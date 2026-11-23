import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function readProjectFile(relPath) {
  return fs.readFileSync(path.join(rootDir, relPath), 'utf8');
}

describe('UAP Phase 5 Frontend Analytics Contract & Dashboard Integration Test Suite', () => {
  const serviceSrc = readProjectFile('frontend/src/services/analytics.service.js');
  const studentDashSrc = readProjectFile('frontend/src/pages/student/Dashboard.jsx');
  const instructorAnalyticsSrc = readProjectFile('frontend/src/pages/instructor/AssessmentAnalytics.jsx');
  const adminDashSrc = readProjectFile('frontend/src/pages/admin/Dashboard.jsx');
  const tailwindCfg = readProjectFile('frontend/tailwind.config.js');

  describe('1. Frontend Analytics API Service Contracts', () => {
    test('1.1 analyticsService exports all student analytics methods', () => {
      assert.match(serviceSrc, /getStudentPerformance:\s*async/, 'getStudentPerformance must be defined');
      assert.match(serviceSrc, /getStudentTrends:\s*async/, 'getStudentTrends must be defined');
      assert.match(serviceSrc, /getStudentTopics:\s*async/, 'getStudentTopics must be defined');
      assert.match(serviceSrc, /getStudentStreak:\s*async/, 'getStudentStreak must be defined');
      assert.match(serviceSrc, /getLeaderboard:\s*async/, 'getLeaderboard must be defined');
    });

    test('1.2 analyticsService exports all instructor reporting methods', () => {
      assert.match(serviceSrc, /getInstructorOverview:\s*async/, 'getInstructorOverview must be defined');
      assert.match(serviceSrc, /getInstructorAssessmentAnalytics:\s*async/, 'getInstructorAssessmentAnalytics must be defined');
      assert.match(serviceSrc, /getInstructorQuestionAnalytics:\s*async/, 'getInstructorQuestionAnalytics must be defined');
      assert.match(serviceSrc, /getInstructorMockTestAnalytics:\s*async/, 'getInstructorMockTestAnalytics must be defined');
    });

    test('1.3 analyticsService exports all admin institutional analytics methods', () => {
      assert.match(serviceSrc, /getAdminOverview:\s*async/, 'getAdminOverview must be defined');
      assert.match(serviceSrc, /getAdminFacultyActivity:\s*async/, 'getAdminFacultyActivity must be defined');
    });
  });

  describe('2. Student Dashboard Performance & Diagnostic Integration', () => {
    test('2.1 StudentDashboard renders Topic & Concept Mastery Diagnostic', () => {
      assert.match(
        studentDashSrc,
        /Topic & Concept Mastery Diagnostic/,
        'StudentDashboard must feature Topic & Concept Mastery Diagnostic'
      );
      assert.match(
        studentDashSrc,
        /confidenceScore/,
        'Must display confidence levels'
      );
      assert.match(
        studentDashSrc,
        /accuracyPercentage/,
        'Must display accuracy progress'
      );
    });

    test('2.2 StudentDashboard renders Technical Code & Database Evaluation', () => {
      assert.match(
        studentDashSrc,
        /Technical & Practical Code Evaluation/,
        'StudentDashboard must feature Technical Code Evaluation'
      );
      assert.match(studentDashSrc, /Algorithmic Coding/, 'Must display Algorithmic Coding statistics');
      assert.match(studentDashSrc, /Database & SQL Querying/, 'Must display SQL Querying statistics');
    });

    test('2.3 StudentDashboard renders Mock Bank & Blueprint Examinations Summary', () => {
      assert.match(
        studentDashSrc,
        /Mock Bank & Blueprint Examinations/,
        'StudentDashboard must feature Mock Bank summary'
      );
      assert.match(studentDashSrc, /mockTestPerformance/, 'Must bind mock test performance metrics');
    });
  });

  describe('3. Instructor Assessment Analytics & Pedagogical Diagnostic', () => {
    test('3.1 AssessmentAnalytics displays Average Grading Turnaround Time', () => {
      assert.match(
        instructorAnalyticsSrc,
        /Avg Grading Turnaround/,
        'AssessmentAnalytics must display Avg Grading Turnaround'
      );
      assert.match(
        instructorAnalyticsSrc,
        /evaluationTurnaround/,
        'Must bind evaluation turnaround data'
      );
    });

    test('3.2 AssessmentAnalytics displays Frequently Missed Questions', () => {
      assert.match(
        instructorAnalyticsSrc,
        /Frequently Missed Questions/,
        'AssessmentAnalytics must render Frequently Missed Questions card'
      );
    });

    test('3.3 AssessmentAnalytics displays Topic-Level Pedagogical Weaknesses', () => {
      assert.match(
        instructorAnalyticsSrc,
        /Topic-Level Pedagogical Weaknesses/,
        'AssessmentAnalytics must render Topic-Level Pedagogical Weaknesses card'
      );
    });
  });

  describe('4. Admin Institutional Dashboard Insights', () => {
    test('4.1 AdminDashboard displays Faculty Assessment Activity & Evaluation Backlog', () => {
      assert.match(
        adminDashSrc,
        /Faculty Assessment Activity & Evaluation Backlog/,
        'AdminDashboard must display Faculty Assessment Activity & Evaluation Backlog'
      );
      assert.match(
        adminDashSrc,
        /facultyAssessmentActivity/,
        'Must bind facultyAssessmentActivity dataset'
      );
    });

    test('4.2 AdminDashboard displays Platform Pass Rate and Evaluation metrics', () => {
      assert.match(
        adminDashSrc,
        /Platform Pass Rate/,
        'AdminDashboard must render Platform Pass Rate'
      );
      assert.match(
        adminDashSrc,
        /overallPassRate/,
        'Must bind overallPassRate'
      );
    });
  });

  describe('5. Design System & Token Integrity', () => {
    test('5.1 Preserves authoritative brand terracotta #E05D38 without unauthorized accents', () => {
      assert.match(
        tailwindCfg,
        /#E05D38/i,
        'Tailwind config must specify authoritative #E05D38 terracotta token'
      );
      assert.doesNotMatch(
        studentDashSrc,
        /bg-indigo-600|text-indigo-600|bg-purple-600/,
        'Must not introduce indigo or purple accents'
      );
    });
  });
});
