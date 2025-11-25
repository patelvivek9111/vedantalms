const cloudinary = require('cloudinary').v2;
const fs = require('fs').promises;
const path = require('path');

// Configure Cloudinary
// Validate configuration before setting
const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

if (cloudName && apiKey && apiSecret) {
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret
  });
} else {
  console.warn('[Cloudinary] Warning: Cloudinary credentials not fully configured. Some features may not work.');
}

/**
 * Upload file to Cloudinary
 * @param {Object} file - Multer file object
 * @param {Object} options - Upload options (folder, resource_type, etc.)
 * @returns {Promise<Object>} Cloudinary upload result
 */
const uploadToCloudinary = async (file, options = {}) => {
  try {
    // Validate Cloudinary is configured
    if (!isCloudinaryConfigured()) {
      throw new Error('Cloudinary is not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET environment variables.');
    }

    // Validate options parameter
    if (options && typeof options !== 'object') {
      throw new Error('Options must be an object');
    }

    // Check if file exists
    if (!file || !file.path) {
      throw new Error('Invalid file object: file.path is missing');
    }

    // Validate file.path is a string
    if (typeof file.path !== 'string' || file.path.trim() === '') {
      throw new Error('Invalid file path');
    }
    
    // Check if file exists on disk
    try {
      await fs.access(file.path);
    } catch (err) {
      throw new Error(`File not found at path: ${file.path}`);
    }
    
    // Default options
    const uploadOptions = {
      folder: options.folder || 'lms',
      resource_type: options.resource_type || 'auto', // 'auto' detects image, video, raw
      use_filename: true,
      unique_filename: true,
      overwrite: false,
      // For raw files (PDFs, documents), ensure they're accessible
      type: 'upload', // Ensure it's an uploaded file, not private
      access_mode: 'public', // Make sure file is publicly accessible
      // For raw files, ensure they're stored and accessible correctly
      ...options
    };
    
    // For raw files, explicitly set access_mode and ensure proper handling
    if (uploadOptions.resource_type === 'raw') {
      uploadOptions.access_mode = 'public';
      // Ensure raw files are stored correctly
      uploadOptions.invalidate = true; // Invalidate CDN cache
      // For raw files, don't use transformations that might cause issues
      uploadOptions.quality = 'auto';
    }

    console.log('[Cloudinary] Uploading file with options:', {
      path: file.path,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      resource_type: uploadOptions.resource_type,
      folder: uploadOptions.folder
    });

    // Upload file
    const result = await cloudinary.uploader.upload(file.path, uploadOptions);
    
    // Validate result
    if (!result || typeof result !== 'object') {
      throw new Error('Invalid response from Cloudinary upload');
    }

    // Use secure_url which is the correct URL format for all resource types
    let fileUrl = result.secure_url;
    
    // Verify the upload was successful and URL is valid
    if (!fileUrl || typeof fileUrl !== 'string' || !fileUrl.startsWith('http')) {
      throw new Error('Invalid URL returned from Cloudinary upload');
    }

    // Validate public_id exists
    if (!result.public_id || typeof result.public_id !== 'string') {
      throw new Error('Invalid public_id returned from Cloudinary upload');
    }
    
    // For raw files, ensure the URL uses the correct format and is publicly accessible
    if (result.resource_type === 'raw') {
      // Ensure the URL uses /raw/upload/ format
      if (!fileUrl.includes('/raw/upload/')) {
        // Reconstruct URL with correct format
        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
        if (!cloudName || typeof cloudName !== 'string') {
          throw new Error('Cloudinary cloud name is not configured');
        }

        const publicId = result.public_id;
        const version = result.version;
        if (!version || typeof version !== 'number') {
          throw new Error('Invalid version returned from Cloudinary');
        }

        const format = result.format || (file.originalname ? path.extname(file.originalname).slice(1) : '');
        if (!format || typeof format !== 'string') {
          throw new Error('Invalid file format');
        }

        fileUrl = `https://res.cloudinary.com/${cloudName}/raw/upload/v${version}/${publicId}.${format}`;
      }
      
      // Verify access_mode is public
      if (result.access_mode !== 'public') {
        console.warn('[Cloudinary] Warning: Raw file access_mode is not public:', result.access_mode);
        // Try to update the access mode
        try {
          await cloudinary.uploader.explicit(result.public_id, {
            type: 'upload',
            resource_type: 'raw',
            access_mode: 'public'
          });
          console.log('[Cloudinary] Updated access_mode to public for:', result.public_id);
        } catch (updateError) {
          console.error('[Cloudinary] Error updating access_mode:', updateError);
        }
      }
    }
    
    console.log('[Cloudinary] Upload successful:', {
      url: fileUrl,
      public_id: result.public_id,
      resource_type: result.resource_type,
      format: result.format,
      bytes: result.bytes,
      version: result.version,
      access_mode: result.access_mode || 'public'
    });
    
    // Delete local file after successful upload
    try {
      await fs.unlink(file.path);
      console.log('[Cloudinary] Local file deleted:', file.path);
    } catch (err) {
      console.error('[Cloudinary] Error deleting local file:', err);
    }

    // Validate return values are valid
    return {
      url: fileUrl,
      public_id: result.public_id,
      format: result.format || null,
      width: result.width || null,
      height: result.height || null,
      bytes: result.bytes || 0,
      resource_type: result.resource_type || 'auto',
      version: result.version || null
    };
  } catch (error) {
    console.error('[Cloudinary] Upload error:', {
      message: error.message,
      stack: error.stack,
      file: file ? { path: file.path, originalname: file.originalname } : 'no file'
    });
    throw error;
  }
};

