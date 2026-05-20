const fs = require('fs');
const path = require('path');
const {
  FORBIDDEN_IF_SECRET_PATTERNS,
  REQUIRED_WORKFLOWS,
  validateWorkflowContent,
  validateAllWorkflows,
} = require('../../scripts/validateWorkflowFiles');

const ROOT = path.join(__dirname, '../..');
const WORKFLOWS_DIR = path.join(ROOT, '.github', 'workflows');

describe('CI workflow validation', () => {
  it('required workflow files exist', () => {
    for (const name of REQUIRED_WORKFLOWS) {
      expect(fs.existsSync(path.join(WORKFLOWS_DIR, name))).toBe(true);
    }
  });

  it('validateAllWorkflows passes for repository workflows', () => {
    const errors = validateAllWorkflows();
    expect(errors).toEqual([]);
  });

  it('predeploy.yml parses and has no secrets in if', () => {
    const rel = '.github/workflows/predeploy.yml';
    const content = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    expect(validateWorkflowContent(rel, content)).toEqual([]);
    expect(content).not.toMatch(/if:\s*\$\{\{\s*secrets\./);
  });

  it('rejects forbidden if: secrets.* patterns', () => {
    const rel = '.github/workflows/example-bad.yml';
    const bad = [
      'name: Bad\non: push\njobs:\n  x:\n    runs-on: ubuntu-latest\n    steps:\n      - if: ${{ secrets.MONGODB_URI != \'\' }}\n        run: echo no\n',
      'name: Bad2\non: push\njobs:\n  x:\n    runs-on: ubuntu-latest\n    steps:\n      - if: secrets.MONGODB_URI\n        run: echo no\n',
    ];
    for (const content of bad) {
      const errors = validateWorkflowContent(rel, content);
      expect(errors.some((e) => e.includes('forbidden'))).toBe(true);
    }
  });

  it('FORBIDDEN_IF_SECRET_PATTERNS match GitHub-invalid expressions', () => {
    const sample = '      - if: ${{ secrets.MONGODB_URI != \'\' }}\n';
    const matched = FORBIDDEN_IF_SECRET_PATTERNS.some((p) => p.test(sample));
    expect(matched).toBe(true);
  });

  it('verify:grading deprecated calculator guard passes', () => {
    const { execSync } = require('child_process');
    const out = execSync('node scripts/checkDeprecatedGradingCalculator.js', {
      cwd: ROOT,
      encoding: 'utf8',
    });
    expect(out).toContain('Deprecated calculator guard OK');
  });
});
