const fs = require('fs');
const path = require('path');
const { paths } = require('../config/paths');

function ensureReportsDir() {
  if (!fs.existsSync(paths.fileReports)) {
    fs.mkdirSync(paths.fileReports, { recursive: true });
  }
}

function writeReport(filename, payload) {
  ensureReportsDir();
  const full = path.join(paths.fileReports, filename);
  fs.writeFileSync(full, JSON.stringify(payload, null, 2), 'utf8');
  return full;
}

function formatHumanSummary(title, sections) {
  const lines = [`=== ${title} ===`, `Generated: ${new Date().toISOString()}`, ''];
  for (const [key, value] of Object.entries(sections)) {
    lines.push(`## ${key}`);
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      for (const [k, v] of Object.entries(value)) {
        lines.push(`  ${k}: ${Array.isArray(v) ? v.length : v}`);
      }
    } else {
      lines.push(`  ${value}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

module.exports = {
  ensureReportsDir,
  writeReport,
  formatHumanSummary,
};
