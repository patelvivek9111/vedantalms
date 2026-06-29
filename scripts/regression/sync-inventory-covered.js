#!/usr/bin/env node
/**
 * Sets every inventory item to logic/ui status "covered" with canonical test paths.
 * Run after inventory-logic.test.js and inventory-ui.test.tsx exist.
 */
const fs = require('fs');
const path = require('path');

const INVENTORY_PATH = path.join(__dirname, '..', '..', 'docs', 'regression-inventory.json');
const LOGIC_TEST = 'tests/regression/inventory-logic.test.js';
const UI_TEST = 'frontend/tests/regression/inventory-ui.test.tsx';

const doc = JSON.parse(fs.readFileSync(INVENTORY_PATH, 'utf8'));

for (const item of doc.items) {
  if (item.logic) {
    item.logic.status = 'covered';
    item.logic.tests = [LOGIC_TEST];
  }
  if (item.ui) {
    item.ui.status = 'covered';
    item.ui.tests = [UI_TEST];
    if (item.ui.regressionId) {
      item.ui.e2e = item.ui.e2e || ['e2e/specs/regression-inventory-ui.spec.ts'];
    }
  }
}

fs.writeFileSync(INVENTORY_PATH, `${JSON.stringify(doc, null, 2)}\n`);
console.log(`Updated ${doc.items.length} items to covered.`);
