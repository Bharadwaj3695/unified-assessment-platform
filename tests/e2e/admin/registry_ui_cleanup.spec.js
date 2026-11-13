import { test, expect } from '@playwright/test';

test.describe('Admin Student & Faculty Registry UI Cleanup Verification', () => {
  test.beforeEach(async ({ page }) => {
    // Authenticate as administrator
    await page.goto('/auth/login');
    await page.fill('#email', 'admin@uap.edu');
    await page.fill('#password', 'Admin@123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/admin/, { timeout: 15000 });
  });

  const viewports = [
    { name: 'Desktop', width: 1280, height: 800 },
    { name: 'Tablet', width: 768, height: 1024 },
    { name: 'Mobile', width: 375, height: 667 },
  ];

  for (const vp of viewports) {
    test(`Student Registry UI on ${vp.name} (${vp.width}x${vp.height})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/admin/student-registry');

      // 1. Heading verification
      const heading = page.getByRole('heading', { level: 1 });
      await expect(heading).toBeVisible();
      await expect(heading).toHaveText(/Student Registry/);
      await expect(heading).not.toHaveText(/Master Data/);

      // 2. Funnel icon and "Status:" label removal
      const filterSection = page.locator('div:has(> select)');
      await expect(filterSection.locator('text=Status:')).toHaveCount(0);
      await expect(filterSection.locator('svg.lucide-filter')).toHaveCount(0);

      // 3. Status dropdown options and functionality
      const select = page.locator('select');
      await expect(select).toBeVisible();
      await expect(select).toHaveValue(''); // All Status by default

      const options = await select.locator('option').allTextContents();
      expect(options).toEqual(['All Status', 'Active', 'Inactive', 'Suspended', 'Graduated']);

      // Filter selection
      await select.selectOption('active');
      await expect(select).toHaveValue('active');

      // 4. Refresh control
      const refreshBtn = page.getByRole('button', { name: /Refresh List/i });
      await expect(refreshBtn).toBeVisible();
      await refreshBtn.click();

      // 5. Add Master Record button
      const addBtn = page.getByRole('button', { name: /Add Master Record/i });
      await expect(addBtn).toBeVisible();

      // 6. Table container and responsive overflow
      const table = page.locator('table');
      await expect(table).toBeVisible();

      // Ensure no horizontal document overflow
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });
      expect(hasHorizontalScroll).toBe(false);
    });

    test(`Faculty Registry UI on ${vp.name} (${vp.width}x${vp.height})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/admin/faculty-registry');

      // 1. Heading verification
      const heading = page.getByRole('heading', { level: 1 });
      await expect(heading).toBeVisible();
      await expect(heading).toHaveText(/Faculty Registry/);
      await expect(heading).not.toHaveText(/Master Data/);

      // 2. Funnel icon and "Status:" label removal
      const filterSection = page.locator('div:has(> select)');
      await expect(filterSection.locator('text=Status:')).toHaveCount(0);
      await expect(filterSection.locator('svg.lucide-filter')).toHaveCount(0);

      // 3. Status dropdown options and functionality
      const select = page.locator('select');
      await expect(select).toBeVisible();
      await expect(select).toHaveValue(''); // All Status by default

      const options = await select.locator('option').allTextContents();
      expect(options).toEqual(['All Status', 'Active', 'Inactive']);

      // Filter selection
      await select.selectOption('active');
      await expect(select).toHaveValue('active');

      // 4. Refresh control
      const refreshBtn = page.getByRole('button', { name: /Refresh List/i });
      await expect(refreshBtn).toBeVisible();
      await refreshBtn.click();

      // 5. Add Faculty Record button
      const addBtn = page.getByRole('button', { name: /Add Faculty Record/i });
      await expect(addBtn).toBeVisible();

      // 6. Table container and responsive overflow
      const table = page.locator('table');
      await expect(table).toBeVisible();

      // Ensure no horizontal document overflow
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });
      expect(hasHorizontalScroll).toBe(false);
    });
  }

  test('Student Registry: [View] [Deactivate/Activate] [Delete] row layout without provisioning or More Actions', async ({ page }) => {
    await page.goto('/admin/student-registry');
    await expect(page.getByRole('heading', { name: /^Student Registry$/i })).toBeVisible({ timeout: 10000 });

    // Ensure at least one master record exists
    const stamp = Date.now();
    const testStudentId = `STU-ACT-${stamp}`;
    const testEmail = `stu_act_${stamp}@college.edu`;

    await page.getByRole('button', { name: /Add Master Record/i }).click();
    await expect(page.getByRole('heading', { name: /Add Student Registry Record/i })).toBeVisible();

    await page.fill('input[placeholder*="STU-2025-001"]', testStudentId);
    await page.fill('input[placeholder*="Rahul Sharma"]', 'Test Student Actions');
    await page.fill('input[type="date"]', '2001-08-20');
    await page.fill('input[placeholder*="college.edu"]', testEmail);

    await page.getByRole('button', { name: /Create Registry Record/i }).click();
    await expect(page.getByText(/Student Registry record created successfully/i)).toBeVisible({ timeout: 10000 });

    // Locate the row for this created record
    const row = page.locator(`tr:has-text("${testStudentId}")`);
    await expect(row).toBeVisible({ timeout: 10000 });

    // 1. Verify "Provision User Account" is completely removed
    await expect(page.locator('text=Provision User Account')).toHaveCount(0);

    // 2. Verify "More Actions" dropdown is completely removed
    await expect(page.locator('button:has-text("More Actions")')).toHaveCount(0);
    await expect(page.locator('[role="menu"]')).toHaveCount(0);

    // 3. For an active record, verify visible action layout: [View] [Deactivate] [Delete]
    const viewBtn = row.getByRole('button', { name: /^View$/i });
    const deactivateBtn = row.getByRole('button', { name: /^Deactivate$/i });
    const deleteBtn = row.getByRole('button', { name: /^Delete$/i });

    await expect(viewBtn).toBeVisible();
    await expect(deactivateBtn).toBeVisible();
    await expect(deleteBtn).toBeVisible();

    // 4. Test View button functionality
    await viewBtn.click();
    const detailsModal = page.getByRole('dialog');
    await expect(detailsModal.getByRole('heading', { name: /Student Registry Master Record/i })).toBeVisible();
    await expect(detailsModal.locator(`text=${testStudentId}`)).toBeVisible();
    await detailsModal.getByRole('button', { name: /^Close$/i }).click();
    await expect(detailsModal).not.toBeVisible();

    // 5. Test Deactivate toggle -> status changes to inactive, button becomes [Activate]
    await deactivateBtn.click();
    await expect(page.getByText(/Registry record set to inactive/i)).toBeVisible({ timeout: 10000 });
    const activateBtn = row.getByRole('button', { name: /^Activate$/i });
    await expect(activateBtn).toBeVisible();

    // 6. Test Activate toggle -> status changes to active, button becomes [Deactivate]
    await page.evaluate(() => document.querySelectorAll('.Toastify__toast').forEach((t) => t.remove()));
    await activateBtn.click();
    await expect(page.getByText(/Registry record set to active/i)).toBeVisible({ timeout: 10000 });
    await expect(row.getByRole('button', { name: /^Deactivate$/i })).toBeVisible();

    // 7. Test Delete button with confirmation dialog preservation
    await page.evaluate(() => document.querySelectorAll('.Toastify__toast').forEach((t) => t.remove()));
    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });
    await row.getByRole('button', { name: /^Delete$/i }).click();
    await expect(page.getByText(/Registry record deleted/i)).toBeVisible({ timeout: 10000 });
    await expect(row).not.toBeVisible();
  });

  test('Faculty Registry: [View] [Deactivate/Activate] [Delete] row layout without provisioning or More Actions', async ({ page }) => {
    await page.goto('/admin/faculty-registry');
    await expect(page.getByRole('heading', { name: /^Faculty Registry$/i })).toBeVisible({ timeout: 10000 });

    // Ensure at least one faculty master record exists
    const stamp = Date.now();
    const testFacId = `FAC-ACT-${stamp}`;
    const testEmail = `fac_act_${stamp}@college.edu`;

    await page.getByRole('button', { name: /Add Faculty Record/i }).click();
    await expect(page.getByRole('heading', { name: /Add Faculty Registry Record/i })).toBeVisible();

    await page.fill('input[placeholder*="FAC-2025-01"]', testFacId);
    await page.fill('input[placeholder*="Alan Turing"]', 'Prof. Faculty Actions');
    await page.fill('input[placeholder*="college.edu"]', testEmail);

    await page.getByRole('button', { name: /Create Registry Record/i }).click();
    await expect(page.getByText(/Faculty Registry record created successfully/i)).toBeVisible({ timeout: 10000 });

    // Locate the row for this created record
    const row = page.locator(`tr:has-text("${testFacId}")`);
    await expect(row).toBeVisible({ timeout: 10000 });

    // 1. Verify "Provision User Account" is completely removed
    await expect(page.locator('text=Provision User Account')).toHaveCount(0);

    // 2. Verify "More Actions" dropdown is completely removed
    await expect(page.locator('button:has-text("More Actions")')).toHaveCount(0);
    await expect(page.locator('[role="menu"]')).toHaveCount(0);

    // 3. For an active record, verify visible action layout: [View] [Deactivate] [Delete]
    const viewBtn = row.getByRole('button', { name: /^View$/i });
    const deactivateBtn = row.getByRole('button', { name: /^Deactivate$/i });
    const deleteBtn = row.getByRole('button', { name: /^Delete$/i });

    await expect(viewBtn).toBeVisible();
    await expect(deactivateBtn).toBeVisible();
    await expect(deleteBtn).toBeVisible();

    // 4. Test View button functionality
    await viewBtn.click();
    const detailsModal = page.getByRole('dialog');
    await expect(detailsModal.getByRole('heading', { name: /Faculty Registry Master Record/i })).toBeVisible();
    await expect(detailsModal.locator(`text=${testFacId}`)).toBeVisible();
    await detailsModal.getByRole('button', { name: /^Close$/i }).click();
    await expect(detailsModal).not.toBeVisible();

    // 5. Test Deactivate toggle -> status changes to inactive, button becomes [Activate]
    await deactivateBtn.click();
    await expect(page.getByText(/Faculty record status set to inactive/i)).toBeVisible({ timeout: 10000 });
    const activateBtn = row.getByRole('button', { name: /^Activate$/i });
    await expect(activateBtn).toBeVisible();

    // 6. Test Activate toggle -> status changes to active, button becomes [Deactivate]
    await page.evaluate(() => document.querySelectorAll('.Toastify__toast').forEach((t) => t.remove()));
    await activateBtn.click();
    await expect(page.getByText(/Faculty record status set to active/i)).toBeVisible({ timeout: 10000 });
    await expect(row.getByRole('button', { name: /^Deactivate$/i })).toBeVisible();

    // 7. Test Delete button with confirmation dialog preservation
    await page.evaluate(() => document.querySelectorAll('.Toastify__toast').forEach((t) => t.remove()));
    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });
    await row.getByRole('button', { name: /^Delete$/i }).click();
    await expect(page.getByText(/Faculty record deleted/i)).toBeVisible({ timeout: 10000 });
    await expect(row).not.toBeVisible();
  });
});
