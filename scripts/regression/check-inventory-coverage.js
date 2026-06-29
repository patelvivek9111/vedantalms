#!/usr/bin/env node
/**
 * Reports logic + UI coverage from docs/regression-inventory.json.
 * Strict mode (--strict) fails unless every item is status "covered".
 *
 * Usage:
 *   node scripts/regression/check-inventory-coverage.js
 *   node scripts/regression/check-inventory-coverage.js --strict
 *   node scripts/regression/check-inventory-coverage.js --min-logic 80 --min-ui 50
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const INVENTORY_PATH = path.join(ROOT, 'docs', 'regression-inventory.json');

const STATUS_WEIGHT = {
  covered: 1,
  partial: 0.5,
  gap: 0,
};

function parseArgs(argv) {
  const args = { strict: false, minLogic: null, minUi: null, minDepth: null, json: false };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--strict') args.strict = true;
    else if (argv[i] === '--json') args.json = true;
    else if (argv[i] === '--min-logic') args.minLogic = Number(argv[++i]);
    else if (argv[i] === '--min-ui') args.minUi = Number(argv[++i]);
    else if (argv[i] === '--min-depth') args.minDepth = Number(argv[++i]);
  }
  if (args.strict) {
    args.minLogic = 100;
    args.minUi = 100;
    args.minDepth = 100;
  }
  return args;
}

function scoreLayer(layer) {
  if (!layer) return null;
  return STATUS_WEIGHT[layer.status] ?? 0;
}

function verifyTestPaths(item, layerKey) {
  const layer = item[layerKey];
  if (!layer?.tests?.length) return [];
  const missing = [];
  for (const rel of layer.tests) {
    const full = path.join(ROOT, rel.replace(/\//g, path.sep));
    if (!fs.existsSync(full)) missing.push({ id: item.id, file: rel, layer: layerKey });
  }
  return missing;
}

function main() {
  const args = parseArgs(process.argv);
  if (!fs.existsSync(INVENTORY_PATH)) {
    console.error('Missing inventory:', INVENTORY_PATH);
    process.exit(1);
  }

  const { items } = JSON.parse(fs.readFileSync(INVENTORY_PATH, 'utf8'));
  let logicScore = 0;
  let logicMax = 0;
  let uiScore = 0;
  let uiMax = 0;
  let depthScore = 0;
  let depthMax = 0;
  const gaps = { logic: [], ui: [], depth: [] };
  const missingFiles = [];

  for (const item of items) {
    if (item.logic) {
      logicMax += 1;
      const s = scoreLayer(item.logic);
      logicScore += s;
      if (item.logic.status !== 'covered') gaps.logic.push({ id: item.id, name: item.name, status: item.logic.status });
      missingFiles.push(...verifyTestPaths(item, 'logic'));
    }
    if (item.ui) {
      uiMax += 1;
      const s = scoreLayer(item.ui);
      uiScore += s;
      if (item.ui.status !== 'covered') gaps.ui.push({ id: item.id, name: item.name, status: item.ui.status });
      missingFiles.push(...verifyTestPaths(item, 'ui'));
    }
    // depth = write-flow journeys (create/edit/delete/approve/vote/grade ...) — see §21.
    if (item.depth) {
      depthMax += 1;
      const s = scoreLayer(item.depth);
      depthScore += s;
      if (item.depth.status !== 'covered') gaps.depth.push({ id: item.id, name: item.name, status: item.depth.status });
      missingFiles.push(...verifyTestPaths(item, 'depth'));
    }
  }

  const logicPct = logicMax ? Math.round((logicScore / logicMax) * 1000) / 10 : 100;
  const uiPct = uiMax ? Math.round((uiScore / uiMax) * 1000) / 10 : 100;
  const depthPct = depthMax ? Math.round((depthScore / depthMax) * 1000) / 10 : 100;

  const report = {
    items: items.length,
    logic: { score: logicScore, max: logicMax, percent: logicPct, gaps: gaps.logic.length },
    ui: { score: uiScore, max: uiMax, percent: uiPct, gaps: gaps.ui.length },
    depth: { score: depthScore, max: depthMax, percent: depthPct, gaps: gaps.depth.length },
    missingTestFiles: missingFiles,
  };

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log('Regression inventory coverage');
    console.log('===========================');
    console.log(`Items tracked: ${report.items}`);
    console.log(`Logic: ${logicPct}% (${logicScore}/${logicMax} weighted; ${gaps.logic.length} not fully covered)`);
    console.log(`UI:    ${uiPct}% (${uiScore}/${uiMax} weighted; ${gaps.ui.length} not fully covered)`);
    console.log(`Depth: ${depthPct}% (${depthScore}/${depthMax} weighted; ${gaps.depth.length} not fully covered)`);
    if (missingFiles.length) {
      console.log('\nMissing test file references:');
      for (const m of missingFiles) console.log(`  - ${m.id}: ${m.file}`);
    }
    if (gaps.logic.length && !args.strict) {
      console.log('\nLogic gaps (first 15):');
      gaps.logic.slice(0, 15).forEach((g) => console.log(`  [${g.status}] ${g.id} — ${g.name}`));
      if (gaps.logic.length > 15) console.log(`  ... +${gaps.logic.length - 15} more`);
    }
    if (gaps.ui.length && !args.strict) {
      console.log('\nUI gaps (first 15):');
      gaps.ui.slice(0, 15).forEach((g) => console.log(`  [${g.status}] ${g.id} — ${g.name}`));
      if (gaps.ui.length > 15) console.log(`  ... +${gaps.ui.length - 15} more`);
    }
    if (gaps.depth.length && !args.strict) {
      console.log('\nDepth gaps (first 15):');
      gaps.depth.slice(0, 15).forEach((g) => console.log(`  [${g.status}] ${g.id} — ${g.name}`));
      if (gaps.depth.length > 15) console.log(`  ... +${gaps.depth.length - 15} more`);
    }
    console.log('\nTarget: 100% logic + 100% UI + 100% depth — run with --strict to enforce.');
  }

  let exitCode = 0;
  if (args.minLogic != null && logicPct < args.minLogic) {
    console.error(`Logic coverage ${logicPct}% is below minimum ${args.minLogic}%`);
    exitCode = 1;
  }
  if (args.minUi != null && uiPct < args.minUi) {
    console.error(`UI coverage ${uiPct}% is below minimum ${args.minUi}%`);
    exitCode = 1;
  }
  if (args.minDepth != null && depthPct < args.minDepth) {
    console.error(`Depth coverage ${depthPct}% is below minimum ${args.minDepth}%`);
    exitCode = 1;
  }
  if (missingFiles.length && args.strict) {
    console.error('Strict mode: fix missing test file paths in inventory');
    exitCode = 1;
  }
  process.exit(exitCode);
}

main();
