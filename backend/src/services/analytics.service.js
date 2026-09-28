const mongoose = require('mongoose');
const { Submission, Assessment, Question, User, Evaluation } = require('../models');

class AnalyticsService {
  /**
   * Helper: Parse dateFilter or custom date range into MongoDB query expression
   * Supported filters: 'recent' (48h), 'last_week' (7d), 'last_month' (30d), or custom startDate/endDate
   */
  getDateRange(dateFilter, startDate, endDate) {
    if (startDate || endDate) {
      const range = {};
      if (startDate) range.$gte = new Date(startDate);
      if (endDate) range.$lte = new Date(endDate);
      return range;
    }

    if (!dateFilter || dateFilter === 'all') {
      return null;
    }

    const now = Date.now();
    if (dateFilter === 'recent') {
      return { $gte: new Date(now - 48 * 60 * 60 * 1000) };
    }
    if (dateFilter === 'last_week') {
      return { $gte: new Date(now - 7 * 24 * 60 * 60 * 1000) };
    }
    if (dateFilter === 'last_month') {
      return { $gte: new Date(now - 30 * 24 * 60 * 60 * 1000) };
    }

    return null;
  }

  /**
   * Streak System Definition:
   * - Meaningful academic activity: Completing/submitting an assessment (status: 'submitted' or 'evaluated').
   * - Timezone consistency: Dates are normalized to UTC calendar days (YYYY-MM-DD).
   * - Same-day deduplication: Multiple assessments completed on the same UTC day count as 1 active day.
   * - Consecutive days: A streak increments by 1 for each contiguous calendar day with at least one completion.
   * - Current streak: Counts back from today (or yesterday, if no activity today yet). Breaks if gap >= 2 days.
   * - Longest streak: The maximum consecutive day streak ever achieved across historical activity.
   */
  calculateStreaks(activityTimestamps) {
    if (!activityTimestamps || activityTimestamps.length === 0) {
      return {
        currentStreak: 0,
        longestStreak: 0,
        lastActiveDate: null,
        streakActiveToday: false,
      };
    }

    // Filter valid dates and extract unique sorted UTC date strings (YYYY-MM-DD)
    const validDates = activityTimestamps
      .filter(Boolean)
      .map((t) => new Date(t))
      .filter((d) => !isNaN(d.getTime()));

    if (validDates.length === 0) {
      return {
        currentStreak: 0,
        longestStreak: 0,
        lastActiveDate: null,
        streakActiveToday: false,
      };
    }

    const uniqueDateStrs = [...new Set(validDates.map((d) => d.toISOString().split('T')[0]))].sort();

    if (uniqueDateStrs.length === 0) {
      return {
        currentStreak: 0,
        longestStreak: 0,
        lastActiveDate: null,
        streakActiveToday: false,
      };
    }

    // Calculate longest streak across history
    let maxStreak = 1;
    let tempStreak = 1;
    const MS_PER_DAY = 86400000;

    for (let i = 1; i < uniqueDateStrs.length; i++) {
      const prevDate = new Date(uniqueDateStrs[i - 1] + 'T00:00:00.000Z').getTime();
      const currDate = new Date(uniqueDateStrs[i] + 'T00:00:00.000Z').getTime();
      const diffDays = Math.round((currDate - prevDate) / MS_PER_DAY);

      if (diffDays === 1) {
        tempStreak++;
        if (tempStreak > maxStreak) {
          maxStreak = tempStreak;
        }
      } else if (diffDays > 1) {
        tempStreak = 1;
      }
    }

    // Calculate current streak
    const todayStr = new Date().toISOString().split('T')[0];
    const yesterdayStr = new Date(Date.now() - MS_PER_DAY).toISOString().split('T')[0];
    const lastDateStr = uniqueDateStrs[uniqueDateStrs.length - 1];

    let currentStreak = 0;
    const streakActiveToday = lastDateStr === todayStr;

    // Current streak is active if last completion was either today or yesterday
    if (lastDateStr === todayStr || lastDateStr === yesterdayStr) {
      currentStreak = 1;
      for (let i = uniqueDateStrs.length - 1; i > 0; i--) {
        const currDate = new Date(uniqueDateStrs[i] + 'T00:00:00.000Z').getTime();
        const prevDate = new Date(uniqueDateStrs[i - 1] + 'T00:00:00.000Z').getTime();
        const diffDays = Math.round((currDate - prevDate) / MS_PER_DAY);

        if (diffDays === 1) {
          currentStreak++;
        } else {
          break;
        }
      }
    }

    return {
      currentStreak,
      longestStreak: Math.max(maxStreak, currentStreak),
      lastActiveDate: lastDateStr,
      streakActiveToday,
    };
  }

