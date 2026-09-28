const { User, Assessment, Question, Submission, Evaluation, Notification, AuditLog, BankQuestion } = require('../models');
const { hashPassword } = require('../utils/password');
const { migrateUserAcademicIds } = require('../utils/idGenerator');

const seedStandardizedDemoAccounts = async () => {
  const adminPassword = await hashPassword('Admin@123');
  const instructorPassword = await hashPassword('Instructor@123');
  const studentPassword = await hashPassword('Student@123');

  const standardizedAccounts = [
    // Students STU-001 to STU-005
    {
      name: 'Demo Student 01',
      email: 'std01@uap.edu',
      password: studentPassword,
      role: 'student',
      studentId: 'STU-001',
      department: 'Computer Science',
      status: 'active',
      isActive: true,
      approvedAt: new Date(),
      bio: 'Standardized demo student account 01.',
    },
    {
      name: 'Demo Student 02',
      email: 'std02@uap.edu',
      password: studentPassword,
      role: 'student',
      studentId: 'STU-002',
      department: 'Software Engineering',
      status: 'active',
      isActive: true,
      approvedAt: new Date(),
      bio: 'Standardized demo student account 02.',
    },
    {
      name: 'Demo Student 03',
      email: 'std03@uap.edu',
      password: studentPassword,
      role: 'student',
      studentId: 'STU-003',
      department: 'Data Science',
      status: 'active',
      isActive: true,
      approvedAt: new Date(),
      bio: 'Standardized demo student account 03.',
    },
    {
      name: 'Demo Student 04',
      email: 'std04@uap.edu',
      password: studentPassword,
      role: 'student',
      studentId: 'STU-004',
      department: 'Computer Science',
      status: 'active',
      isActive: true,
      approvedAt: new Date(),
      bio: 'Standardized demo student account 04.',
    },
    {
      name: 'Demo Student 05',
      email: 'std05@uap.edu',
      password: studentPassword,
      role: 'student',
      studentId: 'STU-005',
      department: 'Artificial Intelligence',
      status: 'active',
      isActive: true,
      approvedAt: new Date(),
      bio: 'Standardized demo student account 05.',
    },

    // Instructors FAC-001 to FAC-005
    {
      name: 'Demo Instructor 01',
      email: 'ins01@uap.edu',
      password: instructorPassword,
      role: 'instructor',
      facultyId: 'FAC-001',
      department: 'Computer Science & Engineering',
      subjectName: 'Software Engineering',
      subjectId: 'CS-301',
      subjectDescription: 'Software lifecycle, design patterns, testing, and modern deployment pipelines.',
      status: 'active',
      isActive: true,
      approvedAt: new Date(),
      bio: 'Standardized demo faculty instructor 01.',
    },
    {
      name: 'Demo Instructor 02',
      email: 'ins02@uap.edu',
      password: instructorPassword,
      role: 'instructor',
      facultyId: 'FAC-002',
      department: 'Computer Science & Engineering',
      subjectName: 'Data Structures & Algorithms',
      subjectId: 'CS-201',
      subjectDescription: 'Algorithmic efficiency, graph theory, trees, and dynamic programming.',
      status: 'active',
      isActive: true,
      approvedAt: new Date(),
      bio: 'Standardized demo faculty instructor 02.',
    },
    {
      name: 'Demo Instructor 03',
      email: 'ins03@uap.edu',
      password: instructorPassword,
      role: 'instructor',
      facultyId: 'FAC-003',
      department: 'Computer Science & Engineering',
      subjectName: 'Artificial Intelligence',
      subjectId: 'AI-401',
      subjectDescription: 'Machine learning fundamentals, neural architectures, and intelligent systems.',
      status: 'active',
      isActive: true,
      approvedAt: new Date(),
      bio: 'Standardized demo faculty instructor 03.',
    },
    {
      name: 'Demo Instructor 04',
      email: 'ins04@uap.edu',
      password: instructorPassword,
      role: 'instructor',
      facultyId: 'FAC-004',
      department: 'Computer Science & Engineering',
      subjectName: 'Distributed Systems',
      subjectId: 'CS-402',
      subjectDescription: 'Consensus protocols, microservices, RPC architectures, and distributed storage.',
      status: 'active',
      isActive: true,
      approvedAt: new Date(),
      bio: 'Standardized demo faculty instructor 04.',
    },
    {
      name: 'Demo Instructor 05',
      email: 'ins05@uap.edu',
      password: instructorPassword,
      role: 'instructor',
      facultyId: 'FAC-005',
      department: 'Computer Science & Engineering',
      subjectName: 'Database Management Systems',
      subjectId: 'CS-302',
      subjectDescription: 'Relational schemas, query optimization, indexing, and NoSQL design.',
      status: 'active',
      isActive: true,
      approvedAt: new Date(),
      bio: 'Standardized demo faculty instructor 05.',
    },

    // Admins ADM-001 to ADM-002
    {
      name: 'Demo Admin 01',
      email: 'admin01@uap.edu',
      password: adminPassword,
      role: 'admin',
      adminId: 'ADM-001',
      department: 'Platform Operations',
      status: 'active',
      isActive: true,
      approvedAt: new Date(),
      bio: 'Standardized platform governance administrator 01.',
    },
    {
      name: 'Demo Admin 02',
      email: 'admin02@uap.edu',
      password: adminPassword,
      role: 'admin',
      adminId: 'ADM-002',
      department: 'Academic Governance',
      status: 'active',
      isActive: true,
      approvedAt: new Date(),
      bio: 'Standardized academic oversight administrator 02.',
    },
  ];

  for (const account of standardizedAccounts) {
    const existing = await User.findOne({ email: account.email });
    if (!existing) {
      await User.create(account);
    } else {
      let updated = false;
      if (existing.status !== 'active' || !existing.isActive) {
        existing.status = 'active';
        existing.isActive = true;
        updated = true;
      }
      if (account.studentId && existing.studentId !== account.studentId && !existing.studentId) {
        existing.studentId = account.studentId;
        updated = true;
      }
      if (account.facultyId && existing.facultyId !== account.facultyId && !existing.facultyId) {
        existing.facultyId = account.facultyId;
        updated = true;
      }
      if (account.adminId && existing.adminId !== account.adminId && !existing.adminId) {
        existing.adminId = account.adminId;
        updated = true;
      }
      if (updated) {
        await existing.save();
      }
    }
  }

  await seedPhase6AnalyticsData();
};

