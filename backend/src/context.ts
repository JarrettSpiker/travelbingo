import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { randomBytes as nodeRandomBytes } from "node:crypto";

/**
 * Everything the handlers touch that isn't pure. Injected rather than imported
 * so tests can pass an in-memory fake, a fixed clock, and a deterministic byte
 * source with no mocking library and no new dependency.
 */
export interface Deps {
  ddb: Pick<DynamoDBDocumentClient, "send">;
  tableName: string;
  now: () => string;
  randomBytes: (size: number) => Buffer;
}

let cached: Deps | undefined;

/** Built once per container, not per request. */
export function getDeps(): Deps {
  if (cached) return cached;

  const tableName = process.env.TABLE_NAME;
  if (!tableName) {
    throw new Error("TABLE_NAME is not set");
  }

  cached = {
    ddb: DynamoDBDocumentClient.from(new DynamoDBClient({}), {
      marshallOptions: { removeUndefinedValues: true },
    }),
    tableName,
    now: () => new Date().toISOString(),
    randomBytes: nodeRandomBytes,
  };

  return cached;
}