/**
 * Upload multiple files to Cloudinary
 * @param {Array} files - Array of Multer file objects
 * @param {Object} options - Upload options
 * @returns {Promise<Array>} Array of upload results
 */
const uploadMultipleToCloudinary = async (files, options = {}) => {
  // Validate files parameter
  if (!Array.isArray(files)) {
    throw new Error('Files must be an array');
  }

  if (files.length === 0) {
    return [];
  }

  // Validate options parameter
  if (options && typeof options !== 'object') {
    throw new Error('Options must be an object');
  }

  // Validate each file
  for (const file of files) {
    if (!file || !file.path) {
      throw new Error('Invalid file object in array: file.path is missing');
    }
  }

  const uploadPromises = files.map(file => uploadToCloudinary(file, options));
  return Promise.all(uploadPromises);
};

/**
 * Delete file from Cloudinary
 * @param {String} publicId - Cloudinary public_id
 * @param {String} resourceType - Resource type (image, video, raw)
 * @returns {Promise<Object>} Deletion result
 */
const deleteFromCloudinary = async (publicId, resourceType = 'image') => {
  try {
    // Validate Cloudinary is configured
    if (!isCloudinaryConfigured()) {
      throw new Error('Cloudinary is not configured');
    }

    // Validate publicId
    if (!publicId || typeof publicId !== 'string' || publicId.trim() === '') {
      throw new Error('Invalid public ID: must be a non-empty string');
    }

    // Validate resourceType
    const validResourceTypes = ['image', 'video', 'raw'];
    if (!validResourceTypes.includes(resourceType)) {
      throw new Error(`Invalid resource type. Must be one of: ${validResourceTypes.join(', ')}`);
    }

    // Sanitize publicId to prevent injection
    const sanitizedPublicId = publicId.trim().replace(/[^a-zA-Z0-9._/-]/g, '');
    if (sanitizedPublicId !== publicId.trim()) {
      throw new Error('Invalid characters in public ID');
    }

    const result = await cloudinary.uploader.destroy(sanitizedPublicId, {
      resource_type: resourceType
    });

    // Validate result
    if (!result || typeof result !== 'object') {
      throw new Error('Invalid response from Cloudinary delete');
    }

    return result;
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    throw error;
  }
};

/**
 * Extract public_id from Cloudinary URL
 * @param {String} url - Cloudinary URL
 * @returns {String|null} Public ID or null
 */
const extractPublicId = (url) => {
  // Validate input
  if (!url || typeof url !== 'string' || url.trim() === '') {
    return null;
  }

  // Validate URL format (must be Cloudinary URL)
  if (!url.includes('cloudinary.com')) {
    return null;
  }

  // Limit URL length to prevent ReDoS
  if (url.length > 500) {
    console.warn('[Cloudinary] URL too long, skipping extraction');
    return null;
  }
  
  // Cloudinary URL format: https://res.cloudinary.com/{cloud_name}/{resource_type}/upload/v{version}/{public_id}.{format}
  // Handle both /image/upload/, /video/upload/, and /raw/upload/ formats
  const match = url.match(/\/v\d+\/(.+?)(?:\.(jpg|jpeg|png|gif|pdf|doc|docx|xls|xlsx|txt|csv|zip|rar|mp4|mov|avi))?$/i);
  if (match && match[1]) {
    const publicId = match[1];
    // Validate extracted publicId is reasonable length
    if (publicId.length > 200) {
      return null;
    }
    return publicId;
  }
  
  // Try alternative format without version number
  const altMatch = url.match(/\/(image|video|raw)\/upload\/(.+?)(?:\.(jpg|jpeg|png|gif|pdf|doc|docx|xls|xlsx|txt|csv|zip|rar|mp4|mov|avi))?$/i);
  if (altMatch && altMatch[2]) {
    const publicId = altMatch[2];
    // Validate extracted publicId is reasonable length
    if (publicId.length > 200) {
      return null;
    }
    return publicId;
  }
  
  // Try to extract from path format (folder structure)
  const pathMatch = url.match(/\/lms\/(.+?)(?:\.(jpg|jpeg|png|gif|pdf|doc|docx|xls|xlsx|txt|csv|zip|rar|mp4|mov|avi))?$/i);
  if (pathMatch && pathMatch[1]) {
    const publicId = `lms/${pathMatch[1]}`;
    // Validate extracted publicId is reasonable length
    if (publicId.length > 200) {
      return null;
    }
    return publicId;
  }
  
  return null;
};

/**
 * Check if Cloudinary is configured
 * @returns {Boolean}
 */
const isCloudinaryConfigured = () => {
  return !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
};

module.exports = {
  uploadToCloudinary,
  uploadMultipleToCloudinary,
  deleteFromCloudinary,
  extractPublicId,
  isCloudinaryConfigured,
  cloudinary
};

