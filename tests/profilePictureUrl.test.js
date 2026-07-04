jest.mock('../models/fileAsset.model', () => ({
  findById: jest.fn(() => ({ lean: jest.fn().mockResolvedValue(null) })),
  findOne: jest.fn(() => ({ lean: jest.fn().mockResolvedValue(null) })),
}));

jest.mock('../models/user.model', () => ({
  updateOne: jest.fn().mockResolvedValue({}),
}));

const {
  resolveProfilePictureUrl,
  getPublicApiBase,
} = require('../utils/profilePictureUrl');

describe('profilePictureUrl', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns empty string for blank values', async () => {
    expect(await resolveProfilePictureUrl('')).toBe('');
    expect(await resolveProfilePictureUrl(null)).toBe('');
  });

  it('passes through absolute URLs', async () => {
    const url = 'https://res.cloudinary.com/demo/image/upload/v1/sample.jpg';
    expect(await resolveProfilePictureUrl(url)).toBe(url);
  });

  it('returns empty string for missing legacy files (avoids CORB on 404 JSON)', async () => {
    process.env.RENDER_EXTERNAL_URL = 'https://vedantalms-backend.onrender.com';
    const resolved = await resolveProfilePictureUrl('profilePicture-1762444967948-138213737.jpg');
    expect(resolved).toBe('');
  });

  it('builds absolute upload URL when the file exists on disk', async () => {
    const fs = require('fs');
    const { paths } = require('../config/paths');
    const testName = 'profilePicture-test-exists.jpg';
    const testPath = require('path').join(paths.uploads, testName);
    fs.writeFileSync(testPath, 'test');
    try {
      process.env.RENDER_EXTERNAL_URL = 'https://vedantalms-backend.onrender.com';
      const resolved = await resolveProfilePictureUrl(testName);
      expect(resolved).toBe(`https://vedantalms-backend.onrender.com/uploads/${testName}`);
    } finally {
      fs.unlinkSync(testPath);
    }
  });

  it('normalizes /uploads/ prefixed legacy paths when file exists', async () => {
    const fs = require('fs');
    const { paths } = require('../config/paths');
    const testName = 'profilePicture-test-prefixed.jpg';
    const testPath = require('path').join(paths.uploads, testName);
    fs.writeFileSync(testPath, 'test');
    try {
      process.env.PUBLIC_API_URL = 'https://api.example.com';
      const resolved = await resolveProfilePictureUrl(`/uploads/${testName}`);
      expect(resolved).toBe(`https://api.example.com/uploads/${testName}`);
    } finally {
      fs.unlinkSync(testPath);
    }
  });

  it('strips /api suffix from public API base', () => {
    process.env.PUBLIC_API_URL = 'https://api.example.com/api';
    expect(getPublicApiBase()).toBe('https://api.example.com');
  });
});
