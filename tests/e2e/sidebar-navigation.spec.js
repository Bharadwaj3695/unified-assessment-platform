const { test, expect } = require('@playwright/test');

test.describe('Application Shell Navigation & Sidebar E2E - Instructor', () => {
  test.beforeEach(async ({ page }) => {
    // Login as instructor
    await page.goto('/auth/login');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.fill('#email', 'instructor@uap.edu');
    await page.fill('#password', 'Instructor@123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/instructor\/dashboard/);
    await expect(page.getByText('instructor Workspace', { exact: true })).toBeVisible({ timeout: 10000 });
  });

  test('Desktop sidebar is fixed/frozen while only main content scrolls', async ({ page }) => {
    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible();

    // Get initial sidebar position
    const initialSidebarBox = await sidebar.boundingBox();
    expect(initialSidebarBox).not.toBeNull();

    // Scroll main content
    await page.evaluate(() => {
      const main = document.querySelector('main');
      if (main) {
        main.scrollTop = 400;
      }
    });

    await page.waitForTimeout(500);

    // Sidebar position should remain unchanged (fixed/frozen)
    const scrolledSidebarBox = await sidebar.boundingBox();
    expect(scrolledSidebarBox.y).toBe(initialSidebarBox.y);
    expect(scrolledSidebarBox.x).toBe(initialSidebarBox.x);
  });

  test('All instructor sidebar links are clickable and route with URL-based active state', async ({ page }) => {
    const links = [
      { name: 'My Assessments', path: '/instructor/assessments' },
      { name: 'Create Assessment', path: '/instructor/create' },
      { name: 'Submissions & Grading', path: '/instructor/submissions' },
      { name: 'Students', path: '/instructor/students' },
      { name: 'Profile', path: '/instructor/profile' },
      { name: 'Dashboard', path: '/instructor/dashboard' },
    ];

    for (const item of links) {
      // Click sidebar link
      const linkLocator = page.locator('aside nav a', { hasText: item.name });
      await expect(linkLocator).toBeVisible();
      await linkLocator.click();

      // Check URL routed correctly
      await expect(page).toHaveURL(new RegExp(item.path));

      // Check URL-based active state highlighting on the link
      await expect(linkLocator).toHaveClass(/bg-brand-primary-light/);

      // Refresh page and verify active highlighting persists
      await page.reload();
      await expect(page).toHaveURL(new RegExp(item.path));
      const refreshedLink = page.locator('aside nav a', { hasText: item.name });
      await expect(refreshedLink).toHaveClass(/bg-brand-primary-light/);
    }
  });

  test('Sidebar interactions remain functional while scrolled down', async ({ page }) => {
    // Scroll content down
    await page.evaluate(() => {
      const main = document.querySelector('main');
      if (main) main.scrollTop = 500;
    });

    // Click a sidebar item while scrolled
    const createLink = page.locator('aside nav a', { hasText: 'Create Assessment' });
    await expect(createLink).toBeVisible();
    await createLink.click();

    await expect(page).toHaveURL(/\/instructor\/create/);
    await expect(createLink).toHaveClass(/bg-brand-primary-light/);
  });

  test('Mobile drawer behavior is preserved on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    // Desktop sidebar should be hidden
    const desktopAside = page.locator('aside.hidden');
    await expect(desktopAside).toBeHidden();

    // Hamburger button should be visible
    const menuButton = page.getByRole('button', { name: 'Open navigation menu' });
    await expect(menuButton).toBeVisible();
    await menuButton.click();

    // Mobile drawer should open
    const drawerAside = page.locator('.fixed.inset-0 aside');
    await expect(drawerAside).toBeVisible();

    // Clicking a link should navigate and close drawer
    const assessmentsLink = drawerAside.locator('nav a', { hasText: 'My Assessments' });
    await assessmentsLink.click();

    await expect(page).toHaveURL(/\/instructor\/assessments/);
    await expect(page.locator('.fixed.inset-0 aside')).not.toBeVisible();
  });
});

test.describe('Application Shell Navigation & Sidebar E2E - Student', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.fill('#email', 'student@uap.edu');
    await page.fill('#password', 'Student@123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/student\/dashboard/);
    await expect(page.getByText('Student Workspace', { exact: true })).toBeVisible({ timeout: 10000 });
  });

  test('All student sidebar links are clickable, route with React Router, and maintain active state on refresh', async ({ page }) => {
    const studentItems = [
      { name: 'Assessments', path: '/student/catalog' },
      { name: 'Submissions', path: '/student/submissions' },
      { name: 'Profile', path: '/student/profile' },
      { name: 'Dashboard', path: '/student/dashboard' },
    ];

    for (const item of studentItems) {
      const link = page.locator('aside nav a', { hasText: item.name });
      await expect(link).toBeVisible();
      await link.click();

      await expect(page).toHaveURL(new RegExp(item.path));
      await expect(link).toHaveClass(/bg-brand-primary-light/);

      // Refresh page to verify URL-based active state remains highlighted
      await page.reload();
      await expect(page).toHaveURL(new RegExp(item.path));
      const refreshedLink = page.locator('aside nav a', { hasText: item.name });
      await expect(refreshedLink).toHaveClass(/bg-brand-primary-light/);
    }
  });
});

test.describe('Application Shell Navigation & Sidebar E2E - Admin', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.fill('#email', 'admin@uap.edu');
    await page.fill('#password', 'Admin@123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/admin\/dashboard/);
    await expect(page.getByText('System Overview', { exact: true })).toBeVisible({ timeout: 10000 });
  });

  test('All admin sidebar links are clickable, route with React Router, and maintain active state on refresh', async ({ page }) => {
    const adminItems = [
      { name: 'User Management', path: '/admin/users' },
      { name: 'All Assessments', path: '/admin/assessments' },
      { name: 'Audit Logs', path: '/admin/logs' },
      { name: 'Settings', path: '/admin/settings' },
      { name: 'System Overview', path: '/admin/dashboard' },
    ];

    for (const item of adminItems) {
      const link = page.locator('aside nav a', { hasText: item.name });
      await expect(link).toBeVisible();
      await link.click();

      await expect(page).toHaveURL(new RegExp(item.path));
      await expect(link).toHaveClass(/bg-brand-primary-light/);

      // Refresh page to verify URL-based active state remains highlighted
      await page.reload();
      await expect(page).toHaveURL(new RegExp(item.path));
      const refreshedLink = page.locator('aside nav a', { hasText: item.name });
      await expect(refreshedLink).toHaveClass(/bg-brand-primary-light/);
    }
  });
});
