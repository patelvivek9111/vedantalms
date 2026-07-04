/**
 * One-shot Cloudinary connectivity check. Reads credentials from env — never commit secrets.
 *
 * Usage:
 *   CLOUDINARY_CLOUD_NAME=... CLOUDINARY_API_KEY=... CLOUDINARY_API_SECRET=... node scripts/verifyCloudinarySetup.js
 */
const cloudinary = require('cloudinary').v2;

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

if (!cloudName || !apiKey || !apiSecret) {
  console.error('Missing CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, or CLOUDINARY_API_SECRET');
  process.exit(1);
}

cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });

const DEMO_IMAGE =
  'https://res.cloudinary.com/demo/image/upload/sample.jpg';

async function main() {
  console.log('Uploading demo image to your Cloudinary account...');
  const upload = await cloudinary.uploader.upload(DEMO_IMAGE, {
    folder: 'lms/verify-setup',
    use_filename: true,
    unique_filename: true,
  });

  console.log('Upload secure URL:', upload.secure_url);
  console.log('Public ID:', upload.public_id);

  const details = await cloudinary.api.resource(upload.public_id);
  console.log('Width:', details.width);
  console.log('Height:', details.height);
  console.log('Format:', details.format);
  console.log('Bytes:', details.bytes);

  // f_auto = best format for browser; q_auto = optimized quality/size tradeoff
  const transformed = cloudinary.url(upload.public_id, {
    fetch_format: 'auto',
    quality: 'auto',
    secure: true,
  });
  console.log(
    '\nDone! Open this link to see the optimized version (check size and format in browser/devtools):'
  );
  console.log(transformed);
}

main().catch((err) => {
  console.error('Cloudinary verification failed:', err.message || err);
  process.exit(1);
});
