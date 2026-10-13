// Destructure and import the database models required for seeding accounts, assessments, submissions, and audit records
const { User, Assessment, Question, Submission, Evaluation, Notification, AuditLog, BankQuestion, StudentRegistry } = require('../models');
// Import password hashing utility to secure seed account credentials using bcrypt
const { hashPassword } = require('../utils/password');
// Import migration helper to generate standardized academic identifiers for users lacking them
const { migrateUserAcademicIds } = require('../utils/idGenerator');

// Define asynchronous function to seed or synchronize standardized demo accounts for students, instructors, and admins
const seedStandardizedDemoAccounts = async () => {
  // Pre-generate hashed password hash for administrator demo accounts
  const adminPassword = await hashPassword('Admin@123');
  // Pre-generate hashed password hash for instructor faculty demo accounts
  const instructorPassword = await hashPassword('Instructor@123');
  // Pre-generate hashed password hash for student demo accounts
  const studentPassword = await hashPassword('Student@123');

  // Define array of standardized demo account profiles across all platform roles
  const standardizedAccounts = [
    // Students STU-001 to STU-005
    // Student account 01 profile definition
    {
      // Full name of demo student 01
      name: 'Demo Student 01',
      // Standardized institutional email address
      email: 'std01@uap.edu',
      // Securely hashed password credential
      password: studentPassword,
      // Platform access role designated as student
      role: 'student',
      // Standardized academic student identifier code
      studentId: 'STU-001',
      // Academic department affiliation
      department: 'Computer Science',
      // Institutional approval status set to active
      status: 'active',
      // Account activity flag enabled
      isActive: true,
      // Timestamp of account approval set to current date
      approvedAt: new Date(),
      // User biography narrative
      bio: 'Standardized demo student account 01.',
    // Close student 01 object
    },
    // Student account 02 profile definition
    {
      // Full name of demo student 02
      name: 'Demo Student 02',
      // Standardized institutional email address
      email: 'std02@uap.edu',
      // Securely hashed password credential
      password: studentPassword,
      // Platform access role designated as student
      role: 'student',
      // Standardized academic student identifier code
      studentId: 'STU-002',
      // Academic department affiliation
      department: 'Software Engineering',
      // Institutional approval status set to active
      status: 'active',
      // Account activity flag enabled
      isActive: true,
      // Timestamp of account approval set to current date
      approvedAt: new Date(),
      // User biography narrative
      bio: 'Standardized demo student account 02.',
    // Close student 02 object
    },
    // Student account 03 profile definition
    {
      // Full name of demo student 03
      name: 'Demo Student 03',
      // Standardized institutional email address
      email: 'std03@uap.edu',
      // Securely hashed password credential
      password: studentPassword,
      // Platform access role designated as student
      role: 'student',
      // Standardized academic student identifier code
      studentId: 'STU-003',
      // Academic department affiliation
      department: 'Data Science',
      // Institutional approval status set to active
      status: 'active',
      // Account activity flag enabled
      isActive: true,
      // Timestamp of account approval set to current date
      approvedAt: new Date(),
      // User biography narrative
      bio: 'Standardized demo student account 03.',
    // Close student 03 object
    },
    // Student account 04 profile definition
    {
      // Full name of demo student 04
      name: 'Demo Student 04',
      // Standardized institutional email address
      email: 'std04@uap.edu',
      // Securely hashed password credential
      password: studentPassword,
      // Platform access role designated as student
      role: 'student',
      // Standardized academic student identifier code
      studentId: 'STU-004',
      // Academic department affiliation
      department: 'Computer Science',
      // Institutional approval status set to active
      status: 'active',
      // Account activity flag enabled
      isActive: true,
      // Timestamp of account approval set to current date
      approvedAt: new Date(),
      // User biography narrative
      bio: 'Standardized demo student account 04.',
    // Close student 04 object
    },
    // Student account 05 profile definition
    {
      // Full name of demo student 05
      name: 'Demo Student 05',
      // Standardized institutional email address
      email: 'std05@uap.edu',
      // Securely hashed password credential
      password: studentPassword,
      // Platform access role designated as student
      role: 'student',
      // Standardized academic student identifier code
      studentId: 'STU-005',
      // Academic department affiliation
      department: 'Artificial Intelligence',
      // Institutional approval status set to active
      status: 'active',
      // Account activity flag enabled
      isActive: true,
      // Timestamp of account approval set to current date
      approvedAt: new Date(),
      // User biography narrative
      bio: 'Standardized demo student account 05.',
    // Close student 05 object
    },

    // Instructors FAC-001 to FAC-005
    // Instructor account 01 profile definition
    {
      // Full name of demo instructor 01
      name: 'Demo Instructor 01',
      // Standardized institutional email address
      email: 'ins01@uap.edu',
      // Securely hashed password credential
      password: instructorPassword,
      // Platform access role designated as instructor
      role: 'instructor',
      // Standardized academic faculty identifier code
      facultyId: 'FAC-001',
      // Academic department affiliation
      department: 'Computer Science & Engineering',
      // Primary teaching subject title
      subjectName: 'Software Engineering',
      // Course catalog subject code
      subjectId: 'CS-301',
      // Course syllabus overview description
      subjectDescription: 'Software lifecycle, design patterns, testing, and modern deployment pipelines.',
      // Institutional approval status set to active
      status: 'active',
      // Account activity flag enabled
      isActive: true,
      // Timestamp of account approval set to current date
      approvedAt: new Date(),
      // User biography narrative
      bio: 'Standardized demo faculty instructor 01.',
    // Close instructor 01 object
    },
    // Instructor account 02 profile definition
    {
      // Full name of demo instructor 02
      name: 'Demo Instructor 02',
      // Standardized institutional email address
      email: 'ins02@uap.edu',
      // Securely hashed password credential
      password: instructorPassword,
      // Platform access role designated as instructor
      role: 'instructor',
      // Standardized academic faculty identifier code
      facultyId: 'FAC-002',
      // Academic department affiliation
      department: 'Computer Science & Engineering',
      // Primary teaching subject title
      subjectName: 'Data Structures & Algorithms',
      // Course catalog subject code
      subjectId: 'CS-201',
      // Course syllabus overview description
      subjectDescription: 'Algorithmic efficiency, graph theory, trees, and dynamic programming.',
      // Institutional approval status set to active
      status: 'active',
      // Account activity flag enabled
      isActive: true,
      // Timestamp of account approval set to current date
      approvedAt: new Date(),
      // User biography narrative
      bio: 'Standardized demo faculty instructor 02.',
    // Close instructor 02 object
    },
    // Instructor account 03 profile definition
    {
      // Full name of demo instructor 03
      name: 'Demo Instructor 03',
      // Standardized institutional email address
      email: 'ins03@uap.edu',
      // Securely hashed password credential
      password: instructorPassword,
      // Platform access role designated as instructor
      role: 'instructor',
      // Standardized academic faculty identifier code
      facultyId: 'FAC-003',
      // Academic department affiliation
      department: 'Computer Science & Engineering',
      // Primary teaching subject title
      subjectName: 'Artificial Intelligence',
      // Course catalog subject code
      subjectId: 'AI-401',
      // Course syllabus overview description
      subjectDescription: 'Machine learning fundamentals, neural architectures, and intelligent systems.',
      // Institutional approval status set to active
      status: 'active',
      // Account activity flag enabled
      isActive: true,
      // Timestamp of account approval set to current date
      approvedAt: new Date(),
      // User biography narrative
      bio: 'Standardized demo faculty instructor 03.',
    // Close instructor 03 object
    },
    // Instructor account 04 profile definition
    {
      // Full name of demo instructor 04
      name: 'Demo Instructor 04',
      // Standardized institutional email address
      email: 'ins04@uap.edu',
      // Securely hashed password credential
      password: instructorPassword,
      // Platform access role designated as instructor
      role: 'instructor',
      // Standardized academic faculty identifier code
      facultyId: 'FAC-004',
      // Academic department affiliation
      department: 'Computer Science & Engineering',
      // Primary teaching subject title
      subjectName: 'Distributed Systems',
      // Course catalog subject code
      subjectId: 'CS-402',
      // Course syllabus overview description
      subjectDescription: 'Consensus protocols, microservices, RPC architectures, and distributed storage.',
      // Institutional approval status set to active
      status: 'active',
      // Account activity flag enabled
      isActive: true,
      // Timestamp of account approval set to current date
      approvedAt: new Date(),
      // User biography narrative
      bio: 'Standardized demo faculty instructor 04.',
    // Close instructor 04 object
    },
    // Instructor account 05 profile definition
    {
      // Full name of demo instructor 05
      name: 'Demo Instructor 05',
      // Standardized institutional email address
      email: 'ins05@uap.edu',
      // Securely hashed password credential
      password: instructorPassword,
      // Platform access role designated as instructor
      role: 'instructor',
      // Standardized academic faculty identifier code
      facultyId: 'FAC-005',
      // Academic department affiliation
      department: 'Computer Science & Engineering',
      // Primary teaching subject title
      subjectName: 'Database Management Systems',
      // Course catalog subject code
      subjectId: 'CS-302',
      // Course syllabus overview description
      subjectDescription: 'Relational schemas, query optimization, indexing, and NoSQL design.',
      // Institutional approval status set to active
      status: 'active',
      // Account activity flag enabled
      isActive: true,
      // Timestamp of account approval set to current date
      approvedAt: new Date(),
      // User biography narrative
      bio: 'Standardized demo faculty instructor 05.',
    // Close instructor 05 object
    },

    // Admins ADM-001 to ADM-002
    // Admin account 01 profile definition
    {
      // Full name of platform administrator 01
      name: 'Demo Admin 01',
      // Standardized institutional email address
      email: 'admin01@uap.edu',
      // Securely hashed password credential
      password: adminPassword,
      // Platform access role designated as admin
      role: 'admin',
      // Standardized academic admin identifier code
      adminId: 'ADM-001',
      // Department affiliation for platform operations
      department: 'Platform Operations',
      // Institutional approval status set to active
      status: 'active',
      // Account activity flag enabled
      isActive: true,
      // Timestamp of account approval set to current date
      approvedAt: new Date(),
      // User biography narrative
      bio: 'Standardized platform governance administrator 01.',
    // Close admin 01 object
    },
    // Admin account 02 profile definition
    {
      // Full name of academic oversight administrator 02
      name: 'Demo Admin 02',
      // Standardized institutional email address
      email: 'admin02@uap.edu',
      // Securely hashed password credential
      password: adminPassword,
      // Platform access role designated as admin
      role: 'admin',
      // Standardized academic admin identifier code
      adminId: 'ADM-002',
      // Department affiliation for academic governance
      department: 'Academic Governance',
      // Institutional approval status set to active
      status: 'active',
      // Account activity flag enabled
      isActive: true,
      // Timestamp of account approval set to current date
      approvedAt: new Date(),
      // User biography narrative
      bio: 'Standardized academic oversight administrator 02.',
    // Close admin 02 object
    },
  // End of standardized accounts list definition
  ];

  // Iterate sequentially through each standardized demo account definition
  for (const account of standardizedAccounts) {
    // Query database to check if a user record with this email already exists
    const existing = await User.findOne({ email: account.email });
    // If no existing record is found, insert new user document
    if (!existing) {
      // Create new user in MongoDB with the account configuration
      await User.create(account);
    // Otherwise update missing identifiers or inactive status on existing record
    } else {
      // Track whether any document field was modified and requires saving
      let updated = false;
      // Ensure account status is active and isActive flag is true
      if (existing.status !== 'active' || !existing.isActive) {
        // Set status property to active
        existing.status = 'active';
        // Set isActive boolean property to true
        existing.isActive = true;
        // Mark update flag as true
        updated = true;
      // End status normalization check
      }
      // Backfill missing student identifier if assigned in account template
      if (account.studentId && existing.studentId !== account.studentId && !existing.studentId) {
        // Assign standardized studentId to existing document
        existing.studentId = account.studentId;
        // Mark update flag as true
        updated = true;
      // End studentId update check
      }
      // Backfill missing faculty identifier if assigned in account template
      if (account.facultyId && existing.facultyId !== account.facultyId && !existing.facultyId) {
        // Assign standardized facultyId to existing document
        existing.facultyId = account.facultyId;
        // Mark update flag as true
        updated = true;
      // End facultyId update check
      }
      // Backfill missing admin identifier if assigned in account template
      if (account.adminId && existing.adminId !== account.adminId && !existing.adminId) {
        // Assign standardized adminId to existing document
        existing.adminId = account.adminId;
        // Mark update flag as true
        updated = true;
      // End adminId update check
      }
      // If any fields were updated, persist changes to MongoDB
      if (updated) {
        // Save modified user document
        await existing.save();
      // End save check
      }
    // End existence branch
    }
  // End standardized accounts loop
  }

  // If SMTP_USER is configured in .env, ensure an active account exists for testing & administration
  const smtpUserEmail = (process.env.SMTP_USER || '').trim().toLowerCase();
  if (smtpUserEmail && smtpUserEmail.includes('@')) {
    const existingSmtpUser = await User.findOne({ email: smtpUserEmail });
    if (!existingSmtpUser) {
      await User.create({
        name: 'Administrator (SMTP)',
        email: smtpUserEmail,
        password: adminPassword,
        role: 'admin',
        adminId: 'ADM-SMTP',
        status: 'active',
        isActive: true,
        approvedAt: new Date(),
        bio: 'Primary administrative account linked to configured SMTP delivery address.',
      });
      console.log('[Seed] Seeded active account for configured SMTP_USER.');
    } else if (existingSmtpUser.status !== 'active' || !existingSmtpUser.isActive) {
      existingSmtpUser.status = 'active';
      existingSmtpUser.isActive = true;
      await existingSmtpUser.save();
    }
  }

  // Trigger seeding of historical analytics, assessments, and submission data for student streak metrics
  await seedPhase6AnalyticsData();
// End seedStandardizedDemoAccounts function
};

