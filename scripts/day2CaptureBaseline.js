const dotenv = require('dotenv');
const fs = require('fs').promises;
const path = require('path');

dotenv.config();

const healthOpsUrl = process.env.HEALTH_OPS_URL || 'http://localhost:5000/health/ops';
const sampleCount = parseInt(process.env.DAY2_SAMPLE_COUNT || '5', 10);
const sampleIntervalMs = parseInt(process.env.DAY2_SAMPLE_INTERVAL_MS || '2000', 10);
const reportFilePath = path.resolve(process.cwd(), 'DAY_PROGRESS.md');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const main = async () => {
  const samples = [];
  for (let i = 0; i < sampleCount; i++) {
    const res = await fetch(healthOpsUrl);
    if (!res.ok) {
      throw new Error(`health ops endpoint failed with status ${res.status}`);
    }
    const body = await res.json();
    samples.push(body);
    if (i < sampleCount - 1) {
      await sleep(sampleIntervalMs);
    }
  }

  const capturedAt = new Date().toISOString();
  const latest = samples[samples.length - 1];
  const entry = `

#### Capture ${capturedAt}

- Source: ${healthOpsUrl}
- Samples: ${sampleCount}
- IntervalMs: ${sampleIntervalMs}

### Latest Snapshot

\`\`\`json
${JSON.stringify(latest, null, 2)}
\`\`\`
`;

  await fs.access(reportFilePath);

  await fs.appendFile(reportFilePath, `${entry}\n`, 'utf8');
  console.log(`[day2] Baseline written to ${reportFilePath}`);
  console.log(entry);
};

main().catch((error) => {
  console.error('[day2] Baseline capture failed:', error.message);
  process.exit(1);
});
