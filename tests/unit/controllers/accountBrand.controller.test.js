jest.mock('../../../models/accountBrand.model', () => ({
  getForRoot: jest.fn(),
}));

jest.mock('../../../utils/tenantContext', () => ({
  rootAccountIdFromRequest: jest.fn(),
}));

const AccountBrand = require('../../../models/accountBrand.model');
const { rootAccountIdFromRequest } = require('../../../utils/tenantContext');
const brandController = require('../../../controllers/accountBrand.controller');

function createRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function createBrandDoc(overrides = {}) {
  return {
    displayName: 'Demo University',
    wordmark: 'DEMO',
    logoUrl: '',
    faviconUrl: '',
    loginBackgroundUrl: '',
    loginTagline: '',
    primaryColor: '#4f46e5',
    secondaryColor: '#7c3aed',
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('accountBrand.controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    rootAccountIdFromRequest.mockReturnValue('root-1');
  });

  describe('updateBrand', () => {
    it('stores valid hex colors and trims text fields', async () => {
      const brand = createBrandDoc();
      AccountBrand.getForRoot.mockResolvedValue(brand);
      const res = createRes();

      await brandController.updateBrand(
        {
          body: {
            primaryColor: '#00A3FF',
            secondaryColor: '#abc',
            wordmark: '  Demo U  ',
            loginTagline: '  Welcome back  ',
          },
        },
        res
      );

      expect(brand.primaryColor).toBe('#00a3ff');
      // #abc shorthand expands rather than falling back to the previous value.
      expect(brand.secondaryColor).toBe('#aabbcc');
      expect(brand.wordmark).toBe('Demo U');
      expect(brand.loginTagline).toBe('Welcome back');
      expect(brand.save).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: 'Branding updated' })
      );
    });

    it('keeps the existing color when given an invalid value', async () => {
      const brand = createBrandDoc({ primaryColor: '#123456' });
      AccountBrand.getForRoot.mockResolvedValue(brand);
      const res = createRes();

      await brandController.updateBrand(
        { body: { primaryColor: 'javascript:alert(1)' } },
        res
      );

      expect(brand.primaryColor).toBe('#123456');
    });

    it('rejects requests with no institution context', async () => {
      rootAccountIdFromRequest.mockReturnValue(null);
      const res = createRes();

      await brandController.updateBrand({ body: {} }, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(AccountBrand.getForRoot).not.toHaveBeenCalled();
    });
  });

  describe('uploadBrandAsset', () => {
    it('rejects an unknown asset kind', async () => {
      const res = createRes();

      await brandController.uploadBrandAsset(
        { params: { kind: 'wallpaper' }, file: {}, user: {} },
        res
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Unknown branding asset' })
      );
    });

    it('rejects non-image uploads', async () => {
      const res = createRes();

      await brandController.uploadBrandAsset(
        {
          params: { kind: 'logo' },
          file: { mimetype: 'application/pdf', originalname: 'brand.pdf' },
          user: {},
        },
        res
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Branding assets must be images' })
      );
    });
  });

  describe('removeBrandAsset', () => {
    it('clears the stored url so the platform default returns', async () => {
      const brand = createBrandDoc({ logoUrl: '/uploads/branding/logo.png' });
      AccountBrand.getForRoot.mockResolvedValue(brand);
      const res = createRes();

      await brandController.removeBrandAsset({ params: { kind: 'logo' } }, res);

      expect(brand.logoUrl).toBe('');
      expect(brand.save).toHaveBeenCalled();
    });
  });
});