  /**
   * 1. Student Performance Dashboard Analytics
   */
  async getStudentPerformance(studentId, requestingUser, options = {}) {
    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      const err = new Error('Invalid student ID format');
      err.statusCode = 400;
      throw err;
    }

    // RBAC: Student can strictly only view their own analytics
    if (requestingUser.role === 'student' && requestingUser.id.toString() !== studentId.toString()) {
      const err = new Error('Access denied. You can only view your own performance analytics.');
      err.statusCode = 403;
      throw err;
    }

    const studentObjectId = new mongoose.Types.ObjectId(studentId);
    const dateRange = this.getDateRange(options.dateFilter, options.startDate, options.endDate);

    const matchQuery = { studentId: studentObjectId };
    if (dateRange) {
      matchQuery.createdAt = dateRange;
    }

    // Retrieve all submissions for this student within date range
    const submissions = await Submission.find(matchQuery)
      .populate('assessmentId', 'title category totalPoints passingScore')
      .sort({ submittedAt: -1, createdAt: -1 });

    const assessmentsAttempted = submissions.length;
    const completedSubmissions = submissions.filter(
      (s) => s.status === 'submitted' || s.status === 'evaluated'
    );
    const assessmentsCompleted = completedSubmissions.length;

    const passedSubmissions = completedSubmissions.filter((s) => Boolean(s.passed));
    const passedAssessments = passedSubmissions.length;
    const failedAssessments = assessmentsCompleted - passedAssessments;

    const passRate =
      assessmentsCompleted > 0 ? Math.round((passedAssessments / assessmentsCompleted) * 100) : 0;

    let overallAverageScore = null;
    if (assessmentsCompleted > 0) {
      const sumPercentage = completedSubmissions.reduce((acc, s) => acc + (s.percentage || 0), 0);
      overallAverageScore = Math.round((sumPercentage / assessmentsCompleted) * 10) / 10;
    }

    // Historical streaks: Always computed over the entire academic history for completeness
    const allHistoricalCompleted = await Submission.find({
      studentId: studentObjectId,
      status: { $in: ['submitted', 'evaluated'] },
      submittedAt: { $ne: null },
    }).select('submittedAt');

    const streakData = this.calculateStreaks(allHistoricalCompleted.map((s) => s.submittedAt));

    // Leaderboard Position: Determine overall rank across students
    let leaderboardPosition = null;
    if (assessmentsCompleted > 0) {
      try {
        const overallLeaderboard = await this.getLeaderboard({
          scope: 'overall',
          requestingUser,
          limit: 1000,
        });
        const myRank = overallLeaderboard.rankings.find(
          (r) => r.studentId?.toString() === studentId.toString()
        );
        if (myRank) {
          leaderboardPosition = {
            rank: myRank.rank,
            totalStudents: overallLeaderboard.totalParticipants,
          };
        }
      } catch (lErr) {
        console.warn('[AnalyticsService] Non-fatal leaderboard lookup warning:', lErr.message);
      }
    }

    // 3. Subject/Category Performance Breakdown
    const categoryMap = new Map();
    completedSubmissions.forEach((sub) => {
      const categoryName = sub.assessmentId?.category || 'General';
      if (!categoryMap.has(categoryName)) {
        categoryMap.set(categoryName, {
          category: categoryName,
          assessmentsAttempted: 0,
          assessmentsCompleted: 0,
          passedCount: 0,
          totalPercentage: 0,
        });
      }
      const entry = categoryMap.get(categoryName);
      entry.assessmentsCompleted++;
      if (sub.passed) entry.passedCount++;
      entry.totalPercentage += sub.percentage || 0;
    });

