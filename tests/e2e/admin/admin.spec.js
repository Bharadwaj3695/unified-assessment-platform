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

  test('4. Admin revokes active user access from all platform accounts view', async ({ page, request }) => {
    const testEmail = `revoke_test_${Date.now()}@uap.edu`;
    const regRes = await request.post('http://localhost:5000/api/auth/register', {
      data: {
        name: 'Active User Gamma',
        email: testEmail,
        password: 'Password@123',
        role: 'student',
        instituteCode: 'REVOKE-TEST',
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

    await page.fill('input[placeholder*="Search by name, email"]', testEmail);
    await page.getByRole('button', { name: 'Search users' }).click();
    await expect(page.locator(`text=${testEmail}`)).toBeVisible({ timeout: 10000 });

    const userRow = page.locator('tr', { hasText: testEmail });
    await userRow.getByRole('button', { name: 'Revoke' }).click();

    await expect(page.locator('text=Revoke Active Account Access')).toBeVisible();
    await page.fill('input[placeholder*="Academic integrity violation"]', 'Honor code violation test');
    await page.getByRole('button', { name: 'Revoke Account Access' }).click();

    await expect(userRow.locator('text=revoked')).toBeVisible({ timeout: 10000 });
  });
});
