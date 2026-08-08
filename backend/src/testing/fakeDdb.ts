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

      case "UpdateCommand":
        this.applyUpdate(input);
        return {};

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

    // If a page size is set, truncate and hand back a LastEvaluatedKey whenever
    // more items remain — the signal DynamoDB gives at a page boundary, which
    // callers must loop on. Without this knob the fake returns everything at
    // once and a broken pagination loop would look like a passing test.
    const pageSize = this.queryPageSize;
    if (pageSize !== undefined && pageSize > 0 && matches.length > pageSize) {
      const truncated = matches.slice(0, pageSize);
      const last = truncated[truncated.length - 1];
      return last
        ? { Items: truncated, LastEvaluatedKey: { PK: String(last.PK), SK: String(last.SK) } }
        : { Items: truncated };
    }

    return { Items: matches };
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

  /** Evaluates the subset of condition expressions this codebase uses. */
  private checkCondition(action: Record<string, any>): void {
    const exists = this.items.has(itemKey(action.Key.PK, action.Key.SK));
    const expression: string = action.ConditionExpression;

    if (expression === "attribute_exists(PK)") {
      if (!exists) {
        const error = new Error("Transaction cancelled");
        error.name = "TransactionCanceledException";
        throw error;
      }
      return;
    }

    throw new Error(`FakeDdb: unsupported condition ${expression}`);
  }

  private applyUpdate(update: Record<string, any>): void {
    const key = itemKey(update.Key.PK, update.Key.SK);
    const existing = this.items.get(key);
    if (!existing) {
      throw new Error("FakeDdb: update on a missing item");
    }

    const expression: string = update.UpdateExpression.trim();
    const names = update.ExpressionAttributeNames ?? {};
    const values = update.ExpressionAttributeValues ?? {};

    // DynamoDB update expressions are a sequence of clauses (SET, REMOVE, ADD,
    // DELETE). This fake implements the SET and REMOVE subset the codebase
    // uses — including a combined "SET ... REMOVE ..." — and throws on anything
    // else, so a broken expression surfaces as a failing test rather than a
    // silent no-op.
    const setMatch = /(?:^|\s)SET\s+(.+?)(?=\s+REMOVE\b|$)/.exec(expression);
    const removeMatch = /(?:^|\s)REMOVE\s+(.+?)(?=\s+SET\b|$)/.exec(expression);

    if (setMatch?.[1]) {
      for (const assignment of setMatch[1].split(",")) {
        const parts = assignment.split("=");
        if (parts.length !== 2 || !parts[0] || !parts[1]) {
          throw new Error(`FakeDdb: unsupported assignment ${assignment}`);
        }
        const nameToken = parts[0].trim();
        const valueToken = parts[1].trim();
        const attribute = nameToken.startsWith("#") ? names[nameToken] : nameToken;
        existing[attribute] = values[valueToken];
      }
    }

    if (removeMatch?.[1]) {
      for (const nameToken of removeMatch[1].split(",")) {
        const token = nameToken.trim();
        if (!token) continue;
        const attribute = token.startsWith("#") ? names[token] : token;
        delete existing[attribute];
      }
    }

    if (!setMatch?.[1] && !removeMatch?.[1]) {
      throw new Error(`FakeDdb: unsupported update expression ${expression}`);
    }

    this.items.set(key, existing);
  }
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
