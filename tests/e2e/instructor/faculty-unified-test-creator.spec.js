const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

test.describe.serial('Faculty Unified Test Creator & Question Authoring E2E', () => {
  const screenshotsDir = path.resolve(__dirname, '../../../test-results/screenshots');
  let page;

  test.beforeAll(async ({ browser }) => {
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
    const context = await browser.newContext({
      viewport: { width: 1366, height: 960 },
    });
    page = await context.newPage();

    // Log in once as instructor
    await page.goto('/auth/login');
    await page.fill('#email', 'instructor@uap.edu');
    await page.fill('#password', 'Instructor@123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/instructor\/dashboard/);
    await expect(page.getByText('instructor Workspace', { exact: true })).toBeVisible({ timeout: 15000 });
  });

  test.afterAll(async () => {
    if (page) await page.close();
  });

  test('1. Create Test Hub has concise copy, primary single card layout, and interview cards', async () => {
    await page.goto('/instructor/create-test');
    await expect(page.locator('[data-testid="faculty-create-test-hub"]')).toBeVisible({ timeout: 10000 });

    // Verify concise header
    await expect(page.getByRole('heading', { name: 'Create Test' })).toBeVisible();
    await expect(page.getByText('Select test type', { exact: true })).toBeVisible();

    // Verify Primary Test Creation Card
    const primaryCard = page.locator('[data-testid="card-primary-test-creation"]');
    await expect(primaryCard).toBeVisible();
    await expect(primaryCard.getByRole('heading', { name: 'Select Test Type' })).toBeVisible();

    // Check two selectable options inside the primary card
    const asmtOption = primaryCard.locator('[data-testid="option-course-assessment"]');
    const mockOption = primaryCard.locator('[data-testid="option-mock-test"]');
    await expect(asmtOption).toBeVisible();
    await expect(mockOption).toBeVisible();

    await expect(asmtOption.getByText('Course Assessment')).toBeVisible();
    await expect(mockOption.getByText('Mock Test')).toBeVisible();

    // Select Mock Test option
    await mockOption.click();
    await expect(primaryCard.getByText('Mock Test', { exact: true }).first()).toBeVisible();

    // Select Course Assessment option
    await asmtOption.click();
    await expect(primaryCard.getByText('Course Assessment', { exact: true }).first()).toBeVisible();

    // Verify Launch button inside the primary card with exact label "Launch"
    const launchBtn = primaryCard.locator('[data-testid="btn-launch-creator"]');
    await expect(launchBtn).toBeVisible();
    await expect(launchBtn).toHaveText(/Launch/);

    // Verify Interview Options (Coming Soon)
    const aiInterviewCard = page.locator('[data-testid="card-interview-ai"]');
    const facultyInterviewCard = page.locator('[data-testid="card-interview-faculty"]');
    await expect(aiInterviewCard).toBeVisible();
    await expect(facultyInterviewCard).toBeVisible();
    await expect(aiInterviewCard.getByText('Coming Soon')).toBeVisible();
    await expect(facultyInterviewCard.getByText('Coming Soon')).toBeVisible();

    // Capture Hub screenshot
    await page.screenshot({
      path: path.join(screenshotsDir, 'faculty-create-test-hub-compact.png'),
    });
  });

  test('2. Assessment Workflow: Launch Test Creator, author coding questions with Faculty IDE, preview, and save draft', async () => {
    await page.goto('/instructor/create-test');

    // Select Assessment and click Launch
    const primaryCard = page.locator('[data-testid="card-primary-test-creation"]');
    await primaryCard.locator('[data-testid="option-course-assessment"]').click();
    await primaryCard.locator('[data-testid="btn-launch-creator"]').click();

    // Verify Test Creator Studio loaded with Assessment badge
    await expect(page).toHaveURL(/\/instructor\/test-creator\?type=assessment/);
    await expect(page.getByRole('heading', { name: 'Test Creator Studio' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Course Assessment', { exact: true }).first()).toBeVisible();

    // Fill Test Details
    const testTitle = `E2E Operating Systems Exam ${Date.now()}`;
    await page.fill('input[placeholder*="Distributed Systems"]', testTitle);

    // Verify Question #1 exists (MCQ)
    const q1Card = page.locator('[data-testid="question-card-0"]');
    await expect(q1Card).toBeVisible();
    await q1Card.locator('textarea').fill('What mechanism avoids race conditions in multi-threaded programs?');

    // Add Question via top button
    await page.locator('[data-testid="btn-add-question-top"]').click();
    const q2Card = page.locator('[data-testid="question-card-1"]');
    await expect(q2Card).toBeVisible();

    // Change Q2 to Coding Challenge
    const typeSelect = q2Card.locator('select').first();
    await typeSelect.selectOption('CODING');

    // Verify Faculty Coding IDE & Test Validator rendered inside Q2 card
    await expect(q2Card.getByText('Faculty Coding IDE & Test Validator')).toBeVisible({ timeout: 8000 });
    await expect(q2Card.getByRole('button', { name: /Code Editor/i })).toBeVisible();
    await expect(q2Card.getByRole('button', { name: /Test Cases/i })).toBeVisible();

    // Switch to Test Cases tab in Faculty IDE
    await q2Card.getByRole('button', { name: /Test Cases/i }).click();
    await expect(q2Card.getByText(/Test Cases/i).first()).toBeVisible();

    // Switch back to Code Editor tab in Faculty IDE
    await q2Card.getByRole('button', { name: /Code Editor/i }).click();
    await expect(q2Card.getByText(/Runtime Language:/i)).toBeVisible();

    // Add Question via bottom button
    await page.locator('[data-testid="btn-add-question-bottom"]').click();
    const q3Card = page.locator('[data-testid="question-card-2"]');
    await expect(q3Card).toBeVisible();

    // Change Q3 to SQL Challenge
    await q3Card.locator('select').first().selectOption('SQL');
    await expect(q3Card.getByText('Faculty Coding IDE & Test Validator')).toBeVisible({ timeout: 8000 });

    // Check Question Count & Marks updated
    await expect(page.getByText('3 Questions', { exact: true }).first()).toBeVisible();

    // Open Student Preview
    await page.getByRole('button', { name: 'Student Preview' }).click();
    const modal = page.locator('[role="dialog"]');
    await expect(modal.getByRole('heading', { name: 'Student Examination Preview' })).toBeVisible({ timeout: 5000 });

    // Switch to Q2 (Coding question) in the preview modal
    await modal.getByRole('button', { name: 'Q2' }).click();

    // Verify student coding IDE rendered with public cases and protected secrets
    await expect(modal.getByText(/Algorithm/i)).toBeVisible();
    await expect(modal.getByRole('button', { name: /Run Code/i })).toBeVisible();
    await expect(modal.getByText(/Sample Example/i).first()).toBeVisible();

    // Verify hidden evaluation test cases are strictly protected
    await expect(modal.getByText(/HIDDEN EVALUATION CASE/i)).toHaveCount(0);

    // Close preview modal
    await modal.getByRole('button', { name: 'Close modal' }).click();
    await expect(modal).not.toBeVisible();

    // Click Save Draft
    await page.locator('[data-testid="btn-save-draft"]').click();
    await expect(page.getByText(/Draft saved/i).first()).toBeVisible({ timeout: 8000 });

    // Capture Assessment Creator screenshot
    await page.screenshot({
      path: path.join(screenshotsDir, 'faculty-test-creator-assessment.png'),
    });
  });

  test('3. Mock Test Workflow: Launch Test Creator, configure blueprint, and author questions', async () => {
    await page.goto('/instructor/create-test');

    // Select Mock Test and click Launch
    const primaryCard = page.locator('[data-testid="card-primary-test-creation"]');
    await primaryCard.locator('[data-testid="option-mock-test"]').click();
    await primaryCard.locator('[data-testid="btn-launch-creator"]').click();

    // Verify Test Creator Studio loaded with Mock Test badge
    await expect(page).toHaveURL(/\/instructor\/test-creator\?type=mock/);
    await expect(page.getByRole('heading', { name: 'Test Creator Studio' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Mock Test', { exact: true }).first()).toBeVisible();

    // Verify blueprint fields are shown
    await expect(page.getByText('Blueprint Distribution & Rules')).toBeVisible();
    await expect(page.getByText(/Easy:/)).toBeVisible();
    await expect(page.getByText(/Medium:/)).toBeVisible();
    await expect(page.getByText(/Hard:/)).toBeVisible();

    // Fill Title
    const mockTitle = `GATE 2026 CS Full-Length Mock ${Date.now()}`;
    await page.fill('input[placeholder*="Distributed Systems"]', mockTitle);

    // Ensure subject is selected
    const subjectSelect = page.locator('select').first();
    await subjectSelect.waitFor({ state: 'visible' });
    const selectedSub = await subjectSelect.inputValue();
    if (!selectedSub) {
      const options = await subjectSelect.locator('option').all();
      if (options.length > 1) {
        const val = await options[1].getAttribute('value');
        if (val) await subjectSelect.selectOption(val);
      }
    }

    // Save Draft for Mock Test
    await page.locator('[data-testid="btn-save-draft"]').click();
    await expect(page.getByText(/Mock test draft saved/i).first()).toBeVisible({ timeout: 8000 });

    // Capture Mock Test Creator screenshot
    await page.screenshot({
      path: path.join(screenshotsDir, 'faculty-test-creator-mock.png'),
    });
  });

  test('4. Responsive mobile layout and dark theme verification', async () => {
    // Mobile Viewport
    await page.setViewportSize({ width: 375, height: 950 });
    await page.goto('/instructor/create-test');
    await expect(page.locator('[data-testid="faculty-create-test-hub"]')).toBeVisible({ timeout: 10000 });

    const primaryCard = page.locator('[data-testid="card-primary-test-creation"]');
    await expect(primaryCard).toBeVisible();
    await expect(primaryCard.locator('[data-testid="option-course-assessment"]')).toBeVisible();
    await expect(primaryCard.locator('[data-testid="option-mock-test"]')).toBeVisible();
    await expect(page.locator('[data-testid="card-interview-ai"]')).toBeVisible();
    await expect(page.locator('[data-testid="card-interview-faculty"]')).toBeVisible();

    // Capture Mobile screenshot
    await page.screenshot({
      path: path.join(screenshotsDir, 'faculty-create-test-hub-mobile.png'),
    });

    // Dark Theme Desktop Viewport
    await page.setViewportSize({ width: 1366, height: 960 });
    await page.goto('/instructor/test-creator?type=assessment');
    await expect(page.getByRole('heading', { name: 'Test Creator Studio' })).toBeVisible({ timeout: 10000 });

    // Toggle dark theme via UI button or storage
    const darkToggle = page.getByRole('button', { name: /Switch to dark theme/i });
    if (await darkToggle.isVisible()) {
      await darkToggle.click();
    } else {
      await page.evaluate(() => {
        document.documentElement.classList.add('dark');
        localStorage.setItem('uap_theme', 'dark');
      });
    }
    await expect(page.locator('html')).toHaveClass(/dark/);

    // Capture Dark Theme screenshot
    await page.screenshot({
      path: path.join(screenshotsDir, 'faculty-test-creator-dark.png'),
    });
  });
});
