/**
 * One-time migration: replace localStorage token reads with cookie auth (credentials: include).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'frontend', 'src');

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (/\.(tsx?|jsx?)$/.test(entry.name)) files.push(full);
  }
  return files;
}

function relativeImport(fromFile, target = 'utils/authToken') {
  const fromDir = path.dirname(fromFile);
  let rel = path.relative(fromDir, path.join(ROOT, target)).replace(/\\/g, '/');
  if (!rel.startsWith('.')) rel = `./${rel}`;
  return rel.replace(/\.ts$/, '');
}

const SKIP = new Set([
  path.normalize(path.join(ROOT, 'contexts', 'AuthContext.tsx')),
  path.normalize(path.join(ROOT, 'utils', 'authToken.ts')),
]);

let updated = 0;

for (const file of walk(ROOT)) {
  if (SKIP.has(path.normalize(file))) continue;
  let content = fs.readFileSync(file, 'utf8');
  if (!content.includes("localStorage.getItem('token')")) continue;

  const importPath = relativeImport(file);
  const importLine = `import { getMemoryAuthToken, authFetchInit } from '${importPath}';\n`;

  if (!content.includes('getMemoryAuthToken')) {
    const m = content.match(/^import .+;\n/m);
    if (m) {
      content = content.replace(m[0], `${m[0]}${importLine}`);
    } else {
      content = `${importLine}\n${content}`;
    }
  }

  content = content.replace(/localStorage\.getItem\('token'\)/g, 'getMemoryAuthToken()');

  // Add credentials to fetch(...) calls that use Authorization Bearer
  content = content.replace(
    /fetch\(([^,]+),\s*\{([^}]*Authorization:\s*`Bearer \$\{[^}]+\}[^}]*)\}\)/gs,
    (match, url, opts) => {
      if (opts.includes('credentials:')) return match;
      const cleaned = opts
        .replace(/,?\s*Authorization:\s*`Bearer \$\{[^`]+}`\s*,?/g, '')
        .replace(/,\s*,/g, ',');
      return `fetch(${url}, authFetchInit({${cleaned}}))`;
    }
  );

  fs.writeFileSync(file, content);
  updated += 1;
}

console.log(`Updated ${updated} files`);
