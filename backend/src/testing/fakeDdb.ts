import type { Deps } from "../context.ts";
import type { ThumbnailStore } from "../lib/thumbnailStore.ts";

// A small in-memory stand-in for DynamoDBDocumentClient, so handlers can be
// tested without a mocking library or a new dependency — matching the repo's
// existing "pure and testable" convention.
//
// It supports exactly the expression subset this codebase uses and throws on
// anything else. That is deliberate: a fake that quietly accepted an expression
// it did not implement would make a broken query look like a passing test.

type Item = Record<string, unknown>;

interface AnyCommand {
  constructor: { name: string };
  input: Record<string, any>;
}

function itemKey(pk: unknown, sk: unknown): string {
  return `${String(pk)} ${String(sk)}`;
}

export class FakeDdb {
  readonly items = new Map<string, Item>();

  /** Number of send() calls, so tests can assert there is no N+1. */
  sendCount = 0;

  /**
   * When set, Query responses are capped at this many items per page and a
   * LastEvaluatedKey is returned when more remain — so tests can exercise code
   * that loops across pages. Unset by default, matching DynamoDB's "everything
   * that fits in 1 MB" only in that a single page holds the whole set.
   */
  queryPageSize?: number;

  seed(item: Item): void {
    this.items.set(itemKey(item.PK, item.SK), { ...item });
  }

  get(pk: string, sk: string): Item | undefined {
    return this.items.get(itemKey(pk, sk));
  }

  async send(command: AnyCommand): Promise<any> {
    this.sendCount += 1;
    const name = command.constructor.name;
    const input = command.input;

    switch (name) {
      case "GetCommand":
        return { Item: this.items.get(itemKey(input.Key.PK, input.Key.SK)) };

      case "PutCommand":
        this.applyPut(input);
        return {};

      case "DeleteCommand":
        this.items.delete(itemKey(input.Key.PK, input.Key.SK));
        return {};

      case "QueryCommand":
        return this.runQuery(input);

      case "UpdateCommand": {
        const updated = this.applyUpdate(input);
        // Only ALL_NEW is used, and only by the marking path. Anything else is
        // rejected rather than silently answered with the wrong projection.
        if (input.ReturnValues === undefined) return {};
        if (input.ReturnValues !== "ALL_NEW") {
          throw new Error(`FakeDdb: unsupported ReturnValues ${input.ReturnValues}`);
        }
        return { Attributes: { ...updated } };
      }

      case "TransactWriteCommand":
        return this.runTransaction(input);

      case "BatchWriteCommand": {
        const requests = Object.values(input.RequestItems)[0] as any[];
        for (const request of requests) {
          if (request.DeleteRequest) {
            const key = request.DeleteRequest.Key;
            this.items.delete(itemKey(key.PK, key.SK));
          } else if (request.PutRequest) {
            this.applyPut({ Item: request.PutRequest.Item });
          } else {
            throw new Error(`FakeDdb: unsupported batch request ${JSON.stringify(request)}`);
          }
        }
        return { UnprocessedItems: {} };
      }

      case "BatchGetCommand": {
        const [tableName, req] = Object.entries(input.RequestItems)[0] as [string, { Keys: Item[] }];
        const items = (req.Keys as Item[])
          .map((k) => this.items.get(itemKey(k.PK, k.SK)))
          .filter((x): x is Item => x !== undefined);
        return { Responses: { [tableName]: items }, UnprocessedKeys: {} };
      }

      default:
        throw new Error(`FakeDdb: unsupported command ${name}`);
    }
  }

  private applyPut(input: Record<string, any>): void {
    const item = input.Item as Item;
    const key = itemKey(item.PK, item.SK);

    if (input.ConditionExpression) {
      if (input.ConditionExpression !== "attribute_not_exists(PK)") {
        throw new Error(`FakeDdb: unsupported condition ${input.ConditionExpression}`);
      }
      if (this.items.has(key)) {
        const error = new Error("The conditional request failed");
        error.name = "ConditionalCheckFailedException";
        throw error;
      }
    }

    this.items.set(key, { ...item });
  }

