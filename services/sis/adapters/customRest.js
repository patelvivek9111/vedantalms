/**
 * Custom REST SIS adapter hook (beyond CSV).
 * Dry-run / log only unless CUSTOM_REST_SIS_URL is configured.
 */
async function pushCustomRest({ config, payload, dryRun = true }) {
  const url = config?.credentialsRef || process.env.CUSTOM_REST_SIS_URL || '';
  if (!url) {
    return {
      ok: false,
      dryRun: true,
      message: 'custom_rest provider has no credentialsRef / CUSTOM_REST_SIS_URL',
    };
  }

  if (dryRun || process.env.CUSTOM_REST_SIS_DRY_RUN !== 'false') {
    return {
      ok: true,
      dryRun: true,
      url,
      payloadPreview: {
        entityType: payload?.entityType,
        count: Array.isArray(payload?.rows) ? payload.rows.length : 0,
      },
      message: 'Dry-run only — set CUSTOM_REST_SIS_DRY_RUN=false to POST',
    };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(process.env.CUSTOM_REST_SIS_TOKEN
        ? { Authorization: `Bearer ${process.env.CUSTOM_REST_SIS_TOKEN}` }
        : {}),
    },
    body: JSON.stringify(payload),
  });

  return {
    ok: res.ok,
    dryRun: false,
    status: res.status,
    body: await res.text().catch(() => ''),
  };
}

module.exports = { pushCustomRest };
