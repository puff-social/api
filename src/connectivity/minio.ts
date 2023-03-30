import { S3Client } from "@aws-sdk/client-s3";
import { env } from "../env";

export const minio = new S3Client({
  endpoint: env.MINIO_ENDPOINT,
  forcePathStyle: true,
  region: "none",
  credentials: {
    accessKeyId: env.MINIO_ACCESS_KEY,
    secretAccessKey: env.MINIO_SECRET_KEY,
  },
});