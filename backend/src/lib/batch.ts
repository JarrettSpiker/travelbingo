import { BatchWriteCommand } from "@aws-sdk/lib-dynamodb";
import type { Deps } from "../context.ts";
import type { TableKey } from "./keys.ts";

/** DynamoDB's hard limit on items per BatchWriteItem call. */
const BATCH_LIMIT = 25;

/** Retries for unprocessed items, which BatchWriteItem returns under throttling. */
const MAX_ATTEMPTS = 3;

/**
 * Deletes a set of keys, chunked to the service limit. Duplicates are removed
 * first: BatchWriteItem rejects the whole request if one call contains two
 * operations on the same key.
 */
export async function deleteKeys(deps: Deps, keys: TableKey[]): Promise<void> {
  const unique = new Map(keys.map((key) => [`${key.PK} ${key.SK}`, key]));

  for (let start = 0; start < unique.size; start += BATCH_LIMIT) {
    const chunk = [...unique.values()].slice(start, start + BATCH_LIMIT);
    let requests = chunk.map((Key) => ({ DeleteRequest: { Key } }));

    for (let attempt = 0; attempt < MAX_ATTEMPTS && requests.length > 0; attempt += 1) {
      const result: { UnprocessedItems?: Record<string, unknown[]> } = await deps.ddb.send(
        new BatchWriteCommand({ RequestItems: { [deps.tableName]: requests } }),
      );

      requests = (result.UnprocessedItems?.[deps.tableName] ?? []) as typeof requests;
    }

    if (requests.length > 0) {
      throw new Error(`failed to delete ${requests.length} items after ${MAX_ATTEMPTS} attempts`);
    }
  }
}

/**
 * Puts a set of items, chunked to the service limit with the same unprocessed
 * retry as {@link deleteKeys}. The notification fan-out writes through this so
 * its worst case — a winning mark emitting two events to a full fifty-member
 * trip, ~100 items — is four calls rather than a hundred.
 *
 * Unlike deleteKeys this does not dedupe: real DynamoDB rejects a batch
 * containing two operations on the same key, so a caller whose items can carry
 * duplicate PK+SK must dedupe itself. Current callers are safe by construction
 * — fan-out recipients come from unique roster SKs and every item gets a fresh
 * `<ts>#<rand>` sort id — which is why the omission is deliberate, and
 * documented here rather than silent.
 */
export async function putItems(deps: Deps, items: (TableKey & Record<string, unknown>)[]): Promise<void> {
  for (let start = 0; start < items.length; start += BATCH_LIMIT) {
    const chunk = items.slice(start, start + BATCH_LIMIT);
    let requests = chunk.map((Item) => ({ PutRequest: { Item } }));

    for (let attempt = 0; attempt < MAX_ATTEMPTS && requests.length > 0; attempt += 1) {
      const result: { UnprocessedItems?: Record<string, unknown[]> } = await deps.ddb.send(
        new BatchWriteCommand({ RequestItems: { [deps.tableName]: requests } }),
      );

      requests = (result.UnprocessedItems?.[deps.tableName] ?? []) as typeof requests;
    }

    if (requests.length > 0) {
      throw new Error(`failed to put ${requests.length} items after ${MAX_ATTEMPTS} attempts`);
    }
  }
}
