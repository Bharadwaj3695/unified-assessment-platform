const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

test.describe.serial('Faculty Create Test Hub — Two Unified Cards UI & Workflow', () => {
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

  test('1. Hub displays exactly TWO top-level cards and both sub-options per card', async () => {
    await page.setViewportSize({ width: 1366, height: 960 });
    await page.goto('/instructor/create-test');
    await expect(page.locator('[data-testid="faculty-create-test-hub"]')).toBeVisible({ timeout: 10000 });

    // Verify exactly TWO top-level cards
    const topLevelCards = page.locator('[data-testid="create-test-two-cards-grid"] > div');
    await expect(topLevelCards).toHaveCount(2);

    const card1 = page.locator('[data-testid="card-assessment-mock"]');
    const card2 = page.locator('[data-testid="card-interview-assessments"]');

    await expect(card1).toBeVisible();
    await expect(card2).toBeVisible();

    // Verify Card 1 Title & Description
    await expect(card1.getByRole('heading', { name: 'Assessment & Mock Test' })).toBeVisible();
    await expect(card1.getByText('Classroom Examinations & Calibrated Blueprints')).toBeVisible();

    // Verify Card 1 Sub-options
    const courseAsmtSubOption = card1.locator('[data-testid="sub-option-course-assessment"]');
    const mockBlueprintSubOption = card1.locator('[data-testid="sub-option-mock-blueprint"]');
    await expect(courseAsmtSubOption).toBeVisible();
    await expect(mockBlueprintSubOption).toBeVisible();

    await expect(courseAsmtSubOption.getByRole('heading', { name: 'Course Assessment' })).toBeVisible();
    await expect(courseAsmtSubOption.getByRole('button', { name: 'Launch Assessment Builder' })).toBeVisible();

    await expect(mockBlueprintSubOption.getByRole('heading', { name: 'Mock Test & Blueprint' })).toBeVisible();
    await expect(mockBlueprintSubOption.getByRole('button', { name: 'Configure Mock Blueprint' })).toBeVisible();

    // Verify Card 2 Title & Description
    await expect(card2.getByRole('heading', { name: 'Interview Assessments' })).toBeVisible();
    await expect(card2.getByText('Conversational AI & Faculty Oral Vivas')).toBeVisible();

    // Verify Card 2 Sub-options
    const aiInterviewSubOption = card2.locator('[data-testid="sub-option-ai-interview"]');
    const facultyInterviewSubOption = card2.locator('[data-testid="sub-option-faculty-interview"]');
    await expect(aiInterviewSubOption).toBeVisible();
    await expect(facultyInterviewSubOption).toBeVisible();

    await expect(aiInterviewSubOption.getByRole('heading', { name: 'AI Mock Interview' })).toBeVisible();
    const aiBtn = aiInterviewSubOption.getByRole('button', { name: 'Coming Soon' });
    await expect(aiBtn).toBeVisible();
    await expect(aiBtn).toBeDisabled();

    await expect(facultyInterviewSubOption.getByRole('heading', { name: 'Faculty Interview' })).toBeVisible();
    const facultyBtn = facultyInterviewSubOption.getByRole('button', { name: 'Coming Soon' });
    await expect(facultyBtn).toBeVisible();
    await expect(facultyBtn).toBeDisabled();

    // Capture Desktop Screenshot
    await page.screenshot({
      path: path.join(screenshotsDir, 'faculty-create-test-desktop.png'),
    });
  });

  test('2. Course Assessment sub-option opens existing AssessmentBuilder workflow', async () => {
    await page.goto('/instructor/create-test');

    const launchBtn = page.locator('[data-testid="sub-option-course-assessment"]').getByRole('button', { name: 'Launch Assessment Builder' });
    await launchBtn.click();

    // Verify redirected to /instructor/create and AssessmentBuilder loaded
    await expect(page).toHaveURL(/\/instructor\/create/);
    await expect(page.getByRole('heading', { name: 'Author New Assessment' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: 'Save Draft' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Publish Live' })).toBeVisible();
  });

  test('3. Mock Test & Blueprint sub-option opens MockTestBlueprintModal workflow', async () => {
    await page.goto('/instructor/create-test');

    const configBtn = page.locator('[data-testid="sub-option-mock-blueprint"]').getByRole('button', { name: 'Configure Mock Blueprint' });
    await configBtn.click();

    // Verify modal appears
    await expect(page.getByRole('heading', { name: 'Mock Test Blueprint Builder' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByPlaceholder('e.g. GATE 2026 Full-Length Mock Exam #1')).toBeVisible();
    await expect(page.getByText('Difficulty Distribution Ratio (%)')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Generate & Publish Blueprint' })).toBeVisible();

    // Close modal
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('heading', { name: 'Mock Test Blueprint Builder' })).not.toBeVisible();
  });

  test('4. Mobile layout stacks two cards cleanly and dark theme works', async () => {
    // Test mobile layout
    await page.setViewportSize({ width: 375, height: 950 });
    await page.goto('/instructor/create-test');
    await expect(page.locator('[data-testid="faculty-create-test-hub"]')).toBeVisible({ timeout: 10000 });

    const card1 = page.locator('[data-testid="card-assessment-mock"]');
    const card2 = page.locator('[data-testid="card-interview-assessments"]');
    await expect(card1).toBeVisible();
    await expect(card2).toBeVisible();

    // Verify both titles are visible and not truncated
    await expect(card1.getByRole('heading', { name: 'Assessment & Mock Test' })).toBeVisible();
    await expect(card2.getByRole('heading', { name: 'Interview Assessments' })).toBeVisible();

    // Capture Mobile Screenshot
    await page.screenshot({
      path: path.join(screenshotsDir, 'faculty-create-test-mobile.png'),
    });

    // Reset viewport and test dark theme
    await page.setViewportSize({ width: 1366, height: 960 });
    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    });

    await expect(page.locator('html')).toHaveClass(/dark/);
    await expect(card1).toBeVisible();
    await expect(card2).toBeVisible();

    // Capture Dark Theme Screenshot
    await page.screenshot({
      path: path.join(screenshotsDir, 'faculty-create-test-dark.png'),
    });
  });
});
