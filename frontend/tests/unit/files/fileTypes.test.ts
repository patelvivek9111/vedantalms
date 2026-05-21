import { describe, expect, it } from 'vitest';
import {
  dedupeFileNames,
  detectPreviewKind,
  extractFileAssetId,
  fileAccessErrorMessage,
  formatFileSize,
  isDocxFile,
} from '../../../src/utils/fileTypes';

describe('fileTypes', () => {
  it('formats file sizes', () => {
    expect(formatFileSize(500)).toBe('500 B');
    expect(formatFileSize(2048)).toContain('KB');
    expect(formatFileSize(5 * 1024 * 1024)).toContain('MB');
  });

  it('detects preview kinds', () => {
    expect(detectPreviewKind({ name: 'photo.png', mimeType: 'image/png' })).toBe('image');
    expect(detectPreviewKind({ name: 'doc.pdf' })).toBe('pdf');
    expect(detectPreviewKind({ name: 'report.docx' })).toBe('office');
    expect(detectPreviewKind({ name: 'app.exe' })).toBe('unsupported');
  });

  it('detects docx for visual preview', () => {
    expect(isDocxFile({ name: 'report.docx' })).toBe(true);
    expect(
      isDocxFile({
        name: 'legacy.doc',
        mimeType: 'application/msword',
      })
    ).toBe(false);
    expect(isDocxFile({ name: 'slides.pptx' })).toBe(false);
  });

  it('extracts file asset id from secure url', () => {
    const id = '507f1f77bcf86cd799439011';
    expect(extractFileAssetId(`/api/files/${id}/download`)).toBe(id);
  });

  it('maps access error messages', () => {
    expect(fileAccessErrorMessage(401)).toMatch(/session expired/i);
    expect(fileAccessErrorMessage(403)).toMatch(/permission/i);
    expect(fileAccessErrorMessage(410)).toMatch(/expired/i);
  });

  it('dedupes duplicate filenames', () => {
    const f1 = new File(['a'], 'essay.pdf');
    const f2 = new File(['b'], 'essay.pdf');
    const out = dedupeFileNames([f1, f2]);
    expect(out[0].name).toBe('essay.pdf');
    expect(out[1].name).toBe('essay (2).pdf');
  });
});
