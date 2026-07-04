const cloudinary = require('cloudinary').v2;
const fs = require('fs').promises;
const path = require('path');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Upload file to Cloudinary
 * @param {Object} file - Multer file object
 * @param {Object} options - Upload options (folder, resource_type, etc.)
 * @returns {Promise<Object>} Cloudinary upload result
 */
const uploadToCloudinary = async (file, options = {}) => {
  try {
    // Default options
    const uploadOptions = {
      folder: options.folder || 'lms',
      resource_type: options.resource_type || 'auto', // 'auto' detects image, video, raw
      use_filename: true,
      unique_filename: true,
      overwrite: false,
      ...options
    };

    let result;
    if (file.path) {
      result = await cloudinary.uploader.upload(file.path, uploadOptions);
      // Delete local file after successful upload
      try {
        await fs.unlink(file.path);
      } catch (err) {
        console.error('Error deleting local file:', err);
      }
    } else if (file.buffer) {
      result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(uploadOptions, (err, uploadResult) => {
          if (err) return reject(err);
          resolve(uploadResult);
        });
        stream.end(file.buffer);
      });
    } else {
      throw new Error('Unsupported upload file payload');
    }

    return {
      url: result.secure_url,
      public_id: result.public_id,
      format: result.format,
      width: result.width,
      height: result.height,
      bytes: result.bytes,
      resource_type: result.resource_type
    };
  } catch (error) {
    console.error('Cloudinary upload error:', error);
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
  const uploadPromises = files.map(file => uploadToCloudinary(file, options));
  return Promise.all(uploadPromises);
};

const uploadBufferToCloudinary = async (buffer, options = {}) => {
  const uploadOptions = {
    folder: options.folder || 'lms',
    resource_type: options.resource_type || 'auto',
    overwrite: options.overwrite !== false,
    ...options,
  };
  if (options.public_id) {
    uploadOptions.public_id = options.public_id;
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(uploadOptions, (err, result) => {
      if (err) return reject(err);
      resolve({
        url: result.secure_url,
        public_id: result.public_id,
        format: result.format,
        bytes: result.bytes,
        resource_type: result.resource_type,
      });
    });
    stream.end(buffer);
  });
};

/**
 * Delete all preview artifacts for a file asset from Cloudinary.
 */
const deletePreviewFolder = async (fileAssetId) => {
  if (!isCloudinaryConfigured() || !fileAssetId) return;
  try {
    await cloudinary.api.delete_resources_by_prefix(`lms/previews/${fileAssetId}`, {
      resource_type: 'image',
    });
    await cloudinary.api.delete_resources_by_prefix(`lms/previews/${fileAssetId}`, {
      resource_type: 'raw',
    });
    await cloudinary.api.delete_resources_by_prefix(`lms/previews/${fileAssetId}`, {
      resource_type: 'video',
    });
  } catch (error) {
    console.warn('Cloudinary preview cleanup warning:', error.message);
  }
};

/**
 * Delete file from Cloudinary
 * @param {String} publicId - Cloudinary public_id
 * @param {String} resourceType - Resource type (image, video, raw)
 * @returns {Promise<Object>} Deletion result
 */
const deleteFromCloudinary = async (publicId, resourceType = 'auto') => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType
    });
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
/**
 * Cloudinary signed URLs must use a concrete resource type (image/raw/video), not "auto".
 */
function inferResourceTypeFromUrl(url, fallback = 'image') {
  if (!url || typeof url !== 'string') return fallback;
  if (/\/video\/upload\//.test(url)) return 'video';
  if (/\/raw\/upload\//.test(url)) return 'raw';
  if (/\/image\/upload\//.test(url)) return 'image';
  return fallback;
}

const extractPublicId = (url) => {
  if (!url || typeof url !== 'string') return null;
  const clean = url.split('?')[0].split('#')[0];

  const versionWithExt = clean.match(/\/v\d+\/(.+)\.[a-z0-9]+$/i);
  if (versionWithExt?.[1]) return versionWithExt[1];

  const versionNoExt = clean.match(/\/v\d+\/(.+)$/i);
  if (versionNoExt?.[1]) return versionNoExt[1];

  const pathMatch = clean.match(/\/lms\/(.+)$/i);
  if (pathMatch?.[1]) {
    return `lms/${pathMatch[1].replace(/\.[a-z0-9]+$/i, '')}`;
  }

  return null;
};

function getSignedCloudinaryUrl(url, { download = true, resourceType = 'auto' } = {}) {
  if (!url || !url.includes('cloudinary.com')) return null;
  const publicId = extractPublicId(url);
  if (!publicId) return null;
  const resolvedType =
    resourceType && resourceType !== 'auto'
      ? resourceType
      : inferResourceTypeFromUrl(url, 'image');
  return cloudinary.url(publicId, {
    resource_type: resolvedType,
    secure: true,
    sign_url: true,
    ...(download ? { flags: 'attachment' } : {}),
  });
}

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
  uploadBufferToCloudinary,
  uploadMultipleToCloudinary,
  deleteFromCloudinary,
  deletePreviewFolder,
  extractPublicId,
  inferResourceTypeFromUrl,
  getSignedCloudinaryUrl,
  isCloudinaryConfigured,
  cloudinary
};

