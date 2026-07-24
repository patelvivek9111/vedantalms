/**
 * Apply SisIntegrationConfig.fieldMappings to raw SIS rows.
 *
 * fieldMappings shape (per entity):
 * {
 *   users: { email: 'mail', sis_id: 'id', first_name: 'givenName', ... },
 *   sections: { sis_section_id: 'sectionId', course_code: 'catalogNbr', ... },
 *   enrollments: { sis_student_id: 'emplid', sis_section_id: 'crn', ... },
 *   grades: { final_grade: 'grade', ... }  // outbound rename (optional)
 * }
 *
 * Keys are LMS/canonical field names; values are source SIS field names.
 */
function applyFieldMappings(rows, entityMappings) {
  if (!Array.isArray(rows) || !rows.length) return [];
  if (!entityMappings || typeof entityMappings !== 'object' || !Object.keys(entityMappings).length) {
    return rows.map((r) => ({ ...r }));
  }

  return rows.map((raw) => {
    const out = { ...raw };
    for (const [lmsField, sisField] of Object.entries(entityMappings)) {
      if (!sisField) continue;
      const src = raw[sisField];
      if (src != null && String(src).trim() !== '') {
        out[lmsField] = src;
        // Also set lowercased canonical for CSV-style parsers
        out[String(lmsField).toLowerCase()] = src;
      }
    }
    return out;
  });
}

function mapOutboundRows(rows, entityMappings) {
  if (!Array.isArray(rows) || !rows.length) return [];
  if (!entityMappings || typeof entityMappings !== 'object' || !Object.keys(entityMappings).length) {
    return rows;
  }
  return rows.map((raw) => {
    const out = {};
    for (const [lmsField, sisField] of Object.entries(entityMappings)) {
      if (raw[lmsField] !== undefined) out[sisField || lmsField] = raw[lmsField];
    }
    // Keep unmapped keys as fallback for partner flexibility
    for (const [k, v] of Object.entries(raw)) {
      if (out[k] === undefined && entityMappings[k] === undefined) out[k] = v;
    }
    return out;
  });
}

module.exports = { applyFieldMappings, mapOutboundRows };
