/**
 * Script to fix Cloudinary access issues
 * This script can be used to verify or update Cloudinary configuration
 */

const dotenv = require('dotenv');
dotenv.config();

const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

async function testCloudinaryConnection() {
  try {
    console.log('Testing Cloudinary connection...');
    
    // Test connection by listing resources
    const result = await cloudinary.api.ping();
    
    if (result.status === 'ok') {
      console.log('✅ Cloudinary connection successful!');
      console.log('Cloud Name:', process.env.CLOUDINARY_CLOUD_NAME);
      return true;
    } else {
      console.error('❌ Cloudinary connection failed:', result);
      return false;
    }
  } catch (error) {
    console.error('❌ Error testing Cloudinary connection:', error.message);
    console.error('\nPlease check your Cloudinary credentials in .env file:');
    console.error('  - CLOUDINARY_CLOUD_NAME');
    console.error('  - CLOUDINARY_API_KEY');
    console.error('  - CLOUDINARY_API_SECRET');
    return false;
  }
}

// Run if called directly
if (require.main === module) {
  testCloudinaryConnection()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Unexpected error:', error);
      process.exit(1);
    });
}

module.exports = { testCloudinaryConnection };

