/* eslint-disable no-console */
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

async function uploadFile(fileAbsPath: string, key: string) {
  const fileContent = fs.readFileSync(fileAbsPath);
  const ext = path.extname(fileAbsPath).toLowerCase();
  let contentType = 'application/octet-stream';
  if (ext === '.png') contentType = 'image/png';
  else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
  else if (ext === '.svg') contentType = 'image/svg+xml';
  else if (ext === '.webp') contentType = 'image/webp';
  else if (ext === '.css') contentType = 'text/css';
  else if (ext === '.js') contentType = 'application/javascript';

  await s3.send(
    new PutObjectCommand({
      Bucket: 'healthstur',
      Key: key,
      Body: fileContent,
      ContentType: contentType,
    }),
  );
  console.log(`Uploaded: ${key}`);
}

async function walk(dir: string, baseDir: string) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      await walk(fullPath, baseDir);
    } else {
      const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      await uploadFile(fullPath, relativePath);
    }
  }
}

async function migrate() {
  const targetDir = path.join(process.cwd(), '..', 'Healthstur-web', 'public');
  console.log('Migrating files from:', targetDir);
  await walk(targetDir, targetDir);
  console.log('All done!');
}

migrate().catch(console.error);
