import { PutObjectCommand, DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { Env } from '../config/env.js';

export type StoredObject = { key: string };

/**
 * Scan images go to object storage rather than the database: they are large,
 * write-once, and subject to a retention policy that is far easier to enforce
 * with a lifecycle rule than with a delete job.
 */
export interface ObjectStorage {
  put(key: string, body: Buffer, contentType: string): Promise<StoredObject>;
  delete(key: string): Promise<void>;
}

class S3Storage implements ObjectStorage {
  private readonly client: S3Client;

  constructor(
    private readonly bucket: string,
    endpoint: string | undefined,
    region: string,
    accessKeyId: string,
    secretAccessKey: string,
  ) {
    this.client = new S3Client({
      region,
      ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  async put(key: string, body: Buffer, contentType: string): Promise<StoredObject> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    );
    return { key };
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}

/**
 * Used when no bucket is configured. Scanning still works end to end — the
 * vision call receives the image directly — it just keeps no reference copy, so
 * local development does not require object storage credentials.
 */
class NoopStorage implements ObjectStorage {
  async put(key: string): Promise<StoredObject> {
    return { key };
  }

  async delete(): Promise<void> {}
}

export function createObjectStorage(env: Env): ObjectStorage {
  if (!env.S3_BUCKET || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) {
    return new NoopStorage();
  }

  return new S3Storage(
    env.S3_BUCKET,
    env.S3_ENDPOINT,
    env.S3_REGION,
    env.S3_ACCESS_KEY_ID,
    env.S3_SECRET_ACCESS_KEY,
  );
}
