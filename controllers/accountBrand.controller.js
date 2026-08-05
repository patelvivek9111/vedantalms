const AccountBrand = require('../models/accountBrand.model');
const { rootAccountIdFromRequest } = require('../utils/tenantContext');

/** Canvas Theme Editor equivalent: per-institution branding owned by school admins. */

const ASSET_FIELDS = {
  logo: 'logoUrl',
  favicon: 'faviconUrl',
  loginBackground: 'loginBackgroundUrl',
};

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const MAX_WORDMARK = 40;
const MAX_TAGLINE = 160;

function normalizeColor(value, fallback) {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  // Accept #abc shorthand so hand-typed values don't silently reset to default.
  const expanded = /^#[0-9a-f]{3}$/i.test(trimmed)
    ? `#${trimmed.slice(1).split('').map((c) => c + c).join('')}`
    : trimmed;
  return HEX_COLOR.test(expanded) ? expanded.toLowerCase() : fallback;
}

function serializeBrand(brand) {
  return {
    displayName: brand.displayName || '',
    wordmark: brand.wordmark || '',
    logoUrl: brand.logoUrl || '',
    faviconUrl: brand.faviconUrl || '',
    loginBackgroundUrl: brand.loginBackgroundUrl || '',
    loginTagline: brand.loginTagline || '',
    primaryColor: brand.primaryColor || '#4F46E5',
    secondaryColor: brand.secondaryColor || '#7C3AED',
    updatedAt: brand.updatedAt,
  };
}

function requireTenant(req, res) {
  const rootAccountId = rootAccountIdFromRequest(req);
  if (!rootAccountId) {
    res.status(400).json({ success: false, message: 'Institution context required' });
    return null;
  }
  return rootAccountId;
}

// @desc    Get branding for the admin's institution
// @route   GET /api/admin/branding
// @access  Private (Admin)
exports.getBrand = async (req, res) => {
  try {
    const rootAccountId = requireTenant(req, res);
    if (!rootAccountId) return undefined;

    const brand = await AccountBrand.getForRoot(rootAccountId);
    return res.json({ success: true, data: serializeBrand(brand) });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Error fetching branding',
      error: err.message,
    });
  }
};

// @desc    Update colors and text for the admin's institution
// @route   PUT /api/admin/branding
// @access  Private (Admin)
exports.updateBrand = async (req, res) => {
  try {
    const rootAccountId = requireTenant(req, res);
    if (!rootAccountId) return undefined;

    const brand = await AccountBrand.getForRoot(rootAccountId);
    const { primaryColor, secondaryColor, wordmark, loginTagline } = req.body || {};

    if (primaryColor !== undefined) {
      brand.primaryColor = normalizeColor(primaryColor, brand.primaryColor);
    }
    if (secondaryColor !== undefined) {
      brand.secondaryColor = normalizeColor(secondaryColor, brand.secondaryColor);
    }
    if (wordmark !== undefined) {
      brand.wordmark = String(wordmark).trim().slice(0, MAX_WORDMARK);
    }
    if (loginTagline !== undefined) {
      brand.loginTagline = String(loginTagline).trim().slice(0, MAX_TAGLINE);
    }

    await brand.save();

    return res.json({
      success: true,
      data: serializeBrand(brand),
      message: 'Branding updated',
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Error updating branding',
      error: err.message,
    });
  }
};

// @desc    Upload a logo, favicon, or login background
// @route   POST /api/admin/branding/assets/:kind
// @access  Private (Admin)
exports.uploadBrandAsset = async (req, res) => {
  try {
    const rootAccountId = requireTenant(req, res);
    if (!rootAccountId) return undefined;

    const field = ASSET_FIELDS[req.params.kind];
    if (!field) {
      return res.status(400).json({ success: false, message: 'Unknown branding asset' });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    if (!String(req.file.mimetype || '').startsWith('image/')) {
      return res.status(400).json({ success: false, message: 'Branding assets must be images' });
    }

    const fileAssetService = require('../services/fileAsset.service');
    const asset = await fileAssetService.createFileAsset({
      file: req.file,
      uploadedBy: req.user,
      category: 'system',
      visibility: 'public',
      accessScope: { ownerOnly: false },
      cloudinaryFolder: 'lms/branding',
      resourceType: 'image',
      lifecycleLocked: true,
      skipLifecycleCheck: true,
      metadata: { ip: req.ip, requestId: req.requestId, brandingKind: req.params.kind },
    });

    const url =
      asset.provider === 'cloudinary' && asset.metadata?.providerUrl
        ? asset.metadata.providerUrl
        : `/uploads/${asset.storageKey}`;

    const brand = await AccountBrand.getForRoot(rootAccountId);
    brand[field] = url;
    await brand.save();

    return res.json({
      success: true,
      data: serializeBrand(brand),
      message: 'Branding asset uploaded',
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || 'Error uploading branding asset',
      error: err.message,
    });
  }
};

// @desc    Clear a branding asset and fall back to the platform default
// @route   DELETE /api/admin/branding/assets/:kind
// @access  Private (Admin)
exports.removeBrandAsset = async (req, res) => {
  try {
    const rootAccountId = requireTenant(req, res);
    if (!rootAccountId) return undefined;

    const field = ASSET_FIELDS[req.params.kind];
    if (!field) {
      return res.status(400).json({ success: false, message: 'Unknown branding asset' });
    }

    const brand = await AccountBrand.getForRoot(rootAccountId);
    brand[field] = '';
    await brand.save();

    return res.json({
      success: true,
      data: serializeBrand(brand),
      message: 'Branding asset removed',
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Error removing branding asset',
      error: err.message,
    });
  }
};

module.exports.serializeBrand = serializeBrand;
