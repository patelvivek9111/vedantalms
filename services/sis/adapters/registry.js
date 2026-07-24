const customRest = require('./customRest');
const banner = require('./banner');
const peoplesoft = require('./peoplesoft');
const fedena = require('./fedena');

const ADAPTERS = {
  csv: {
    id: 'csv',
    label: 'CSV (manual)',
    capabilities: { pull: false, push: false, schedule: false },
    async pull() {
      return {
        ok: false,
        message: 'csv provider uses the Import tab — no HTTP pull',
        users: [],
        sections: [],
        enrollments: [],
      };
    },
    async push() {
      return { ok: true, dryRun: true, message: 'csv export uses grades.csv download' };
    },
  },
  custom_rest: {
    id: 'custom_rest',
    label: 'Custom REST',
    capabilities: { pull: true, push: true, schedule: true },
    pull: customRest.pullCustomRest,
    push: customRest.pushCustomRest,
  },
  banner: {
    id: 'banner',
    label: 'Banner',
    capabilities: { pull: true, push: true, schedule: true },
    pull: banner.pullBanner,
    push: banner.pushBanner,
  },
  peoplesoft: {
    id: 'peoplesoft',
    label: 'PeopleSoft',
    capabilities: { pull: true, push: true, schedule: true },
    pull: peoplesoft.pullPeopleSoft,
    push: peoplesoft.pushPeopleSoft,
  },
  fedena: {
    id: 'fedena',
    label: 'Fedena',
    capabilities: { pull: true, push: true, schedule: true },
    pull: fedena.pullFedena,
    push: fedena.pushFedena,
  },
  workday: {
    id: 'workday',
    label: 'Workday (enrollment stage only)',
    capabilities: { pull: false, push: false, schedule: false },
    async pull() {
      return {
        ok: false,
        message: 'workday HTTP adapter not configured — use CSV or custom_rest',
        users: [],
        sections: [],
        enrollments: [],
      };
    },
    async push() {
      return { ok: false, message: 'workday push not configured' };
    },
  },
};

function listAdapters() {
  return Object.values(ADAPTERS).map((a) => ({
    id: a.id,
    label: a.label,
    capabilities: a.capabilities,
  }));
}

function getAdapter(provider) {
  const key = String(provider || 'csv').toLowerCase();
  return ADAPTERS[key] || ADAPTERS.csv;
}

module.exports = { ADAPTERS, listAdapters, getAdapter };
