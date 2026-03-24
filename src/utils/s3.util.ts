/* eslint-disable no-console */
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import { extname } from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const s3 = new S3Client({
  region: 'auto',
  endpoint: 'https://f81a3b1b4ce50398b783a3e2f315c0a1.r2.cloudflarestorage.com',
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
});

/**
 * Uploads a file buffer to Cloudflare R2 (S3 compatible)
 */
export async function uploadImageToS3(
  fileBuffer: Buffer,
  originalName: string,
  contentType: string,
): Promise<string> {
  const fileName = uuidv4() + extname(originalName);
  const bucketName = process.env.R2_BUCKET_NAME || 'healthstur';

  console.log(`Uploading ${fileName} to bucket ${bucketName}...`);

  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: fileName,
        Body: fileBuffer,
        ContentType: contentType,
      }),
    );

    const publicDomain =
      process.env.R2_PUBLIC_DOMAIN ||
      'https://pub-b15ba39a844442478b781f47b6e00e99.r2.dev';
    const cleanDomain = publicDomain.endsWith('/')
      ? publicDomain.slice(0, -1)
      : publicDomain;

    const url = `${cleanDomain}/${fileName}`;
    console.log(`Upload successful. Public URL: ${url}`);
    return url;
  } catch (error) {
    console.error('S3 Upload Error:', error);
    throw error;
  }
}
