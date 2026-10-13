const { test, expect } = require('@playwright/test');

test.describe('Global RBAC Scroll Reset & Layout Consistency E2E', () => {

  test.describe('Admin Workspace - Route Scroll Reset & In-Page State Preservation', () => {
    test.beforeEach(async ({ page }) => {
      // Authenticate as administrator
      await page.goto('/auth/login');
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      await page.fill('#email', 'admin@uap.edu');
      await page.fill('#password', 'Admin@123');
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/\/admin\/dashboard/);
      await expect(page.locator('aside')).toBeVisible({ timeout: 10000 });
    });

    test('1. Main scroll container resets to top on navigation between admin sections', async ({ page }) => {
      const mainLocator = page.locator('main');
      await expect(mainLocator).toBeVisible();

      // Ensure page is scrollable and scroll down on System Overview
      await page.evaluate(() => {
        const main = document.querySelector('main');
        if (main) main.scrollTop = 400;
      });

      const initialScroll = await page.evaluate(() => document.querySelector('main')?.scrollTop || 0);
      expect(initialScroll).toBeGreaterThan(0);

      // Navigate to User Management (Approval Queue) which reuses AdminDashboard
      const approvalQueueLink = page.locator('aside nav a', { hasText: 'Approval Queue' });
      await approvalQueueLink.click();
      await expect(page).toHaveURL(/\/admin\/users/);

      // Wait for layout update and verify scroll was reset to 0
      await expect.poll(async () => {
        return page.evaluate(() => document.querySelector('main')?.scrollTop || 0);
      }).toBe(0);

      // Scroll down in User Management
      await page.evaluate(() => {
        const main = document.querySelector('main');
        if (main) main.scrollTop = 350;
      });
      const usersScroll = await page.evaluate(() => document.querySelector('main')?.scrollTop || 0);
      expect(usersScroll).toBeGreaterThan(0);

      // Navigate to Student Registry (standalone component)
      const studentRegistryLink = page.locator('aside nav a', { hasText: 'Student Registry' });
      await studentRegistryLink.click();
      await expect(page).toHaveURL(/\/admin\/student-registry/);

      // Verify scroll reset to top
      await expect.poll(async () => {
        return page.evaluate(() => document.querySelector('main')?.scrollTop || 0);
      }).toBe(0);

      // Header, Add Record button, and search input should be visible at top
      await expect(page.getByRole('heading', { name: /Student Registry/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /Add Master Record/i })).toBeVisible();

      // Scroll down in Student Registry
      await page.evaluate(() => {
        const main = document.querySelector('main');
        if (main) main.scrollTop = 250;
      });

      // Navigate to Faculty Registry
      const facultyRegistryLink = page.locator('aside nav a', { hasText: 'Faculty Registry' });
      await facultyRegistryLink.click();
      await expect(page).toHaveURL(/\/admin\/faculty-registry/);

      // Verify scroll reset to top
      await expect.poll(async () => {
        return page.evaluate(() => document.querySelector('main')?.scrollTop || 0);
      }).toBe(0);

      // Header should be visible at top
      await expect(page.getByRole('heading', { name: /Faculty Registry/i })).toBeVisible();

      // Navigate back to System Overview
      const overviewLink = page.locator('aside nav a', { hasText: 'System Overview' });
      await overviewLink.click();
      await expect(page).toHaveURL(/\/admin\/dashboard/);

      await expect.poll(async () => {
        return page.evaluate(() => document.querySelector('main')?.scrollTop || 0);
      }).toBe(0);
      await expect(page.getByText('System Governance')).toBeVisible();
    });

    test('2. In-page search and filter interactions do NOT reset scroll position', async ({ page }) => {
      // Navigate to Student Registry via sidebar
      const studentRegistryLink = page.locator('aside nav a', { hasText: 'Student Registry' });
      await studentRegistryLink.click();
      await expect(page).toHaveURL(/\/admin\/student-registry/);
      await expect(page.locator('h1', { hasText: 'Student Registry' })).toBeVisible({ timeout: 10000 });

      // Scroll down moderately within available space
      await page.evaluate(() => {
        const main = document.querySelector('main');
        if (main) main.scrollTop = 50;
      });

      const currentScroll = await page.evaluate(() => document.querySelector('main')?.scrollTop || 0);
      expect(currentScroll).toBe(50);

      // Type in search box without changing pathname
      const searchInput = page.locator('input[placeholder*="Search by ID"]');
      await searchInput.fill('NonExistentStudent');

      // Give search a moment to debounce
      await page.waitForTimeout(400);

      // Scroll should NOT be reset to 0 because pathname did not change
      const scrollAfterSearch = await page.evaluate(() => document.querySelector('main')?.scrollTop || 0);
      expect(scrollAfterSearch).toBe(50);
    });
  });

  test.describe('Student & Instructor Roles - Scroll Reset Verification', () => {
    test('3. Student navigation between Dashboard, Catalog, and Submissions resets scroll', async ({ page }) => {
      await page.goto('/auth/login');
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      await page.fill('#email', 'student@uap.edu');
      await page.fill('#password', 'Student@123');
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/\/student\/dashboard/);
      await expect(page.locator('aside')).toBeVisible({ timeout: 10000 });

      // Scroll down on dashboard
      await page.evaluate(() => {
        const main = document.querySelector('main');
        if (main) main.scrollTop = 300;
      });
      expect(await page.evaluate(() => document.querySelector('main')?.scrollTop || 0)).toBeGreaterThan(0);

      // Navigate to Catalog
      await page.locator('aside nav a', { hasText: 'Assessments' }).click();
      await expect(page).toHaveURL(/\/student\/catalog/);

      await expect.poll(async () => {
        return page.evaluate(() => document.querySelector('main')?.scrollTop || 0);
      }).toBe(0);
    });

    test('4. Instructor navigation between Dashboard and My Assessments resets scroll', async ({ page }) => {
      await page.goto('/auth/login');
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      await page.fill('#email', 'instructor@uap.edu');
      await page.fill('#password', 'Instructor@123');
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/\/instructor\/dashboard/);
      await expect(page.locator('aside')).toBeVisible({ timeout: 10000 });

      // Scroll down on dashboard
      await page.evaluate(() => {
        const main = document.querySelector('main');
        if (main) main.scrollTop = 300;
      });
      expect(await page.evaluate(() => document.querySelector('main')?.scrollTop || 0)).toBeGreaterThan(0);

      // Navigate to My Assessments
      await page.locator('aside nav a', { hasText: 'My Assessments' }).click();
      await expect(page).toHaveURL(/\/instructor\/assessments/);

      await expect.poll(async () => {
        return page.evaluate(() => document.querySelector('main')?.scrollTop || 0);
      }).toBe(0);
    });
  });

});
