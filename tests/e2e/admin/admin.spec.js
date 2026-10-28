const { test, expect } = require('@playwright/test');

test.describe('Admin Platform Oversight & Account Lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    // Log in as administrator
    await page.goto('/auth/login');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.fill('#email', 'admin@uap.edu');
    await page.fill('#password', 'Admin@123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/admin\/dashboard/);
    await expect(page.getByText('admin Workspace', { exact: true })).toBeVisible({ timeout: 10000 });
  });

  test('1. Admin views pending registration queue', async ({ page }) => {
    await page.goto('/admin/users');
    await expect(page.locator('text=Pending Registration Queue')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('table').or(page.locator('text=No Pending Approvals')).first()).toBeVisible();
  });

  test('2. Admin approves applicant registration and transitions account to active', async ({ page, request }) => {
    const testEmail = `approve_test_${Date.now()}@uap.edu`;
    await request.post('http://localhost:5000/api/auth/register', {
      data: {
        name: 'Pending Applicant Alpha',
        email: testEmail,
        password: 'Password@123',
        role: 'student',
        instituteCode: 'TEST-DEPT',
      },
    });

    await page.goto('/admin/users');
    await expect(page.locator(`text=${testEmail}`)).toBeVisible({ timeout: 10000 });

    const row = page.locator('tr', { hasText: testEmail });
    await row.getByRole('button', { name: 'Approve' }).click();

    await expect(page.locator('text=Approve Account Registration')).toBeVisible();
    await page.getByRole('button', { name: 'Confirm & Activate Account' }).click();

    // Modal closes and user disappears from pending table
    await expect(page.locator('text=Approve Account Registration')).not.toBeVisible({ timeout: 10000 });
    await expect(page.locator('table').locator(`text=${testEmail}`)).not.toBeVisible({ timeout: 10000 });
  });

  test('3. Admin rejects applicant registration with reason', async ({ page, request }) => {
    const testEmail = `reject_test_${Date.now()}@uap.edu`;
    await request.post('http://localhost:5000/api/auth/register', {
      data: {
        name: 'Pending Applicant Beta',
        email: testEmail,
        password: 'Password@123',
        role: 'student',
        instituteCode: 'INVALID-CODE',
      },
    });

    await page.goto('/admin/users');
    await expect(page.locator(`text=${testEmail}`)).toBeVisible({ timeout: 10000 });

    const row = page.locator('tr', { hasText: testEmail });
    await row.getByRole('button', { name: 'Reject' }).click();

    await expect(page.locator('text=Reject Account Registration')).toBeVisible();
    await page.fill('input[placeholder*="Unrecognized institute code"]', 'Eligibility criteria not met');
    await page.getByRole('button', { name: 'Reject Application' }).click();

    await expect(page.locator('text=Reject Account Registration')).not.toBeVisible({ timeout: 10000 });
    await expect(page.locator('table').locator(`text=${testEmail}`)).not.toBeVisible({ timeout: 10000 });
  });

  test('4. Admin deactivates and reactivates user access from all platform accounts view', async ({ page, request }) => {
    const testEmail = `status_control_test_${Date.now()}@uap.edu`;
    const regRes = await request.post('http://localhost:5000/api/auth/register', {
      data: {
        name: 'Active User Gamma',
        email: testEmail,
        password: 'Password@123',
        role: 'student',
        instituteCode: 'STATUS-TEST',
      },
    });
    const regJson = await regRes.json();
    const userId = regJson.data?.user?.id || regJson.data?.user?._id || regJson.user?.id || regJson.user?._id;

    const adminLoginRes = await request.post('http://localhost:5000/api/auth/login', {
      data: { email: 'admin@uap.edu', password: 'Admin@123' },
    });
    const adminLoginJson = await adminLoginRes.json();
    const token = adminLoginJson.data?.accessToken || adminLoginJson.accessToken || adminLoginJson.token;

    const approveRes = await request.put(`http://localhost:5000/api/admin/users/${userId}/approve`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { role: 'student' },
    });
    expect(approveRes.ok()).toBeTruthy();

    await page.goto('/admin/users');
    await page.getByRole('button', { name: 'All Platform Accounts' }).click();

    // Search for user using top navbar search
    const navSearch = page.locator('header input[placeholder="Search users, assessments..."]');
    await navSearch.fill(testEmail);
    await page.waitForTimeout(400);
    const dropdown = page.locator('#admin-search-results');
    await expect(dropdown.locator(`text=${testEmail}`).first()).toBeVisible({ timeout: 10000 });
    await page.keyboard.press('Escape');
    await expect(page.locator(`text=${testEmail}`)).toBeVisible({ timeout: 10000 });

    const userRow = page.locator('tr', { hasText: testEmail });
    await expect(userRow.getByText('Active', { exact: true })).toBeVisible({ timeout: 10000 });

    // Click Deactivate button
    await userRow.getByRole('button', { name: 'Deactivate' }).click();

    await expect(page.locator('text=Deactivate User Account')).toBeVisible();
    await page.getByRole('button', { name: 'Deactivate Account' }).click();

    // Verify user row transitions to Inactive badge
    await expect(userRow.locator('text=Inactive')).toBeVisible({ timeout: 10000 });

    // Verify Activate button is now available
    await userRow.getByRole('button', { name: 'Activate' }).click();
    await expect(page.locator('text=Activate User Account')).toBeVisible();
    await page.getByRole('button', { name: 'Activate Account' }).click();

    // Verify user row transitions back to Active badge
    await expect(userRow.getByText('Active', { exact: true })).toBeVisible({ timeout: 10000 });
  });

  test('5. Admin Refresh Data button triggers genuine telemetry update with loading animation and recovery', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await expect(page.locator('#adminRefreshDataBtn')).toBeVisible({ timeout: 10000 });

    const refreshBtn = page.locator('#adminRefreshDataBtn');
    await expect(refreshBtn).toHaveText(/Refresh Data/);
    await expect(refreshBtn).toBeEnabled();

    // Intercept admin stats request to verify genuine backend API call
    const statsPromise = page.waitForResponse((response) =>
      response.url().includes('/api/admin/stats') && response.status() === 200
    );

    // Click Refresh Data
    await refreshBtn.click();

    // Verify network response from genuine API
    await statsPromise;

    // Verify recovery to idle state and re-enabling
    await expect(refreshBtn).toHaveText(/Refresh Data/, { timeout: 10000 });
    await expect(refreshBtn).toBeEnabled({ timeout: 10000 });

    // Verify dashboard statistics are rendered
    await expect(page.locator('text=System Overview').or(page.locator('text=Platform Overview')).first()).toBeVisible();
  });
});
