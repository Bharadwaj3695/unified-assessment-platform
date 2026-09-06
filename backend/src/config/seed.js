const { User, Assessment, Question, Submission, Evaluation, Notification, AuditLog } = require('../models');
const { hashPassword } = require('../utils/password');

const seedDatabase = async () => {
  try {
    const existingAdmin = await User.findOne({ email: 'admin@uap.edu' });
    if (existingAdmin) {
      console.log('[Seed] Database already contains seed accounts. Skipping.');
      return;
    }

    console.log('[Seed] Seeding MongoDB with initial platform data...');

    // 1. Users
    const adminPassword = await hashPassword('Admin@123');
    const instructorPassword = await hashPassword('Instructor@123');
    const studentPassword = await hashPassword('Student@123');

    const admin = await User.create({
      name: 'System Administrator',
      email: 'admin@uap.edu',
      password: adminPassword,
      role: 'admin',
      status: 'active',
      isActive: true,
      bio: 'Lead platform administrator for Unified Assessment Platform.',
    });

    const instructor = await User.create({
      name: 'Prof. Alan Turing',
      email: 'instructor@uap.edu',
      password: instructorPassword,
      role: 'instructor',
      status: 'active',
      isActive: true,
      bio: 'Professor of Computer Science & Algorithmic Foundations.',
    });

    const student1 = await User.create({
      name: 'Alex Johnson',
      email: 'student@uap.edu',
      password: studentPassword,
      role: 'student',
      status: 'active',
      isActive: true,
      bio: 'Final year Software Engineering student.',
    });

    const student2 = await User.create({
      name: 'Alice Williams',
      email: 'alice@uap.edu',
      password: studentPassword,
      role: 'student',
      status: 'active',
      isActive: true,
      bio: 'Junior Developer and Cloud Enthusiast.',
    });

    const pendingStudent = await User.create({
      name: 'David Miller',
      email: 'pending@uap.edu',
      password: studentPassword,
      role: 'student',
      status: 'pending',
      isActive: false,
      instituteCode: 'CAMPUS-2025',
      bio: 'Prospective applicant awaiting account verification.',
    });

    // 2. Assessments
    const webDevAssessment = await Assessment.create({
      title: 'Full-Stack Web Architecture & Engineering',
      description:
        'Comprehensive evaluation covering RESTful design, relational caching, state management, and asynchronous operations.',
      category: 'Software Engineering',
      instructorId: instructor._id,
      durationMinutes: 45,
      totalPoints: 100,
      passingScore: 70,
      status: 'published',
      allowReview: true,
    });

    const dsaAssessment = await Assessment.create({
      title: 'Data Structures & Algorithmic Complexity',
      description:
        'Core concepts in algorithmic complexity, asymptotic bounds, balanced trees, and dynamic programming.',
      category: 'Computer Science',
      instructorId: instructor._id,
      durationMinutes: 60,
      totalPoints: 100,
      passingScore: 60,
      status: 'published',
      allowReview: true,
    });

    // 3. Questions for Web Dev Assessment (MCQ, Short Answer, Long Answer, True/False, Code)
    const questionsWebDev = await Question.insertMany([
      {
        assessmentId: webDevAssessment._id,
        questionText:
          'Which HTTP status code signifies that a requested resource has not been modified and can be retrieved from client cache?',
        type: 'mcq',
        options: [
          { id: 'a', text: '200 OK' },
          { id: 'b', text: '304 Not Modified' },
          { id: 'c', text: '400 Bad Request' },
          { id: 'd', text: '404 Not Found' },
        ],
        correctAnswer: 'b',
        explanation: 'HTTP 304 indicates that the resource has not been modified since header date.',
        points: 20,
        orderIndex: 0,
      },
      {
        assessmentId: webDevAssessment._id,
        questionText:
          'A JSON Web Token (JWT) signature alone encrypts the payload so that sensitive data cannot be read by anyone possessing the token.',
        type: 'true_false',
        options: [
          { id: 'true', text: 'True' },
          { id: 'false', text: 'False' },
        ],
        correctAnswer: 'false',
        explanation: 'JWT payload is base64url encoded and not encrypted; signature guarantees integrity only.',
        points: 15,
        orderIndex: 1,
      },
      {
        assessmentId: webDevAssessment._id,
        questionText:
          'Explain the difference between optimistic concurrency control and pessimistic locking in relational databases.',
        type: 'short_answer',
        options: [],
        correctAnswer:
          'Optimistic locking validates record versions at commit time without holding locks, while pessimistic locking holds exclusive database locks during transactions.',
        explanation: 'Optimistic locking minimizes locks and works well in read-heavy applications.',
        points: 25,
        orderIndex: 2,
      },
      {
        assessmentId: webDevAssessment._id,
        questionText:
          'Discuss how modern distributed web architectures achieve horizontal scalability and high availability. Detail database partitioning, stateless application tiers, and caching strategies.',
        type: 'long_answer',
        options: [],
        correctAnswer:
          'Comprehensive architectural essay addressing stateless microservices, read replicas/sharding, Redis caching tiers, and CDN edge termination.',
        explanation: 'Should cover tier decoupling, cache invalidation, and replication consistency trade-offs.',
        points: 40,
        orderIndex: 3,
      },
    ]);

    // 4. Questions for DSA Assessment
    await Question.insertMany([
      {
        assessmentId: dsaAssessment._id,
        questionText:
          'What is the worst-case time complexity of searching in an AVL Tree containing N elements?',
        type: 'mcq',
        options: [
          { id: 'a', text: 'O(1)' },
          { id: 'b', text: 'O(log N)' },
          { id: 'c', text: 'O(N)' },
          { id: 'd', text: 'O(N log N)' },
        ],
        correctAnswer: 'b',
        explanation: 'AVL trees are strictly height-balanced BSTs, ensuring O(log N) worst-case search.',
        points: 50,
        orderIndex: 0,
      },
      {
        assessmentId: dsaAssessment._id,
        questionText:
          'Breadth-First Search (BFS) on an unweighted graph is guaranteed to find the shortest path between two nodes.',
        type: 'true_false',
        options: [
          { id: 'true', text: 'True' },
          { id: 'false', text: 'False' },
        ],
        correctAnswer: 'true',
        explanation: 'BFS explores layer by layer, identifying the shortest path in unweighted graphs.',
        points: 50,
        orderIndex: 1,
      },
    ]);

    // 5. Sample Submission & Evaluation
    const q1 = questionsWebDev[0];
    const q2 = questionsWebDev[1];
    const q3 = questionsWebDev[2];
    const q4 = questionsWebDev[3];

    const submission1 = await Submission.create({
      assessmentId: webDevAssessment._id,
      studentId: student1._id,
      answers: {
        [q1._id.toString()]: 'b',
        [q2._id.toString()]: 'false',
        [q3._id.toString()]:
          'Optimistic locking validates record versions at commit time without holding locks, while pessimistic locking holds exclusive database locks during transactions.',
        [q4._id.toString()]:
          'Modern distributed architectures decouple the presentation and application tiers by maintaining stateless compute nodes that horizontally scale behind load balancers. State is externalized into managed database clusters utilizing sharding and replication, alongside Redis distributed caches.',
      },
      score: 95,
      totalPoints: 100,
      percentage: 95,
      passed: true,
      status: 'evaluated',
      startedAt: new Date(Date.now() - 3600000),
      submittedAt: new Date(Date.now() - 1800000),
      timeSpentSeconds: 1650,
      feedback: 'Outstanding grasp of web architectures and concurrency patterns.',
    });

    await Evaluation.create({
      submissionId: submission1._id,
      evaluatorId: instructor._id,
      questionFeedback: {
        [q1._id.toString()]: { pointsAwarded: 20, comment: 'Correct HTTP status code.' },
        [q2._id.toString()]: { pointsAwarded: 15, comment: 'Accurate distinction on signature vs encryption.' },
        [q3._id.toString()]: { pointsAwarded: 24, comment: 'Precise comparison of concurrency models.' },
        [q4._id.toString()]: { pointsAwarded: 36, comment: 'Thorough discussion of stateless scaling.' },
      },
      generalFeedback: 'Superb work! Demonstrated strong theoretical and architectural fundamentals.',
      finalScore: 95,
      status: 'completed',
      gradedAt: new Date(),
    });

    // 6. Notifications
    await Notification.create({
      userId: student1._id,
      title: 'Assessment Graded',
      message: 'Your submission for "Full-Stack Web Architecture & Engineering" has been graded. You scored 95%!',
      type: 'grade',
      link: `/student/results/${submission1._id}`,
    });

    await Notification.create({
      userId: student1._id,
      title: 'New Assessment Available',
      message: 'New assessment "Data Structures & Algorithmic Complexity" is now open for enrollment.',
      type: 'assessment',
      link: `/student/catalog`,
    });

    // 7. Audit Log
    await AuditLog.create({
      userId: admin._id,
      action: 'SYSTEM_BOOTSTRAP',
      entityType: 'System',
      details: { environment: 'production-ready', database: 'MongoDB + Mongoose' },
    });

    console.log('[Seed] Database successfully populated with initial accounts and test data!');
  } catch (error) {
    console.error('[Seed] Error seeding database:', error);
  }
};

module.exports = seedDatabase;
