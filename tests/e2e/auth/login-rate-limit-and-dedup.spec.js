const { test, expect } = require('@playwright/test');

test.describe('Login Request Deduplication & Auth Rate-Limiter Scoping', () => {
  test('1. Login page fires only one refresh request (exempt from authRateLimiter) and submits only one login request per submission', async ({ page }) => {
    const refreshRequests = [];
    const loginRequests = [];

    page.on('request', (req) => {
      if (req.url().includes('/api/auth/refresh') && req.method() === 'POST') {
        refreshRequests.push(req.url());
      }
      if (req.url().includes('/api/auth/login') && req.method() === 'POST') {
        loginRequests.push(req.url());
      }
    });

    const refreshRespPromise = page.waitForResponse(
      (resp) => resp.url().includes('/api/auth/refresh') && resp.request().method() === 'POST'
    );

    await page.goto('/auth/login');
    const refreshResp = await refreshRespPromise;

    // Refresh must use general apiRateLimiter (limit 1000), NOT authRateLimiter (limit 60)
    const refreshLimitHeader = refreshResp.headers()['x-ratelimit-limit'];
    if (refreshLimitHeader !== undefined) {
      expect(Number(refreshLimitHeader)).toBe(1000);
    }

    // Even under React StrictMode dev, only 1 silent refresh request should be fired on mount
    await page.waitForTimeout(400);
    expect(refreshRequests.length).toBe(1);

    // 1A. Invalid credentials rejected with 401 and exactly 1 login POST
    await page.fill('#email', 'instructor@uap.edu');
    await page.fill('#password', 'WrongPass!999');

    const invalidRespPromise = page.waitForResponse(
      (resp) => resp.url().includes('/api/auth/login') && resp.request().method() === 'POST'
    );
    await page.click('button[type="submit"]');
    const invalidResp = await invalidRespPromise;
    expect(invalidResp.status()).toBe(401);
    expect(loginRequests.length).toBe(1);
    await expect(page.locator('[role="alert"]').first()).toBeVisible({ timeout: 5000 });

    // Login endpoint must still enforce authRateLimiter (limit 60 when non-loopback)
    const loginLimitHeader = invalidResp.headers()['x-ratelimit-limit'];
    if (loginLimitHeader !== undefined) {
      expect(Number(loginLimitHeader)).toBe(60);
    }

    // 1B. Valid login succeeds with exactly 1 additional login POST and redirects to dashboard
    loginRequests.length = 0;
    await page.fill('#email', 'instructor@uap.edu');
    await page.fill('#password', 'Instructor@123');

    const validRespPromise = page.waitForResponse(
      (resp) => resp.url().includes('/api/auth/login') && resp.request().method() === 'POST'
    );
    await page.click('button[type="submit"]');
    const validResp = await validRespPromise;
    expect(validResp.status()).toBe(200);
    expect(loginRequests.length).toBe(1);

    await expect(page).toHaveURL(/\/instructor\/dashboard/, { timeout: 15000 });
    await expect(page.getByText('instructor Workspace', { exact: true })).toBeVisible({ timeout: 15000 });
  });
});
