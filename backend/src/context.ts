import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { randomBytes as nodeRandomBytes } from "node:crypto";
import { createThumbnailStore, type ThumbnailStore } from "./lib/thumbnailStore.ts";

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
  /**
   * Owner-private thumbnail object storage. The store encapsulates the bucket
   * name and region; routes ask for a key derived from the card id and never
   * assemble S3 locations themselves.
   */
  thumbnailStore: ThumbnailStore;
}

let cached: Deps | undefined;

/** Built once per container, not per request. */
export function getDeps(): Deps {
  if (cached) return cached;

  const tableName = process.env.TABLE_NAME;
  if (!tableName) {
    throw new Error("TABLE_NAME is not set");
  }

  const thumbnailBucket = process.env.THUMBNAIL_BUCKET_NAME;
  if (!thumbnailBucket) {
    throw new Error("THUMBNAIL_BUCKET_NAME is not set");
  }

  // AWS_REGION is set implicitly by the Lambda runtime and is what the S3 client
  // and presigner use to build the regional endpoint for presigned GET URLs.
  const region = process.env.AWS_REGION;
  if (!region) {
    throw new Error("AWS_REGION is not set");
  }

  cached = {
    ddb: DynamoDBDocumentClient.from(new DynamoDBClient({}), {
      marshallOptions: { removeUndefinedValues: true },
    }),
    tableName,
    now: () => new Date().toISOString(),
    randomBytes: nodeRandomBytes,
    thumbnailStore: createThumbnailStore(thumbnailBucket, region),
  };

  return cached;
}
