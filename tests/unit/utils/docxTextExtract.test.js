const JSZip = require('jszip');
const { extractDocxPlainText } = require('../../../utils/docxTextExtract');

async function buildMinimalDocx(text) {
  const zip = new JSZip();
  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>${text}</w:t></w:r></w:p>
  </w:body>
</w:document>`
  );
  zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>');
  return zip.generateAsync({ type: 'nodebuffer' });
}

describe('docxTextExtract', () => {
  it('extracts text from word/document.xml inside the zip', async () => {
    const buf = await buildMinimalDocx('Production Ready Report');
    const plain = await extractDocxPlainText(buf);
    expect(plain).toContain('Production');
    expect(plain).toContain('Ready');
    expect(plain).toContain('Report');
  });

  it('returns empty string for invalid buffer', async () => {
    expect(await extractDocxPlainText(Buffer.from('not a zip'))).toBe('');
  });
});
