const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

test.describe('Admin User & Registry Management Module E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Authenticate as administrator via UI login so session cookies are stored
    await page.goto('/auth/login');
    await page.fill('#email', 'admin@uap.edu');
    await page.fill('#password', 'Admin@123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/admin\/dashboard/);
  });

  test('1. Admin navigates to Students and adds an individual student', async ({ page }) => {
    await page.goto('/admin/students');
    await expect(page.getByRole('heading', { name: /Students Management/i })).toBeVisible({ timeout: 10000 });

    const testId = `STU-E2E-${Date.now()}`;
    const testEmail = `e2e_student_${Date.now()}@college.edu`;

    await page.getByRole('button', { name: 'Add Student' }).click();
    await expect(page.getByRole('heading', { name: 'Add Individual Student' })).toBeVisible();

    await page.fill('input[placeholder*="STU-2025-001"]', testId);
    await page.fill('input[placeholder*="John Doe"]', 'E2E Test Student');
    await page.fill('input[type="date"]', '2002-05-15');
    await page.fill('input[placeholder*="john.doe@college.edu"]', testEmail);

    await page.getByRole('button', { name: 'Create Student' }).click();

    // Verify student appears in list
    await expect(page.getByText('Student account created and registered successfully')).toBeVisible({ timeout: 10000 });
    await expect(page.locator(`text=${testId}`)).toBeVisible({ timeout: 10000 });
    await expect(page.locator(`text=${testEmail}`)).toBeVisible();
  });

  test('2. Admin navigates to Faculty and adds an individual faculty member', async ({ page }) => {
    await page.goto('/admin/faculty');
    await expect(page.getByRole('heading', { name: /Faculty Management/i })).toBeVisible({ timeout: 10000 });

    const facId = `FAC-E2E-${Date.now()}`;
    const facEmail = `e2e_faculty_${Date.now()}@college.edu`;

    await page.getByRole('button', { name: 'Add Faculty Member' }).click();
    await expect(page.getByRole('heading', { name: 'Add Faculty Member' })).toBeVisible();

    await page.fill('input[placeholder*="FAC-2025-01"]', facId);
    await page.fill('input[placeholder*="Prof. Alan Turing"]', 'Prof. E2E Faculty');
    await page.fill('input[placeholder*="alan.turing@college.edu"]', facEmail);
    await page.fill('input[placeholder*="Computer Science"]', 'Information Technology');

    await page.getByRole('button', { name: 'Create Faculty' }).click();

    await expect(page.getByText('Faculty account and registry record created successfully')).toBeVisible({ timeout: 10000 });
    await expect(page.locator(`text=${facId}`)).toBeVisible({ timeout: 10000 });
    await expect(page.locator(`text=${facEmail}`)).toBeVisible();
  });

  test('3. Admin runs Bulk Student Import with CSV and confirms valid records', async ({ page }) => {
    await page.goto('/admin/students');
    await expect(page.getByRole('heading', { name: /Students Management/i })).toBeVisible({ timeout: 10000 });

    const uniqueStamp = Date.now();
    const csvContent = `Student ID,Name,Date of Birth,Email
STU-BULK-${uniqueStamp}-A,Bulk Student Alpha,2002-03-10,bulk_a_${uniqueStamp}@college.edu
STU-BULK-${uniqueStamp}-B,Bulk Student Beta,2001-11-22,bulk_b_${uniqueStamp}@college.edu
`;
    const tempFilePath = path.join(__dirname, `temp_bulk_${uniqueStamp}.csv`);
    fs.writeFileSync(tempFilePath, csvContent, 'utf-8');

    try {
      await page.getByRole('button', { name: /Bulk Import/i }).click();
      await expect(page.getByRole('heading', { name: 'Bulk Student Import' })).toBeVisible();

      // Upload file
      const fileInput = page.locator('#student-bulk-input');
      await fileInput.setInputFiles(tempFilePath);

      await page.getByRole('button', { name: /Next: Validate & Preview/i }).click();

      // Step 2: Preview should appear
      await expect(page.getByText('Total Rows')).toBeVisible({ timeout: 10000 });
      await expect(page.locator(`text=STU-BULK-${uniqueStamp}-A`)).toBeVisible();
      await expect(page.locator(`text=STU-BULK-${uniqueStamp}-B`)).toBeVisible();

      // Confirm import
      await page.getByRole('button', { name: /Import 2 Valid Records/i }).click();

      // Step 4: Completion Summary
      await expect(page.getByText('Bulk Student Import Completed!')).toBeVisible({ timeout: 10000 });
      await page.getByRole('button', { name: /Done & View Student Roster/i }).click();

      // Verify records are visible in student table
      await expect(page.locator(`text=STU-BULK-${uniqueStamp}-A`)).toBeVisible({ timeout: 10000 });
    } finally {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    }
  });

  test('4. Admin navigates to Student Registry and Faculty Registry master data pages', async ({ page }) => {
    // Student Registry
    await page.goto('/admin/student-registry');
    await expect(page.getByRole('heading', { name: /^Student Registry$/i })).toBeVisible({ timeout: 10000 });
    await expect(page.locator('table')).toBeVisible();

    // Faculty Registry via SPA sidebar navigation
    await page.locator('nav a', { hasText: 'Faculty Registry' }).first().click();
    await expect(page.getByRole('heading', { name: /^Faculty Registry$/i })).toBeVisible({ timeout: 10000 });
    await expect(page.locator('table')).toBeVisible();
  });
});
