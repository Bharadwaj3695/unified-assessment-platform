const { test, expect } = require('@playwright/test');

test.describe('Admin Workspace - Collapsible Hamburger Sidebar E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login and log in as administrator
    await page.goto('/auth/login');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.fill('#email', 'admin@uap.edu');
    await page.fill('#password', 'Admin@123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/admin\/dashboard/);
    await expect(page.locator('aside')).toBeVisible({ timeout: 10000 });
  });

  test('1. Sidebar is initially expanded with workspace title and full labels', async ({ page }) => {
    const aside = page.locator('aside');
    await expect(aside).toBeVisible();

    // Check expanded width class (w-64)
    await expect(aside).toHaveClass(/w-64/);

    // Hamburger button has "Collapse sidebar" aria-label
    const hamburgerBtn = aside.getByRole('button', { name: 'Collapse sidebar' });
    await expect(hamburgerBtn).toBeVisible();

    // Brand and workspace labels visible
    await expect(aside.getByText('Unified Assessment', { exact: true })).toBeVisible();
    await expect(aside.getByText('admin Workspace', { exact: true })).toBeVisible();

    // Navigation section titles visible
    await expect(aside.getByText('Workspace', { exact: true })).toBeVisible();
    await expect(aside.getByText('User Management', { exact: true })).toBeVisible();
    await expect(aside.getByText('Registries', { exact: true })).toBeVisible();
    await expect(aside.getByText('Platform Administration', { exact: true })).toBeVisible();
    await expect(aside.getByText('Security & Governance', { exact: true })).toBeVisible();

    // Navigation links with full text visible
    await expect(aside.locator('nav a', { hasText: 'System Overview' })).toBeVisible();
    await expect(aside.locator('nav a', { hasText: 'Approval Queue' })).toBeVisible();
    await expect(aside.locator('nav a', { hasText: 'Student Registry' })).toBeVisible();
    await expect(aside.locator('nav a', { hasText: 'Faculty Registry' })).toBeVisible();
    await expect(aside.locator('nav a', { hasText: 'All Assessments' })).toBeVisible();
    await expect(aside.locator('nav a', { hasText: 'Audit Logs' })).toBeVisible();
    await expect(aside.locator('nav a', { hasText: 'Settings' })).toBeVisible();
  });

  test('2. Clicking hamburger button collapses sidebar to icon-only narrow view', async ({ page }) => {
    const aside = page.locator('aside');
    const hamburgerBtn = aside.getByRole('button', { name: 'Collapse sidebar' });
    await hamburgerBtn.click();

    // Sidebar becomes narrow (w-20)
    await expect(aside).toHaveClass(/w-20/);

    // Hamburger button toggles aria-label to "Expand sidebar"
    const expandBtn = aside.getByRole('button', { name: 'Expand sidebar' });
    await expect(expandBtn).toBeVisible();

    // Workspace label and section text are hidden
    await expect(aside.getByText('admin Workspace', { exact: true })).not.toBeVisible();
    await expect(aside.getByText('User Management', { exact: true })).not.toBeVisible();

    // Navigation icons remain visible and present
    const iconLinks = aside.locator('nav a');
    await expect(iconLinks).toHaveCount(7);
  });

  test('3. Re-expanding sidebar restores full width and all labels', async ({ page }) => {
    const aside = page.locator('aside');

    // Collapse
    const collapseBtn = aside.getByRole('button', { name: 'Collapse sidebar' });
    await collapseBtn.click();
    await expect(aside).toHaveClass(/w-20/);

    // Expand
    const expandBtn = aside.getByRole('button', { name: 'Expand sidebar' });
    await expandBtn.click();
    await expect(aside).toHaveClass(/w-64/);

    // Full labels restored
    await expect(aside.getByText('admin Workspace', { exact: true })).toBeVisible();
    await expect(aside.getByText('System Overview', { exact: true })).toBeVisible();
    await expect(aside.getByText('Approval Queue', { exact: true })).toBeVisible();
  });

  test('4. Hamburger button has accessible semantics, keyboard support, and focus state', async ({ page }) => {
    const aside = page.locator('aside');
    const hamburgerBtn = aside.getByRole('button', { name: 'Collapse sidebar' });

    // Verify accessible attributes
    await expect(hamburgerBtn).toHaveAttribute('type', 'button');
    await expect(hamburgerBtn).toHaveAttribute('aria-label', 'Collapse sidebar');
    await expect(hamburgerBtn).toHaveAttribute('title', 'Collapse sidebar');

    // Focus via keyboard
    await hamburgerBtn.focus();
    await expect(hamburgerBtn).toBeFocused();

    // Press Enter to collapse
    await page.keyboard.press('Enter');
    await expect(aside).toHaveClass(/w-20/);

    // Expand button accessible attributes
    const expandBtn = aside.getByRole('button', { name: 'Expand sidebar' });
    await expect(expandBtn).toHaveAttribute('aria-label', 'Expand sidebar');
    await expect(expandBtn).toHaveAttribute('title', 'Expand sidebar');

    // Press Space to re-expand
    await expandBtn.focus();
    await page.keyboard.press('Space');
    await expect(aside).toHaveClass(/w-64/);
  });

  test('5. Active route retains highlighting in both collapsed and expanded states', async ({ page }) => {
    const aside = page.locator('aside');

    // System Overview should be active on /admin/dashboard
    const dashboardLink = aside.locator('nav a[href="/admin/dashboard"]');
    await expect(dashboardLink).toHaveClass(/bg-brand-primary-light/);
    await expect(dashboardLink).toHaveAttribute('aria-current', 'page');

    // Collapse sidebar
    await aside.getByRole('button', { name: 'Collapse sidebar' }).click();
    await expect(aside).toHaveClass(/w-20/);

    // Collapsed active link retains active classes and aria-current
    const collapsedDashboardLink = aside.locator('nav a[href="/admin/dashboard"]');
    await expect(collapsedDashboardLink).toBeVisible();
    await expect(collapsedDashboardLink).toHaveClass(/bg-brand-primary-light/);
    await expect(collapsedDashboardLink).toHaveAttribute('aria-current', 'page');

    // Active icon retains terracotta styling
    const activeIcon = collapsedDashboardLink.locator('svg');
    await expect(activeIcon).toHaveClass(/text-\[#E05D38\]/);
  });

  test('6. All navigation items remain functional and route smoothly while collapsed', async ({ page }) => {
    const aside = page.locator('aside');

    // Collapse sidebar
    await aside.getByRole('button', { name: 'Collapse sidebar' }).click();
    await expect(aside).toHaveClass(/w-20/);

    const routes = [
      { path: '/admin/users', title: 'Approval Queue' },
      { path: '/admin/student-registry', title: 'Student Registry' },
      { path: '/admin/faculty-registry', title: 'Faculty Registry' },
      { path: '/admin/assessments', title: 'All Assessments' },
      { path: '/admin/logs', title: 'Audit Logs' },
      { path: '/admin/settings', title: 'Settings' },
      { path: '/admin/dashboard', title: 'System Overview' },
    ];

    for (const route of routes) {
      const link = aside.locator(`nav a[href="${route.path}"]`);
      await expect(link).toBeVisible();
      await link.click();

      // Check URL routed properly
      await expect(page).toHaveURL(new RegExp(route.path));

      // Active state applied to current link
      await expect(link).toHaveClass(/bg-brand-primary-light/);
      await expect(link).toHaveAttribute('aria-current', 'page');
    }
  });

  test('7. Icons provide tooltip information in collapsed state', async ({ page }) => {
    const aside = page.locator('aside');

    // Collapse sidebar
    await aside.getByRole('button', { name: 'Collapse sidebar' }).click();
    await expect(aside).toHaveClass(/w-20/);

    const routes = [
      { path: '/admin/dashboard', name: 'System Overview' },
      { path: '/admin/users', name: 'Approval Queue' },
      { path: '/admin/student-registry', name: 'Student Registry' },
      { path: '/admin/faculty-registry', name: 'Faculty Registry' },
      { path: '/admin/assessments', name: 'All Assessments' },
      { path: '/admin/logs', name: 'Audit Logs' },
      { path: '/admin/settings', name: 'Settings' },
    ];

    for (const route of routes) {
      const link = aside.locator(`nav a[href="${route.path}"]`);
      await expect(link).toHaveAttribute('title', route.name);
      await expect(link).toHaveAttribute('aria-label', route.name);
    }
  });

  test('8. Section expand/collapse accordion still works in expanded state', async ({ page }) => {
    const aside = page.locator('aside');

    // Locate User Management accordion toggle
    const userMgmtBtn = aside.locator('button#section-btn-admin-user-management-section');
    await expect(userMgmtBtn).toBeVisible();
    await expect(userMgmtBtn).toHaveAttribute('aria-expanded', 'true');

    // Collapse section
    await userMgmtBtn.click();
    await expect(userMgmtBtn).toHaveAttribute('aria-expanded', 'false');
    await expect(aside.locator('#section-admin-user-management-section')).not.toBeVisible();

    // Re-expand section
    await userMgmtBtn.click();
    await expect(userMgmtBtn).toHaveAttribute('aria-expanded', 'true');
    await expect(aside.locator('#section-admin-user-management-section')).toBeVisible();
  });

  test('9. Sidebar collapse state persists in localStorage across page reload', async ({ page }) => {
    const aside = page.locator('aside');

    // Collapse sidebar
    await aside.getByRole('button', { name: 'Collapse sidebar' }).click();
    await expect(aside).toHaveClass(/w-20/);

    // Verify localStorage has persisted state
    const savedState = await page.evaluate(() => localStorage.getItem('uap_admin_sidebar_collapsed'));
    expect(savedState).toBe('true');

    // Reload page
    await page.reload();
    await expect(page).toHaveURL(/\/admin\/dashboard/);

    // Sidebar remains collapsed after reload
    const refreshedAside = page.locator('aside');
    await expect(refreshedAside).toHaveClass(/w-20/);
    await expect(refreshedAside.getByRole('button', { name: 'Expand sidebar' })).toBeVisible();
  });

  test('10. Mobile drawer behavior remains preserved on mobile viewports', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    // Desktop sidebar hidden on mobile
    const desktopAside = page.locator('aside.hidden');
    await expect(desktopAside).toBeHidden();

    // Header hamburger menu button visible
    const mobileMenuBtn = page.getByRole('button', { name: 'Open navigation menu' });
    await expect(mobileMenuBtn).toBeVisible();
    await mobileMenuBtn.click();

    // Mobile drawer opens
    const drawer = page.locator('[role="dialog"][aria-label="Mobile Navigation Menu"]');
    await expect(drawer).toBeVisible();

    // Drawer sidebar shows full navigation items (not collapsed into icon strip)
    await expect(drawer.locator('nav a', { hasText: 'System Overview' })).toBeVisible();
    await expect(drawer.locator('nav a', { hasText: 'Approval Queue' })).toBeVisible();

    // Navigating closes drawer
    await drawer.locator('nav a', { hasText: 'Approval Queue' }).click();
    await expect(page).toHaveURL(/\/admin\/users/);
    await expect(drawer).not.toBeVisible();
  });
});
