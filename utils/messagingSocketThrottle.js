const parseIntEnv = (key, fallback) => {
  const v = parseInt(process.env[key] || String(fallback), 10);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};

const windowMs = () => parseIntEnv('MESSAGING_THROTTLE_WINDOW_MS', 1000);

const maxForEvent = (eventName) => {
  const limits = {
    'messaging:subscribe': parseIntEnv('MESSAGING_THROTTLE_SUBSCRIBE_MAX', 30),
    'messaging:unsubscribe': parseIntEnv('MESSAGING_THROTTLE_SUBSCRIBE_MAX', 30),
  };
  return limits[eventName] ?? parseIntEnv('MESSAGING_THROTTLE_DEFAULT_MAX', 60);
};

/** @returns {boolean} true if the event is allowed */
function allowMessagingEvent(socket, eventName) {
  const max = maxForEvent(eventName);
  const w = windowMs();
  const now = Date.now();
  const cutoff = now - w;
  if (!socket.__msgThrottle) {
    socket.__msgThrottle = {};
  }
  let hits = socket.__msgThrottle[eventName];
  if (!hits) {
    hits = [];
    socket.__msgThrottle[eventName] = hits;
  }
  while (hits.length > 0 && hits[0] < cutoff) {
    hits.shift();
  }
  if (hits.length >= max) {
    return false;
  }
  hits.push(now);
  return true;
}

module.exports = { allowMessagingEvent };