    // Also account for in_progress attempts under each category
    submissions.forEach((sub) => {
      const categoryName = sub.assessmentId?.category || 'General';
      if (!categoryMap.has(categoryName)) {
        categoryMap.set(categoryName, {
          category: categoryName,
          assessmentsAttempted: 0,
          assessmentsCompleted: 0,
          passedCount: 0,
          totalPercentage: 0,
        });
      }
      const entry = categoryMap.get(categoryName);
      entry.assessmentsAttempted++;
    });

    const categoryPerformance = Array.from(categoryMap.values()).map((cat) => ({
      category: cat.category,
      assessmentsAttempted: cat.assessmentsAttempted,
      assessmentsCompleted: cat.assessmentsCompleted,
      averageScore:
        cat.assessmentsCompleted > 0
          ? Math.round((cat.totalPercentage / cat.assessmentsCompleted) * 10) / 10
          : 0,
      passRate:
        cat.assessmentsCompleted > 0
          ? Math.round((cat.passedCount / cat.assessmentsCompleted) * 100)
          : 0,
    }));

    // 4. Recent Performance: latest completed/evaluated assessments (top 5)
    const recentResults = completedSubmissions.slice(0, 5).map((sub) => ({
      id: sub._id.toString(),
      assessmentId: sub.assessmentId?._id?.toString() || null,
      assessmentTitle: sub.assessmentId?.title || 'Assessment',
      category: sub.assessmentId?.category || 'General',
      date: sub.submittedAt || sub.createdAt,
      score: sub.score,
      totalPoints: sub.totalPoints,
      percentage: sub.percentage,
      passed: Boolean(sub.passed),
      resultStatus: sub.resultStatus || (sub.passed ? 'passed' : 'failed'),
      status: sub.status,
    }));

