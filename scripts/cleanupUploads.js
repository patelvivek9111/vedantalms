const fs = require('fs');
const path = require('path');

/**
 * Cleanup script to remove old or unused files from uploads directory
 * This helps prevent accumulation of test files and failed uploads
 */

const uploadsDir = path.join(__dirname, '..', 'uploads');

// Configuration
const MAX_FILE_AGE_DAYS = 7; // Delete files older than 7 days
const MIN_FILE_SIZE_BYTES = 100; // Delete files smaller than 100 bytes (likely corrupted or empty)

async function cleanupUploads() {
  try {
    console.log('🧹 Starting uploads cleanup...\n');
    
    if (!fs.existsSync(uploadsDir)) {
      console.log('✅ Uploads directory does not exist, nothing to clean');
      return;
    }

    const files = fs.readdirSync(uploadsDir);
    const now = Date.now();
    const maxAge = MAX_FILE_AGE_DAYS * 24 * 60 * 60 * 1000; // Convert days to milliseconds
    
    let deletedCount = 0;
    let keptCount = 0;
    let totalSizeDeleted = 0;

    for (const file of files) {
      const filePath = path.join(uploadsDir, file);
      
      try {
        const stats = fs.statSync(filePath);
        
        // Skip directories
        if (stats.isDirectory()) {
          continue;
        }

        const fileAge = now - stats.mtimeMs;
        const shouldDelete = 
          fileAge > maxAge || // File is older than MAX_FILE_AGE_DAYS
          stats.size < MIN_FILE_SIZE_BYTES; // File is suspiciously small (likely corrupted/empty)

        if (shouldDelete) {
          const reason = fileAge > maxAge 
            ? `older than ${MAX_FILE_AGE_DAYS} days`
            : `too small (${stats.size} bytes)`;
          
          fs.unlinkSync(filePath);
          deletedCount++;
          totalSizeDeleted += stats.size;
          console.log(`  🗑️  Deleted: ${file} (${reason})`);
        } else {
          keptCount++;
        }
      } catch (err) {
        console.error(`  ❌ Error processing ${file}:`, err.message);
      }
    }

    console.log('\n✅ Cleanup completed!');
    console.log(`   Deleted: ${deletedCount} files (${(totalSizeDeleted / 1024).toFixed(2)} KB)`);
    console.log(`   Kept: ${keptCount} files`);
    
  } catch (error) {
    console.error('❌ Cleanup error:', error);
    process.exit(1);
  }
}

// Run cleanup if script is executed directly
if (require.main === module) {
  cleanupUploads()
    .then(() => {
      console.log('\n✨ Done!');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Fatal error:', err);
      process.exit(1);
    });
}

module.exports = { cleanupUploads };

