// Define asynchronous function to seed analytics metrics, assessments, questions, and submissions
const seedPhase6AnalyticsData = async () => {
  // Retrieve student 01 record from database by email
  const std01 = await User.findOne({ email: 'std01@uap.edu' });
  // Retrieve student 02 record from database by email
  const std02 = await User.findOne({ email: 'std02@uap.edu' });
  // Retrieve student 03 record from database by email
  const std03 = await User.findOne({ email: 'std03@uap.edu' });
  // Retrieve instructor 01 record from database by email
  const ins01 = await User.findOne({ email: 'ins01@uap.edu' });
  // Retrieve instructor 02 record from database by email
  const ins02 = await User.findOne({ email: 'ins02@uap.edu' });

  // Early return if primary demo student or instructor accounts are missing
  if (!std01 || !ins01) return;

  // 1. Core Assessment for ins01
  // Query for existence of the core Software Engineering assessment
  let asmt1 = await Assessment.findOne({ title: 'CS301: Software Engineering Core Principles' });
  // Create assessment and question items if not previously seeded
  if (!asmt1) {
    // Create new Assessment document authored by ins01
    asmt1 = await Assessment.create({
      // Assessment title
      title: 'CS301: Software Engineering Core Principles',
      // Explanatory assessment description
      description: 'Comprehensive evaluation covering agile workflows, modularity, design patterns, and testing.',
      // Subject category classification
      category: 'Software Engineering',
      // Reference to the authoring instructor's user ID
      instructorId: ins01._id,
      // Examination time limit in minutes
      durationMinutes: 45,
      // Total attainable points across all questions
      totalPoints: 100,
      // Percentage threshold required to pass the assessment
      passingScore: 60,
      // Publication status set to published
      status: 'published',
      // Access scope set to public for all enrolled students
      accessType: 'public',
      // Allow students to review submissions and answers post-evaluation
      allowReview: true,
    // Close assessment creation object
    });

    // Bulk insert initial set of questions associated with assessment 1
    await Question.insertMany([
      // First question definition: Multiple Choice Question on design patterns
      {
        // Reference foreign key to assessment 1
        assessmentId: asmt1._id,
        // The question prompt text
        questionText: 'Which design pattern guarantees that a class has only one instance and provides a global point of access to it?',
        // Question format type
        type: 'mcq',
        // Array of answer choices
        options: [
          // Option A definition
          { id: 'a', text: 'Factory Method' },
          // Option B definition
          { id: 'b', text: 'Singleton Pattern' },
          // Option C definition
          { id: 'c', text: 'Observer Pattern' },
          // Option D definition
          { id: 'd', text: 'Adapter Pattern' },
        // Close options array
        ],
        // The correct choice identifier
        correctAnswer: 'b',
        // Points awarded for correct answer
        points: 25,
        // Zero-based display order index
        orderIndex: 0,
      // Close question 1 object
      },
      // Second question definition: True/False Question on unit testing principles
      {
        // Reference foreign key to assessment 1
        assessmentId: asmt1._id,
        // The question prompt text
        questionText: 'Unit tests should test multiple classes integrated together rather than isolated components.',
        // Question format type
        type: 'true_false',
        // Array of binary choices
        options: [
          // True option
          { id: 'true', text: 'True' },
          // False option
          { id: 'false', text: 'False' },
        // Close options array
        ],
        // The correct choice identifier
        correctAnswer: 'false',
        // Points awarded for correct answer
        points: 25,
        // Display order index
        orderIndex: 1,
      // Close question 2 object
      },
      // Third question definition: Short answer explanation of SOLID principles
      {
        // Reference foreign key to assessment 1
        assessmentId: asmt1._id,
        // The subjective question prompt text
        questionText: 'Explain the Single Responsibility Principle and how it enhances code maintainability.',
        // Question format type for open-ended response
        type: 'short_answer',
        // Points awarded for full credit
        points: 50,
        // Display order index
        orderIndex: 2,
      // Close question 3 object
      },
    // Close insertMany questions array
    ]);
  // End assessment 1 initialization block
  }

  // 2. Secondary Assessment in Computer Science for ins01
  // Query for existence of the Data Structures assessment
  let asmt2 = await Assessment.findOne({ title: 'CS201: Data Structures & Algorithmic Foundations' });
  // Create second assessment and questions if not previously seeded
  if (!asmt2) {
    // Create new Assessment document authored by ins01
    asmt2 = await Assessment.create({
      // Assessment title
      title: 'CS201: Data Structures & Algorithmic Foundations',
      // Examination scope and syllabus description
      description: 'Asymptotic analysis, binary search trees, heap allocations, and graph traversal.',
      // Subject category classification
      category: 'Computer Science',
      // Reference to the authoring instructor's user ID
      instructorId: ins01._id,
      // Examination time limit in minutes
      durationMinutes: 60,
      // Total points available
      totalPoints: 100,
      // Passing percentage threshold
      passingScore: 60,
      // Publication status set to published
      status: 'published',
      // Access scope set to public
      accessType: 'public',
      // Allow post-assessment student review
      allowReview: true,
    // Close assessment creation object
    });

    // Bulk insert questions for assessment 2
    await Question.insertMany([
      // First question: MCQ on BST lookup complexity
      {
        // Reference foreign key to assessment 2
        assessmentId: asmt2._id,
        // Question prompt text
        questionText: 'What is the average case lookup time in a balanced binary search tree?',
        // Question format type
        type: 'mcq',
        // Array of answer choices
        options: [
          // Option A
          { id: 'a', text: 'O(1)' },
          // Option B
          { id: 'b', text: 'O(log N)' },
          // Option C
          { id: 'c', text: 'O(N)' },
          // Option D
          { id: 'd', text: 'O(N log N)' },
        // Close options array
        ],
        // Correct answer option identifier
        correctAnswer: 'b',
        // Points awarded for correct answer
        points: 50,
        // Display order index
        orderIndex: 0,
      // Close question 1 object
      },
      // Second question: True/False on Hash Map average lookup time
      {
        // Reference foreign key to assessment 2
        assessmentId: asmt2._id,
        // Question prompt text
        questionText: 'Hash maps provide constant time lookups on average.',
        // Question format type
        type: 'true_false',
        // Array of binary options
        options: [
          // True option
          { id: 'true', text: 'True' },
          // False option
          { id: 'false', text: 'False' },
        // Close options array
        ],
        // Correct answer option identifier
        correctAnswer: 'true',
        // Points awarded for correct answer
        points: 50,
        // Display order index
        orderIndex: 1,
      // Close question 2 object
      },
    // Close questions array
    ]);
  // End assessment 2 initialization block
  }

  // 3. Foreign assessment owned by ins02 (verifying authorization isolation)
  // Ensure foreign instructor account exists before authoring isolated assessment
  if (ins02) {
    // Check if foreign assessment authored by ins02 already exists
    let asmtForeign = await Assessment.findOne({ title: 'CS202: Advanced Graph Theory & Network Flows' });
    // Create foreign assessment if not already present
    if (!asmtForeign) {
      // Create new Assessment document with instructorId belonging to ins02
      await Assessment.create({
        // Title of foreign course assessment
        title: 'CS202: Advanced Graph Theory & Network Flows',
        // Description of syllabus topics
        description: 'Maximum flow, min-cut theorem, bipartite matching, and network topology.',
        // Subject category classification
        category: 'Computer Science',
        // Authoring instructor user ID for ins02
        instructorId: ins02._id,
        // Time limit in minutes
        durationMinutes: 60,
        // Total points available
        totalPoints: 100,
        // Passing percentage threshold
        passingScore: 60,
        // Publication status set to published
        status: 'published',
        // Access scope set to public
        accessType: 'public',
        // Allow post-assessment student review
        allowReview: true,
      // Close foreign assessment creation object
      });
    // End foreign assessment check
    }
  // End ins02 check
  }

  // 4. Submissions for std01 with consecutive dates for streak calculation
  // Check if student 01 already has a submission record for assessment 1
  const existingSub1 = await Submission.findOne({ studentId: std01._id, assessmentId: asmt1._id });
  // Record current epoch timestamp in milliseconds
  const now = Date.now();
  // Define constant for milliseconds in one 24-hour day (24 * 60 * 60 * 1000)
  const dayMs = 86400000;

  // Create submission 1 for student 01 if none exists
  if (!existingSub1) {
    // Fetch all questions for assessment 1 to map responses to question IDs
    const qList1 = await Question.find({ assessmentId: asmt1._id });
    // Initialize student answer map object
    const answers1 = {};
    // Map answer for question 1 (design pattern)
    if (qList1[0]) answers1[qList1[0]._id.toString()] = 'b';
    // Map answer for question 2 (unit testing)
    if (qList1[1]) answers1[qList1[1]._id.toString()] = 'false';
    // Map answer for question 3 (Single Responsibility Principle)
    if (qList1[2]) answers1[qList1[2]._id.toString()] = 'Every class should have one reason to change.';

    // Create completed and evaluated Submission document
    const sub1 = await Submission.create({
      // Student foreign key identifier
      studentId: std01._id,
      // Assessment foreign key identifier
      assessmentId: asmt1._id,
      // Student submitted response mapping
      answers: answers1,
      // Score awarded
      score: 90,
      // Maximum points possible
      totalPoints: 100,
      // Computed percentage score
      percentage: 90,
      // Boolean passed flag
      passed: true,
      // Overall submission processing status
      status: 'evaluated',
      // Academic result status
      resultStatus: 'passed',
      // Instructor evaluation lifecycle state
      evaluationStatus: 'completed',
      // Submission start timestamp (1 hour ago)
      startedAt: new Date(now - 3600000),
      // Submission delivery timestamp (30 minutes ago)
      submittedAt: new Date(now - 1800000),
      // Duration spent on attempt in seconds (30 minutes)
      timeSpentSeconds: 1800,
    // Close submission 1 creation object
    });

    // If subjective question exists, create instructor evaluation record
    if (qList1[2]) {
      // Create detailed Evaluation document with question feedback
      await Evaluation.create({
        // Foreign key to submission 1
        submissionId: sub1._id,
        // Foreign key to evaluator (ins01)
        evaluatorId: ins01._id,
        // Feedback and score breakdown keyed by question ID
        questionFeedback: {
          // Feedback entry for question 3
          [qList1[2]._id.toString()]: {
            // Points awarded for subjective response
            pointsAwarded: 40,
            // Qualitative feedback comment from instructor
            comment: 'Clear grasp of high cohesion.',
          // Close question 3 feedback entry
          },
        // Close questionFeedback map
        },
        // General feedback message for student attempt
        generalFeedback: 'Great performance overall.',
        // Final consolidated score
        finalScore: 90,
        // Lifecycle status of evaluation
        status: 'completed',
      // Close evaluation document object
      });
    // End subjective question check
    }
  // End submission 1 block
  }

  // Check if student 01 already has a submission record for assessment 2
  const existingSub2 = await Submission.findOne({ studentId: std01._id, assessmentId: asmt2._id });
  // Create submission 2 for student 01 (dated yesterday for streak tracking) if none exists
  if (!existingSub2) {
    // Fetch all questions for assessment 2
    const qList2 = await Question.find({ assessmentId: asmt2._id });
    // Initialize student answer map object
    const answers2 = {};
    // Map answer for question 1 (BST lookup)
    if (qList2[0]) answers2[qList2[0]._id.toString()] = 'b';
    // Map answer for question 2 (Hash map lookup)
    if (qList2[1]) answers2[qList2[1]._id.toString()] = 'true';

    // Create completed and evaluated Submission document with yesterday's timestamp
    const sub2 = await Submission.create({
      // Student foreign key identifier
      studentId: std01._id,
      // Assessment foreign key identifier
      assessmentId: asmt2._id,
      // Student answer response map
      answers: answers2,
      // Full credit score
      score: 100,
      // Maximum points possible
      totalPoints: 100,
      // Computed percentage score
      percentage: 100,
      // Boolean passed flag
      passed: true,
      // Processing status set to evaluated
      status: 'evaluated',
      // Result outcome status set to passed
      resultStatus: 'passed',
      // Evaluation lifecycle status completed
      evaluationStatus: 'completed',
      // Submission start time backdated by 1 day and 1 hour
      startedAt: new Date(now - dayMs - 3600000),
      // Submission completion time backdated by 1 day and 30 minutes
      submittedAt: new Date(now - dayMs - 1800000),
      // Duration spent in seconds (30 minutes)
      timeSpentSeconds: 1800,
    // Close submission 2 creation object
    });

    // Create completed evaluation record for submission 2
    await Evaluation.create({
      // Foreign key to submission 2
      submissionId: sub2._id,
      // Foreign key to evaluator (ins01)
      evaluatorId: ins01._id,
      // Empty feedback map for automated MCQ scoring
      questionFeedback: {},
      // General feedback text
      generalFeedback: 'Flawless score on algorithmic fundamentals.',
      // Final consolidated score
      finalScore: 100,
      // Lifecycle status completed
      status: 'completed',
    // Close evaluation 2 document object
    });
  // End submission 2 block
  }

  // Create sample submission for student 02 if user exists
  if (std02) {
    // Check if student 02 has already submitted assessment 1
    const subStd02 = await Submission.findOne({ studentId: std02._id, assessmentId: asmt1._id });
    // Create submission record if not already present
    if (!subStd02) {
      // Create evaluated submission document for student 02
      await Submission.create({
        // Foreign key to student 02
        studentId: std02._id,
        // Foreign key to assessment 1
        assessmentId: asmt1._id,
        // Empty answers map for placeholder submission
        answers: {},
        // Awarded score
        score: 75,
        // Maximum points possible
        totalPoints: 100,
        // Percentage score
        percentage: 75,
        // Passed status boolean
        passed: true,
        // Processing status evaluated
        status: 'evaluated',
        // Result status passed
        resultStatus: 'passed',
        // Evaluation status completed
        evaluationStatus: 'completed',
        // Start timestamp 2 hours ago
        startedAt: new Date(now - 7200000),
        // Submission timestamp 1 hour ago
        submittedAt: new Date(now - 3600000),
        // Duration spent in seconds (40 minutes)
        timeSpentSeconds: 2400,
      // Close student 02 submission object
      });
    // End student 02 submission check
    }
  // End student 02 check
  }

  // Create sample submission for student 03 if user exists
  if (std03) {
    // Check if student 03 has already submitted assessment 1
    const subStd03 = await Submission.findOne({ studentId: std03._id, assessmentId: asmt1._id });
    // Create submission record if not already present
    if (!subStd03) {
      // Create evaluated submission document for student 03
      await Submission.create({
        // Foreign key to student 03
        studentId: std03._id,
        // Foreign key to assessment 1
        assessmentId: asmt1._id,
        // Empty answers map for placeholder submission
        answers: {},
        // Awarded score
        score: 95,
        // Maximum points possible
        totalPoints: 100,
        // Percentage score
        percentage: 95,
        // Passed status boolean
        passed: true,
        // Processing status evaluated
        status: 'evaluated',
        // Result status passed
        resultStatus: 'passed',
        // Evaluation status completed
        evaluationStatus: 'completed',
        // Start timestamp 2 hours ago
        startedAt: new Date(now - 7200000),
        // Submission timestamp 1.5 hours ago
        submittedAt: new Date(now - 5400000),
        // Duration spent in seconds (26.6 minutes)
        timeSpentSeconds: 1600,
      // Close student 03 submission object
      });
    // End student 03 submission check
    }
  // End student 03 check
  }

  // Seed Phase 7 Question Bank for demo instructor ins01
  // Retrieve ins01 user document by email
  const ins01User = await User.findOne({ email: 'ins01@uap.edu' });
  // If user document exists, trigger seeding of question bank items
  if (ins01User) {
    // Await question bank seed execution for ins01
    await seedPhase7QuestionBank(ins01User);
  // End ins01User check
  }
// End seedPhase6AnalyticsData function
};