    return {
      overallAverageScore,
      assessmentsAttempted,
      assessmentsCompleted,
      passedAssessments,
      failedAssessments,
      passRate,
      currentStreak: streakData.currentStreak,
      bestStreak: streakData.longestStreak,
      longestStreak: streakData.longestStreak,
      streakActiveToday: streakData.streakActiveToday,
      leaderboardPosition,
      categoryPerformance,
      recentResults,
      hasData: assessmentsCompleted > 0,
    };
  }

  /**
   * 2. Score Trend: Chronological assessment performance for charting
   */
  async getStudentTrends(studentId, requestingUser, options = {}) {
    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      const err = new Error('Invalid student ID format');
      err.statusCode = 400;
      throw err;
    }

    if (requestingUser.role === 'student' && requestingUser.id.toString() !== studentId.toString()) {
      const err = new Error('Access denied. You can only view your own performance analytics.');
      err.statusCode = 403;
      throw err;
    }

    const studentObjectId = new mongoose.Types.ObjectId(studentId);
    const dateRange = this.getDateRange(options.dateFilter, options.startDate, options.endDate);

    const query = {
      studentId: studentObjectId,
      status: { $in: ['submitted', 'evaluated'] },
    };

    if (dateRange) {
      query.submittedAt = dateRange;
    }

    // Sorted ASCENDING by submitted date for natural chronological trendline
    const submissions = await Submission.find(query)
      .populate('assessmentId', 'title category totalPoints passingScore')
      .sort({ submittedAt: 1, createdAt: 1 });

    const trends = submissions.map((s) => {
      const dateVal = s.submittedAt || s.createdAt;
      return {
        id: s._id.toString(),
        date: dateVal ? new Date(dateVal).toISOString().split('T')[0] : '',
        timestamp: dateVal,
        assessmentId: s.assessmentId?._id?.toString() || '',
        assessmentTitle: s.assessmentId?.title || 'Assessment',
        category: s.assessmentId?.category || 'General',
        percentage: s.percentage || 0,
        score: s.score || 0,
        totalPoints: s.totalPoints || 100,
        passingScore: s.assessmentId?.passingScore ?? 60,
        passed: Boolean(s.passed),
      };
    });

    return trends;
  }

  /**
   * 5. Streak Details Endpoint
   */
  async getStudentStreak(studentId, requestingUser) {
    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      const err = new Error('Invalid student ID format');
      err.statusCode = 400;
      throw err;
    }

    if (requestingUser.role === 'student' && requestingUser.id.toString() !== studentId.toString()) {
      const err = new Error('Access denied. You can only view your own streak analytics.');
      err.statusCode = 403;
      throw err;
    }

    const submissions = await Submission.find({
      studentId: new mongoose.Types.ObjectId(studentId),
      status: { $in: ['submitted', 'evaluated'] },
      submittedAt: { $ne: null },
    })
      .select('submittedAt')
      .sort({ submittedAt: 1 });

    const timestamps = submissions.map((s) => s.submittedAt);
    const streakResult = this.calculateStreaks(timestamps);

    return {
      studentId,
      ...streakResult,
      totalActivityDays: timestamps.length > 0 ? new Set(timestamps.map((t) => new Date(t).toISOString().split('T')[0])).size : 0,
    };
  }

  /**
   * 6 & 7. Leaderboard & Fairness
   * Ranking rules:
   * - Assessment scope:
   *   1. percentage DESC
   *   2. timeSpentSeconds ASC (tie-breaker for equal score)
   *   3. submittedAt ASC (tie-breaker for equal time)
   *   Strictly excludes incomplete / in_progress submissions.
   * - Overall scope:
   *   1. averagePercentage DESC
   *   2. totalCompleted DESC
   *   3. totalPassed DESC
   * - Ties: Students with identical ranking metrics share the same rank number.
   * - Privacy: Exposes only rank, student displayName, academic ID code, and score. No email or password.
   */
  async getLeaderboard({
    scope = 'overall',
    assessmentId = null,
    category = null,
    requestingUser = null,
    page = 1,
    limit = 50,
  }) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    if (scope === 'assessment') {
      if (!assessmentId || !mongoose.Types.ObjectId.isValid(assessmentId)) {
        const err = new Error('Valid assessment ID is required for assessment-scoped leaderboard');
        err.statusCode = 400;
        throw err;
      }

      const assessment = await Assessment.findById(assessmentId);
      if (!assessment) {
        const err = new Error('Assessment not found');
        err.statusCode = 404;
        throw err;
      }

      // If restricted assessment, student must be assigned or be the instructor/admin
      if (
        requestingUser &&
        requestingUser.role === 'student' &&
        assessment.accessType === 'restricted'
      ) {
        const isAssigned =
          assessment.assignedStudents &&
          assessment.assignedStudents.some(
            (id) => id.toString() === requestingUser.id.toString()
          );
        if (!isAssigned) {
          const err = new Error('You are not authorized to view the leaderboard for this assessment.');
          err.statusCode = 403;
          throw err;
        }
      }

      // Fetch completed submissions only
      const submissions = await Submission.find({
        assessmentId: new mongoose.Types.ObjectId(assessmentId),
        status: { $in: ['submitted', 'evaluated'] },
      })
        .populate('studentId', 'name studentId avatar status')
        .sort({ percentage: -1, timeSpentSeconds: 1, submittedAt: 1, _id: 1 });

      // Filter out deleted/inactive students
      const eligible = submissions.filter((s) => s.studentId && s.studentId.status !== 'revoked');

      // Compute deterministic competition ranks with tie handling
      let currentRank = 1;
      const ranked = eligible.map((sub, index) => {
        let assignedRank = 1;
        if (index > 0) {
          const prev = eligible[index - 1];
          const isTied =
            prev.percentage === sub.percentage &&
            (prev.timeSpentSeconds || 0) === (sub.timeSpentSeconds || 0);
          if (isTied) {
            assignedRank = currentRank;
          } else {
            currentRank = index + 1;
            assignedRank = currentRank;
          }
        } else {
          currentRank = 1;
          assignedRank = 1;
        }

        const studentObjId = sub.studentId?._id ? sub.studentId._id.toString() : '';
        return {
          rank: assignedRank,
          id: sub._id.toString(),
          studentId: studentObjId,
          studentDisplayName: sub.studentId?.name || 'Anonymous Student',
          studentCode: sub.studentId?.studentId || 'STU-***',
          avatar: sub.studentId?.avatar || null,
          score: sub.score,
          totalPoints: sub.totalPoints,
          percentage: sub.percentage,
          timeSpentSeconds: sub.timeSpentSeconds || 0,
          submittedAt: sub.submittedAt,
          isCurrentUser:
            requestingUser && studentObjId === requestingUser.id?.toString(),
        };
      });

      const paginated = ranked.slice(skip, skip + limitNum);

      return {
        scope: 'assessment',
        assessmentId: assessment._id.toString(),
        assessmentTitle: assessment.title,
        category: assessment.category,
        totalParticipants: ranked.length,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(ranked.length / limitNum) || 1,
        rankings: paginated,
      };
    }

    // Overall / Student Performance Scope (Optionally filtered by category)
    const pipeline = [];

    // Match completed submissions
    const matchStage = {
      status: { $in: ['submitted', 'evaluated'] },
    };

    if (category && category !== 'All') {
      const assessmentsInCat = await Assessment.find({
        category: { $regex: new RegExp(`^${category.trim()}$`, 'i') },
      }).select('_id');
      matchStage.assessmentId = { $in: assessmentsInCat.map((a) => a._id) };
    }

    pipeline.push({ $match: matchStage });

    // Group by studentId and calculate averages
    pipeline.push({
      $group: {
        _id: '$studentId',
        averagePercentage: { $avg: '$percentage' },
        totalCompleted: { $sum: 1 },
        totalPassed: { $sum: { $cond: ['$passed', 1, 0] } },
        lastActive: { $max: '$submittedAt' },
      },
    });

    // Lookup user details
    pipeline.push({
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'student',
      },
    });

    pipeline.push({ $unwind: '$student' });

    // Filter active student accounts
    pipeline.push({
      $match: {
        'student.role': 'student',
        'student.status': 'active',
      },
    });

    // Deterministic sort: avg percentage DESC, completed count DESC, passed count DESC, student name ASC
    pipeline.push({
      $sort: {
        averagePercentage: -1,
        totalCompleted: -1,
        totalPassed: -1,
        'student.name': 1,
      },
    });

    const aggregatedStudents = await Submission.aggregate(pipeline);

    // Assign standard competition ranks with tie handling
    let currentRank = 1;
    const rankedOverall = aggregatedStudents.map((item, index) => {
      let assignedRank = 1;
      const roundedAvg = Math.round((item.averagePercentage || 0) * 10) / 10;

      if (index > 0) {
        const prev = aggregatedStudents[index - 1];
        const prevRounded = Math.round((prev.averagePercentage || 0) * 10) / 10;
        const isTied =
          prevRounded === roundedAvg &&
          prev.totalCompleted === item.totalCompleted &&
          prev.totalPassed === item.totalPassed;

        if (isTied) {
          assignedRank = currentRank;
        } else {
          currentRank = index + 1;
          assignedRank = currentRank;
        }
      } else {
        currentRank = 1;
        assignedRank = 1;
      }

      const sId = item._id ? item._id.toString() : '';
      return {
        rank: assignedRank,
        id: sId,
        studentId: sId,
        studentDisplayName: item.student.name,
        studentCode: item.student.studentId || 'STU-***',
        department: item.student.department || 'Academic',
        avatar: item.student.avatar || null,
        averagePercentage: roundedAvg,
        totalCompleted: item.totalCompleted,
        totalPassed: item.totalPassed,
        lastActive: item.lastActive,
        isCurrentUser: requestingUser && sId === requestingUser.id?.toString(),
      };
    });

    const paginated = rankedOverall.slice(skip, skip + limitNum);

    return {
      scope: 'overall',
      category: category || null,
      totalParticipants: rankedOverall.length,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(rankedOverall.length / limitNum) || 1,
      rankings: paginated,
    };
  }

  /**
   * 8 & 10. Faculty Assessment Analytics & Score Distribution
   */
  async getInstructorAssessmentAnalytics(assessmentId, requestingUser) {
    if (!mongoose.Types.ObjectId.isValid(assessmentId)) {
      const err = new Error('Invalid assessment ID format');
      err.statusCode = 400;
      throw err;
    }

    const assessment = await Assessment.findById(assessmentId);
    if (!assessment) {
      const err = new Error('Assessment not found');
      err.statusCode = 404;
      throw err;
    }

    // RBAC: Instructor must own this assessment or be an admin
    const ownerId = (assessment.instructorId?._id || assessment.instructorId)?.toString();
    if (requestingUser.role !== 'admin' && ownerId !== requestingUser.id.toString()) {
      const err = new Error('Access denied. You do not own this assessment.');
      err.statusCode = 403;
      throw err;
    }

    const totalAssigned =
      assessment.accessType === 'restricted'
        ? assessment.assignedStudents?.length || 0
        : null;

    // Fetch all submissions for this assessment
    const submissions = await Submission.find({
      assessmentId: new mongoose.Types.ObjectId(assessmentId),
    })
      .populate('studentId', 'name studentId email avatar')
      .sort({ submittedAt: -1, createdAt: -1 });

    const startedAttempts = submissions.length;
    const completedSubmissions = submissions.filter(
      (s) => s.status === 'submitted' || s.status === 'evaluated'
    );
    const evaluatedSubmissions = completedSubmissions.filter((s) => s.status === 'evaluated');
    const pendingEvaluations = completedSubmissions.filter(
      (s) => s.status === 'submitted' || s.evaluationStatus === 'pending'
    );

    const completedCount = completedSubmissions.length;
    const evaluatedCount = evaluatedSubmissions.length;
    const pendingCount = pendingEvaluations.length;

    let averageScore = null;
    let highestScore = null;
    let lowestScore = null;
    let passRate = 0;

    // Score distribution buckets: 0-20, 21-40, 41-60, 61-80, 81-100
    const scoreDistribution = [
      { bucket: '0–20', count: 0, range: [0, 20] },
      { bucket: '21–40', count: 0, range: [21, 40] },
      { bucket: '41–60', count: 0, range: [41, 60] },
      { bucket: '61–80', count: 0, range: [61, 80] },
      { bucket: '81–100', count: 0, range: [81, 100] },
    ];

    if (completedCount > 0) {
      const scores = completedSubmissions.map((s) => s.percentage || 0);
      const sum = scores.reduce((a, b) => a + b, 0);
      averageScore = Math.round((sum / completedCount) * 10) / 10;
      highestScore = Math.max(...scores);
      lowestScore = Math.min(...scores);

      const passedCount = completedSubmissions.filter((s) => Boolean(s.passed)).length;
      passRate = Math.round((passedCount / completedCount) * 100);

      completedSubmissions.forEach((s) => {
        const pct = Math.round(s.percentage || 0);
        if (pct <= 20) scoreDistribution[0].count++;
        else if (pct <= 40) scoreDistribution[1].count++;
        else if (pct <= 60) scoreDistribution[2].count++;
        else if (pct <= 80) scoreDistribution[3].count++;
        else scoreDistribution[4].count++;
      });
    }

    let evaluationCompletionStatus = 'no_submissions';
    if (completedCount > 0) {
      evaluationCompletionStatus = pendingCount === 0 ? 'completed' : 'pending';
    }

    // Student performance list for this assessment
    const studentSubmissions = completedSubmissions.map((sub) => ({
      id: sub._id.toString(),
      studentId: sub.studentId?._id?.toString() || '',
      studentName: sub.studentId?.name || 'Student',
      studentCode: sub.studentId?.studentId || 'STU-***',
      avatar: sub.studentId?.avatar || null,
      score: sub.score,
      totalPoints: sub.totalPoints,
      percentage: sub.percentage,
      passed: Boolean(sub.passed),
      status: sub.status,
      evaluationStatus: sub.evaluationStatus,
      submittedAt: sub.submittedAt,
    }));

    return {
      assessment: {
        id: assessment._id.toString(),
        title: assessment.title,
        category: assessment.category,
        totalPoints: assessment.totalPoints,
        passingScore: assessment.passingScore,
        accessType: assessment.accessType,
        status: assessment.status,
      },
      totalAssigned,
      startedAttempts,
      completedSubmissions: completedCount,
      evaluatedSubmissions: evaluatedCount,
      pendingEvaluations: pendingCount,
      averageScore,
      highestScore,
      lowestScore,
      passRate,
      evaluationCompletionStatus,
      scoreDistribution,
      studentSubmissions,
    };
  }

  /**
   * 9. Question-Level Analytics
   */
  async getInstructorQuestionAnalytics(assessmentId, requestingUser) {
    if (!mongoose.Types.ObjectId.isValid(assessmentId)) {
      const err = new Error('Invalid assessment ID format');
      err.statusCode = 400;
      throw err;
    }

    const assessment = await Assessment.findById(assessmentId);
    if (!assessment) {
      const err = new Error('Assessment not found');
      err.statusCode = 404;
      throw err;
    }

    // RBAC: Verify assessment ownership
    const ownerId = (assessment.instructorId?._id || assessment.instructorId)?.toString();
    if (requestingUser.role !== 'admin' && ownerId !== requestingUser.id.toString()) {
      const err = new Error('Access denied. You do not own this assessment.');
      err.statusCode = 403;
      throw err;
    }

    const questions = await Question.find({ assessmentId }).sort({ orderIndex: 1 });
    const completedSubmissions = await Submission.find({
      assessmentId,
      status: { $in: ['submitted', 'evaluated'] },
    });

    const evaluations = await Evaluation.find({
      submissionId: { $in: completedSubmissions.map((s) => s._id) },
    });

    // Map evaluations by submissionId string
    const evalMap = new Map();
    evaluations.forEach((ev) => {
      evalMap.set(ev.submissionId.toString(), ev);
    });

    const questionAnalytics = questions.map((q, idx) => {
      const qId = q._id.toString();
      const isObjective = q.type === 'mcq' || q.type === 'true_false';

      let attempts = 0;
      let correctCount = 0;
      let incorrectCount = 0;
      let optionDistribution = {};

      if (q.type === 'mcq' && q.options) {
        q.options.forEach((opt) => {
          optionDistribution[opt.id] = { id: opt.id, text: opt.text, count: 0 };
        });
      }

      if (isObjective) {
        completedSubmissions.forEach((sub) => {
          const answersObj =
            sub.answers instanceof Map
              ? Object.fromEntries(sub.answers)
              : sub.answers || {};
          const ans = answersObj[qId];

          if (ans !== undefined && ans !== null && ans !== '') {
            attempts++;
            if (q.type === 'mcq' && optionDistribution[ans]) {
              optionDistribution[ans].count++;
            }

            const isCorrect =
              String(ans).trim().toLowerCase() ===
              String(q.correctAnswer).trim().toLowerCase();
            if (isCorrect) {
              correctCount++;
            } else {
              incorrectCount++;
            }
          }
        });

        const correctPercentage =
          attempts > 0 ? Math.round((correctCount / attempts) * 100) : 0;
        const averageMarks =
          attempts > 0 ? Math.round((correctCount * q.points / attempts) * 10) / 10 : 0;
        const isDifficult = attempts >= 1 && correctPercentage < 50;

        return {
          questionId: qId,
          orderIndex: idx + 1,
          questionText: q.questionText,
          type: q.type,
          isObjective: true,
          points: q.points,
          attempts,
          correctCount,
          incorrectCount,
          correctPercentage,
          averageMarks,
          isDifficult,
          options: q.options || [],
          optionDistribution: Object.values(optionDistribution),
        };
      }

      // Subjective question analytics (short_answer, long_answer, code, file_upload)
      // Strictly do NOT fake automated correctness! Use manual evaluation feedback data.
      let evaluatedCount = 0;
      let totalAwardedPoints = 0;

      completedSubmissions.forEach((sub) => {
        const answersObj =
          sub.answers instanceof Map
            ? Object.fromEntries(sub.answers)
            : sub.answers || {};
        const ans = answersObj[qId];

        if (ans !== undefined && ans !== null && ans !== '') {
          attempts++;
        }

        const ev = evalMap.get(sub._id.toString());
        if (ev) {
          const qFeedback =
            ev.questionFeedback instanceof Map
              ? ev.questionFeedback.get(qId)
              : ev.questionFeedback?.[qId];

          if (qFeedback && qFeedback.pointsAwarded !== undefined) {
            evaluatedCount++;
            totalAwardedPoints += Number(qFeedback.pointsAwarded) || 0;
          }
        }
      });

      const averageMarks =
        evaluatedCount > 0 ? Math.round((totalAwardedPoints / evaluatedCount) * 10) / 10 : null;
      const averagePercentage =
        evaluatedCount > 0 && q.points > 0
          ? Math.round((totalAwardedPoints / (evaluatedCount * q.points)) * 100)
          : null;
      const isDifficult =
        evaluatedCount > 0 && averagePercentage !== null && averagePercentage < 50;

      return {
        questionId: qId,
        orderIndex: idx + 1,
        questionText: q.questionText,
        type: q.type,
        isObjective: false,
        points: q.points,
        attempts,
        evaluatedCount,
        averageMarks,
        averagePercentage,
        isDifficult,
      };
    });

    return {
      assessmentId,
      assessmentTitle: assessment.title,
      totalQuestions: questions.length,
      questions: questionAnalytics,
    };
  }

  /**
   * 11. Admin Platform Overview Analytics
   */
  async getAdminOverview(options = {}) {
    const [
      totalActiveStudents,
      totalInstructors,
      totalAssessments,
      publishedAssessments,
      totalSubmissions,
      completedSubmissions,
      evaluatedSubmissions,
      pendingEvaluations,
    ] = await Promise.all([
      User.countDocuments({ role: 'student', status: 'active' }),
      User.countDocuments({ role: 'instructor', status: 'active' }),
      Assessment.countDocuments(),
      Assessment.countDocuments({ status: 'published' }),
      Submission.countDocuments(),
      Submission.countDocuments({ status: { $in: ['submitted', 'evaluated'] } }),
      Submission.countDocuments({ status: 'evaluated' }),
      Submission.countDocuments({ evaluationStatus: 'pending' }),
    ]);

    // Aggregate overall scores and pass rate
    const scoreAgg = await Submission.aggregate([
      { $match: { status: { $in: ['submitted', 'evaluated'] } } },
      {
        $group: {
          _id: null,
          avgPercentage: { $avg: '$percentage' },
          passedCount: { $sum: { $cond: ['$passed', 1, 0] } },
          totalCount: { $sum: 1 },
        },
      },
    ]);

    let overallAverageScore = 0;
    let overallPassRate = 0;
    if (scoreAgg.length > 0 && scoreAgg[0].totalCount > 0) {
      overallAverageScore = Math.round(scoreAgg[0].avgPercentage * 10) / 10;
      overallPassRate = Math.round((scoreAgg[0].passedCount / scoreAgg[0].totalCount) * 100);
    }

    // Activity trendline: Submissions completed per day
    const daysLimit = options.dateFilter === 'last_month' ? 30 : 7;
    const sinceDate = new Date(Date.now() - daysLimit * 24 * 60 * 60 * 1000);

    const activityAgg = await Submission.aggregate([
      {
        $match: {
          submittedAt: { $gte: sinceDate },
          status: { $in: ['submitted', 'evaluated'] },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$submittedAt' } },
          submissions: { $sum: 1 },
          passed: { $sum: { $cond: ['$passed', 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Category distribution breakdown
    const categoryAgg = await Assessment.aggregate([
      {
        $group: {
          _id: '$category',
          totalAssessments: { $sum: 1 },
          published: { $sum: { $cond: [{ $eq: ['$status', 'published'] }, 1, 0] } },
        },
      },
      { $sort: { totalAssessments: -1 } },
    ]);

    const categories = categoryAgg.map((c) => ({
      category: c._id || 'General',
      totalAssessments: c.totalAssessments,
      published: c.published,
    }));

    return {
      totalActiveStudents,
      totalInstructors,
      totalAssessments,
      publishedAssessments,
      totalSubmissions,
      completedSubmissions,
      evaluatedSubmissions,
      pendingEvaluations,
      overallAverageScore,
      overallPassRate,
      activityTrend: activityAgg.map((a) => ({
        date: a._id,
        submissions: a.submissions,
        passed: a.passed,
      })),
      categories,
    };
  }
}

module.exports = new AnalyticsService();
