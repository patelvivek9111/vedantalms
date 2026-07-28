import { describe, expect, it } from 'vitest';
import {
  coercePreviewBlob,
  createPreviewObjectUrl,
  resolveDownloadFileName,
} from '../../../src/utils/filePreviewBlob';

describe('filePreviewBlob', () => {
  it('types octet-stream blobs as application/pdf for pdf filenames', () => {
    const raw = new Blob(['%PDF-1.4'], { type: 'application/octet-stream' });
    const typed = coercePreviewBlob(raw, { fileName: 'VResume1.pdf', kind: 'pdf' });
    expect(typed.type).toBe('application/pdf');
  });

  it('preserves existing mime types on blobs', () => {
    const raw = new Blob(['x'], { type: 'image/png' });
    const typed = coercePreviewBlob(raw, { fileName: 'photo.png' });
    expect(typed.type).toBe('image/png');
  });

  it('createPreviewObjectUrl wraps named Files', () => {
    const raw = new Blob(['%PDF'], { type: 'application/pdf' });
    const url = createPreviewObjectUrl(raw, 'VResume1.pdf');
    expect(url.startsWith('blob:')).toBe(true);
    URL.revokeObjectURL(url);
  });

  it('resolveDownloadFileName rejects blob UUIDs', () => {
    expect(resolveDownloadFileName('151c0201-2e61-460e-820b-fcebc8b4f264', 'file.pdf')).toBe(
      'file.pdf'
    );
    expect(resolveDownloadFileName('VResume1.pdf')).toBe('VResume1.pdf');
  });
});
