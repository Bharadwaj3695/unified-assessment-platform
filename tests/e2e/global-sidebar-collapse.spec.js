const { test, expect } = require('@playwright/test');

test.describe('Global RBAC Collapsible Sidebar E2E — Student, Instructor & Admin', () => {

  test.describe('Student Workspace — Collapsible Sidebar', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/auth/login');
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      await page.fill('#email', 'student@uap.edu');
      await page.fill('#password', 'Student@123');
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/\/student\/dashboard/);
      await expect(page.locator('aside')).toBeVisible({ timeout: 10000 });
    });

    test('1. Student sidebar is initially expanded with workspace title and full labels', async ({ page }) => {
      const aside = page.locator('aside');
      await expect(aside).toBeVisible();
      await expect(aside).toHaveClass(/w-64/);

      // Hamburger button has "Collapse sidebar" aria-label
      const hamburgerBtn = aside.getByRole('button', { name: 'Collapse sidebar' });
      await expect(hamburgerBtn).toBeVisible();

      // Workspace label and full navigation text visible
      await expect(aside.getByText('student Workspace', { exact: true })).toBeVisible();
      await expect(aside.locator('nav a', { hasText: 'Dashboard' })).toBeVisible();
      await expect(aside.locator('nav a', { hasText: 'Assessments' })).toBeVisible();
      await expect(aside.locator('nav a', { hasText: 'Submissions' })).toBeVisible();
      await expect(aside.locator('nav a', { hasText: 'Profile' })).toBeVisible();
    });

    test('2. Student can collapse sidebar to icon-only narrow view and tooltips are present', async ({ page }) => {
      const aside = page.locator('aside');
      const hamburgerBtn = aside.getByRole('button', { name: 'Collapse sidebar' });
      await hamburgerBtn.click();

      // Sidebar becomes narrow (w-20)
      await expect(aside).toHaveClass(/w-20/);

      // Expand button is now visible
      const expandBtn = aside.getByRole('button', { name: 'Expand sidebar' });
      await expect(expandBtn).toBeVisible();

      // Labels hidden in collapsed mode
      await expect(aside.getByText('student Workspace', { exact: true })).not.toBeVisible();

      // All 5 student icon links visible and have title/aria-label for tooltips
      const navLinks = aside.locator('nav a');
      await expect(navLinks).toHaveCount(5);

      const items = [
        { path: '/student/dashboard', name: 'Dashboard' },
        { path: '/student/catalog', name: 'My Assessments' },
        { path: '/student/certifications', name: 'My Certifications' },
        { path: '/student/submissions', name: 'Submissions' },
        { path: '/student/profile', name: 'Profile' },
      ];

      for (const item of items) {
        const link = aside.locator(`nav a[href="${item.path}"]`);
        await expect(link).toBeVisible();
        await expect(link).toHaveAttribute('title', item.name);
        await expect(link).toHaveAttribute('aria-label', item.name);
      }
    });

    test('3. Student navigating while collapsed maintains collapsed state and updates active highlight', async ({ page }) => {
      const aside = page.locator('aside');
      await aside.getByRole('button', { name: 'Collapse sidebar' }).click();
      await expect(aside).toHaveClass(/w-20/);

      // Navigate to catalog
      const catalogLink = aside.locator('nav a[href="/student/catalog"]');
      await catalogLink.click();
      await expect(page).toHaveURL(/\/student\/catalog/);

      // Sidebar remains collapsed
      await expect(aside).toHaveClass(/w-20/);

      // Catalog link is now active
      await expect(catalogLink).toHaveClass(/bg-brand-primary-light/);
      await expect(catalogLink).toHaveAttribute('aria-current', 'page');

      // Navigate to submissions
      const submissionsLink = aside.locator('nav a[href="/student/submissions"]');
      await submissionsLink.click();
      await expect(page).toHaveURL(/\/student\/submissions/);

      // Sidebar remains collapsed
      await expect(aside).toHaveClass(/w-20/);
      await expect(submissionsLink).toHaveClass(/bg-brand-primary-light/);
      await expect(submissionsLink).toHaveAttribute('aria-current', 'page');
    });

    test('4. Student collapse state persists in localStorage across page reload', async ({ page }) => {
      const aside = page.locator('aside');
      await aside.getByRole('button', { name: 'Collapse sidebar' }).click();
      await expect(aside).toHaveClass(/w-20/);

      const saved = await page.evaluate(() => localStorage.getItem('uap_student_sidebar_collapsed'));
      expect(saved).toBe('true');

      // Reload page
      await page.reload();
      await expect(page).toHaveURL(/\/student\/dashboard/);

      const reloadedAside = page.locator('aside');
      await expect(reloadedAside).toHaveClass(/w-20/);
      await expect(reloadedAside.getByRole('button', { name: 'Expand sidebar' })).toBeVisible();
    });
  });

  test.describe('Instructor Workspace — Collapsible Sidebar', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/auth/login');
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      await page.fill('#email', 'instructor@uap.edu');
      await page.fill('#password', 'Instructor@123');
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/\/instructor\/dashboard/);
      await expect(page.locator('aside')).toBeVisible({ timeout: 10000 });
    });

    test('5. Instructor sidebar is initially expanded with workspace title and full labels', async ({ page }) => {
      const aside = page.locator('aside');
      await expect(aside).toBeVisible();
      await expect(aside).toHaveClass(/w-64/);

      const hamburgerBtn = aside.getByRole('button', { name: 'Collapse sidebar' });
      await expect(hamburgerBtn).toBeVisible();

      await expect(aside.getByText('instructor Workspace', { exact: true })).toBeVisible();
      await expect(aside.locator('nav a', { hasText: 'Dashboard' })).toBeVisible();
      await expect(aside.locator('nav a', { hasText: 'My Assessments' })).toBeVisible();
      await expect(aside.locator('nav a', { hasText: 'Submissions & Grading' })).toBeVisible();
    });

    test('6. Instructor can collapse sidebar to icon-only narrow view and navigate between routes', async ({ page }) => {
      const aside = page.locator('aside');
      const hamburgerBtn = aside.getByRole('button', { name: 'Collapse sidebar' });
      await hamburgerBtn.click();
      await expect(aside).toHaveClass(/w-20/);

      // Verify collapsed links
      const assessmentsLink = aside.locator('nav a[href="/instructor/assessments"]');
      await expect(assessmentsLink).toBeVisible();
      await assessmentsLink.click();
      await expect(page).toHaveURL(/\/instructor\/assessments/);

      // Remains collapsed
      await expect(aside).toHaveClass(/w-20/);
      await expect(assessmentsLink).toHaveClass(/bg-brand-primary-light/);
      await expect(assessmentsLink).toHaveAttribute('aria-current', 'page');

      // Navigate to submissions queue
      const submissionsLink = aside.locator('nav a[href="/instructor/submissions"]');
      await submissionsLink.click();
      await expect(page).toHaveURL(/\/instructor\/submissions/);

      await expect(aside).toHaveClass(/w-20/);
      await expect(submissionsLink).toHaveClass(/bg-brand-primary-light/);
      await expect(submissionsLink).toHaveAttribute('aria-current', 'page');
    });

    test('7. Instructor collapse state persists in localStorage across page reload', async ({ page }) => {
      const aside = page.locator('aside');
      await aside.getByRole('button', { name: 'Collapse sidebar' }).click();
      await expect(aside).toHaveClass(/w-20/);

      const saved = await page.evaluate(() => localStorage.getItem('uap_instructor_sidebar_collapsed'));
      expect(saved).toBe('true');

      await page.reload();
      await expect(page).toHaveURL(/\/instructor\/dashboard/);

      const reloadedAside = page.locator('aside');
      await expect(reloadedAside).toHaveClass(/w-20/);
      await expect(reloadedAside.getByRole('button', { name: 'Expand sidebar' })).toBeVisible();
    });
  });

  test.describe('Admin Workspace Regression Verification', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/auth/login');
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      await page.fill('#email', 'admin@uap.edu');
      await page.fill('#password', 'Admin@123');
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/\/admin\/dashboard/);
      await expect(page.locator('aside')).toBeVisible({ timeout: 10000 });
    });

    test('8. Admin sidebar collapses, expands, and persists under uap_admin_sidebar_collapsed', async ({ page }) => {
      const aside = page.locator('aside');
      await expect(aside).toHaveClass(/w-64/);

      const hamburgerBtn = aside.getByRole('button', { name: 'Collapse sidebar' });
      await hamburgerBtn.click();
      await expect(aside).toHaveClass(/w-20/);

      const saved = await page.evaluate(() => localStorage.getItem('uap_admin_sidebar_collapsed'));
      expect(saved).toBe('true');

      // Expand
      const expandBtn = aside.getByRole('button', { name: 'Expand sidebar' });
      await expandBtn.click();
      await expect(aside).toHaveClass(/w-64/);

      const expandedSaved = await page.evaluate(() => localStorage.getItem('uap_admin_sidebar_collapsed'));
      expect(expandedSaved).toBe('false');
    });
  });
});
