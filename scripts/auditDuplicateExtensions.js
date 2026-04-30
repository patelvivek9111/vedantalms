const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, '..', 'frontend', 'src');
const grouped = new Map();

const walk = (dir) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
      continue;
    }
    const ext = path.extname(entry.name);
    if (!['.js', '.jsx', '.ts', '.tsx'].includes(ext)) continue;
    const rel = path.relative(targetDir, full);
    const key = rel.replace(/\.(js|jsx|ts|tsx)$/i, '');
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(rel);
  }
};

walk(targetDir);

const duplicates = Array.from(grouped.entries())
  .filter(([, files]) => files.length > 1)
  .sort((a, b) => a[0].localeCompare(b[0]));

if (!duplicates.length) {
  console.log('No duplicate basename components found.');
  process.exit(0);
}

console.log('Duplicate basename files found (review before migration):');
for (const [base, files] of duplicates) {
  console.log(`\n- ${base}`);
  files.forEach((f) => console.log(`  - ${f}`));
}

process.exitCode = 1;
