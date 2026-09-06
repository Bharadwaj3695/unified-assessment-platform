const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { connectDB, disconnectDB } = require('../src/config/db');
const seedDatabase = require('../src/config/seed');
const authService = require('../src/services/auth.service');
const { User, Assessment, Question } = require('../src/models');
const { verifyAccessToken } = require('../src/utils/jwt');

describe('Step 1 & 2 Verification: MongoDB, Mongoose, Auth & RBAC', () => {
  before(async () => {
    await connectDB();
    await seedDatabase();
  });

  after(async () => {
    await disconnectDB();
  });

  it('should verify database seeded users with correct roles', async () => {
    const admin = await User.findOne({ email: 'admin@uap.edu' });
    const instructor = await User.findOne({ email: 'instructor@uap.edu' });
    const student = await User.findOne({ email: 'student@uap.edu' });

    assert.ok(admin, 'Admin should exist');
    assert.strictEqual(admin.role, 'admin');

    assert.ok(instructor, 'Instructor should exist');
    assert.strictEqual(instructor.role, 'instructor');

    assert.ok(student, 'Student should exist');
    assert.strictEqual(student.role, 'student');
  });

  it('should authenticate student and return valid JWT tokens', async () => {
    const result = await authService.login({
      email: 'student@uap.edu',
      password: 'Student@123',
    });

    assert.ok(result.accessToken, 'Access token should be present');
    assert.ok(result.refreshToken, 'Refresh token should be present');
    assert.strictEqual(result.user.role, 'student');

    const decoded = verifyAccessToken(result.accessToken);
    assert.strictEqual(decoded.role, 'student');
    assert.strictEqual(decoded.email, 'student@uap.edu');
  });

  it('should support all mandatory question types (MCQ, Short Answer, Long Answer)', async () => {
    const questions = await Question.find();
    const types = new Set(questions.map(q => q.type));

    assert.ok(types.has('mcq'), 'MCQ question type must be present');
    assert.ok(types.has('short_answer'), 'Short Answer question type must be present');
    assert.ok(types.has('long_answer'), 'Long Answer question type must be present');
  });

  it('should reject invalid credentials with 401', async () => {
    await assert.rejects(
      async () => {
        await authService.login({
          email: 'student@uap.edu',
          password: 'WrongPassword!',
        });
      },
      (err) => {
        assert.strictEqual(err.statusCode, 401);
        return true;
      }
    );
  });

  it('should register a new applicant with pending status requiring admin approval', async () => {
    await User.deleteOne({ email: 'applicant@uap.edu' });
    const regResult = await authService.register({
      name: 'New Applicant',
      email: 'applicant@uap.edu',
      password: 'SecurePassword123',
      role: 'student',
      instituteCode: 'CAMPUS-2025',
    });

    assert.ok(regResult.user.id);
    assert.strictEqual(regResult.user.role, 'student');
    assert.strictEqual(regResult.status, 'pending');
    assert.strictEqual(regResult.user.status, 'pending');
    assert.strictEqual(regResult.accessToken, undefined, 'Pending user should not receive access token');
  });

  it('should block public registration from creating an admin account', async () => {
    await assert.rejects(
      async () => {
        await authService.register({
          name: 'Unauthorized Admin',
          email: 'badadmin@uap.edu',
          password: 'Password123',
          role: 'admin',
          instituteCode: 'CAMPUS-2025',
        });
      },
      (err) => {
        assert.strictEqual(err.statusCode, 403);
        assert.match(err.message, /cannot create an administrator account/i);
        return true;
      }
    );
  });

  it('should prevent pending user from logging in before admin approval', async () => {
    await assert.rejects(
      async () => {
        await authService.login({
          email: 'applicant@uap.edu',
          password: 'SecurePassword123',
        });
      },
      (err) => {
        assert.strictEqual(err.statusCode, 403);
        assert.match(err.message, /pending administrator approval/i);
        return true;
      }
    );
  });

  it('should allow active instructor to log in with role inferred from DB', async () => {
    const loginResult = await authService.login({
      email: 'instructor@uap.edu',
      password: 'Instructor@123',
    });

    assert.ok(loginResult.accessToken);
    assert.strictEqual(loginResult.user.role, 'instructor');
    assert.strictEqual(loginResult.user.status, 'active');
  });

  it('should allow active admin to log in with role inferred from DB', async () => {
    const loginResult = await authService.login({
      email: 'admin@uap.edu',
      password: 'Admin@123',
    });

    assert.ok(loginResult.accessToken);
    assert.strictEqual(loginResult.user.role, 'admin');
    assert.strictEqual(loginResult.user.status, 'active');
  });
});
