/**
 * Deterministic upload E2E seeds — no production credentials required for gate tests.
 */
export const UPLOAD_SEED = {
  student: {
    email: process.env.E2E_STUDENT_EMAIL || 'student.upload.e2e@example.com',
    password: process.env.E2E_STUDENT_PASSWORD || 'TestUpload123!',
  },
  teacher: {
    email: process.env.E2E_TEACHER_EMAIL || 'teacher.upload.e2e@example.com',
    password: process.env.E2E_TEACHER_PASSWORD || 'TestUpload123!',
  },
  admin: {
    email: process.env.E2E_ADMIN_EMAIL || 'admin.upload.e2e@example.com',
    password: process.env.E2E_ADMIN_PASSWORD || 'TestUpload123!',
  },
  registrar: {
    email: process.env.E2E_REGISTRAR_EMAIL || 'registrar.upload.e2e@example.com',
    password: process.env.E2E_REGISTRAR_PASSWORD || 'TestUpload123!',
  },
};

export const CHAOS = {
  chunkStallMs: 2000,
  tokenExpirySimulation: true,
};