  private runQuery(input: Record<string, any>): {
    Items: Item[];
    LastEvaluatedKey?: { PK: string; SK: string };
  } {
    const expression: string = input.KeyConditionExpression;
    const values = input.ExpressionAttributeValues ?? {};

    const pkMatch = /PK = (:\w+)/.exec(expression);
    if (!pkMatch?.[1]) {
      throw new Error(`FakeDdb: unsupported key condition ${expression}`);
    }
    const pk = String(values[pkMatch[1]]);

    const beginsMatch = /begins_with\(SK, (:\w+)\)/.exec(expression);
    const prefix = beginsMatch?.[1] ? String(values[beginsMatch[1]]) : null;

    let matches = [...this.items.values()].filter((item) => {
      if (item.PK !== pk) return false;
      return prefix === null || String(item.SK).startsWith(prefix);
    });

    matches.sort((a, b) => String(a.SK).localeCompare(String(b.SK)));

    // Honor ExclusiveStartKey (exclusive): resume strictly after the last key
    // returned on the previous page.
    const start = input.ExclusiveStartKey as { PK: string; SK: string } | undefined;
    if (start) {
      const startIdx = matches.findIndex(
        (it) => String(it.PK) === start.PK && String(it.SK) === start.SK,
      );
      matches = startIdx >= 0 ? matches.slice(startIdx + 1) : [];
    }

    // A ProjectionExpression narrows what comes back. Honored rather than
    // ignored: the progress poll exists precisely so it does *not* return
    // snapshots, and a fake that returned them anyway would let that regress
    // while the test still passed. Applied at the return, after the page key is
    // taken from the full item — the real service always returns a complete key
    // in LastEvaluatedKey, whatever the projection drops.
    const project = (items: Item[]): Item[] => {
      const expressionText: string | undefined = input.ProjectionExpression;
      if (!expressionText) return items;

      const names = input.ExpressionAttributeNames ?? {};
      const attributes = expressionText.split(",").map((token) => {
        const trimmed = token.trim();
        if (!trimmed.startsWith("#")) return trimmed;
        const resolved = names[trimmed];
        if (!resolved) throw new Error(`FakeDdb: unbound projection name ${trimmed}`);
        return String(resolved);
      });

      return items.map((item) => {
        const projected: Item = {};
        for (const attribute of attributes) {
          if (attribute in item) projected[attribute] = item[attribute];
        }
        return projected;
      });
    };

    // If a page size is set, truncate and hand back a LastEvaluatedKey whenever
    // more items remain — the signal DynamoDB gives at a page boundary, which
    // callers must loop on. Without this knob the fake returns everything at
    // once and a broken pagination loop would look like a passing test.
    const pageSize = this.queryPageSize;
    if (pageSize !== undefined && pageSize > 0 && matches.length > pageSize) {
      const truncated = matches.slice(0, pageSize);
      const last = truncated[truncated.length - 1];
      return last
        ? { Items: project(truncated), LastEvaluatedKey: { PK: String(last.PK), SK: String(last.SK) } }
        : { Items: project(truncated) };
    }

    return { Items: project(matches) };
  }

  private runTransaction(input: Record<string, any>): Record<string, never> {
    // Validate every action before applying any, so a failed transaction leaves
    // no partial write behind — the property the real service guarantees.
    const actions = input.TransactItems as any[];

    for (const action of actions) {
      if (action.Put?.ConditionExpression === "attribute_not_exists(PK)") {
        const item = action.Put.Item;
        if (this.items.has(itemKey(item.PK, item.SK))) {
          const error = new Error("Transaction cancelled");
          error.name = "TransactionCanceledException";
          throw error;
        }
      }
      // ConditionCheck lets a transaction assert (or refuse) on another item's
      // state — used by removeMember to refuse a write that would strand a trip
      // with no administrator. Validated up front with the Put conditions so a
      // failed check cancels the whole transaction.
      if (action.ConditionCheck) {
        this.checkCondition(action.ConditionCheck);
      }
    }

    for (const action of actions) {
      if (action.Put) {
        const item = action.Put.Item as Item;
        this.items.set(itemKey(item.PK, item.SK), { ...item });
      } else if (action.Delete) {
        const key = action.Delete.Key;
        this.items.delete(itemKey(key.PK, key.SK));
      } else if (action.Update) {
        this.applyUpdate(action.Update);
      } else if (action.ConditionCheck) {
        // No-op: already validated above.
      } else {
        throw new Error(`FakeDdb: unsupported transaction action ${JSON.stringify(action)}`);
      }
    }

    return {};
  }

