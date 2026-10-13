// Import the User Mongoose model representing user accounts and credentials
const User = require('./User');
// Import the Assessment Mongoose model representing exams and test definitions
const Assessment = require('./Assessment');
// Import the Question Mongoose model representing exam questions and answers
const Question = require('./Question');
// Import the Submission Mongoose model representing student test attempts and responses
const Submission = require('./Submission');
// Import the Evaluation Mongoose model representing scoring and grading results
const Evaluation = require('./Evaluation');
// Import the Notification Mongoose model representing user notifications and alerts
const Notification = require('./Notification');
// Import the AuditLog Mongoose model representing administrative and system audit events
const AuditLog = require('./AuditLog');
// Import the SystemSetting Mongoose model representing platform-wide configuration settings
const SystemSetting = require('./SystemSetting');
// Import the ProctoringSession Mongoose model representing automated proctoring monitoring sessions
const ProctoringSession = require('./ProctoringSession');
// Import the ProctoringEvent Mongoose model representing logged proctoring incident events
const ProctoringEvent = require('./ProctoringEvent');
// Import the BankQuestion Mongoose model representing reusable questions stored in question banks
const BankQuestion = require('./BankQuestion');
// Import the QuestionImportJob Mongoose model representing background question import tasks
const QuestionImportJob = require('./QuestionImportJob');
// Import the MfaChallenge Mongoose model representing multi-factor authentication challenges
const MfaChallenge = require('./MfaChallenge');
// Import the StudentRegistry Mongoose model representing the master student institutional registry
const StudentRegistry = require('./StudentRegistry');
// Import the FacultyRegistry Mongoose model representing the master faculty institutional registry
const FacultyRegistry = require('./FacultyRegistry');
// Import the PasswordResetToken Mongoose model representing secure password reset tokens
const PasswordResetToken = require('./PasswordResetToken');
// Import the Session Mongoose model representing authoritative server-side refresh sessions
const Session = require('./Session');

// Export an aggregated object containing all Mongoose models for unified access across the platform
module.exports = {
  // Export User model
  User,
  // Export Assessment model
  Assessment,
  // Export Question model
  Question,
  // Export Submission model
  Submission,
  // Export Evaluation model
  Evaluation,
  // Export Notification model
  Notification,
  // Export AuditLog model
  AuditLog,
  // Export SystemSetting model
  SystemSetting,
  // Export ProctoringSession model
  ProctoringSession,
  // Export ProctoringEvent model
  ProctoringEvent,
  // Export BankQuestion model
  BankQuestion,
  // Export QuestionImportJob model
  QuestionImportJob,
  // Export MfaChallenge model
  MfaChallenge,
  // Export StudentRegistry model
  StudentRegistry,
  // Export FacultyRegistry model
  FacultyRegistry,
  // Export PasswordResetToken model
  PasswordResetToken,
  // Export Session model
  Session,
// Close the exported models dictionary
};
