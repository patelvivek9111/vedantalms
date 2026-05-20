#!/usr/bin/env node
/**
 * CI guard: GitHub Actions workflow files must parse and must not use secrets in `if:`.
 */
const fs = require('fs');
const path = require('path');
const yaml = require('yaml');

const ROOT = path.join(__dirname, '..');
const WORKFLOWS_DIR = path.join(ROOT, '.github', 'workflows');

const REQUIRED_WORKFLOWS = [
  'predeploy.yml',
  'grading-production.yml',
  'hardening-production.yml',
];

/** GitHub rejects `secrets.*` in job/step `if:` at workflow parse time. */
const FORBIDDEN_IF_SECRET_PATTERNS = [
  /^\s*-?\s*if:\s*\$\{\{\s*secrets\./m,
  /^\s*-?\s*if:\s*secrets\./m,
  /if:\s*\$\{\{\s*secrets\./,
];

function validateWorkflowContent(relPath, content) {
  const errors = [];

  for (const pattern of FORBIDDEN_IF_SECRET_PATTERNS) {
    if (pattern.test(content)) {
      errors.push(
        `${relPath}: forbidden \`if:\` expression references secrets (use shell gating in \`run:\` instead)`
      );
      break;
    }
  }

  if (content.includes('\t')) {
    errors.push(`${relPath}: workflow YAML must not contain tab characters`);
  }

  try {
    const doc = yaml.parse(content);
    if (!doc || typeof doc !== 'object') {
      errors.push(`${relPath}: workflow must parse to a YAML object`);
      return errors;
    }
    if (!doc.name || typeof doc.name !== 'string') {
      errors.push(`${relPath}: missing required top-level \`name\``);
    }
    if (!doc.on) {
      errors.push(`${relPath}: missing required top-level \`on\``);
    }
    if (!doc.jobs || typeof doc.jobs !== 'object' || Object.keys(doc.jobs).length === 0) {
      errors.push(`${relPath}: missing required top-level \`jobs\``);
    }
  } catch (parseError) {
    errors.push(`${relPath}: YAML parse error — ${parseError.message}`);
  }

  return errors;
}

function listWorkflowFiles() {
  if (!fs.existsSync(WORKFLOWS_DIR)) {
    return [];
  }
  return fs
    .readdirSync(WORKFLOWS_DIR)
    .filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'))
    .map((name) => path.join(WORKFLOWS_DIR, name));
}

function validateAllWorkflows() {
  const errors = [];

  for (const required of REQUIRED_WORKFLOWS) {
    const full = path.join(WORKFLOWS_DIR, required);
    if (!fs.existsSync(full)) {
      errors.push(`Missing required workflow: .github/workflows/${required}`);
    }
  }

  const files = listWorkflowFiles();
  if (files.length === 0) {
    errors.push('No workflow files found under .github/workflows/');
    return errors;
  }

  for (const file of files) {
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    const content = fs.readFileSync(file, 'utf8');
    errors.push(...validateWorkflowContent(rel, content));
  }

  return errors;
}

function main() {
  const errors = validateAllWorkflows();
  if (errors.length > 0) {
    console.error('Workflow validation failed:\n' + errors.map((e) => `  - ${e}`).join('\n'));
    process.exit(1);
  }
  console.log(
    `Workflow validation OK (${REQUIRED_WORKFLOWS.length} required workflows, ${listWorkflowFiles().length} file(s) checked).`
  );
}

if (require.main === module) {
  main();
}

module.exports = {
  FORBIDDEN_IF_SECRET_PATTERNS,
  REQUIRED_WORKFLOWS,
  validateWorkflowContent,
  validateAllWorkflows,
};
