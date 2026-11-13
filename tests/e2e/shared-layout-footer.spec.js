const { test, expect } = require('@playwright/test');

const VIEWPORTS = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 768, height: 1024 },
  laptop: { width: 1366, height: 768 },
  desktop: { width: 1920, height: 1080 },
};

async function checkNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: window.innerWidth,
      hasOverflow: doc.scrollWidth > window.innerWidth + 1,
    };
  });
  expect(
    overflow.hasOverflow,
    `Page has horizontal overflow: scrollWidth (${overflow.scrollWidth}px) > viewport width (${overflow.clientWidth}px)`
  ).toBe(false);
}

test.describe('UAP Shared Layout & Footer Architecture Suite', () => {

  // 1. PUBLIC LANDING PAGE
  test.describe('1. Public Landing Page — Marketing Footer Preservation', () => {
    test('Public home page displays marketing footer with all columns and operational status', async ({ page }) => {
      const consoleErrors = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // The marketing footer must be present and visible
      const marketingFooter = page.locator('[data-testid="marketing-footer"]');
      await expect(marketingFooter).toBeVisible();

      // Check key marketing footer elements:
      // A. Operational status badge
      await expect(marketingFooter.getByText('All Evaluation Services Operational')).toBeVisible();

      // B. Platform column
      await expect(marketingFooter.getByRole('heading', { name: 'Platform' })).toBeVisible();
      await expect(marketingFooter.getByRole('link', { name: 'Question Bank' })).toBeVisible();

      // C. Workspaces column
      await expect(marketingFooter.getByRole('heading', { name: 'Workspaces' })).toBeVisible();
      await expect(marketingFooter.getByRole('link', { name: 'Student Portal' })).toBeVisible();

      // D. Institutional Trust column
      await expect(marketingFooter.getByRole('heading', { name: 'Institutional Trust' })).toBeVisible();
      await expect(marketingFooter.getByText('Role-Based Access')).toBeVisible();

      // E. Bottom copyright bar
      await expect(marketingFooter.getByText(/Unified Assessment Platform \(UAP\)\. All rights reserved\./)).toBeVisible();
      await expect(marketingFooter.getByText('Production Grade')).toBeVisible();

      // F. Exactly one footer rendered on public landing page
      const footers = page.locator('footer');
      await expect(footers).toHaveCount(1);

      // Verify no horizontal overflow
      await checkNoHorizontalOverflow(page);
    });

    test('Public landing page marketing footer is responsive across viewports', async ({ page }) => {
      for (const [name, viewport] of Object.entries(VIEWPORTS)) {
        await page.setViewportSize(viewport);
        await page.goto('/');
        await expect(page.locator('[data-testid="marketing-footer"]')).toBeVisible();
        await checkNoHorizontalOverflow(page);
      }
    });
  });

  // 2. STUDENT WORKSPACE
  test.describe('2. Student Workspace — Compact Footer & No Marketing Footer', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/auth/login');
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      await page.fill('#email', 'student@uap.edu');
      await page.fill('#password', 'Student@123');
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/\/student\/dashboard/);
      await page.waitForLoadState('networkidle');
    });

    const studentRoutes = [
      { path: '/student/dashboard', name: 'Dashboard' },
      { path: '/student/catalog', name: 'Catalog' },
      { path: '/student/submissions', name: 'Submissions' },
      { path: '/student/profile', name: 'Profile' },
    ];

    for (const route of studentRoutes) {
      test(`Student ${route.name} (${route.path}) has compact footer and NO marketing footer`, async ({ page }) => {
        await page.goto(route.path);
        await page.waitForLoadState('networkidle');

        // Marketing footer must NOT exist anywhere in DOM
        await expect(page.locator('[data-testid="marketing-footer"]')).toHaveCount(0);
        await expect(page.getByText('All Evaluation Services Operational')).toHaveCount(0);
        await expect(page.getByRole('heading', { name: 'Institutional Trust' })).toHaveCount(0);

        // Compact app footer MUST be visible
        const appFooter = page.locator('[data-testid="app-footer"]');
        await expect(appFooter).toBeVisible();
        await expect(appFooter.getByText(/Unified Assessment Platform \(UAP\)\. All rights reserved\./)).toBeVisible();
        await expect(appFooter.getByText('Production Grade')).toBeVisible();

        // Exactly one footer rendered on page
        await expect(page.locator('footer')).toHaveCount(1);

        // Header is at top: 0
        const header = page.locator('header');
        await expect(header).toBeVisible();
        const headerBox = await header.boundingBox();
        expect(headerBox.y).toBe(0);

        // Footer is pinned at bottom of viewport
        const footerBox = await appFooter.boundingBox();
        const viewport = page.viewportSize();
        expect(Math.abs(footerBox.y + footerBox.height - viewport.height)).toBeLessThanOrEqual(2);

        // Check horizontal overflow
        await checkNoHorizontalOverflow(page);
      });
    }

    test('Student layout footer rests at bottom on short content without overlapping sidebar', async ({ page }) => {
      await page.goto('/student/profile');
      await page.waitForLoadState('networkidle');

      const appFooter = page.locator('[data-testid="app-footer"]');
      await expect(appFooter).toBeVisible();

      // Header is at top: 0
      const headerBox = await page.locator('header').boundingBox();
      expect(headerBox.y).toBe(0);

      // Verify footer is at the bottom of the viewport
      const viewport = page.viewportSize();
      const footerBox = await appFooter.boundingBox();
      expect(footerBox).not.toBeNull();
      expect(Math.abs(footerBox.y + footerBox.height - viewport.height)).toBeLessThanOrEqual(2);

      // Verify footer does NOT overlap the sidebar
      const asideBox = await page.locator('aside').boundingBox();
      if (asideBox) {
        expect(footerBox.x).toBeGreaterThanOrEqual(asideBox.x + asideBox.width - 1);
      }
    });

    test('Student sidebar navigation and sign out work smoothly', async ({ page }) => {
      // Sidebar desktop navigation
      const aside = page.locator('aside');
      await expect(aside).toBeVisible();
      await aside.locator('nav a', { hasText: 'Assessments' }).click();
      await expect(page).toHaveURL(/\/student\/catalog/);

      // Verify profile card exists in sidebar
      await expect(aside.getByText(/Alex Johnson|Student User/i)).toBeVisible();

      // Sign out via sidebar logout button
      const logoutBtn = aside.locator('button', { hasText: 'Sign Out' });
      await expect(logoutBtn).toBeVisible();
      await logoutBtn.click();
      await expect(page).toHaveURL(/\/auth\/login/);
    });
  });

  // 3. INSTRUCTOR WORKSPACE
  test.describe('3. Instructor Workspace — Compact Footer & No Marketing Footer', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/auth/login');
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      await page.fill('#email', 'instructor@uap.edu');
      await page.fill('#password', 'Instructor@123');
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/\/instructor\/dashboard/);
      await page.waitForLoadState('networkidle');
    });

    const instructorRoutes = [
      { path: '/instructor/dashboard', name: 'Dashboard' },
      { path: '/instructor/assessments', name: 'Assessments' },
      { path: '/instructor/question-bank', name: 'Question Bank' },
      { path: '/instructor/profile', name: 'Profile' },
    ];

    for (const route of instructorRoutes) {
      test(`Instructor ${route.name} (${route.path}) has compact footer and NO marketing footer`, async ({ page }) => {
        await page.goto(route.path);
        await page.waitForLoadState('networkidle');

        // Marketing footer must NOT exist
        await expect(page.locator('[data-testid="marketing-footer"]')).toHaveCount(0);
        await expect(page.getByText('All Evaluation Services Operational')).toHaveCount(0);

        // Compact app footer MUST be visible
        const appFooter = page.locator('[data-testid="app-footer"]');
        await expect(appFooter).toBeVisible();
        await expect(appFooter.getByText(/Unified Assessment Platform \(UAP\)\. All rights reserved\./)).toBeVisible();
        await expect(appFooter.getByText('Production Grade')).toBeVisible();

        // Exactly one footer rendered on page
        await expect(page.locator('footer')).toHaveCount(1);

        // Header is at top: 0
        const header = page.locator('header');
        await expect(header).toBeVisible();
        const headerBox = await header.boundingBox();
        expect(headerBox.y).toBe(0);

        // Footer is at bottom: 0 of viewport
        const footerBox = await appFooter.boundingBox();
        const viewport = page.viewportSize();
        expect(Math.abs(footerBox.y + footerBox.height - viewport.height)).toBeLessThanOrEqual(2);

        await checkNoHorizontalOverflow(page);
      });
    }

    test('Instructor layout: header and footer remain stationary while main content scrolls on long pages', async ({ page }) => {
      await page.goto('/instructor/dashboard');
      await page.waitForLoadState('networkidle');

      const header = page.locator('header');
      const appFooter = page.locator('[data-testid="app-footer"]');
      const main = page.locator('main');

      await expect(header).toBeVisible();
      await expect(appFooter).toBeVisible();

      const initialHeaderBox = await header.boundingBox();
      const initialFooterBox = await appFooter.boundingBox();

      // Scroll main to bottom or by 300px
      await main.evaluate((el) => {
        el.scrollTop = 300;
      });

      // Verify header and footer did not move
      const scrolledHeaderBox = await header.boundingBox();
      const scrolledFooterBox = await appFooter.boundingBox();

      expect(scrolledHeaderBox.y).toBe(initialHeaderBox.y);
      expect(scrolledFooterBox.y).toBe(initialFooterBox.y);

      // Verify footer is still visible in viewport
      await expect(appFooter).toBeInViewport();
      await expect(header).toBeInViewport();
    });
  });

  // 4. ADMIN WORKSPACE
  test.describe('4. Admin Workspace — Compact Footer & No Marketing Footer', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/auth/login');
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      await page.fill('#email', 'admin@uap.edu');
      await page.fill('#password', 'Admin@123');
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/\/admin\/dashboard/);
      await page.waitForLoadState('networkidle');
    });

    const adminRoutes = [
      { path: '/admin/dashboard', name: 'Dashboard' },
      { path: '/admin/student-registry', name: 'Student Registry' },
      { path: '/admin/faculty-registry', name: 'Faculty Registry' },
      { path: '/admin/profile', name: 'Profile' },
    ];

    for (const route of adminRoutes) {
      test(`Admin ${route.name} (${route.path}) has compact footer and NO marketing footer`, async ({ page }) => {
        await page.goto(route.path);
        await page.waitForLoadState('networkidle');

        // Marketing footer must NOT exist
        await expect(page.locator('[data-testid="marketing-footer"]')).toHaveCount(0);
        await expect(page.getByText('All Evaluation Services Operational')).toHaveCount(0);

        // Compact app footer MUST be visible
        const appFooter = page.locator('[data-testid="app-footer"]');
        await expect(appFooter).toBeVisible();
        await expect(appFooter.getByText(/Unified Assessment Platform \(UAP\)\. All rights reserved\./)).toBeVisible();
        await expect(appFooter.getByText('Production Grade')).toBeVisible();

        // Exactly one footer rendered on page
        await expect(page.locator('footer')).toHaveCount(1);

        // Header is at top: 0
        const header = page.locator('header');
        await expect(header).toBeVisible();
        const headerBox = await header.boundingBox();
        expect(headerBox.y).toBe(0);

        // Footer is at bottom: 0 of viewport
        const footerBox = await appFooter.boundingBox();
        const viewport = page.viewportSize();
        expect(Math.abs(footerBox.y + footerBox.height - viewport.height)).toBeLessThanOrEqual(2);

        await checkNoHorizontalOverflow(page);
      });
    }

    test('Admin workspace responsive viewports with compact footer', async ({ page }) => {
      for (const [name, viewport] of Object.entries(VIEWPORTS)) {
        await page.setViewportSize(viewport);
        await page.goto('/admin/dashboard');
        await page.waitForLoadState('networkidle');

        await expect(page.locator('[data-testid="marketing-footer"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="app-footer"]')).toBeVisible();
        await checkNoHorizontalOverflow(page);

        // Verify mobile drawer on smaller viewports
        if (viewport.width < 1024) {
          const hamburger = page.locator('header button[aria-label="Open navigation menu"]');
          await expect(hamburger).toBeVisible();
          await hamburger.click();
          const drawer = page.locator('div[role="dialog"]');
          await expect(drawer).toBeVisible();
          // Close drawer
          const closeBtn = drawer.locator('button[aria-label="Close navigation menu"]');
          if (await closeBtn.isVisible()) {
            await closeBtn.click();
          }
        }
      }
    });

    test('Admin dashboard at 200% zoom maintains fixed header, fixed footer, and no horizontal overflow', async ({ page }) => {
      // 200% zoom on standard 1366x768 laptop viewport is equivalent to 683x384 CSS viewport with deviceScaleFactor: 2
      await page.setViewportSize({ width: 683, height: 384 });
      await page.goto('/admin/dashboard');
      await page.waitForLoadState('networkidle');

      const header = page.locator('header');
      const appFooter = page.locator('[data-testid="app-footer"]');
      const main = page.locator('main');

      await expect(header).toBeVisible();
      await expect(appFooter).toBeVisible();
      await expect(main).toBeVisible();

      // Header remains fixed at top: 0
      const headerBox = await header.boundingBox();
      expect(headerBox.y).toBe(0);

      // Footer remains fixed at bottom: 0 of the viewport
      const footerBox = await appFooter.boundingBox();
      expect(Math.abs(footerBox.y + footerBox.height - 384)).toBeLessThanOrEqual(2);

      // No horizontal overflow at 200% zoom
      await checkNoHorizontalOverflow(page);
    });
  });

});

