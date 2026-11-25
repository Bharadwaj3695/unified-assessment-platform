const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const screenshotDir = path.resolve(__dirname, '../../test-results/screenshots');
if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true });
}

test.describe('Automated Student & Faculty Portal UI Verification', () => {
  test.describe('Student Portal Verification', () => {
    test('Student Portal full verification and visual capture', async ({ page }) => {
      const consoleErrors = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          const text = msg.text();
          // Filter out benign network or font favicon warnings
          if (!text.includes('favicon') && !text.includes('404')) {
            consoleErrors.push(text);
          }
        }
      });

      // 1. Student login succeeds
      await page.goto('/auth/login');
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      await page.fill('#email', 'student@uap.edu');
      await page.fill('#password', 'Student@123');
      await page.click('button[type="submit"]');

      // 2. Student dashboard route loads
      await expect(page).toHaveURL(/\/student\/dashboard/);
      await expect(page.getByText('Student Workspace').first()).toBeVisible({ timeout: 15000 });

      // 3. Student dashboard displays the implemented UI
      // Greeting, Stat cards, learning cards, or recent activity
      await expect(page.locator('text=Welcome back').or(page.locator('text=Good')).first()).toBeVisible({ timeout: 10000 });

      // Visual verification screenshot: Student Dashboard
      await page.screenshot({ path: path.join(screenshotDir, 'student-dashboard.png'), fullPage: true });

      // 4. Student navigation works
      const catalogNav = page.locator('aside nav a', { hasText: 'My Assessments' });
      await expect(catalogNav).toBeVisible();
      await catalogNav.click();
      await expect(page).toHaveURL(/\/student\/catalog/);

      // 5. Available Tests page loads
      await page.goto('/student/tests');
      await expect(page).toHaveURL(/\/student\/tests/);
      await expect(page.locator('text=Available Tests').or(page.locator('text=My Assessments')).first()).toBeVisible({ timeout: 10000 });

      // 6. Assessment and Mock Test catalog navigation works
      await page.goto('/student/catalog');
      await expect(page.locator('text=All Tests').or(page.locator('text=Catalog View:')).first()).toBeVisible({ timeout: 10000 });
      
      // Toggle to Practice Mock Tests tab if present
      const mockTab = page.locator('button', { hasText: 'Practice Mock Tests' });
      if (await mockTab.isVisible()) {
        await mockTab.click();
        await page.waitForTimeout(500);
      }

      // Visual verification screenshot: Student Test Catalog
      await page.screenshot({ path: path.join(screenshotDir, 'student-catalog.png'), fullPage: true });

      // 7. My Attempts page loads
      await page.goto('/student/attempts');
      await expect(page).toHaveURL(/\/student\/attempts/);
      await expect(page.locator('text=My Attempts').or(page.locator('text=Submissions')).first()).toBeVisible({ timeout: 10000 });

      // 8. My Results page loads
      await page.goto('/student/results');
      await expect(page).toHaveURL(/\/student\/results/);
      await expect(page.locator('text=My Results').or(page.locator('text=Submissions')).first()).toBeVisible({ timeout: 10000 });

      // 9. Student cannot access Faculty-only pages
      await page.goto('/instructor/dashboard');
      // RoleRoute renders Access Denied alert
      await expect(page.locator('text=Access Denied')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('text=Your current role')).toBeVisible();

      // 10. No critical console errors
      expect(consoleErrors.length).toBeLessThan(5);
    });
  });

  test.describe('Faculty Workspace Verification', () => {
    test('Faculty Workspace full verification and visual capture', async ({ page }) => {
      const consoleErrors = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          const text = msg.text();
          if (!text.includes('favicon') && !text.includes('404')) {
            consoleErrors.push(text);
          }
        }
      });

      // 1. Faculty login succeeds
      await page.goto('/auth/login');
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      await page.fill('#email', 'instructor@uap.edu');
      await page.fill('#password', 'Instructor@123');
      await page.click('button[type="submit"]');

      // 2. Faculty dashboard route loads
      await expect(page).toHaveURL(/\/instructor\/dashboard/);
      await expect(page.getByText('instructor Workspace').first()).toBeVisible({ timeout: 15000 });

      // 3. Faculty dashboard displays the implemented UI
      await expect(page.locator('text=Course Assessments').or(page.locator('text=My Assessments')).or(page.locator('text=Welcome back')).first()).toBeVisible({ timeout: 10000 });

      // Visual verification screenshot: Faculty Dashboard
      await page.screenshot({ path: path.join(screenshotDir, 'faculty-dashboard.png'), fullPage: true });

      // 4. Faculty navigation works
      const submissionsNav = page.locator('aside nav a', { hasText: 'Submissions & Grading' });
      await expect(submissionsNav).toBeVisible();
      await submissionsNav.click();
      await expect(page).toHaveURL(/\/instructor\/submissions/);

      // 5. Create Test page loads
      await page.goto('/instructor/create-test');
      await expect(page).toHaveURL(/\/instructor\/create-test/);
      await expect(page.locator('text=Create Test & Examination')).toBeVisible({ timeout: 10000 });
      await expect(page.getByRole('heading', { name: 'Course Assessment' })).toBeVisible({ timeout: 10000 });
      await expect(page.getByRole('heading', { name: 'Mock Test & Blueprint' })).toBeVisible({ timeout: 10000 });

      // Visual verification screenshot: Faculty Create Test page
      await page.screenshot({ path: path.join(screenshotDir, 'faculty-create-test.png'), fullPage: true });

      // 6. Assessment card opens the existing Assessment workflow
      const createAssessmentBtn = page.getByRole('button', { name: 'Create Assessment' });
      await expect(createAssessmentBtn).toBeVisible();
      await createAssessmentBtn.click();
      await expect(page).toHaveURL(/\/instructor\/create/);
      await expect(page.locator('text=Assessment Builder').or(page.locator('text=Assessment Setup')).or(page.locator('input[placeholder*="Distributed Systems"]')).first()).toBeVisible({ timeout: 10000 });

      // 7. Mock Test card opens the existing Mock Test workflow
      await page.goto('/instructor/create-test');
      const createMockBtn = page.getByRole('button', { name: 'Create Mock Test' });
      await expect(createMockBtn).toBeVisible();
      await createMockBtn.click();
      // Verify blueprint modal opens
      await expect(page.locator('text=Mock Test Blueprint Builder')).toBeVisible({ timeout: 10000 });
      // Close modal
      const closeBtn = page.locator('button:has(svg.lucide-x)').or(page.getByRole('button', { name: 'Cancel' })).first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
      }

      // 8. My Tests page loads
      await page.goto('/instructor/tests');
      await expect(page).toHaveURL(/\/instructor\/tests/);
      await expect(page.locator('text=My Tests').or(page.locator('text=Course Assessments')).first()).toBeVisible({ timeout: 10000 });

      // 9. Question Bank page loads
      await page.goto('/instructor/question-bank');
      await expect(page).toHaveURL(/\/instructor\/question-bank/);
      await expect(page.locator('text=Question Bank').or(page.locator('text=Mock Bank')).or(page.locator('text=Central Question Repository')).first()).toBeVisible({ timeout: 10000 });

      // 10. Submissions and Grading page loads
      await page.goto('/instructor/submissions');
      await expect(page).toHaveURL(/\/instructor\/submissions/);
      await expect(page.locator('text=Submission Evaluation Queue').or(page.locator('text=Submissions')).first()).toBeVisible({ timeout: 10000 });

      // 11. Faculty cannot access Admin-only pages
      await page.goto('/admin/dashboard');
      await expect(page.locator('text=Access Denied')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('text=Your current role')).toBeVisible();

      // 12. No critical console errors
      expect(consoleErrors.length).toBeLessThan(5);
    });
  });
});