  /**
   * Evaluates the subset of condition expressions this codebase uses.
   *
   * `failure` names the exception the real service raises, which differs by
   * caller: a cancelled transaction reports `TransactionCanceledException`, a
   * conditional single-item write reports `ConditionalCheckFailedException`.
   */
  private checkCondition(
    action: Record<string, any>,
    failure: "TransactionCanceledException" | "ConditionalCheckFailedException" = "TransactionCanceledException",
  ): void {
    const exists = this.items.has(itemKey(action.Key.PK, action.Key.SK));
    const expression: string = action.ConditionExpression;

    if (expression === "attribute_exists(PK)") {
      if (!exists) {
        const error = new Error(
          failure === "TransactionCanceledException" ? "Transaction cancelled" : "The conditional request failed",
        );
        error.name = failure;
        throw error;
      }
      return;
    }

    throw new Error(`FakeDdb: unsupported condition ${expression}`);
  }

  private applyUpdate(update: Record<string, any>): Item {
    const key = itemKey(update.Key.PK, update.Key.SK);

    // UpdateItem is an upsert: a missing item is *created*, carrying only its
    // key plus whatever the expression sets. This fake used to throw here
    // instead, which made every "a deleted row stays deleted" test pass against
    // behaviour the service does not have. Model the service; let the callers
    // that need "only if it exists" say so with a condition.
    const existing: Item = this.items.get(key) ?? { PK: update.Key.PK, SK: update.Key.SK };

    if (update.ConditionExpression) {
      this.checkCondition(
        { Key: update.Key, ConditionExpression: update.ConditionExpression },
        "ConditionalCheckFailedException",
      );
    }

    const expression: string = update.UpdateExpression.trim();
    const names = update.ExpressionAttributeNames ?? {};
    const values = update.ExpressionAttributeValues ?? {};

    // DynamoDB update expressions are a sequence of clauses (SET, REMOVE, ADD,
    // DELETE), which may appear in any order but at most once each. This fake
    // implements the subset the codebase uses and throws on anything else, so a
    // broken expression surfaces as a failing test rather than a silent no-op.
    const clauses = splitClauses(expression);

    // An unbound `#name` is a ValidationException from the real service, so it
    // must not quietly become an attribute literally called "#typo" here. The
    // projection path already throws on this; the two agree.
    const resolve = (token: string): string => {
      if (!token.startsWith("#")) return token;
      const resolved = names[token];
      if (!resolved) throw new Error(`FakeDdb: unbound name ${token}`);
      return String(resolved);
    };

    if (clauses.SET) {
      for (const assignment of clauses.SET.split(",")) {
        const parts = assignment.split("=");
        if (parts.length !== 2 || !parts[0] || !parts[1]) {
          throw new Error(`FakeDdb: unsupported assignment ${assignment}`);
        }
        existing[resolve(parts[0].trim())] = values[parts[1].trim()];
      }
    }

    if (clauses.REMOVE) {
      for (const nameToken of clauses.REMOVE.split(",")) {
        const token = nameToken.trim();
        if (!token) continue;
        delete existing[resolve(token)];
      }
    }

    // ADD and DELETE are implemented for number sets only — the one use is the
    // per-square marking path, where set semantics are what make two members
    // marking at once safe. Numeric ADD (the counter form) is deliberately not
    // implemented, so reaching for it fails loudly instead of half-working.
    if (clauses.ADD) {
      for (const [attribute, value] of setOperands(clauses.ADD, resolve, values)) {
        const current = existing[attribute];
        const next = current instanceof Set ? new Set(current) : new Set();
        for (const member of value) next.add(member);
        existing[attribute] = next;
      }
    }

    if (clauses.DELETE) {
      for (const [attribute, value] of setOperands(clauses.DELETE, resolve, values)) {
        const current = existing[attribute];
        if (!(current instanceof Set)) continue;
        const next = new Set(current);
        for (const member of value) next.delete(member);
        // A DynamoDB set cannot be empty: removing the last member removes the
        // attribute. Readers must treat absent and empty identically, and this
        // is where that becomes true in tests.
        if (next.size === 0) delete existing[attribute];
        else existing[attribute] = next;
      }
    }

    if (!clauses.SET && !clauses.REMOVE && !clauses.ADD && !clauses.DELETE) {
      throw new Error(`FakeDdb: unsupported update expression ${expression}`);
    }

    this.items.set(key, existing);
    return existing;
  }
}

