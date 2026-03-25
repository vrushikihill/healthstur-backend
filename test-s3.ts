/* eslint-disable no-console */
import { uploadImageToS3 } from './src/utils/s3.util';

async function test() {
  try {
    const url = await uploadImageToS3(
      Buffer.from('hello world image data'),
      'test-upload.txt',
      'text/plain',
    );
    console.log('SUCCESS! URL:', url);
  } catch (err) {
    console.error('ERROR UPLOADING TO S3:', err);
  }
}

test();
