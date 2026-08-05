import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// The thumbnail object key is derived deterministically from the card id, so a
// re-save overwrites the same object and a delete always knows where to look.
// Its presence on a card record (thumbnailKey) is what distinguishes a card
// that has a thumbnail from a legacy card that predates the feature.
export function thumbnailKeyFor(cardId: string): string {
  return `${cardId}.png`;
}

/**
 * Short-lived by requirement: a presigned URL leaks the object to anyone who
 * holds it within its window. Five minutes is long enough for a library render
 * (and a reload mints fresh ones) while keeping the exposure window tight.
 */
export const THUMBNAIL_URL_TTL_SECONDS = 300;

export interface ThumbnailStore {
  /** Writes (or overwrites) a thumbnail object. ContentType is pinned to PNG. */
  put(key: string, bytes: Buffer): Promise<void>;
  /** Deletes a thumbnail object, tolerating an already-missing one. */
  delete(key: string): Promise<void>;
  /** Mints a short-lived presigned GET URL. Signing is local (no network). */
  presignGet(key: string): Promise<string>;
}

/**
 * Builds the production store from the AWS SDK. The S3 client is created once
 * per container; getSignedUrl computes the signature locally using SigV4, so
 * presignGet makes no network call and N presigns on the list path stay cheap.
 */
export function createThumbnailStore(bucket: string, region: string): ThumbnailStore {
  const s3 = new S3Client({ region });

  return {
    async put(key, bytes) {
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: bytes,
          ContentType: "image/png",
        }),
      );
    },
    async delete(key) {
      // S3 DeleteObject is idempotent: deleting a non-existent object returns
      // 204, not an error, so an already-missing thumbnail needs no special
      // handling here.
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
    async presignGet(key) {
      return getSignedUrl(
        s3,
        new GetObjectCommand({ Bucket: bucket, Key: key }),
        { expiresIn: THUMBNAIL_URL_TTL_SECONDS },
      );
    },
  };
}