// Define asynchronous function to populate Phase 7 Question Bank items for an instructor
const seedPhase7QuestionBank = async (instructorUser) => {
  // Return early if instructor user is null or undefined
  if (!instructorUser) return;
  // Count existing questions authored by this instructor in the question bank
  const count = await BankQuestion.countDocuments({ createdBy: instructorUser._id });
  // Skip seeding if question bank already contains questions authored by this user
  if (count > 0) return;

  // Define array of sample question bank items covering multiple formats, Bloom levels, and categories
  const sampleQuestions = [
    // Question Bank item 1: Red-Black tree insertion time complexity (MCQ)
    {
      // Unique question bank identifier
      questionBankId: 'QB-DSA-001',
      // Version number
      version: 1,
      // Flag indicating whether this is the latest version
      isLatest: true,
      // Full question text prompt
      questionText: 'What is the tightest upper bound time complexity of inserting into a Red-Black Tree with N nodes?',
      // Lowercase normalized text for duplicate detection and search indexing
      normalizedText: 'what is the tightest upper bound time complexity of inserting into a redblack tree with n nodes',
      // Question format type
      type: 'mcq',
      // Array of answer choices
      options: [
        // Choice A
        { id: 'a', text: 'O(1)' },
        // Choice B
        { id: 'b', text: 'O(log N)' },
        // Choice C
        { id: 'c', text: 'O(N)' },
        // Choice D
        { id: 'd', text: 'O(N log N)' },
      // Close options array
      ],
      // Correct answer option key
      correctAnswer: 'b',
      // Detailed pedagogical explanation for answer key
      explanation: 'Red-Black tree rotations and color adjustments take O(1) following O(log N) BST insertion search.',
      // Default point value
      points: 5,
      // Difficulty rating
      difficulty: 'MEDIUM',
      // Bloom's taxonomy cognitive level
      bloomLevel: 'UNDERSTAND',
      // Subject category
      category: 'Data Structures',
      // Array of searchable tags
      tags: ['data-structures', 'trees', 'red-black-tree', 'complexity'],
      // Approval status in question bank workflow
      status: 'APPROVED',
      // Origin source type
      source: 'MANUAL',
      // Authoring instructor user ID
      createdBy: instructorUser._id,
      // AI categorization confidence percentage
      classificationConfidence: 95,
      // Origin of classification metadata
      classificationSource: 'AI',
    // Close question 1 object
    },
    // Question Bank item 2: Merge sort worst case runtime (MCQ)
    {
      // Unique question bank identifier
      questionBankId: 'QB-DSA-002',
      // Version number
      version: 1,
      // Flag indicating whether this is the latest version
      isLatest: true,
      // Full question text prompt
      questionText: 'Which sorting algorithm exhibits worst-case O(N log N) runtime performance and is typically NOT in-place?',
      // Lowercase normalized text for duplicate detection
      normalizedText: 'which sorting algorithm exhibits worstcase on log n runtime performance and is typically not inplace',
      // Question format type
      type: 'mcq',
      // Array of answer choices
      options: [
        // Choice A
        { id: 'a', text: 'Merge Sort' },
        // Choice B
        { id: 'b', text: 'Quick Sort' },
        // Choice C
        { id: 'c', text: 'Heap Sort' },
        // Choice D
        { id: 'd', text: 'Bubble Sort' },
      // Close options array
      ],
      // Correct answer option key
      correctAnswer: 'a',
      // Pedagogical explanation
      explanation: 'Standard array-based Merge Sort requires O(N) auxiliary space while guaranteeing O(N log N) worst case.',
      // Default point value
      points: 5,
      // Difficulty rating
      difficulty: 'EASY',
      // Bloom's taxonomy cognitive level
      bloomLevel: 'REMEMBER',
      // Subject category
      category: 'Algorithms',
      // Array of searchable tags
      tags: ['algorithms', 'sorting', 'merge-sort'],
      // Approval status in question bank
      status: 'APPROVED',
      // Origin source type
      source: 'MANUAL',
      // Authoring instructor user ID
      createdBy: instructorUser._id,
      // AI categorization confidence percentage
      classificationConfidence: 98,
      // Origin of classification metadata
      classificationSource: 'AI',
    // Close question 2 object
    },
    // Question Bank item 3: Idempotent vs Safe HTTP methods (Short Answer)
    {
      // Unique question bank identifier
      questionBankId: 'QB-WEB-001',
      // Version number
      version: 1,
      // Flag indicating whether this is the latest version
      isLatest: true,
      // Full question text prompt
      questionText: 'Explain how idempotent HTTP methods differ from safe HTTP methods in RESTful API design.',
      // Lowercase normalized text
      normalizedText: 'explain how idempotent http methods differ from safe http methods in restful api design',
      // Question format type
      type: 'short_answer',
      // Empty options array for open-ended format
      options: [],
      // Model answer expected for full credit
      correctAnswer: 'Safe methods (like GET, HEAD) do not modify server state. Idempotent methods (like PUT, DELETE) can modify state, but repeated identical requests yield the exact same resource state.',
      // Pedagogical explanation
      explanation: 'PUT and DELETE are idempotent but not safe. GET is both safe and idempotent.',
      // Default point value
      points: 10,
      // Difficulty rating
      difficulty: 'MEDIUM',
      // Bloom's taxonomy cognitive level
      bloomLevel: 'ANALYZE',
      // Subject category
      category: 'Web Architecture',
      // Array of searchable tags
      tags: ['http', 'rest', 'api-design'],
      // Approval status
      status: 'APPROVED',
      // Origin source type
      source: 'MANUAL',
      // Authoring instructor user ID
      createdBy: instructorUser._id,
      // AI categorization confidence percentage
      classificationConfidence: 92,
      // Origin of classification metadata
      classificationSource: 'AI',
    // Close question 3 object
    },
    // Question Bank item 4: Distributed rate limiter design (Long Answer)
    {
      // Unique question bank identifier
      questionBankId: 'QB-SYS-001',
      // Version number
      version: 1,
      // Flag indicating whether this is the latest version
      isLatest: true,
      // Full question text prompt
      questionText: 'Design a distributed rate limiter for a high-traffic microservice architecture handling 100k RPS. Discuss the Token Bucket algorithm, Redis cluster coordination, clock drift, and race condition mitigations using Lua scripts.',
      // Lowercase normalized text
      normalizedText: 'design a distributed rate limiter for a hightraffic microservice architecture handling 100k rps discuss the token bucket algorithm redis cluster coordination clock drift and race condition mitigations using lua scripts',
      // Question format type
      type: 'long_answer',
      // Empty options array for open-ended format
      options: [],
      // Model answer outline
      correctAnswer: 'Architecture essay covering Token Bucket / Leaky Bucket algorithms, Redis atomicity via EVAL Lua scripts, multi-region synchronization, and graceful degradation under Redis failure.',
      // Pedagogical explanation
      explanation: 'Requires comprehensive architecture synthesis, concurrency handling, and system trade-offs.',
      // Default point value
      points: 25,
      // Difficulty rating
      difficulty: 'HARD',
      // Bloom's taxonomy cognitive level
      bloomLevel: 'CREATE',
      // Subject category
      category: 'Distributed Systems',
      // Array of searchable tags
      tags: ['system-design', 'rate-limiter', 'redis', 'concurrency'],
      // Approval status
      status: 'APPROVED',
      // Origin source type
      source: 'MANUAL',
      // Authoring instructor user ID
      createdBy: instructorUser._id,
      // AI categorization confidence percentage
      classificationConfidence: 90,
      // Origin of classification metadata
      classificationSource: 'AI',
    // Close question 4 object
    },
    // Question Bank item 5: LRU Cache implementation (File Upload)
    {
      // Unique question bank identifier
      questionBankId: 'QB-PRG-001',
      // Version number
      version: 1,
      // Flag indicating whether this is the latest version
      isLatest: true,
      // Full question text prompt
      questionText: 'Implement an LRU (Least Recently Used) cache with O(1) get and put operations. Submit your documented source code file (Python/Java/JavaScript).',
      // Lowercase normalized text
      normalizedText: 'implement an lru least recently used cache with o1 get and put operations submit your documented source code file pythonjavajavascript',
      // Question format type
      type: 'file_upload',
      // Empty options array for file upload format
      options: [],
      // Model answer guidelines
      correctAnswer: 'Doubly linked list combined with hash map implementing O(1) get and put with node eviction on capacity breach.',
      // Pedagogical explanation
      explanation: 'Solution must include full doubly-linked list node tracking with fast hash table lookup.',
      // Default point value
      points: 20,
      // Difficulty rating
      difficulty: 'HARD',
      // Bloom's taxonomy cognitive level
      bloomLevel: 'APPLY',
      // Subject category
      category: 'Data Structures',
      // Array of searchable tags
      tags: ['lru-cache', 'data-structures', 'file-upload'],
      // Approval status
      status: 'APPROVED',
      // Origin source type
      source: 'MANUAL',
      // Authoring instructor user ID
      createdBy: instructorUser._id,
      // AI categorization confidence percentage
      classificationConfidence: 88,
      // Origin of classification metadata
      classificationSource: 'AI',
    // Close question 5 object
    },
  // End of sample questions array
  ];

  // Bulk insert all sample questions into the BankQuestion collection
  await BankQuestion.insertMany(sampleQuestions);
  // Log confirmation message indicating successful question bank seeding
  console.log(`[Seed] Seeded ${sampleQuestions.length} Phase 7 Question Bank items for instructor: ${instructorUser.email}`);
// End seedPhase7QuestionBank function
};

