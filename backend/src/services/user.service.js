const { User, Submission, Assessment } = require('../models');

class UserService {
  /**
   * Derive truthful student academic summary from actual platform evaluation data.
   * Do NOT hardcode claims like "Top in class" unless statistically computed.
   */
  async getStudentAcademicSummary(studentId) {
    const submissions = await Submission.find({
      studentId,
      status: { $in: ['submitted', 'evaluated'] },
    }).populate('assessmentId', 'title category totalPoints passingScore');

    const evaluated = submissions.filter((s) => s.status === 'evaluated');

    if (evaluated.length === 0) {
      return {
        summary: 'Enrolled Student — Ready for First Assessment',
        metrics: {
          totalCompleted: 0,
          averagePercentage: 0,
          passedCount: 0,
          strongestCategory: null,
          classRank: null,
        },
      };
    }

    const totalCompleted = evaluated.length;
    const passedCount = evaluated.filter((s) => s.passed).length;
    const avgPercentage = Math.round(
      evaluated.reduce((acc, s) => acc + (s.percentage || 0), 0) / evaluated.length
    );

    // 1. Group performance by category
    const categoryStats = {};
    for (const sub of evaluated) {
      const cat = sub.assessmentId?.category || 'General';
      if (!categoryStats[cat]) {
        categoryStats[cat] = { totalPct: 0, count: 0 };
      }
      categoryStats[cat].totalPct += sub.percentage || 0;
      categoryStats[cat].count += 1;
    }

    let strongestCategory = null;
    let highestCatAvg = -1;
    for (const [cat, data] of Object.entries(categoryStats)) {
      const avg = Math.round(data.totalPct / data.count);
      if (avg >= 70 && avg > highestCatAvg) {
        highestCatAvg = avg;
        strongestCategory = cat;
      }
    }

    // 2. Derive Class Rank / Percentile if class-level cohort data is sufficient
    // Count all distinct students with evaluated submissions
    const allEvaluatedSubmissions = await Submission.find({ status: 'evaluated' })
      .select('studentId percentage');

    const studentAverages = {};
    for (const s of allEvaluatedSubmissions) {
      const sId = s.studentId.toString();
      if (!studentAverages[sId]) {
        studentAverages[sId] = { total: 0, count: 0 };
      }
      studentAverages[sId].total += s.percentage || 0;
      studentAverages[sId].count += 1;
    }

    const cohortList = Object.entries(studentAverages).map(([id, data]) => ({
      studentId: id,
      avg: Math.round(data.total / data.count),
    })).sort((a, b) => b.avg - a.avg);

    let summaryText = '';
    let classRank = null;

    if (cohortList.length >= 3) {
      const currentRankIndex = cohortList.findIndex((c) => c.studentId === studentId.toString());
      if (currentRankIndex !== -1) {
        classRank = currentRankIndex + 1;
        const percentile = Math.round((classRank / cohortList.length) * 100);

        if (percentile <= 10 && cohortList.length >= 5) {
          summaryText = `Top 10% of class (Cohort Rank #${classRank})`;
        } else if (classRank <= 3) {
          summaryText = `Class Rank #${classRank} (${avgPercentage}% overall average)`;
        } else if (strongestCategory) {
          summaryText = `Strong performance in ${strongestCategory} (${highestCatAvg}% average)`;
        } else {
          summaryText = `Rank #${classRank} in class cohort (${totalCompleted} assessments completed)`;
        }
      }
    }

    if (!summaryText) {
      if (strongestCategory) {
        summaryText = `Strong performance in ${strongestCategory}`;
      } else {
        summaryText = `${totalCompleted} Assessment${totalCompleted > 1 ? 's' : ''} Completed (${avgPercentage}% avg score)`;
      }
    }

    return {
      summary: summaryText,
      metrics: {
        totalCompleted,
        passedCount,
        averagePercentage: avgPercentage,
        strongestCategory,
        classRank,
      },
    };
  }

  /**
   * Get academic profile for user.
   */
  async getProfile(userId) {
    const user = await User.findById(userId);
    if (!user) {
      const err = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }

    const profile = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      isActive: user.isActive,
      avatar: user.avatar,
      bio: user.bio,
      department: user.department || (user.role === 'student' ? 'Computer Science' : 'Computer Science & Engineering'),
      mfaEnabled: Boolean(user.mfaEnabled),
      mfaEnrolledAt: user.mfaEnrolledAt || null,
      createdAt: user.createdAt,
    };

