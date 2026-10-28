const { test, expect } = require('@playwright/test');

test.describe('Admin Pending Registration Queue: Search, Filters & Bulk Approval', () => {
  let studentUserEmail;
  let facultyUserEmail;

  test.beforeEach(async ({ page, request }) => {
    // Register unique test student and faculty pending accounts
    const timestamp = Date.now();
    studentUserEmail = `queue_stu_${timestamp}@uap.edu`;
    facultyUserEmail = `queue_fac_${timestamp}@uap.edu`;

    await request.post('http://localhost:5000/api/auth/register', {
      data: {
        name: `Queue Student ${timestamp}`,
        email: studentUserEmail,
        password: 'Password@123',
        role: 'student',
        instituteCode: 'TEST-STU-DEPT',
      },
    });

    await request.post('http://localhost:5000/api/auth/register', {
      data: {
        name: `Queue Faculty ${timestamp}`,
        email: facultyUserEmail,
        password: 'Password@123',
        role: 'instructor',
        instituteCode: 'TEST-FAC-DEPT',
      },
    });

    // Log in as administrator
    await page.goto('/auth/login');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.fill('#email', 'admin@uap.edu');
    await page.fill('#password', 'Admin@123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/admin\/dashboard/);
    await expect(page.getByText('admin Workspace', { exact: true })).toBeVisible({ timeout: 10000 });

    // Navigate to Pending Registration Queue
    await page.goto('/admin/users');
    await expect(page.locator('text=Pending Registration Queue')).toBeVisible({ timeout: 10000 });
  });

  test('13. Redundant page-level pending search is removed and navbar search finds pending users', async ({ page }) => {
    await expect(page.locator(`text=${studentUserEmail}`)).toBeVisible({ timeout: 10000 });
    await expect(page.locator(`text=${facultyUserEmail}`)).toBeVisible({ timeout: 10000 });

    // Verify redundant in-page search bar is removed
    await expect(page.locator('#pendingSearchInput')).toHaveCount(0);

    // Verify top navbar search bar replaces it and finds pending user
    const navSearch = page.locator('header input[placeholder="Search users, assessments..."]');
    await expect(navSearch).toBeVisible();
    await navSearch.fill(studentUserEmail);
    await page.waitForTimeout(400);

    const dropdown = page.locator('#admin-search-results');
    await expect(dropdown).toBeVisible();
    await expect(dropdown.locator(`text=${studentUserEmail}`).first()).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dropdown).not.toBeVisible();
  });

  test('14, 15, 16. Role filter works (Students, Faculty, All)', async ({ page }) => {
    await expect(page.locator(`text=${studentUserEmail}`)).toBeVisible({ timeout: 10000 });
    await expect(page.locator(`text=${facultyUserEmail}`)).toBeVisible({ timeout: 10000 });

    const roleSelect = page.locator('#pendingRoleFilterSelect');

    // 14. Filter by Students
    await roleSelect.selectOption('student');
    await expect(page.locator(`text=${studentUserEmail}`)).toBeVisible();
    await expect(page.locator(`text=${facultyUserEmail}`)).not.toBeVisible();

    // 15. Filter by Faculty
    await roleSelect.selectOption('instructor');
    await expect(page.locator(`text=${facultyUserEmail}`)).toBeVisible();
    await expect(page.locator(`text=${studentUserEmail}`)).not.toBeVisible();

    // 16. Filter All
    await roleSelect.selectOption('all');
    await expect(page.locator(`text=${studentUserEmail}`)).toBeVisible();
    await expect(page.locator(`text=${facultyUserEmail}`)).toBeVisible();
  });

  test('17, 18, 19, 20. Checkboxes, Select All, Count, and Disabled State', async ({ page }) => {
    const bulkApproveBtn = page.getByRole('button', { name: 'Approve Selected' }).first();
    const countDisplay = page.locator('text=Selected:');

    // 20. Initially no users selected, button should be disabled
    await expect(countDisplay).toContainText('Selected: 0');
    await expect(bulkApproveBtn).toBeDisabled();

    // 17. Individual checkbox selection
    const studentRow = page.locator('tr', { hasText: studentUserEmail });
    const studentCheckbox = studentRow.locator('input[type="checkbox"]');
    await studentCheckbox.check();

    // 19. Count updates immediately
    await expect(countDisplay).toContainText('Selected: 1');
    await expect(bulkApproveBtn).toBeEnabled();

    // Uncheck
    await studentCheckbox.uncheck();
    await expect(countDisplay).toContainText('Selected: 0');
    await expect(bulkApproveBtn).toBeDisabled();

    // 18. Select All checkbox
    const selectAllCheckbox = page.locator('#selectAllPending');
    await selectAllCheckbox.check();
    await expect(studentCheckbox).toBeChecked();
    await expect(bulkApproveBtn).toBeEnabled();

    // Select All uncheck
    await selectAllCheckbox.uncheck();
    await expect(studentCheckbox).not.toBeChecked();
    await expect(countDisplay).toContainText('Selected: 0');
  });

  test('21. Confirmation modal appears on Approve Selected', async ({ page }) => {
    const studentRow = page.locator('tr', { hasText: studentUserEmail });
    await studentRow.locator('input[type="checkbox"]').check();

    const bulkApproveBtn = page.getByRole('button', { name: 'Approve Selected' }).first();
    await bulkApproveBtn.click();

    // Modal appears
    await expect(page.locator('text=These users will be approved and activated.')).toBeVisible();
    await expect(page.locator('[role="dialog"]').or(page.locator('.fixed')).locator(`text=${studentUserEmail}`)).toBeVisible();

    // Cancel modal
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.locator('text=These users will be approved and activated.')).not.toBeVisible();
  });

  test('22. Successful bulk approval clears approved users and selection', async ({ page }) => {
    // Filter by student role to isolate student test users
    const roleSelect = page.locator('#pendingRoleFilterSelect');
    await roleSelect.selectOption('student');

    const studentRow = page.locator('tr', { hasText: studentUserEmail });
    await studentRow.locator('input[type="checkbox"]').check();

    const bulkApproveBtn = page.getByRole('button', { name: 'Approve Selected' }).first();
    await bulkApproveBtn.click();

    // Confirm bulk approval
    await page.getByRole('button', { name: /Approve \d+ User/ }).click();

    // Success toast and row removed
    await expect(page.locator('text=These users will be approved and activated.')).not.toBeVisible({ timeout: 10000 });
    await expect(page.locator(`text=${studentUserEmail}`)).not.toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Selected: 0')).toBeVisible();

    // Reset role filter
    await roleSelect.selectOption('all');
  });

  test('24. Individual Approve action still works', async ({ page }) => {
    const studentRow = page.locator('tr', { hasText: studentUserEmail });
    await studentRow.getByRole('button', { name: 'Approve' }).click();

    await expect(page.locator('text=Approve Account Registration')).toBeVisible();
    await page.getByRole('button', { name: 'Confirm & Activate Account' }).click();

    await expect(page.locator('text=Approve Account Registration')).not.toBeVisible({ timeout: 10000 });
    await expect(page.locator(`text=${studentUserEmail}`)).not.toBeVisible({ timeout: 10000 });
  });

  test('25. Individual Reject action still works', async ({ page }) => {
    const facultyRow = page.locator('tr', { hasText: facultyUserEmail });
    await facultyRow.getByRole('button', { name: 'Reject' }).click();

    await expect(page.locator('text=Reject Account Registration')).toBeVisible();
    await page.fill('input[placeholder*="Unrecognized institute code"]', 'Testing individual rejection');
    await page.getByRole('button', { name: 'Reject Application' }).click();

    await expect(page.locator('text=Reject Account Registration')).not.toBeVisible({ timeout: 10000 });
    await expect(page.locator(`text=${facultyUserEmail}`)).not.toBeVisible({ timeout: 10000 });
  });
});
