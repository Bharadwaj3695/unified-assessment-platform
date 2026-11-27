const { test, expect } = require('@playwright/test');

test.describe('Faculty Interview Navigation Consolidation & Card Activation', () => {
  test('1. Faculty sidebar omits duplicate Interviews link, Create Test enables Faculty Interview card, and destination route works across refresh', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 960 });

    // Log in as instructor
    await page.goto('/auth/login');
    await page.fill('#email', 'instructor@uap.edu');
    await page.fill('#password', 'Instructor@123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/instructor\/dashboard/, { timeout: 20000 });

    const aside = page.locator('aside');
    await expect(aside).toBeVisible({ timeout: 15000 });

    // 1. Faculty sidebar no longer displays separate Interviews item, while keeping other items
    await expect(aside.locator('nav a', { hasText: 'Dashboard' })).toBeVisible();
    await expect(aside.locator('nav a', { hasText: 'My Tests' })).toBeVisible();
    await expect(aside.locator('nav a', { hasText: 'Create Test' })).toBeVisible();
    await expect(aside.locator('nav a', { hasText: 'Question Bank' })).toBeVisible();
    await expect(aside.locator('nav a', { hasText: 'Submissions & Grading' })).toBeVisible();
    await expect(aside.locator('nav a', { hasText: 'Students' })).toBeVisible();
    await expect(aside.locator('nav a', { hasText: 'Profile' })).toBeVisible();
    await expect(aside.locator('nav a', { hasText: /^Interviews$/ })).toHaveCount(0);
    await expect(aside.locator('nav a[href="/instructor/interviews"]')).toHaveCount(0);

    // 2. Navigate to Create Test
    await aside.locator('nav a', { hasText: 'Create Test' }).click();
    await expect(page).toHaveURL(/\/instructor\/create-test/);
    await expect(page.getByTestId('faculty-create-test-hub')).toBeVisible({ timeout: 10000 });

    // 3. AI Mock Interview remains Coming Soon; Faculty Interview is enabled
    const aiCard = page.getByTestId('card-interview-ai');
    const facultyCard = page.getByTestId('card-interview-faculty');
    await expect(aiCard).toBeVisible();
    await expect(aiCard.getByText('Coming Soon')).toBeVisible();

    await expect(facultyCard).toBeVisible();
    await expect(facultyCard).toBeEnabled();
    await expect(facultyCard.getByText('Coming Soon')).toHaveCount(0);
    await expect(facultyCard.getByRole('heading', { name: 'Faculty Interview' })).toBeVisible();

    // Check dark mode compatibility on Create Test page before clicking
    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
      localStorage.setItem('uap_theme', 'dark');
    });
    await expect(page.locator('html')).toHaveClass(/dark/);
    await expect(facultyCard).toBeVisible();
    await page.evaluate(() => {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('uap_theme', 'light');
    });

    // 4. Click Faculty Interview card -> navigates directly to existing /instructor/interviews route
    await facultyCard.click();
    await expect(page).toHaveURL(/\/instructor\/interviews$/);
    await expect(page.getByTestId('faculty-interviews-page')).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'Faculty Interview Studio' })).toBeVisible();
    await expect(page.getByTestId('btn-create-interview')).toBeVisible();

    // Create Test stays highlighted as the active parent sidebar item
    await expect(aside.locator('nav a', { hasText: 'Create Test' })).toHaveClass(/bg-brand-primary-light/);

    // 5. Refreshing /instructor/interviews renders cleanly without blank page or 404
    await page.reload();
    await expect(page).toHaveURL(/\/instructor\/interviews$/);
    await expect(page.getByTestId('faculty-interviews-page')).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'Faculty Interview Studio' })).toBeVisible();
  });

  test('2. Mobile drawer omits faculty Interviews link and student role remains blocked from /instructor/interviews while keeping student Interviews', async ({ page }) => {
    // Verify mobile drawer for instructor
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/auth/login');
    await page.fill('#email', 'instructor@uap.edu');
    await page.fill('#password', 'Instructor@123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/instructor\/dashboard/, { timeout: 20000 });

    await page.getByRole('button', { name: 'Open navigation menu' }).click();
    const drawer = page.locator('div[role="dialog"][aria-label="Mobile Navigation Menu"]');
    await expect(drawer).toBeVisible();
    await expect(drawer.locator('nav a', { hasText: 'Create Test' })).toBeVisible();
    await expect(drawer.locator('nav a', { hasText: /^Interviews$/ })).toHaveCount(0);

    // Log out and verify student authorization + student Interviews sidebar item
    await drawer.getByRole('button', { name: /sign out|logout/i }).click();
    await expect(page).toHaveURL(/\/auth\/login/, { timeout: 15000 });

    await page.setViewportSize({ width: 1366, height: 960 });
    await page.fill('#email', 'student@uap.edu');
    await page.fill('#password', 'Student@123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/student\/dashboard/, { timeout: 20000 });

    // Student sidebar still keeps Interviews
    const studentAside = page.locator('aside');
    await expect(studentAside.locator('nav a', { hasText: 'Interviews' })).toBeVisible();

    // Student cannot access /instructor/interviews (RoleRoute blocks with Access Denied)
    await page.goto('/instructor/interviews');
    await expect(page.getByText('Access Denied')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('faculty-interviews-page')).toHaveCount(0);
  });
});
