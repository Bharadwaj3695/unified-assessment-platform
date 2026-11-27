const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

test.describe.serial('Faculty and Student Sidebar Navigation Verification', () => {
  const screenshotsDir = path.resolve(__dirname, '../../../test-results/screenshots');

  test.beforeAll(() => {
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
  });

  test('1. Instructor Desktop Sidebar — labels, sections, active styling, and routing', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 960 });

    // Login as instructor
    await page.goto('/auth/login');
    await page.fill('#email', 'instructor@uap.edu');
    await page.fill('#password', 'Instructor@123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/instructor\/dashboard/);

    const aside = page.locator('aside');
    await expect(aside).toBeVisible({ timeout: 15000 });

    // Verify Section Headers (case-insensitive due to CSS uppercase)
    await expect(aside.getByText(/workspace/i).first()).toBeVisible();
    await expect(aside.getByText(/tests & content/i).first()).toBeVisible();
    await expect(aside.getByText(/evaluation & cohorts/i).first()).toBeVisible();
    await expect(aside.getByText(/account/i).first()).toBeVisible();

    // Verify Required Menu Items
    const dashboardLink = aside.locator('nav a', { hasText: 'Dashboard' });
    const myTestsLink = aside.locator('nav a', { hasText: 'My Tests' });
    const createTestLink = aside.locator('nav a', { hasText: 'Create Test' });
    const questionBankLink = aside.locator('nav a', { hasText: 'Question Bank' });
    const submissionsLink = aside.locator('nav a', { hasText: 'Submissions & Grading' });
    const studentsLink = aside.locator('nav a', { hasText: 'Students' });
    const profileLink = aside.locator('nav a', { hasText: 'Profile' });

    await expect(dashboardLink).toBeVisible();
    await expect(myTestsLink).toBeVisible();
    await expect(createTestLink).toBeVisible();
    await expect(questionBankLink).toBeVisible();
    await expect(submissionsLink).toBeVisible();
    await expect(studentsLink).toBeVisible();
    await expect(profileLink).toBeVisible();

    // Verify Legacy items are NOT present
    await expect(aside.locator('nav a', { hasText: 'My Assessments' })).toHaveCount(0);
    await expect(aside.locator('nav a', { hasText: 'Create Assessment' })).toHaveCount(0);
    await expect(aside.locator('nav a', { hasText: 'Mock Bank' })).toHaveCount(0);
    await expect(aside.locator('nav a', { hasText: 'Import Questions' })).toHaveCount(0);

    // Initial Dashboard active styling
    await expect(dashboardLink).toHaveClass(/bg-brand-primary-light/);

    // Screenshot Desktop Sidebar on Dashboard
    await page.screenshot({
      path: path.join(screenshotsDir, 'faculty-sidebar-desktop.png'),
      fullPage: false,
    });

    // Click My Tests and confirm /instructor/tests loads
    await myTestsLink.click();
    await expect(page).toHaveURL(/\/instructor\/tests/);
    await expect(myTestsLink).toHaveClass(/bg-brand-primary-light/);

    // Click Create Test and confirm /instructor/create-test loads the two-card Test Creation Hub
    await createTestLink.click();
    await expect(page).toHaveURL(/\/instructor\/create-test/);
    await expect(createTestLink).toHaveClass(/bg-brand-primary-light/);

    // Verify the two-card hub
    await expect(page.locator('[data-testid="faculty-create-test-hub"]')).toBeVisible();
    await expect(page.locator('[data-testid="card-assessment-mock"]')).toBeVisible();
    await expect(page.locator('[data-testid="card-interview-assessments"]')).toBeVisible();

    // Screenshot Two-card Test Creation Hub
    await page.screenshot({
      path: path.join(screenshotsDir, 'faculty-create-test-hub.png'),
    });

    // Click Question Bank and confirm /instructor/question-bank loads
    await questionBankLink.click();
    await expect(page).toHaveURL(/\/instructor\/question-bank/);
    await expect(questionBankLink).toHaveClass(/bg-brand-primary-light/);
  });

  test('2. Instructor Mobile Drawer — hamburger toggle, drawer menu, labels, and actions', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    // Login as instructor on mobile
    await page.goto('/auth/login');
    await page.fill('#email', 'instructor@uap.edu');
    await page.fill('#password', 'Instructor@123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/instructor\/dashboard/);

    // Desktop sidebar must be hidden
    await expect(page.locator('aside.hidden')).toBeHidden();

    // Open hamburger menu
    const menuBtn = page.getByRole('button', { name: 'Open navigation menu' });
    await expect(menuBtn).toBeVisible({ timeout: 10000 });
    await menuBtn.click();

    // Drawer must be visible
    const drawer = page.locator('div[role="dialog"][aria-label="Mobile Navigation Menu"]');
    await expect(drawer).toBeVisible();

    // Verify Drawer Section Headers (case-insensitive due to CSS uppercase)
    await expect(drawer.getByText(/workspace/i).first()).toBeVisible();
    await expect(drawer.getByText(/tests & content/i).first()).toBeVisible();
    await expect(drawer.getByText(/evaluation & cohorts/i).first()).toBeVisible();
    await expect(drawer.getByText(/account/i).first()).toBeVisible();

    // Verify Required Drawer Items
    const drawerDashboard = drawer.locator('nav a', { hasText: 'Dashboard' });
    const drawerMyTests = drawer.locator('nav a', { hasText: 'My Tests' });
    const drawerCreateTest = drawer.locator('nav a', { hasText: 'Create Test' });
    const drawerQuestionBank = drawer.locator('nav a', { hasText: 'Question Bank' });
    const drawerSubmissions = drawer.locator('nav a', { hasText: 'Submissions & Grading' });
    const drawerStudents = drawer.locator('nav a', { hasText: 'Students' });
    const drawerProfile = drawer.locator('nav a', { hasText: 'Profile' });

    await expect(drawerDashboard).toBeVisible();
    await expect(drawerMyTests).toBeVisible();
    await expect(drawerCreateTest).toBeVisible();
    await expect(drawerQuestionBank).toBeVisible();
    await expect(drawerSubmissions).toBeVisible();
    await expect(drawerStudents).toBeVisible();
    await expect(drawerProfile).toBeVisible();

    // Verify Legacy items are NOT in mobile drawer
    await expect(drawer.locator('nav a', { hasText: 'My Assessments' })).toHaveCount(0);
    await expect(drawer.locator('nav a', { hasText: 'Create Assessment' })).toHaveCount(0);
    await expect(drawer.locator('nav a', { hasText: 'Mock Bank' })).toHaveCount(0);
    await expect(drawer.locator('nav a', { hasText: 'Import Questions' })).toHaveCount(0);

    // Capture screenshot of mobile drawer open
    await page.screenshot({
      path: path.join(screenshotsDir, 'faculty-sidebar-mobile-drawer.png'),
    });

    // Click My Tests in drawer and confirm navigation + drawer closes
    await drawerMyTests.click();
    await expect(page).toHaveURL(/\/instructor\/tests/);
    await expect(drawer).not.toBeVisible();

    // Re-open drawer and click Create Test
    await menuBtn.click();
    await expect(drawer).toBeVisible();
    await drawerCreateTest.click();
    await expect(page).toHaveURL(/\/instructor\/create-test/);
    await expect(drawer).not.toBeVisible();
    await expect(page.locator('[data-testid="faculty-create-test-hub"]')).toBeVisible();
  });

  test('3. Student Portal Sidebar — Desktop and Mobile Drawer Verification', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 960 });

    // Login as student
    await page.goto('/auth/login');
    await page.fill('#email', 'student@uap.edu');
    await page.fill('#password', 'Student@123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/student\/dashboard/);

    const aside = page.locator('aside');
    await expect(aside).toBeVisible({ timeout: 15000 });

    // Verify Required Student Navigation Items
    const studentDash = aside.locator('nav a', { hasText: 'Dashboard' });
    const availTests = aside.locator('nav a', { hasText: 'Available Tests' });
    const myAttempts = aside.locator('nav a', { hasText: 'My Attempts' });
    const myResults = aside.locator('nav a', { hasText: 'My Results' });
    const progress = aside.locator('nav a', { hasText: 'Progress' });
    const profile = aside.locator('nav a', { hasText: 'Profile' });

    await expect(studentDash).toBeVisible();
    await expect(availTests).toBeVisible();
    await expect(myAttempts).toBeVisible();
    await expect(myResults).toBeVisible();
    await expect(progress).toBeVisible();
    await expect(profile).toBeVisible();

    // Screenshot Student Desktop Sidebar
    await page.screenshot({
      path: path.join(screenshotsDir, 'student-sidebar-desktop.png'),
    });

    // Test routing for Available Tests
    await availTests.click();
    await expect(page).toHaveURL(/\/student\/tests/);
    await expect(availTests).toHaveClass(/bg-brand-primary-light/);

    // Test routing for My Attempts
    await myAttempts.click();
    await expect(page).toHaveURL(/\/student\/attempts/);
    await expect(myAttempts).toHaveClass(/bg-brand-primary-light/);

    // Test routing for My Results
    await myResults.click();
    await expect(page).toHaveURL(/\/student\/results/);
    await expect(myResults).toHaveClass(/bg-brand-primary-light/);

    // Test routing for Progress
    await progress.click();
    await expect(page).toHaveURL(/\/student\/progress/);
    await expect(progress).toHaveClass(/bg-brand-primary-light/);

    // Now test mobile viewport for student
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/student/dashboard');

    const menuBtn = page.getByRole('button', { name: 'Open navigation menu' });
    await expect(menuBtn).toBeVisible({ timeout: 10000 });
    await menuBtn.click();

    const drawer = page.locator('div[role="dialog"][aria-label="Mobile Navigation Menu"]');
    await expect(drawer).toBeVisible();

    await expect(drawer.locator('nav a', { hasText: 'Dashboard' })).toBeVisible();
    await expect(drawer.locator('nav a', { hasText: 'Available Tests' })).toBeVisible();
    await expect(drawer.locator('nav a', { hasText: 'My Attempts' })).toBeVisible();
    await expect(drawer.locator('nav a', { hasText: 'My Results' })).toBeVisible();
    await expect(drawer.locator('nav a', { hasText: 'Progress' })).toBeVisible();
    await expect(drawer.locator('nav a', { hasText: 'Profile' })).toBeVisible();

    // Screenshot Student Mobile Drawer
    await page.screenshot({
      path: path.join(screenshotsDir, 'student-sidebar-mobile-drawer.png'),
    });
  });
});
