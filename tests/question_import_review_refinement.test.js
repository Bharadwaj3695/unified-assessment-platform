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

describe('Question Import Review Page UI Refinement Contract', () => {
  const reviewSrc = readProjectFile('frontend/src/pages/instructor/QuestionImportReview.jsx');
  const routesSrc = readProjectFile('frontend/src/routes/AppRoutes.jsx');

  test('1. Action bar renders Submissions, Save Draft, and Publish Live with consistent design language', () => {
    // 1.1 All three action buttons are rendered
    assert.match(reviewSrc, /<Button[^>]*>[\s\S]*?Submissions[\s\S]*?<\/Button>/);
    assert.match(reviewSrc, /<Button[^>]*>[\s\S]*?Save Draft[\s\S]*?<\/Button>/);
    assert.match(reviewSrc, /<Button[^>]*>[\s\S]*?Publish Live[\s\S]*?<\/Button>/);

    // 1.2 Matches styling, sizes, and design system variants
    assert.match(
      reviewSrc,
      /<Button[\s\S]*?variant="outline"[\s\S]*?size="md"[\s\S]*?icon=\{FileCheck2\}[\s\S]*?>[\s\S]*?Submissions/
    );
    assert.match(
      reviewSrc,
      /<Button[\s\S]*?variant="outline"[\s\S]*?size="md"[\s\S]*?icon=\{Save\}[\s\S]*?>[\s\S]*?Save Draft/
    );
    assert.match(
      reviewSrc,
      /<Button[\s\S]*?variant="primary"[\s\S]*?size="md"[\s\S]*?icon=\{Send\}[\s\S]*?>[\s\S]*?Publish Live/
    );
  });

  test('2. Submissions button navigates to existing Instructor Submissions route', () => {
    assert.match(
      reviewSrc,
      /handleNavigateToSubmissions[\s\S]*?navigate\(['"`]\/instructor\/submissions['"`]\)/
    );
    assert.match(
      reviewSrc,
      /onClick=\{handleNavigateToSubmissions\}[\s\S]*?>[\s\S]*?Submissions/
    );
  });

  test('3. Save Draft persists import workflow progress using existing supported functionality', () => {
    assert.match(reviewSrc, /const handleSaveDraft = async \(\) =>/);
    assert.match(reviewSrc, /setIsSavingDraft\(true\)/);
    assert.match(reviewSrc, /await loadJobPreview\(\)/);
    assert.match(reviewSrc, /toast\.success\(/);
    assert.match(reviewSrc, /finally\s*\{[\s\S]*?setIsSavingDraft\(false\)/);
  });

  test('4. Publish Live enforces faculty approval gate and routes to existing assessment builder', () => {
    // Faculty review gate: blocks direct publishing when pending questions exist
    assert.match(
      reviewSrc,
      /const currentPending = questions\.filter\(\(q\) => q\.reviewStatus === 'PENDING'\);/
    );
    assert.match(
      reviewSrc,
      /if\s*\(currentPending\.length > 0\)\s*\{[\s\S]*?setPublishModal\(\{[\s\S]*?mode:\s*'pending_warning'/
    );
    // Verification of accepted questions availability
    assert.match(reviewSrc, /if\s*\(currentAccepted === 0\)/);
    // Reroutes to assessment creation workflow without inventing an assessment entity
    assert.match(
      reviewSrc,
      /navigate\(['"`]\/instructor\/create['"`]\)/
    );
  });

  test('5. Summary cards are the single source of visible status counts', () => {
    // 4 Summary cards exist with reactive counts
    assert.match(reviewSrc, /Total Detected[\s\S]*?\{questions\.length\}/);
    assert.match(reviewSrc, /Pending Review[\s\S]*?\{pendingQuestions\.length\}/);
    assert.match(reviewSrc, /Accepted into Bank[\s\S]*?\{acceptedCount\}/);
    assert.match(reviewSrc, /Rejected[\s\S]*?\{rejectedCount\}/);

    // Filter tabs do NOT contain numerical counts in tabs
    assert.doesNotMatch(
      reviewSrc,
      /\{st\}\s*\(\s*\{questions\.filter/,
      'Filter buttons must not repeat numerical status counts'
    );
    assert.doesNotMatch(
      reviewSrc,
      /\{tab\.label\}\s*\(/,
      'Filter tabs must not include parentheses count in label'
    );
    assert.match(reviewSrc, /FILTER_TABS/);
    assert.match(reviewSrc, /\{ id: 'ALL', label: 'All' \}/);
    assert.match(reviewSrc, /\{ id: 'PENDING', label: 'Pending Review' \}/);
    assert.match(reviewSrc, /\{ id: 'ACCEPTED', label: 'Accepted' \}/);
    assert.match(reviewSrc, /\{ id: 'REJECTED', label: 'Rejected' \}/);
  });

  test('6. Filter and bulk action toolbar is compact and unified', () => {
    // Filter buttons and bulk review actions share one clear toolbar
    assert.match(reviewSrc, /Select All Pending/);
    assert.match(reviewSrc, /handleBulkReview\('REJECT'\)/);
    assert.match(reviewSrc, /handleBulkReview\('ACCEPT'\)/);
    assert.match(reviewSrc, /flex flex-col md:flex-row md:items-center justify-between/);
  });

  test('7. Spacing, typography, and dark mode support use design system tokens', () => {
    // Top sticky bar with blur
    assert.match(reviewSrc, /sticky top-0 z-30 bg-bg-light\/95 dark:bg-bg-dark\/95/);
    // Dark mode support on cards and inputs
    assert.match(reviewSrc, /dark:border-\[#2D3748\]/);
    assert.match(reviewSrc, /dark:text-\[#F9FAFB\]/);
    assert.match(reviewSrc, /dark:bg-surface-dark/);
  });

  test('8. Mandatory faculty review and review status integrity are preserved', () => {
    assert.match(reviewSrc, /questionImportService\.reviewQuestion/);
    assert.match(reviewSrc, /questionImportService\.bulkReview/);
    assert.match(reviewSrc, /reviewStatus: action/);
    assert.match(reviewSrc, /handleSingleReview\(q\.tempId, 'ACCEPT'\)/);
    assert.match(reviewSrc, /handleSingleReview\(q\.tempId, 'REJECT'\)/);
  });
});
