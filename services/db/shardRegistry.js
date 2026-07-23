const mongoose = require('mongoose');
const { resolveShardForRoot, BY_ACCOUNT_CODE, DEFAULT_SHARD } = require('../../config/tenantShardMap');

/**
 * Runtime multi-connection registry for dedicated tenant shards.
 * Default tenants use mongoose.connection (primary).
 */

const connections = new Map(); // label -> Connection
let warmed = false;

async function ensureConnection(shard) {
  const label = shard.label || 'primary';
  if (label === 'primary' || !shard.isDedicated) {
    return mongoose.connection;
  }
  if (connections.has(label)) return connections.get(label);

  const uri = shard.mongoUri;
  if (!uri) {
    console.warn(`[shardRegistry] No URI for shard ${label}; using primary`);
    return mongoose.connection;
  }

  const conn = mongoose.createConnection(uri, {
    maxPoolSize: parseInt(process.env.SHARD_POOL_SIZE || '10', 10),
  });
  await conn.asPromise();
  connections.set(label, conn);
  console.log(`[shardRegistry] Connected dedicated shard "${label}"`);
  return conn;
}

async function warmDedicatedShards() {
  if (warmed) return;
  warmed = true;
  for (const code of Object.keys(BY_ACCOUNT_CODE)) {
    const shard = resolveShardForRoot({ accountCode: code });
    if (shard.isDedicated) {
      try {
        await ensureConnection(shard);
      } catch (err) {
        console.error(`[shardRegistry] Failed to warm ${code}:`, err.message);
      }
    }
  }
}

async function getConnectionForRoot({ rootAccountId, accountCode } = {}) {
  const shard = resolveShardForRoot({ rootAccountId, accountCode });
  return ensureConnection(shard);
}

function getModelOnShard(conn, modelName, schemaFactory) {
  if (conn === mongoose.connection) {
    return mongoose.model(modelName);
  }
  if (conn.models[modelName]) return conn.models[modelName];
  const primary = mongoose.model(modelName);
  return conn.model(modelName, primary.schema);
}

/**
 * Resolve connection for a request tenant. Falls back to primary.
 */
async function connectionFromRequest(req) {
  const Account = require('../../models/account.model');
  let code = req.account?.code;
  if (!code && req.rootAccountId) {
    const acc = await Account.findById(req.rootAccountId).select('code').lean();
    code = acc?.code;
  }
  return getConnectionForRoot({
    rootAccountId: req.rootAccountId,
    accountCode: code,
  });
}

module.exports = {
  warmDedicatedShards,
  getConnectionForRoot,
  getModelOnShard,
  connectionFromRequest,
  DEFAULT_SHARD,
};
