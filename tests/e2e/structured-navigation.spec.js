const { test, expect } = require('@playwright/test');

test.describe('Phase 8D - Structured Dashboard Navigation E2E', () => {

  test.describe('Student Role - Structured Navigation & Active States', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/auth/login');
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      await page.fill('#email', 'student@uap.edu');
      await page.fill('#password', 'Student@123');
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/\/student\/dashboard/);
      await expect(page.locator('aside')).toBeVisible();
    });

    test('renders structured sections and preserves EdTech visual hierarchy', async ({ page }) => {
      const aside = page.locator('aside');
      await expect(aside.getByText('student Workspace', { exact: true })).toBeVisible();

      // Verify structured section headers exist
      await expect(aside.getByText('Workspace', { exact: true })).toBeVisible();
      await expect(aside.getByText('Academic Suite', { exact: true })).toBeVisible();
      await expect(aside.getByText('Account', { exact: true })).toBeVisible();

      // Verify all student links are present
      await expect(aside.locator('nav a', { hasText: 'Dashboard' })).toBeVisible();
      await expect(aside.locator('nav a', { hasText: 'Assessments' })).toBeVisible();
      await expect(aside.locator('nav a', { hasText: 'Submissions' })).toBeVisible();
      await expect(aside.locator('nav a', { hasText: 'Profile' })).toBeVisible();
    });

    test('supports collapsing and expanding navigation sections with ARIA attributes', async ({ page }) => {
      const academicBtn = page.locator('aside button#section-btn-student-academics');
      await expect(academicBtn).toBeVisible();
      await expect(academicBtn).toHaveAttribute('aria-expanded', 'true');

      // Click to collapse
      await academicBtn.click();
      await expect(academicBtn).toHaveAttribute('aria-expanded', 'false');
      await expect(page.locator('#section-student-academics')).not.toBeVisible();

      // Click to re-expand
      await academicBtn.click();
      await expect(academicBtn).toHaveAttribute('aria-expanded', 'true');
      await expect(page.locator('#section-student-academics')).toBeVisible();

      // Test keyboard interaction (Enter key)
      await academicBtn.focus();
      await page.keyboard.press('Enter');
      await expect(academicBtn).toHaveAttribute('aria-expanded', 'false');

      // Re-expand with Space key
      await page.keyboard.press('Space');
      await expect(academicBtn).toHaveAttribute('aria-expanded', 'true');
    });

    test('active route highlighting updates correctly on navigation and refresh', async ({ page }) => {
      const links = [
        { name: 'Assessments', path: '/student/catalog' },
        { name: 'Submissions', path: '/student/submissions' },
        { name: 'Profile', path: '/student/profile' },
        { name: 'Dashboard', path: '/student/dashboard' },
      ];

      for (const item of links) {
        const link = page.locator('aside nav a', { hasText: item.name });
        await link.click();
        await expect(page).toHaveURL(new RegExp(item.path));
        await expect(link).toHaveClass(/bg-brand-primary-light/);
        await expect(link).toHaveAttribute('aria-current', 'page');

        // Verify active state persists across full reload
        await page.reload();
        await expect(page).toHaveURL(new RegExp(item.path));
        const refreshedLink = page.locator('aside nav a', { hasText: item.name });
        await expect(refreshedLink).toHaveClass(/bg-brand-primary-light/);
        await expect(refreshedLink).toHaveAttribute('aria-current', 'page');
      }
    });

    test('dynamic/nested routes keep parent navigation item active', async ({ page }) => {
      // Direct navigation to attempt route
      await page.goto('/student/attempt/sample-assessment-id-123');

      // Assessments navigation item should remain highlighted
      const assessmentsLink = page.locator('aside nav a', { hasText: 'Assessments' });
      await expect(assessmentsLink).toBeVisible();
      await expect(assessmentsLink).toHaveClass(/bg-brand-primary-light/);
      await expect(assessmentsLink).toHaveAttribute('aria-current', 'page');
    });

    test('active child route auto-expands parent section even if collapsed', async ({ page }) => {
      const academicBtn = page.locator('aside button#section-btn-student-academics');
      await academicBtn.click();
      await expect(academicBtn).toHaveAttribute('aria-expanded', 'false');

      // Navigating to a child route inside that section will auto-expand it
      await page.goto('/student/catalog');
      await expect(academicBtn).toHaveAttribute('aria-expanded', 'true');
      const assessmentsLink = page.locator('aside nav a', { hasText: 'Assessments' });
      await expect(assessmentsLink).toBeVisible();
      await expect(assessmentsLink).toHaveClass(/bg-brand-primary-light/);
    });

    test('direct /student/assessments alias routes to catalog with Assessments active', async ({ page }) => {
      await page.goto('/student/assessments');
      await expect(page).toHaveURL(/\/student\/catalog/);
      const assessmentsLink = page.locator('aside nav a', { hasText: 'Assessments' });
      await expect(assessmentsLink).toBeVisible();
      await expect(assessmentsLink).toHaveClass(/bg-brand-primary-light/);
      await expect(assessmentsLink).toHaveAttribute('aria-current', 'page');
    });
  });

  test.describe('Instructor Role - Structured Navigation & Nested Flows', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/auth/login');
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      await page.fill('#email', 'instructor@uap.edu');
      await page.fill('#password', 'Instructor@123');
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/\/instructor\/dashboard/);
      await expect(page.locator('aside')).toBeVisible();
    });

    test('renders instructor structured sections accurately', async ({ page }) => {
      const aside = page.locator('aside');
      await expect(aside.getByText('instructor Workspace', { exact: true })).toBeVisible();

      // Check section titles
      await expect(aside.getByText('Workspace', { exact: true })).toBeVisible();
      await expect(aside.getByText('Assessments & Content', { exact: true })).toBeVisible();
      await expect(aside.getByText('Evaluation & Cohorts', { exact: true })).toBeVisible();
      await expect(aside.getByText('Account', { exact: true })).toBeVisible();

      // Check all items
      await expect(aside.locator('nav a', { hasText: 'Dashboard' })).toBeVisible();
      await expect(aside.locator('nav a', { hasText: 'My Assessments' })).toBeVisible();
      await expect(aside.locator('nav a', { hasText: 'Create Assessment' })).toBeVisible();
      await expect(aside.locator('nav a', { hasText: 'Question Bank' })).toBeVisible();
      await expect(aside.locator('nav a', { hasText: 'Import Questions' })).toBeVisible();
      await expect(aside.locator('nav a', { hasText: 'Submissions & Grading' })).toBeVisible();
      await expect(aside.locator('nav a', { hasText: 'Students' })).toBeVisible();
      await expect(aside.locator('nav a', { hasText: 'Profile' })).toBeVisible();
    });

    test('question-bank nested routes keep Question Bank active', async ({ page }) => {
      await page.goto('/instructor/question-bank/create');
      await expect(page.locator('aside')).toBeVisible();
      const qBankLink = page.locator('aside nav a', { hasText: 'Question Bank' });
      await expect(qBankLink).toHaveClass(/bg-brand-primary-light/);
    });

    test('assessment edit subroute keeps My Assessments active', async ({ page }) => {
      await page.goto('/instructor/assessments');
      await expect(page.locator('aside')).toBeVisible();
      const assessmentsLink = page.locator('aside nav a', { hasText: 'My Assessments' });
      await expect(assessmentsLink).toHaveClass(/bg-brand-primary-light/);

      // Navigate to create assessment
      const createLink = page.locator('aside nav a', { hasText: 'Create Assessment' });
      await createLink.click();
      await expect(page).toHaveURL(/\/instructor\/create/);
      await expect(createLink).toHaveClass(/bg-brand-primary-light/);
    });

    test('nested evaluation, analytics, question-bank edit, and import review keep parent navigation active', async ({ page }) => {
      // 1. Nested evaluation route
      await page.goto('/instructor/evaluate/sample-submission-id-123');
      await expect(page.locator('aside')).toBeVisible();
      const subsLink = page.locator('aside nav a', { hasText: 'Submissions & Grading' });
      await expect(subsLink).toHaveClass(/bg-brand-primary-light/);

      // 2. Nested analytics route
      await page.goto('/instructor/analytics/sample-assessment-id-123');
      await expect(page.locator('aside')).toBeVisible();
      const asmtLink = page.locator('aside nav a', { hasText: 'My Assessments' });
      await expect(asmtLink).toHaveClass(/bg-brand-primary-light/);

      // 3. Question bank edit route
      await page.goto('/instructor/question-bank/edit/sample-qb-id-123');
      await expect(page.locator('aside')).toBeVisible();
      const qbLink = page.locator('aside nav a', { hasText: 'Question Bank' });
      await expect(qbLink).toHaveClass(/bg-brand-primary-light/);

      // 4. Question import review route
      await page.goto('/instructor/question-import/review/sample-import-id-123');
      await expect(page.locator('aside')).toBeVisible();
      const impLink = page.locator('aside nav a', { hasText: 'Import Questions' });
      await expect(impLink).toHaveClass(/bg-brand-primary-light/);
    });

    test('instructor students and profile links route with active state', async ({ page }) => {
      const studentsLink = page.locator('aside nav a', { hasText: 'Students' });
      await studentsLink.click();
      await expect(page).toHaveURL(/\/instructor\/students/);
      await expect(studentsLink).toHaveClass(/bg-brand-primary-light/);

      const profileLink = page.locator('aside nav a', { hasText: 'Profile' });
      await profileLink.click();
      await expect(page).toHaveURL(/\/instructor\/profile/);
      await expect(profileLink).toHaveClass(/bg-brand-primary-light/);
    });
  });

  test.describe('Admin Role - Structured Navigation & Management Groups', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/auth/login');
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      await page.fill('#email', 'admin@uap.edu');
      await page.fill('#password', 'Admin@123');
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/\/admin\/dashboard/);
      await expect(page.locator('aside')).toBeVisible();
    });

    test('renders admin structured sections and administration items', async ({ page }) => {
      const aside = page.locator('aside');
      await expect(aside.getByText('admin Workspace', { exact: true })).toBeVisible();

      // Check section titles
      await expect(aside.getByText('Workspace', { exact: true })).toBeVisible();
      await expect(aside.getByText('Platform Administration', { exact: true })).toBeVisible();
      await expect(aside.getByText('Security & Governance', { exact: true })).toBeVisible();

      // Check all items
      await expect(aside.locator('nav a', { hasText: 'System Overview' })).toBeVisible();
      await expect(aside.locator('nav a', { hasText: 'User Management' })).toBeVisible();
      await expect(aside.locator('nav a', { hasText: 'All Assessments' })).toBeVisible();
      await expect(aside.locator('nav a', { hasText: 'Audit Logs' })).toBeVisible();
      await expect(aside.locator('nav a', { hasText: 'Settings' })).toBeVisible();
    });

    test('admin profile card routes smoothly without 404', async ({ page }) => {
      const profileCard = page.locator('aside div[title="View Academic Profile"]');
      await expect(profileCard).toBeVisible();
      await profileCard.click();

      // Should seamlessly navigate to settings
      await expect(page).toHaveURL(/\/admin\/settings/);
      const settingsLink = page.locator('aside nav a', { hasText: 'Settings' });
      await expect(settingsLink).toHaveClass(/bg-brand-primary-light/);
    });

    test('all admin navigation links update URL, active state, and maintain active state on refresh', async ({ page }) => {
      const adminLinks = [
        { name: 'User Management', path: '/admin/users' },
        { name: 'All Assessments', path: '/admin/assessments' },
        { name: 'Audit Logs', path: '/admin/logs' },
        { name: 'Settings', path: '/admin/settings' },
        { name: 'System Overview', path: '/admin/dashboard' },
      ];

      for (const item of adminLinks) {
        const link = page.locator('aside nav a', { hasText: item.name });
        await link.click();
        await expect(page).toHaveURL(new RegExp(item.path));
        await expect(link).toHaveClass(/bg-brand-primary-light/);
        await expect(link).toHaveAttribute('aria-current', 'page');

        await page.reload();
        await expect(page).toHaveURL(new RegExp(item.path));
        const refreshedLink = page.locator('aside nav a', { hasText: item.name });
        await expect(refreshedLink).toHaveClass(/bg-brand-primary-light/);
      }
    });
  });

  test.describe('Security & Role Boundary Enforcement', () => {
    test('student cannot see instructor/admin menu items and direct URLs are blocked', async ({ page }) => {
      await page.goto('/auth/login');
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      await page.fill('#email', 'student@uap.edu');
      await page.fill('#password', 'Student@123');
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/\/student\/dashboard/);

      // Verify no instructor or admin links are in sidebar
      const aside = page.locator('aside');
      await expect(aside.locator('nav a', { hasText: 'User Management' })).toHaveCount(0);
      await expect(aside.locator('nav a', { hasText: 'Audit Logs' })).toHaveCount(0);
      await expect(aside.locator('nav a', { hasText: 'Question Bank' })).toHaveCount(0);

      // Direct URL attempt to /admin/dashboard
      await page.goto('/admin/dashboard');
      await expect(page.getByText('Access Denied', { exact: false })).toBeVisible();

      // Direct URL attempt to /instructor/dashboard
      await page.goto('/instructor/dashboard');
      await expect(page.getByText('Access Denied', { exact: false })).toBeVisible();
    });

    test('instructor cannot see admin menu items and direct admin URLs are blocked', async ({ page }) => {
      await page.goto('/auth/login');
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      await page.fill('#email', 'instructor@uap.edu');
      await page.fill('#password', 'Instructor@123');
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/\/instructor\/dashboard/);

      const aside = page.locator('aside');
      await expect(aside.locator('nav a', { hasText: 'User Management' })).toHaveCount(0);
      await expect(aside.locator('nav a', { hasText: 'Audit Logs' })).toHaveCount(0);

      // Direct URL attempt to /admin/dashboard
      await page.goto('/admin/dashboard');
      await expect(page.getByText('Access Denied', { exact: false })).toBeVisible();
    });
  });

  test.describe('Responsive Navigation & Viewport Testing', () => {
    const desktopResolutions = [
      { width: 1366, height: 768, name: '1366x768 Laptop' },
      { width: 1440, height: 900, name: '1440x900 MacBook' },
      { width: 1536, height: 864, name: '1536x864 Desktop' },
      { width: 1920, height: 1080, name: '1920x1080 Full HD' },
    ];

    for (const res of desktopResolutions) {
      test(`desktop navigation layout renders without overflow on ${res.name}`, async ({ page }) => {
        await page.setViewportSize({ width: res.width, height: res.height });
        await page.goto('/auth/login');
        await page.evaluate(() => localStorage.clear());
        await page.reload();
        await page.fill('#email', 'instructor@uap.edu');
        await page.fill('#password', 'Instructor@123');
        await page.click('button[type="submit"]');
        await expect(page).toHaveURL(/\/instructor\/dashboard/);

        const sidebar = page.locator('aside');
        await expect(sidebar).toBeVisible();

        // Verify page body does not have unnecessary horizontal scroll
        const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
        const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
        expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2); // allowing minor subpixel rounding
      });
    }

    const mobileResolutions = [
      { width: 390, height: 844, name: '390x844 iPhone 13' },
      { width: 412, height: 915, name: '412x915 Pixel 7' },
      { width: 768, height: 1024, name: '768x1024 iPad Portrait' },
    ];

    for (const res of mobileResolutions) {
      test(`mobile drawer navigation functions on ${res.name}`, async ({ page }) => {
        await page.setViewportSize({ width: res.width, height: res.height });
        await page.goto('/auth/login');
        await page.evaluate(() => localStorage.clear());
        await page.reload();
        await page.fill('#email', 'student@uap.edu');
        await page.fill('#password', 'Student@123');
        await page.click('button[type="submit"]');
        await expect(page).toHaveURL(/\/student\/dashboard/);

        // Hamburger button should be visible
        const menuBtn = page.getByRole('button', { name: 'Open navigation menu' });
        await expect(menuBtn).toBeVisible();
        await menuBtn.click();

        // Drawer should open
        const drawer = page.locator('[role="dialog"][aria-label="Mobile Navigation Menu"]');
        await expect(drawer).toBeVisible();

        // Clicking a link navigates and closes drawer
        const catalogLink = drawer.locator('nav a', { hasText: 'Assessments' });
        await catalogLink.click();
        await expect(page).toHaveURL(/\/student\/catalog/);
        await expect(drawer).not.toBeVisible();

        // Reopen and test Escape key closes drawer
        await menuBtn.click();
        await expect(drawer).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(drawer).not.toBeVisible();
      });
    }

    test('backdrop overlay click closes mobile drawer', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/auth/login');
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      await page.fill('#email', 'student@uap.edu');
      await page.fill('#password', 'Student@123');
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/\/student\/dashboard/);

      const menuBtn = page.getByRole('button', { name: 'Open navigation menu' });
      await menuBtn.click();

      const drawer = page.locator('[role="dialog"][aria-label="Mobile Navigation Menu"]');
      await expect(drawer).toBeVisible();

      // Click the backdrop overlay outside the drawer panel
      await page.mouse.click(350, 200);
      await expect(drawer).not.toBeVisible();
    });
  });

  test.describe('Theme Mode Verification', () => {
    test('theme switcher applies dark theme styling to navigation and retains readability', async ({ page }) => {
      await page.goto('/auth/login');
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      await page.fill('#email', 'student@uap.edu');
      await page.fill('#password', 'Student@123');
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/\/student\/dashboard/);

      // Locate theme toggle button in header
      const themeToggle = page.getByRole('button', { name: /switch to dark theme/i });
      await expect(themeToggle).toBeVisible();
      await themeToggle.click();

      // HTML should have dark class
      await expect(page.locator('html')).toHaveClass(/dark/);

      // Verify active navigation item retains dark highlighting
      const dashboardLink = page.locator('aside nav a', { hasText: 'Dashboard' });
      await expect(dashboardLink).toHaveClass(/dark:bg-\[#341C16\]/);
      await expect(dashboardLink).toHaveClass(/dark:text-\[#F4A261\]/);

      // Switch back to light theme
      const lightToggle = page.getByRole('button', { name: /switch to light theme/i });
      await expect(lightToggle).toBeVisible();
      await lightToggle.click();
      await expect(page.locator('html')).not.toHaveClass(/dark/);
    });
  });

  test.describe('Keyboard & Accessibility Navigation', () => {
    test('focus indicators and keyboard navigation are operational on navigation elements', async ({ page }) => {
      await page.goto('/auth/login');
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      await page.fill('#email', 'student@uap.edu');
      await page.fill('#password', 'Student@123');
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/\/student\/dashboard/);

      // Focus first collapsible button
      const academicBtn = page.locator('aside button#section-btn-student-academics');
      await academicBtn.focus();
      await expect(academicBtn).toBeFocused();

      // Focus link and check focus ring
      const dashboardLink = page.locator('aside nav a', { hasText: 'Dashboard' });
      await dashboardLink.focus();
      await expect(dashboardLink).toBeFocused();
    });
  });

});
