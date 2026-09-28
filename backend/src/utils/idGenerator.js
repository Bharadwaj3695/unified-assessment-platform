const { User, Assessment } = require('../models');

/**
 * Generate a unique and deterministic student academic identifier.
 * Format: STU-YYYY-XXX (e.g., STU-2026-001)
 */
async function generateStudentId(year = new Date().getFullYear()) {
  const prefix = `STU-${year}-`;
  const existingCount = await User.countDocuments({
    studentId: { $regex: new RegExp(`^${prefix}`) },
  });

  let seq = existingCount + 1;
  let candidate = `${prefix}${String(seq).padStart(3, '0')}`;

  // Ensure absolute uniqueness
  while (await User.exists({ studentId: candidate })) {
    seq += 1;
    candidate = `${prefix}${String(seq).padStart(3, '0')}`;
  }

  return candidate;
}

/**
 * Generate a unique and deterministic faculty academic identifier.
 * Format: FAC-YYYY-XXX (e.g., FAC-2026-001)
 */
async function generateFacultyId(year = new Date().getFullYear()) {
  const prefix = `FAC-${year}-`;
  const existingCount = await User.countDocuments({
    facultyId: { $regex: new RegExp(`^${prefix}`) },
  });

  let seq = existingCount + 1;
  let candidate = `${prefix}${String(seq).padStart(3, '0')}`;

  // Ensure absolute uniqueness
  while (await User.exists({ facultyId: candidate })) {
    seq += 1;
    candidate = `${prefix}${String(seq).padStart(3, '0')}`;
  }

  return candidate;
}

/**
 * Safe, idempotent migration to backfill studentId and facultyId
 * for existing users who do not yet have assigned academic IDs.
 */
async function migrateUserAcademicIds() {
  const currentYear = new Date().getFullYear();

  // 1. Migrate Students lacking studentId
  const studentsWithoutId = await User.find({
    role: 'student',
    $or: [{ studentId: null }, { studentId: { $exists: false } }, { studentId: '' }],
  }).sort({ createdAt: 1, _id: 1 });

  for (const student of studentsWithoutId) {
    const newStudentId = await generateStudentId(currentYear);
    student.studentId = newStudentId;
    if (!student.department) {
      student.department = student.bio?.toLowerCase().includes('software')
        ? 'Software Engineering'
        : 'Computer Science';
    }
    await student.save();
  }

  // 2. Migrate Instructors lacking facultyId
  const instructorsWithoutId = await User.find({
    role: 'instructor',
    $or: [{ facultyId: null }, { facultyId: { $exists: false } }, { facultyId: '' }],
  }).sort({ createdAt: 1, _id: 1 });

  for (const instructor of instructorsWithoutId) {
    const newFacultyId = await generateFacultyId(currentYear);
    instructor.facultyId = newFacultyId;

    if (!instructor.department) {
      instructor.department = 'Computer Science & Engineering';
    }

    // Associate subject info from instructor's assessments if available
    if (!instructor.subjectName || !instructor.subjectId) {
      const ownedAssessment = await Assessment.findOne({ instructorId: instructor._id }).sort({ createdAt: 1 });
      if (ownedAssessment) {
        instructor.subjectName = ownedAssessment.category || 'Computer Science';
        instructor.subjectId = ownedAssessment.category === 'Artificial Intelligence' ? 'AI-401' : 'CS-301';
        instructor.subjectDescription = ownedAssessment.description
          ? ownedAssessment.description.slice(0, 120)
          : 'Instruction and assessment evaluation in algorithmic and software engineering principles.';
      } else {
        instructor.subjectName = 'Algorithmic Foundations & Systems';
        instructor.subjectId = 'CS-101';
        instructor.subjectDescription = 'Foundational academic curriculum, system architecture, and assessment oversight.';
      }
    }

    await instructor.save();
  }

  return {
    migratedStudentsCount: studentsWithoutId.length,
    migratedInstructorsCount: instructorsWithoutId.length,
  };
}

module.exports = {
  generateStudentId,
  generateFacultyId,
  migrateUserAcademicIds,
};
