const { test, expect } = require('@playwright/test');

test.describe('Authentication Workflows', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage to start with a fresh session
    await page.goto('/auth/login');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('1. Student login succeeds and navigates to student workspace', async ({ page }) => {
    await page.goto('/auth/login');

    await page.fill('#email', 'student@uap.edu');
    await page.fill('#password', 'Student@123');
    await page.click('button[type="submit"]');

    // Should redirect to student dashboard
    await expect(page).toHaveURL(/\/student\/dashboard/);
    await expect(page.getByText('student Workspace', { exact: true })).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Welcome back').first()).toBeVisible();
  });

  test('2. Faculty / Instructor login succeeds and navigates to instructor workspace', async ({ page }) => {
    await page.goto('/auth/login');

    await page.fill('#email', 'instructor@uap.edu');
    await page.fill('#password', 'Instructor@123');
    await page.click('button[type="submit"]');

    // Should redirect to instructor dashboard
    await expect(page).toHaveURL(/\/instructor\/dashboard/);
    await expect(page.getByText('instructor Workspace', { exact: true })).toBeVisible({ timeout: 10000 });
  });

  test('3. Admin login succeeds and navigates to admin platform oversight', async ({ page }) => {
    await page.goto('/auth/login');

    await page.fill('#email', 'admin@uap.edu');
    await page.fill('#password', 'Admin@123');
    await page.click('button[type="submit"]');

    // Should redirect to admin dashboard
    await expect(page).toHaveURL(/\/admin\/dashboard/);
    await expect(page.getByText('admin Workspace', { exact: true })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('System Governance', { exact: true })).toBeVisible();
  });

  test('4. Invalid login displays authentication error message and blocks access', async ({ page }) => {
    await page.goto('/auth/login');

    await page.fill('#email', 'student@uap.edu');
    await page.fill('#password', 'WrongPassword!999');
    await page.click('button[type="submit"]');

    // Should remain on login page and show error alert
    await expect(page).toHaveURL(/\/auth\/login/);
    const alertOrToast = page.locator('[role="alert"], .Toastify__toast--error');
    await expect(alertOrToast.first()).toBeVisible({ timeout: 5000 });
  });

  test('5. Pending applicant account is blocked from login prior to approval', async ({ page }) => {
    await page.goto('/auth/login');

    await page.fill('#email', 'pending@uap.edu');
    await page.fill('#password', 'Student@123');
    await page.click('button[type="submit"]');

    // Should remain on login page and indicate pending approval
    await expect(page).toHaveURL(/\/auth\/login/);
    const alertOrToast = page.locator('[role="alert"], .Toastify__toast--error');
    await expect(alertOrToast.first()).toBeVisible({ timeout: 5000 });
    const text = await alertOrToast.first().textContent();
    expect(text.toLowerCase()).toContain('pending');
  });

  test('6. Regression: Google SSO initiation properly parses response contract and redirects to Google OAuth', async ({ page }) => {
    await page.goto('/auth/login');

    const googleBtn = page.getByRole('button', { name: /Continue with Google/i });
    await expect(googleBtn).toBeVisible();

    const [request] = await Promise.all([
      page.waitForRequest((req) => req.url().includes('/api/auth/google/url')),
      googleBtn.click(),
    ]);

    expect(request.url()).toContain('/api/auth/google/url');

    // Wait for Google OAuth redirect to accounts.google.com
    await page.waitForURL(/^https:\/\/accounts\.google\.com\//, { timeout: 10000 });
    expect(page.url()).toContain('accounts.google.com');
    expect(page.url()).toContain('client_id=');
    expect(page.url()).toContain('redirect_uri=');
    expect(page.url()).toContain('state=');

    // Ensure error banner did not appear
    const alert = page.locator('[role="alert"], .bg-red-50');
    await expect(alert).not.toBeVisible();
  });
});
