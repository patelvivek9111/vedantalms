const JSZip = require('jszip');

function decodeXmlEntities(text) {
  return String(text)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/**
 * Extract plain text from a DOCX buffer by reading word/document.xml inside the ZIP.
 */
async function extractDocxPlainText(buffer) {
  if (!buffer?.length) return '';
  try {
    const zip = await JSZip.loadAsync(buffer);
    let docEntry = zip.file('word/document.xml');
    if (!docEntry) {
      const key = Object.keys(zip.files).find((k) => /word\/document\.xml$/i.test(k));
      docEntry = key ? zip.file(key) : null;
    }
    if (!docEntry) return '';

    let xml = await docEntry.async('string');
    xml = xml
      .replace(/<w:tab[^/]*\/>/gi, '\t')
      .replace(/<w:br[^/]*\/>/gi, '\n')
      .replace(/<\/w:p>/gi, '\n');

    const parts = [];
    const re = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/gi;
    let match = re.exec(xml);
    while (match) {
      parts.push(decodeXmlEntities(match[1]));
      match = re.exec(xml);
    }

    let plain = parts.join('');
    if (!plain.trim()) {
      plain = decodeXmlEntities(xml.replace(/<[^>]+>/g, ' '));
    }

    return plain.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim();
  } catch {
    return '';
  }
}

module.exports = { extractDocxPlainText, decodeXmlEntities };
