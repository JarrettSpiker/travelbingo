import { PutCommand } from "@aws-sdk/lib-dynamodb";
import type { Deps } from "../context.ts";
import { HttpError } from "../http.ts";
import type { TableKey } from "./keys.ts";

/**
 * 16 bytes = 128 bits of entropy, base64url-encoded to 22 characters.
 *
 * Guessing is infeasible at this size, which is why the throttle on the public
 * resolve route is a cost control rather than a secrecy control. The residual
 * risk is leakage — browser history, Referer, shoulder-surfing — handled by
 * Referrer-Policy: no-referrer, Cache-Control: no-store, and the client
 * scrubbing the token from the URL once the snapshot has loaded.
 */
export const TOKEN_BYTES = 16;

export function generateToken(deps: Deps): string {
  return deps.randomBytes(TOKEN_BYTES).toString("base64url");
}

function isConditionFailure(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "ConditionalCheckFailedException" || error.name === "TransactionCanceledException")
  );
}

/**
 * Writes an item under a fresh token, conditional on that token being unused.
 * A collision at 128 bits effectively cannot happen, but the write is
 * conditional anyway — an unconditional put would silently overwrite somebody
 * else's item if it ever did. One retry, then give up loudly.
 *
 * The key shape is supplied by the caller ({@link shareKey} for share links,
 * {@link inviteKey} for trip invites), so the same collision-retried pattern
 * serves both without duplication.
 */
export async function putWithUniqueToken(
  deps: Deps,
  keyFor: (token: string) => TableKey,
  buildItem: (token: string) => Record<string, unknown>,
): Promise<string> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const token = generateToken(deps);

    try {
      await deps.ddb.send(
        new PutCommand({
          TableName: deps.tableName,
          Item: { ...keyFor(token), ...buildItem(token) },
          ConditionExpression: "attribute_not_exists(PK)",
        }),
      );
      return token;
    } catch (error) {
      if (!isConditionFailure(error)) throw error;
    }
  }

  throw new HttpError(503, "token_collision");
}