// Define primary database bootstrapping function to seed initial collections, users, and tests
const seedDatabase = async () => {
  // Wrap seed logic in try-catch block for comprehensive database error management
  try {
    // Safely backfill academic IDs for existing users if missing
    await migrateUserAcademicIds();

    // Ensure standardized demo accounts (std01-05, ins01-05, admin01-02) exist and are active
    await seedStandardizedDemoAccounts();

    // Query for existing system administrator account to detect prior seeding
    const existingAdmin = await User.findOne({ email: 'admin@uap.edu' });
    // If system administrator exists, skip redundant initial data creation
    if (existingAdmin) {
      // Log notification that seed data is already present
      console.log('[Seed] Database already contains seed accounts. Skipping.');
      // Return early to prevent duplicate insertion
      return;
    // End existing admin check
    }

    // Log notice that primary database seeding is underway
    console.log('[Seed] Seeding MongoDB with initial platform data...');

    // 1. Users
    // Pre-hash default passwords for primary admin, instructor, and student accounts
    const adminPassword = await hashPassword('Admin@123');
    // Pre-hash default password for instructor account
    const instructorPassword = await hashPassword('Instructor@123');
    // Pre-hash default password for student accounts
    const studentPassword = await hashPassword('Student@123');

    // Create primary System Administrator user record
    const admin = await User.create({
      // Full name
      name: 'System Administrator',
      // Registered email
      email: 'admin@uap.edu',
      // Hashed password
      password: adminPassword,
      // Role assigned as admin
      role: 'admin',
      // Verification status active
      status: 'active',
      // Active boolean flag
      isActive: true,
      // Profile biography narrative
      bio: 'Lead platform administrator for Unified Assessment Platform.',
    // Close admin user creation object
    });

    // Create primary Faculty Instructor user record
    const instructor = await User.create({
      // Full name
      name: 'Prof. Alan Turing',
      // Registered email
      email: 'instructor@uap.edu',
      // Hashed password
      password: instructorPassword,
      // Role assigned as instructor
      role: 'instructor',
      // Verification status active
      status: 'active',
      // Active boolean flag
      isActive: true,
      // Profile biography narrative
      bio: 'Professor of Computer Science & Algorithmic Foundations.',
    // Close instructor user creation object
    });

    // Create primary active Student 1 user record
    const student1 = await User.create({
      // Full name
      name: 'Alex Johnson',
      // Registered email
      email: 'student@uap.edu',
      // Hashed password
      password: studentPassword,
      // Role assigned as student
      role: 'student',
      // Verification status active
      status: 'active',
      // Active boolean flag
      isActive: true,
      // Profile biography narrative
      bio: 'Final year Software Engineering student.',
    // Close student 1 user creation object
    });

    // Create secondary active Student 2 user record
    const student2 = await User.create({
      // Full name
      name: 'Alice Williams',
      // Registered email
      email: 'alice@uap.edu',
      // Hashed password
      password: studentPassword,
      // Role assigned as student
      role: 'student',
      // Verification status active
      status: 'active',
      // Active boolean flag
      isActive: true,
      // Profile biography narrative
      bio: 'Junior Developer and Cloud Enthusiast.',
    // Close student 2 user creation object
    });

    // Create pending approval Student applicant record
    const pendingStudent = await User.create({
      // Full name
      name: 'David Miller',
      // Registered email
      email: 'pending@uap.edu',
      // Hashed password
      password: studentPassword,
      // Role assigned as student
      role: 'student',
      // Verification status pending
      status: 'pending',
      // Active boolean flag disabled pending verification
      isActive: false,
      // Institutional affiliation code
      instituteCode: 'CAMPUS-2025',
      // Profile biography narrative
      bio: 'Prospective applicant awaiting account verification.',
    // Close pending student creation object
    });

    // 2. Assessments
    // Create initial Web Architecture assessment authored by Alan Turing
    const webDevAssessment = await Assessment.create({
      // Assessment title
      title: 'Full-Stack Web Architecture & Engineering',
      // Detailed description of topics covered
      description:
        'Comprehensive evaluation covering RESTful design, relational caching, state management, and asynchronous operations.',
      // Subject category classification
      category: 'Software Engineering',
      // Instructor user ID foreign key
      instructorId: instructor._id,
      // Duration limit in minutes
      durationMinutes: 45,
      // Maximum points possible
      totalPoints: 100,
      // Passing score threshold percentage
      passingScore: 70,
      // Publication status set to published
      status: 'published',
      // Allow students to review questions after evaluation
      allowReview: true,
    // Close webDevAssessment creation object
    });

    // Create initial Data Structures assessment authored by Alan Turing
    const dsaAssessment = await Assessment.create({
      // Assessment title
      title: 'Data Structures & Algorithmic Complexity',
      // Detailed description of topics covered
      description:
        'Core concepts in algorithmic complexity, asymptotic bounds, balanced trees, and dynamic programming.',
      // Subject category classification
      category: 'Computer Science',
      // Instructor user ID foreign key
      instructorId: instructor._id,
      // Duration limit in minutes
      durationMinutes: 60,
      // Maximum points possible
      totalPoints: 100,
      // Passing score threshold percentage
      passingScore: 60,
      // Publication status set to published
      status: 'published',
      // Allow students to review questions after evaluation
      allowReview: true,
    // Close dsaAssessment creation object
    });

    // 3. Questions for Web Dev Assessment (MCQ, Short Answer, Long Answer, True/False, Code)
    // Bulk insert multiple question types into Question collection for Web Dev Assessment
    const questionsWebDev = await Question.insertMany([
      // First question: MCQ on HTTP 304 caching
      {
        // Reference foreign key to webDevAssessment
        assessmentId: webDevAssessment._id,
        // Question prompt text
        questionText:
          'Which HTTP status code signifies that a requested resource has not been modified and can be retrieved from client cache?',
        // Question format type
        type: 'mcq',
        // Array of answer choices
        options: [
          // Choice A
          { id: 'a', text: '200 OK' },
          // Choice B
          { id: 'b', text: '304 Not Modified' },
          // Choice C
          { id: 'c', text: '400 Bad Request' },
          // Choice D
          { id: 'd', text: '404 Not Found' },
        // Close options array
        ],
        // Correct answer option key
        correctAnswer: 'b',
        // Pedagogical explanation
        explanation: 'HTTP 304 indicates that the resource has not been modified since header date.',
        // Point value
        points: 20,
        // Order index
        orderIndex: 0,
      // Close question 1
      },
      // Second question: True/False on JWT encryption vs signing
      {
        // Reference foreign key to webDevAssessment
        assessmentId: webDevAssessment._id,
        // Question prompt text
        questionText:
          'A JSON Web Token (JWT) signature alone encrypts the payload so that sensitive data cannot be read by anyone possessing the token.',
        // Question format type
        type: 'true_false',
        // Array of binary choices
        options: [
          // True choice
          { id: 'true', text: 'True' },
          // False choice
          { id: 'false', text: 'False' },
        // Close options array
        ],
        // Correct answer option key
        correctAnswer: 'false',
        // Pedagogical explanation
        explanation: 'JWT payload is base64url encoded and not encrypted; signature guarantees integrity only.',
        // Point value
        points: 15,
        // Order index
        orderIndex: 1,
      // Close question 2
      },
      // Third question: Short answer on optimistic vs pessimistic concurrency
      {
        // Reference foreign key to webDevAssessment
        assessmentId: webDevAssessment._id,
        // Question prompt text
        questionText:
          'Explain the difference between optimistic concurrency control and pessimistic locking in relational databases.',
        // Question format type
        type: 'short_answer',
        // Empty options array for open text response
        options: [],
        // Model answer for scoring
        correctAnswer:
          'Optimistic locking validates record versions at commit time without holding locks, while pessimistic locking holds exclusive database locks during transactions.',
        // Pedagogical explanation
        explanation: 'Optimistic locking minimizes locks and works well in read-heavy applications.',
        // Point value
        points: 25,
        // Order index
        orderIndex: 2,
      // Close question 3
      },
      // Fourth question: Long answer essay on distributed architectures
      {
        // Reference foreign key to webDevAssessment
        assessmentId: webDevAssessment._id,
        // Question prompt text
        questionText:
          'Discuss how modern distributed web architectures achieve horizontal scalability and high availability. Detail database partitioning, stateless application tiers, and caching strategies.',
        // Question format type
        type: 'long_answer',
        // Empty options array for open text response
        options: [],
        // Model answer for scoring
        correctAnswer:
          'Comprehensive architectural essay addressing stateless microservices, read replicas/sharding, Redis caching tiers, and CDN edge termination.',
        // Pedagogical explanation
        explanation: 'Should cover tier decoupling, cache invalidation, and replication consistency trade-offs.',
        // Point value
        points: 40,
        // Order index
        orderIndex: 3,
      // Close question 4
      },
    // Close web dev questions array
    ]);

    // 4. Questions for DSA Assessment
    // Bulk insert questions for DSA assessment
    await Question.insertMany([
      // First question: MCQ on AVL tree search complexity
      {
        // Reference foreign key to dsaAssessment
        assessmentId: dsaAssessment._id,
        // Question prompt text
        questionText:
          'What is the worst-case time complexity of searching in an AVL Tree containing N elements?',
        // Question format type
        type: 'mcq',
        // Array of answer choices
        options: [
          // Choice A
          { id: 'a', text: 'O(1)' },
          // Choice B
          { id: 'b', text: 'O(log N)' },
          // Choice C
          { id: 'c', text: 'O(N)' },
          // Choice D
          { id: 'd', text: 'O(N log N)' },
        // Close options array
        ],
        // Correct answer option key
        correctAnswer: 'b',
        // Pedagogical explanation
        explanation: 'AVL trees are strictly height-balanced BSTs, ensuring O(log N) worst-case search.',
        // Point value
        points: 50,
        // Order index
        orderIndex: 0,
      // Close question 1
      },
      // Second question: True/False on BFS shortest path
      {
        // Reference foreign key to dsaAssessment
        assessmentId: dsaAssessment._id,
        // Question prompt text
        questionText:
          'Breadth-First Search (BFS) on an unweighted graph is guaranteed to find the shortest path between two nodes.',
        // Question format type
        type: 'true_false',
        // Array of binary choices
        options: [
          // True choice
          { id: 'true', text: 'True' },
          // False choice
          { id: 'false', text: 'False' },
        // Close options array
        ],
        // Correct answer option key
        correctAnswer: 'true',
        // Pedagogical explanation
        explanation: 'BFS explores layer by layer, identifying the shortest path in unweighted graphs.',
        // Point value
        points: 50,
        // Order index
        orderIndex: 1,
      // Close question 2
      },
    // Close DSA questions array
    ]);

    // 5. Sample Submission & Evaluation
    // Reference first question (caching MCQ)
    const q1 = questionsWebDev[0];
    // Reference second question (JWT true/false)
    const q2 = questionsWebDev[1];
    // Reference third question (concurrency short answer)
    const q3 = questionsWebDev[2];
    // Reference fourth question (distributed system long answer)
    const q4 = questionsWebDev[3];

    // Create completed and scored Submission document for student 1
    const submission1 = await Submission.create({
      // Reference foreign key to assessment
      assessmentId: webDevAssessment._id,
      // Reference foreign key to student 1
      studentId: student1._id,
      // Map of student answer responses keyed by question ID
      answers: {
        // Answer choice for question 1
        [q1._id.toString()]: 'b',
        // Answer choice for question 2
        [q2._id.toString()]: 'false',
        // Subjective response for question 3
        [q3._id.toString()]:
          'Optimistic locking validates record versions at commit time without holding locks, while pessimistic locking holds exclusive database locks during transactions.',
        // Subjective essay for question 4
        [q4._id.toString()]:
          'Modern distributed architectures decouple the presentation and application tiers by maintaining stateless compute nodes that horizontally scale behind load balancers. State is externalized into managed database clusters utilizing sharding and replication, alongside Redis distributed caches.',
      // Close answers map
      },
      // Total score awarded
      score: 95,
      // Total available points
      totalPoints: 100,
      // Percentage score achieved
      percentage: 95,
      // Boolean passed flag
      passed: true,
      // Submission evaluation status
      status: 'evaluated',
      // Submission start time (1 hour ago)
      startedAt: new Date(Date.now() - 3600000),
      // Submission delivery time (30 minutes ago)
      submittedAt: new Date(Date.now() - 1800000),
      // Duration spent in seconds (27.5 minutes)
      timeSpentSeconds: 1650,
      // Consolidated instructor feedback comment
      feedback: 'Outstanding grasp of web architectures and concurrency patterns.',
    // Close submission 1 creation object
    });

    // Create detailed Evaluation document with instructor rubric scoring
    await Evaluation.create({
      // Reference foreign key to submission 1
      submissionId: submission1._id,
      // Reference foreign key to instructor Alan Turing
      evaluatorId: instructor._id,
      // Question-by-question scoring and feedback rubric
      questionFeedback: {
        // Feedback for question 1
        [q1._id.toString()]: { pointsAwarded: 20, comment: 'Correct HTTP status code.' },
        // Feedback for question 2
        [q2._id.toString()]: { pointsAwarded: 15, comment: 'Accurate distinction on signature vs encryption.' },
        // Feedback for question 3
        [q3._id.toString()]: { pointsAwarded: 24, comment: 'Precise comparison of concurrency models.' },
        // Feedback for question 4
        [q4._id.toString()]: { pointsAwarded: 36, comment: 'Thorough discussion of stateless scaling.' },
      // Close questionFeedback map
      },
      // High-level instructor evaluation summary
      generalFeedback: 'Superb work! Demonstrated strong theoretical and architectural fundamentals.',
      // Consolidated final grade score
      finalScore: 95,
      // Lifecycle state set to completed
      status: 'completed',
      // Timestamp when grading occurred
      gradedAt: new Date(),
    // Close evaluation document object
    });

    // 6. Notifications
    // Create grade release notification for student 1
    await Notification.create({
      // Recipient student user ID
      userId: student1._id,
      // Notification title header
      title: 'Assessment Graded',
      // Notification message body
      message: 'Your submission for "Full-Stack Web Architecture & Engineering" has been graded. You scored 95%!',
      // Type classification category
      type: 'grade',
      // Deep-link URL navigating student to result breakdown
      link: `/student/submissions?submissionId=${submission1._id}`,
    // Close notification 1 creation object
    });

    // Create new assessment available notification for student 1
    await Notification.create({
      // Recipient student user ID
      userId: student1._id,
      // Notification title header
      title: 'New Assessment Available',
      // Notification message body
      message: 'New assessment "Data Structures & Algorithmic Complexity" is now open for enrollment.',
      // Type classification category
      type: 'assessment',
      // Deep-link URL navigating student to assessment catalog
      link: `/student/catalog`,
    // Close notification 2 creation object
    });

    // 7. Seed Phase 7 Question Bank items
    // Populate Question Bank with sample items authored by primary instructor Alan Turing
    await seedPhase7QuestionBank(instructor);

    // 8. Authoritative Institution Student Registry Records (Phase 9B)
    // Query count of authoritative student registry records in database
    const existingRegistryCount = await StudentRegistry.countDocuments();
    // Seed pre-verified institution student registry records if collection is empty
    if (existingRegistryCount === 0) {
      // Bulk insert authoritative institution student records
      await StudentRegistry.insertMany([
        // Student registry entry 1
        {
          // Institutional student identification code
          studentId: 'STU001',
          // Student full legal name
          name: 'Rahul Kumar',
          // Birthdate for institutional identity verification
          dateOfBirth: new Date('2002-06-15'),
          // Institutional email address
          email: 'rahul@college.edu',
          // Enrollment status
          status: 'active',
        // Close student registry entry 1
        },
        // Student registry entry 2
        {
          // Institutional student identification code
          studentId: 'STU-2026-101',
          // Student full legal name
          name: 'Priya Sharma',
          // Birthdate for institutional identity verification
          dateOfBirth: new Date('2003-04-20'),
          // Institutional email address
          email: 'priya.sharma@uap.edu',
          // Enrollment status
          status: 'active',
        // Close student registry entry 2
        },
        // Student registry entry 3
        {
          // Institutional student identification code
          studentId: 'STU-2026-102',
          // Student full legal name
          name: 'David Chen',
          // Birthdate for institutional identity verification
          dateOfBirth: new Date('2001-11-08'),
          // Institutional email address
          email: 'david.chen@uap.edu',
          // Enrollment status
          status: 'active',
        // Close student registry entry 3
        },
        // Student registry entry 4
        {
          // Institutional student identification code
          studentId: 'STU-2026-103',
          // Student full legal name
          name: 'Eleanor Vance',
          // Birthdate for institutional identity verification
          dateOfBirth: new Date('2002-09-12'),
          // Institutional email address
          email: 'eleanor.vance@uap.edu',
          // Enrollment status
          status: 'active',
        // Close student registry entry 4
        },
        // Student registry entry 5
        {
          // Institutional student identification code
          studentId: 'STU-2026-104',
          // Student full legal name
          name: 'Marcus Brody',
          // Birthdate for institutional identity verification
          dateOfBirth: new Date('2002-01-25'),
          // Institutional email address
          email: 'marcus.brody@uap.edu',
          // Inactive enrollment status
          status: 'inactive',
        // Close student registry entry 5
        },
      // Close registry records array
      ]);
      // Log confirmation that institutional registry was seeded
      console.log('[Seed] Seeded authoritative Institution Student Registry records.');
    // End registry count check
    }

    // 9. Audit Log
    // Create audit log tracking platform bootstrap initialization event
    await AuditLog.create({
      // Reference foreign key to system admin user
      userId: admin._id,
      // Standardized audit event action tag
      action: 'SYSTEM_BOOTSTRAP',
      // Entity classification
      entityType: 'System',
      // Metadata details regarding environment and storage stack
      details: { environment: 'production-ready', database: 'MongoDB + Mongoose' },
    // Close audit log creation object
    });

    // Output success message to console indicating database seeding completed
    console.log('[Seed] Database successfully populated with initial accounts and test data!');
  // Catch and handle any errors during database seeding
  } catch (error) {
    // Log database seeding failure to error stream
    console.error('[Seed] Error seeding database:', error);
  // End try-catch block
  }
// End seedDatabase function
};

// Export the seedDatabase bootstrapping function as the module export
module.exports = seedDatabase;