const seedPhase6AnalyticsData = async () => {
  const std01 = await User.findOne({ email: 'std01@uap.edu' });
  const std02 = await User.findOne({ email: 'std02@uap.edu' });
  const std03 = await User.findOne({ email: 'std03@uap.edu' });
  const ins01 = await User.findOne({ email: 'ins01@uap.edu' });
  const ins02 = await User.findOne({ email: 'ins02@uap.edu' });

  if (!std01 || !ins01) return;

  // 1. Core Assessment for ins01
  let asmt1 = await Assessment.findOne({ title: 'CS301: Software Engineering Core Principles' });
  if (!asmt1) {
    asmt1 = await Assessment.create({
      title: 'CS301: Software Engineering Core Principles',
      description: 'Comprehensive evaluation covering agile workflows, modularity, design patterns, and testing.',
      category: 'Software Engineering',
      instructorId: ins01._id,
      durationMinutes: 45,
      totalPoints: 100,
      passingScore: 60,
      status: 'published',
      accessType: 'public',
      allowReview: true,
    });

    await Question.insertMany([
      {
        assessmentId: asmt1._id,
        questionText: 'Which design pattern guarantees that a class has only one instance and provides a global point of access to it?',
        type: 'mcq',
        options: [
          { id: 'a', text: 'Factory Method' },
          { id: 'b', text: 'Singleton Pattern' },
          { id: 'c', text: 'Observer Pattern' },
          { id: 'd', text: 'Adapter Pattern' },
        ],
        correctAnswer: 'b',
        points: 25,
        orderIndex: 0,
      },
      {
        assessmentId: asmt1._id,
        questionText: 'Unit tests should test multiple classes integrated together rather than isolated components.',
        type: 'true_false',
        options: [
          { id: 'true', text: 'True' },
          { id: 'false', text: 'False' },
        ],
        correctAnswer: 'false',
        points: 25,
        orderIndex: 1,
      },
      {
        assessmentId: asmt1._id,
        questionText: 'Explain the Single Responsibility Principle and how it enhances code maintainability.',
        type: 'short_answer',
        points: 50,
        orderIndex: 2,
      },
    ]);
  }

  // 2. Secondary Assessment in Computer Science for ins01
  let asmt2 = await Assessment.findOne({ title: 'CS201: Data Structures & Algorithmic Foundations' });
  if (!asmt2) {
    asmt2 = await Assessment.create({
      title: 'CS201: Data Structures & Algorithmic Foundations',
      description: 'Asymptotic analysis, binary search trees, heap allocations, and graph traversal.',
      category: 'Computer Science',
      instructorId: ins01._id,
      durationMinutes: 60,
      totalPoints: 100,
      passingScore: 60,
      status: 'published',
      accessType: 'public',
      allowReview: true,
    });

    await Question.insertMany([
      {
        assessmentId: asmt2._id,
        questionText: 'What is the average case lookup time in a balanced binary search tree?',
        type: 'mcq',
        options: [
          { id: 'a', text: 'O(1)' },
          { id: 'b', text: 'O(log N)' },
          { id: 'c', text: 'O(N)' },
          { id: 'd', text: 'O(N log N)' },
        ],
        correctAnswer: 'b',
        points: 50,
        orderIndex: 0,
      },
      {
        assessmentId: asmt2._id,
        questionText: 'Hash maps provide constant time lookups on average.',
        type: 'true_false',
        options: [
          { id: 'true', text: 'True' },
          { id: 'false', text: 'False' },
        ],
        correctAnswer: 'true',
        points: 50,
        orderIndex: 1,
      },
    ]);
  }

  // 3. Foreign assessment owned by ins02 (verifying authorization isolation)
  if (ins02) {
    let asmtForeign = await Assessment.findOne({ title: 'CS202: Advanced Graph Theory & Network Flows' });
    if (!asmtForeign) {
      await Assessment.create({
        title: 'CS202: Advanced Graph Theory & Network Flows',
        description: 'Maximum flow, min-cut theorem, bipartite matching, and network topology.',
        category: 'Computer Science',
        instructorId: ins02._id,
        durationMinutes: 60,
        totalPoints: 100,
        passingScore: 60,
        status: 'published',
        accessType: 'public',
        allowReview: true,
      });
    }
  }

  // 4. Submissions for std01 with consecutive dates for streak calculation
  const existingSub1 = await Submission.findOne({ studentId: std01._id, assessmentId: asmt1._id });
  const now = Date.now();
  const dayMs = 86400000;

  if (!existingSub1) {
    const qList1 = await Question.find({ assessmentId: asmt1._id });
    const answers1 = {};
    if (qList1[0]) answers1[qList1[0]._id.toString()] = 'b';
    if (qList1[1]) answers1[qList1[1]._id.toString()] = 'false';
    if (qList1[2]) answers1[qList1[2]._id.toString()] = 'Every class should have one reason to change.';

    const sub1 = await Submission.create({
      studentId: std01._id,
      assessmentId: asmt1._id,
      answers: answers1,
      score: 90,
      totalPoints: 100,
      percentage: 90,
      passed: true,
      status: 'evaluated',
      resultStatus: 'passed',
      evaluationStatus: 'completed',
      startedAt: new Date(now - 3600000),
      submittedAt: new Date(now - 1800000),
      timeSpentSeconds: 1800,
    });

    if (qList1[2]) {
      await Evaluation.create({
        submissionId: sub1._id,
        evaluatorId: ins01._id,
        questionFeedback: {
          [qList1[2]._id.toString()]: {
            pointsAwarded: 40,
            comment: 'Clear grasp of high cohesion.',
          },
        },
        generalFeedback: 'Great performance overall.',
        finalScore: 90,
        status: 'completed',
      });
    }
  }

  const existingSub2 = await Submission.findOne({ studentId: std01._id, assessmentId: asmt2._id });
  if (!existingSub2) {
    const qList2 = await Question.find({ assessmentId: asmt2._id });
    const answers2 = {};
    if (qList2[0]) answers2[qList2[0]._id.toString()] = 'b';
    if (qList2[1]) answers2[qList2[1]._id.toString()] = 'true';

    const sub2 = await Submission.create({
      studentId: std01._id,
      assessmentId: asmt2._id,
      answers: answers2,
      score: 100,
      totalPoints: 100,
      percentage: 100,
      passed: true,
      status: 'evaluated',
      resultStatus: 'passed',
      evaluationStatus: 'completed',
      startedAt: new Date(now - dayMs - 3600000),
      submittedAt: new Date(now - dayMs - 1800000),
      timeSpentSeconds: 1800,
    });

    await Evaluation.create({
      submissionId: sub2._id,
      evaluatorId: ins01._id,
      questionFeedback: {},
      generalFeedback: 'Flawless score on algorithmic fundamentals.',
      finalScore: 100,
      status: 'completed',
    });
  }

  if (std02) {
    const subStd02 = await Submission.findOne({ studentId: std02._id, assessmentId: asmt1._id });
    if (!subStd02) {
      await Submission.create({
        studentId: std02._id,
        assessmentId: asmt1._id,
        answers: {},
        score: 75,
        totalPoints: 100,
        percentage: 75,
        passed: true,
        status: 'evaluated',
        resultStatus: 'passed',
        evaluationStatus: 'completed',
        startedAt: new Date(now - 7200000),
        submittedAt: new Date(now - 3600000),
        timeSpentSeconds: 2400,
      });
    }
  }

  if (std03) {
    const subStd03 = await Submission.findOne({ studentId: std03._id, assessmentId: asmt1._id });
    if (!subStd03) {
      await Submission.create({
        studentId: std03._id,
        assessmentId: asmt1._id,
        answers: {},
        score: 95,
        totalPoints: 100,
        percentage: 95,
        passed: true,
        status: 'evaluated',
        resultStatus: 'passed',
        evaluationStatus: 'completed',
        startedAt: new Date(now - 7200000),
        submittedAt: new Date(now - 5400000),
        timeSpentSeconds: 1600,
      });
    }
  }

  // Seed Phase 7 Question Bank for demo instructor ins01
  const ins01User = await User.findOne({ email: 'ins01@uap.edu' });
  if (ins01User) {
    await seedPhase7QuestionBank(ins01User);
  }
};

