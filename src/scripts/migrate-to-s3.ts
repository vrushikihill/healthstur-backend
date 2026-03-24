import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';

const s3 = new S3Client({
  region: 'auto',
  endpoint: 'https://f81a3b1b4ce50398b783a3e2f315c0a1.r2.cloudflarestorage.com',
  credentials: {
    accessKeyId: '4ecfeeb284981d6ccd49ee7122fc2cdd',
    secretAccessKey:
      '65f51db0054522fcbdc68a9c59357c4879fe5e7606443672c8ecdebab2b855c9',
  },
});

/* eslint-disable no-console */

export async function uploadFile(
  filePath: string,
  bucketName: string,
  key: string,
) {
  const fileContent = fs.readFileSync(filePath);
  const extension = path.extname(filePath).toLowerCase();

  let contentType = 'application/octet-stream';
  if (extension === '.png') contentType = 'image/png';
  else if (extension === '.jpg' || extension === '.jpeg')
    contentType = 'image/jpeg';
  else if (extension === '.svg') contentType = 'image/svg+xml';
  else if (extension === '.webp') contentType = 'image/webp';

  await s3.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: fileContent,
      ContentType: contentType,
    }),
  );
  console.log(`Uploaded: ${key}`);
}