    if (user.role === 'student') {
      profile.studentId = user.studentId;
      const academicData = await this.getStudentAcademicSummary(user._id);
      profile.academicSummary = academicData.summary;
      profile.academicMetrics = academicData.metrics;
    } else if (user.role === 'instructor') {
      profile.facultyId = user.facultyId;
      profile.subjectId = user.subjectId || 'CS-101';
      profile.subjectName = user.subjectName || 'Algorithmic Foundations';
      profile.subjectDescription =
        user.subjectDescription ||
        'Academic instruction and assessment evaluation across computer science principles.';
    } else if (user.role === 'admin') {
      profile.adminId = user.adminId;
    }

    return profile;
  }

  /**
   * Update profile with strict immutability checks.
   */
  async updateProfile(userId, updateData) {
    // 1. Explicitly reject attempts to change immutable IDs
    if (updateData.studentId !== undefined) {
      const err = new Error('Student ID is permanent and immutable after creation');
      err.statusCode = 400;
      throw err;
    }

    if (updateData.facultyId !== undefined) {
      const err = new Error('Faculty ID is permanent and immutable after creation');
      err.statusCode = 400;
      throw err;
    }

    if (updateData.adminId !== undefined) {
      const err = new Error('Admin ID is permanent and immutable after creation');
      err.statusCode = 400;
      throw err;
    }

    if (updateData.googleId !== undefined || updateData.authProvider !== undefined) {
      const err = new Error('OAuth authentication identifiers cannot be modified via profile update');
      err.statusCode = 400;
      throw err;
    }

    if (
      updateData.role !== undefined ||
      updateData.status !== undefined ||
      updateData.isActive !== undefined ||
      updateData.approvedAt !== undefined ||
      updateData.revokedAt !== undefined
    ) {
      const err = new Error('Administrative account roles and statuses cannot be modified via profile update');
      err.statusCode = 400;
      throw err;
    }

    if (
      updateData.mfaEnabled !== undefined ||
      updateData.mfaSecret !== undefined ||
      updateData.mfaPendingSecret !== undefined ||
      updateData.mfaRecoveryCodes !== undefined ||
      updateData.tokenVersion !== undefined
    ) {
      const err = new Error('MFA settings and security tokens cannot be modified via profile update');
      err.statusCode = 400;
      throw err;
    }

    const user = await User.findById(userId);
    if (!user) {
      const err = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }

    if (updateData.name && updateData.name.trim().length >= 2) {
      user.name = updateData.name.trim();
    }
    if (updateData.bio !== undefined) {
      user.bio = updateData.bio ? updateData.bio.trim() : '';
    }
    if (updateData.department !== undefined) {
      user.department = updateData.department ? updateData.department.trim() : null;
    }

    if (user.role === 'instructor') {
      if (updateData.subjectId !== undefined) {
        user.subjectId = updateData.subjectId ? updateData.subjectId.trim() : user.subjectId;
      }
      if (updateData.subjectName !== undefined) {
        user.subjectName = updateData.subjectName ? updateData.subjectName.trim() : user.subjectName;
      }
      if (updateData.subjectDescription !== undefined) {
        user.subjectDescription = updateData.subjectDescription
          ? updateData.subjectDescription.trim()
          : user.subjectDescription;
      }
    }

    await user.save();
    return this.getProfile(user._id);
  }

  /**
   * Faculty viewing student's profile: authorized only if student is enrolled in or
   * has submitted to an assessment owned by this faculty.
   */
  async getStudentProfileForFaculty(facultyId, studentTargetId) {
    const student = await User.findOne({ _id: studentTargetId, role: 'student' });
    if (!student) {
      const err = new Error('Student not found');
      err.statusCode = 404;
      throw err;
    }

    // Check if faculty owns any assessment that this student submitted or is assigned to
    const facultyAssessments = await Assessment.find({ instructorId: facultyId }).select('_id assignedStudents');
    const assessmentIds = facultyAssessments.map((a) => a._id);

    const hasSubmission = await Submission.exists({
      studentId: studentTargetId,
      assessmentId: { $in: assessmentIds },
    });

    const isAssigned = facultyAssessments.some((a) =>
      a.assignedStudents && a.assignedStudents.some((s) => s.toString() === studentTargetId.toString())
    );

    if (!hasSubmission && !isAssigned) {
      const err = new Error('Access denied. You can only view profiles of students associated with your assessments.');
      err.statusCode = 403;
      throw err;
    }

    const academicData = await this.getStudentAcademicSummary(student._id);
    return {
      id: student._id.toString(),
      name: student.name,
      email: student.email,
      studentId: student.studentId,
      avatar: student.avatar,
      department: student.department || 'Computer Science',
      academicSummary: academicData.summary,
      academicMetrics: academicData.metrics,
    };
  }
}

module.exports = new UserService();