type ClauseName = "SET" | "REMOVE" | "ADD" | "DELETE";

/** Splits an update expression into its clauses, in whatever order they appear. */
function splitClauses(expression: string): Partial<Record<ClauseName, string>> {
  const keywords: ClauseName[] = ["SET", "REMOVE", "ADD", "DELETE"];
  const boundaries = [...expression.matchAll(/(?:^|\s)(SET|REMOVE|ADD|DELETE)\s/g)].map((match) => ({
    name: match[1] as ClauseName,
    start: match.index + match[0].length,
    keywordAt: match.index,
  }));

  const clauses: Partial<Record<ClauseName, string>> = {};
  for (const [i, boundary] of boundaries.entries()) {
    const end = boundaries[i + 1]?.keywordAt ?? expression.length;
    if (clauses[boundary.name] !== undefined) {
      throw new Error(`FakeDdb: repeated ${boundary.name} clause in ${expression}`);
    }
    clauses[boundary.name] = expression.slice(boundary.start, end).trim();
  }

  if (boundaries.length === 0 && keywords.some((k) => expression.includes(k))) {
    throw new Error(`FakeDdb: unsupported update expression ${expression}`);
  }
  return clauses;
}

/** Parses `#name :value, #other :value` operand pairs, requiring a Set value. */
function setOperands(
  clause: string,
  resolve: (token: string) => string,
  values: Record<string, unknown>,
): [string, Set<unknown>][] {
  return clause.split(",").map((operand) => {
    const parts = operand.trim().split(/\s+/);
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      throw new Error(`FakeDdb: unsupported set operand ${operand}`);
    }
    const value = values[parts[1]];
    if (!(value instanceof Set)) {
      throw new Error(`FakeDdb: ADD/DELETE is implemented for sets only, got ${String(value)}`);
    }
    return [resolve(parts[0]), value];
  });
}

export interface TestDeps extends Deps {
  ddb: FakeDdb;
}

/** Deterministic clock and byte source, so assertions are exact. */
export function makeTestDeps(overrides: Partial<Deps> = {}): TestDeps {
  const fake = new FakeDdb();
  let counter = 0;

  return {
    ddb: fake,
    tableName: "test-table",
    now: () => "2026-08-02T00:00:00.000Z",
    randomBytes: (size: number) => {
      counter += 1;
      return Buffer.alloc(size, counter);
    },
    thumbnailStore: makeFakeThumbnailStore(),
    ...overrides,
    // Keep the fake reachable even when callers override other fields.
    ...(overrides.ddb ? {} : { ddb: fake }),
  } as TestDeps;
}

/**
 * In-memory thumbnail store for tests. Records every operation so tests can
 * assert a thumbnail was written, deleted, or presigned — without an S3 mock.
 */
export function makeFakeThumbnailStore(): ThumbnailStore & {
  objects: Map<string, Buffer>;
  presigned: string[];
  puts: number;
  deletes: number;
} {
  const objects = new Map<string, Buffer>();
  const presigned: string[] = [];
  const counts = { puts: 0, deletes: 0 };

  return {
    objects,
    presigned,
    get puts() {
      return counts.puts;
    },
    get deletes() {
      return counts.deletes;
    },
    async put(key, bytes) {
      counts.puts += 1;
      objects.set(key, Buffer.from(bytes));
    },
    async delete(key) {
      counts.deletes += 1;
      objects.delete(key);
    },
    async presignGet(key) {
      const url = `https://example.test/${encodeURIComponent(key)}?sig=${presigned.length}`;
      presigned.push(url);
      return url;
    },
  };
}
