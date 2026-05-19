const fs = require('fs');
const path = require('path');
const os = require('os');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { exportInstitutionBundle } = require('../../services/export/institutionalExport.service');
const {
  restoreInstitutionBundle,
  validateBundleIntegrity,
} = require('../../services/import/institutionalImport.service');
const { validateExportManifest } = require('../../shared/portability/exportManifest.cjs');
const { verifyBackupCompatibility } = require('../../services/backup/backupManifest.service');
const User = require('../../models/user.model');
const Course = require('../../models/course.model');
const StudentCourseGradeSnapshot = require('../../models/studentCourseGradeSnapshot.model');

let mongoServer;
let exportBaseDir;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  exportBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lms-export-'));
  process.env.INSTITUTION_EXPORTS_DIR = exportBaseDir;
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

async function seedMinimalInstitution() {
  const teacher = await User.create({
    firstName: 'Migration',
    lastName: 'Teacher',
    email: `migration.teacher.${Date.now()}@example.com`,
    password: 'password123',
    role: 'teacher',
  });
  const student = await User.create({
    firstName: 'Migration',
    lastName: 'Student',
    email: `migration.student.${Date.now()}@example.com`,
    password: 'password123',
    role: 'student',
  });
  const course = await Course.create({
    title: 'Migration Test Course',
    description: 'DR readiness',
    instructor: teacher._id,
    students: [student._id],
    published: true,
  });
  return { teacher, student, course };
}

describe('institution migration (Phase R1-R8)', () => {
  test('export manifest includes schemaVersion, counts, and integrity hashes', async () => {
    await seedMinimalInstitution();
    const result = await exportInstitutionBundle({
      sections: ['users', 'courses', 'enrollments', 'permissionsRoles'],
      registerBackup: false,
    });

    expect(result.manifest.schemaVersion).toBe(1);
    expect(result.manifest.exportVersion).toBe('2.0.0');
    expect(result.manifest.sections.length).toBeGreaterThan(0);
    for (const section of result.manifest.sections) {
      expect(section.contentHash).toBeTruthy();
      expect(section.recordCount).toBeGreaterThanOrEqual(0);
    }

    const validation = validateExportManifest(result.manifest);
    expect(validation.valid).toBe(true);

    const integrity = validateBundleIntegrity(result.directory, result.manifest);
    expect(integrity.valid).toBe(true);
  });

  test('partial domain export preserves deterministic section ordering', async () => {
    const result = await exportInstitutionBundle({
      sections: ['courses', 'users'],
      registerBackup: false,
    });
    const names = result.sections.map((s) => s.name);
    expect(names.indexOf('users')).toBeLessThan(names.indexOf('courses'));
  });

  test('validate-only restore passes for valid bundle', async () => {
    const result = await exportInstitutionBundle({
      sections: ['users', 'courses'],
      registerBackup: false,
    });
    const report = await restoreInstitutionBundle(result.directory, { validateOnly: true });
    expect(report.integrity.valid).toBe(true);
    expect(report.validateOnly).toBe(true);
  });

  test('finalized snapshot is not silently overwritten on restore', async () => {
    const { student, course } = await seedMinimalInstitution();
    const snap = await StudentCourseGradeSnapshot.create({
      student: student._id,
      course: course._id,
      term: 'Spring',
      year: 2025,
      finalPercent: 88,
      letterGrade: 'B',
      gradingPolicyVersion: 1,
      gradingPolicyHash: 'abc123',
      gradingPolicySnapshot: { gradeScale: [] },
      frozen: true,
      isCurrent: true,
    });

    const exported = await exportInstitutionBundle({
      sections: ['gradeSnapshots'],
      registerBackup: false,
    });

    const report = await restoreInstitutionBundle(exported.directory, {
      validateOnly: false,
      skipExisting: true,
    });
    expect(report.skipped).toBeGreaterThanOrEqual(1);

    const existing = await StudentCourseGradeSnapshot.findById(snap._id).lean();
    expect(existing.letterGrade).toBe('B');
  });

  test('corrupted manifest checksum is detected', async () => {
    const result = await exportInstitutionBundle({
      sections: ['users'],
      registerBackup: false,
    });
    const manifestPath = path.join(result.directory, 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    manifest.checksum = 'deadbeef';
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));

    const integrity = validateBundleIntegrity(result.directory, manifest);
    expect(integrity.valid).toBe(false);
  });

  test('backup compatibility verification', async () => {
    const result = await exportInstitutionBundle({
      sections: ['users'],
      registerBackup: false,
    });
    const compat = verifyBackupCompatibility(result.manifest);
    expect(compat.compatible).toBe(true);
  });

  test('remap-ids dry-run produces id map without writes', async () => {
    const exported = await exportInstitutionBundle({
      sections: ['users', 'courses'],
      registerBackup: false,
    });
    const report = await restoreInstitutionBundle(exported.directory, {
      dryRun: true,
      remapIds: true,
    });
    expect(report.dryRun).toBe(true);
    expect(report.idMap).toBeDefined();
  });
});