const seedPhase7QuestionBank = async (instructorUser) => {
  if (!instructorUser) return;
  const count = await BankQuestion.countDocuments({ createdBy: instructorUser._id });
  if (count > 0) return;

  const sampleQuestions = [
    {
      questionBankId: 'QB-DSA-001',
      version: 1,
      isLatest: true,
      questionText: 'What is the tightest upper bound time complexity of inserting into a Red-Black Tree with N nodes?',
      normalizedText: 'what is the tightest upper bound time complexity of inserting into a redblack tree with n nodes',
      type: 'mcq',
      options: [
        { id: 'a', text: 'O(1)' },
        { id: 'b', text: 'O(log N)' },
        { id: 'c', text: 'O(N)' },
        { id: 'd', text: 'O(N log N)' },
      ],
      correctAnswer: 'b',
      explanation: 'Red-Black tree rotations and color adjustments take O(1) following O(log N) BST insertion search.',
      points: 5,
      difficulty: 'MEDIUM',
      bloomLevel: 'UNDERSTAND',
      category: 'Data Structures',
      tags: ['data-structures', 'trees', 'red-black-tree', 'complexity'],
      status: 'APPROVED',
      source: 'MANUAL',
      createdBy: instructorUser._id,
      classificationConfidence: 95,
      classificationSource: 'AI',
    },
    {
      questionBankId: 'QB-DSA-002',
      version: 1,
      isLatest: true,
      questionText: 'Which sorting algorithm exhibits worst-case O(N log N) runtime performance and is typically NOT in-place?',
      normalizedText: 'which sorting algorithm exhibits worstcase on log n runtime performance and is typically not inplace',
      type: 'mcq',
      options: [
        { id: 'a', text: 'Merge Sort' },
        { id: 'b', text: 'Quick Sort' },
        { id: 'c', text: 'Heap Sort' },
        { id: 'd', text: 'Bubble Sort' },
      ],
      correctAnswer: 'a',
      explanation: 'Standard array-based Merge Sort requires O(N) auxiliary space while guaranteeing O(N log N) worst case.',
      points: 5,
      difficulty: 'EASY',
      bloomLevel: 'REMEMBER',
      category: 'Algorithms',
      tags: ['algorithms', 'sorting', 'merge-sort'],
      status: 'APPROVED',
      source: 'MANUAL',
      createdBy: instructorUser._id,
      classificationConfidence: 98,
      classificationSource: 'AI',
    },
    {
      questionBankId: 'QB-WEB-001',
      version: 1,
      isLatest: true,
      questionText: 'Explain how idempotent HTTP methods differ from safe HTTP methods in RESTful API design.',
      normalizedText: 'explain how idempotent http methods differ from safe http methods in restful api design',
      type: 'short_answer',
      options: [],
      correctAnswer: 'Safe methods (like GET, HEAD) do not modify server state. Idempotent methods (like PUT, DELETE) can modify state, but repeated identical requests yield the exact same resource state.',
      explanation: 'PUT and DELETE are idempotent but not safe. GET is both safe and idempotent.',
      points: 10,
      difficulty: 'MEDIUM',
      bloomLevel: 'ANALYZE',
      category: 'Web Architecture',
      tags: ['http', 'rest', 'api-design'],
      status: 'APPROVED',
      source: 'MANUAL',
      createdBy: instructorUser._id,
      classificationConfidence: 92,
      classificationSource: 'AI',
    },
    {
      questionBankId: 'QB-SYS-001',
      version: 1,
      isLatest: true,
      questionText: 'Design a distributed rate limiter for a high-traffic microservice architecture handling 100k RPS. Discuss the Token Bucket algorithm, Redis cluster coordination, clock drift, and race condition mitigations using Lua scripts.',
      normalizedText: 'design a distributed rate limiter for a hightraffic microservice architecture handling 100k rps discuss the token bucket algorithm redis cluster coordination clock drift and race condition mitigations using lua scripts',
      type: 'long_answer',
      options: [],
      correctAnswer: 'Architecture essay covering Token Bucket / Leaky Bucket algorithms, Redis atomicity via EVAL Lua scripts, multi-region synchronization, and graceful degradation under Redis failure.',
      explanation: 'Requires comprehensive architecture synthesis, concurrency handling, and system trade-offs.',
      points: 25,
      difficulty: 'HARD',
      bloomLevel: 'CREATE',
      category: 'Distributed Systems',
      tags: ['system-design', 'rate-limiter', 'redis', 'concurrency'],
      status: 'APPROVED',
      source: 'MANUAL',
      createdBy: instructorUser._id,
      classificationConfidence: 90,
      classificationSource: 'AI',
    },
    {
      questionBankId: 'QB-PRG-001',
      version: 1,
      isLatest: true,
      questionText: 'Implement an LRU (Least Recently Used) cache with O(1) get and put operations. Submit your documented source code file (Python/Java/JavaScript).',
      normalizedText: 'implement an lru least recently used cache with o1 get and put operations submit your documented source code file pythonjavajavascript',
      type: 'file_upload',
      options: [],
      correctAnswer: 'Doubly linked list combined with hash map implementing O(1) get and put with node eviction on capacity breach.',
      explanation: 'Solution must include full doubly-linked list node tracking with fast hash table lookup.',
      points: 20,
      difficulty: 'HARD',
      bloomLevel: 'APPLY',
      category: 'Data Structures',
      tags: ['lru-cache', 'data-structures', 'file-upload'],
      status: 'APPROVED',
      source: 'MANUAL',
      createdBy: instructorUser._id,
      classificationConfidence: 88,
      classificationSource: 'AI',
    },
  ];

  await BankQuestion.insertMany(sampleQuestions);
  console.log(`[Seed] Seeded ${sampleQuestions.length} Phase 7 Question Bank items for instructor: ${instructorUser.email}`);
};


const seedDatabase = async () => {
  try {
    // Safely backfill academic IDs for existing users if missing
    await migrateUserAcademicIds();

    // Ensure standardized demo accounts (std01-05, ins01-05, admin01-02) exist and are active
    await seedStandardizedDemoAccounts();

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

    // 7. Seed Phase 7 Question Bank items
    await seedPhase7QuestionBank(instructor);

    // 8. Audit Log
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
