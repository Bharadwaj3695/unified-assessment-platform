const { test, expect } = require('@playwright/test');

// 10 Specific Viewports covering Mobile, Phablet, Tablet, Laptop, and Large Desktop
const TARGET_VIEWPORTS = {
  phone320: { width: 320, height: 568 },
  phone360: { width: 360, height: 800 },
  phone390: { width: 390, height: 844 },
  phone430: { width: 430, height: 932 },
  tablet768: { width: 768, height: 1024 },
  tablet820: { width: 820, height: 1180 },
  laptop1024: { width: 1024, height: 768 },
  laptop1280: { width: 1280, height: 800 },
  desktop1440: { width: 1440, height: 900 },
  desktop1920: { width: 1920, height: 1080 },
};

// Helper: Assert zero horizontal overflow across document, body, and inner main container
async function checkNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const mainEl = document.querySelector('main');
    // Allow up to 1.5px tolerance for subpixel antialiasing/rounding
    const scrollW = Math.max(doc.scrollWidth, body.scrollWidth, mainEl ? mainEl.scrollWidth : 0);
    const clientW = window.innerWidth;
    return {
      scrollWidth: scrollW,
      clientWidth: clientW,
      hasOverflow: scrollW > clientW + 1.5,
    };
  });
  expect(overflow.hasOverflow, `Page has horizontal overflow: scrollWidth (${overflow.scrollWidth}px) > viewport width (${overflow.clientWidth}px)`).toBe(false);
}

// Helper: Assert header controls do not bleed past the right viewport boundary
async function checkHeaderWithinViewport(page, viewportWidth) {
  const headerRight = page.locator('header').locator('div.flex.items-center').last();
  if (await headerRight.isVisible()) {
    const box = await headerRight.boundingBox();
    if (box) {
      expect(box.x + box.width).toBeLessThanOrEqual(viewportWidth + 2);
    }
  }
}

test.describe('UAP Enterprise Responsive Layout & Adaptive Viewport Suite', () => {

  // =========================================================================
  // 1. Unauthenticated & Authentication Pages Viewport Responsiveness
  // =========================================================================
  test.describe('1. Authentication Pages Across 10 Target Viewports', () => {
    for (const [name, viewport] of Object.entries(TARGET_VIEWPORTS)) {
      test(`Login page at ${name} (${viewport.width}x${viewport.height}) has zero horizontal overflow`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await page.goto('/auth/login');
        await expect(page.locator('button[type="submit"]')).toBeVisible({ timeout: 10000 });
        await checkNoHorizontalOverflow(page);
      });
    }

    test('MFA Setup & Verification responsive container at 320px', async ({ page }) => {
      await page.setViewportSize(TARGET_VIEWPORTS.phone320);
      await page.goto('/auth/mfa-verify');
      await page.waitForLoadState('domcontentloaded');
      await checkNoHorizontalOverflow(page);
    });
  });

  // =========================================================================
  // 2. Student Workspace Across All 10 Target Viewports
  // =========================================================================
  test.describe('2. Student Workspace Across 10 Target Viewports', () => {
    for (const [name, viewport] of Object.entries(TARGET_VIEWPORTS)) {
      test(`Student Dashboard & Header at ${name} (${viewport.width}x${viewport.height})`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await page.goto('/auth/login');
        await page.evaluate(() => localStorage.clear());
        await page.reload();
        await page.fill('#email', 'student@uap.edu');
        await page.fill('#password', 'Student@123');
        await page.click('button[type="submit"]');
        await expect(page).toHaveURL(/\/student\/dashboard/);
        await page.waitForLoadState('networkidle');

        // Verify zero horizontal overflow on Dashboard
        await checkNoHorizontalOverflow(page);

        // Verify header controls stay strictly within viewport
        await checkHeaderWithinViewport(page, viewport.width);

        // Sidebar behavior based on breakpoint
        if (viewport.width < 1024) {
          // On mobile & tablet, desktop aside should be hidden
          const aside = page.locator('aside');
          await expect(aside).toHaveClass(/hidden/);

          // Hamburger button must be visible in header
          const hamburger = page.locator('header button[aria-label="Open navigation menu"]');
          await expect(hamburger).toBeVisible();

          // Open Mobile Drawer
          await hamburger.click();
          const drawer = page.locator('div[role="dialog"]');
          await expect(drawer).toBeVisible();

          // Drawer navigation works cleanly
          const catalogLink = drawer.locator('nav a', { hasText: 'Assessments' });
          await expect(catalogLink).toBeVisible();
          await catalogLink.click();
          await expect(page).toHaveURL(/\/student\/catalog/);
          await checkNoHorizontalOverflow(page);
        } else {
          // On laptop & desktop, desktop aside is visible
          const aside = page.locator('aside');
          await expect(aside).toBeVisible();
        }
      });
    }

    test('Student Notification Popover fits 320px mobile viewport without clipping', async ({ page }) => {
      await page.setViewportSize(TARGET_VIEWPORTS.phone320);
      await page.goto('/auth/login');
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      await page.fill('#email', 'student@uap.edu');
      await page.fill('#password', 'Student@123');
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/\/student\/dashboard/);

      // Click notification bell
      const bell = page.locator('header button[aria-label="Notifications"]');
      await expect(bell).toBeVisible();
      await bell.click();

      // Notification popover dropdown appears
      const popover = page.locator('header').locator('text=Notifications').locator('xpath=ancestor::div[contains(@class, "rounded-2xl")]');
      await expect(popover).toBeVisible();

      // Verify popover stays strictly within mobile viewport boundaries
      const box = await popover.boundingBox();
      expect(box).not.toBeNull();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(TARGET_VIEWPORTS.phone320.width + 2);

      // Popover should not cause horizontal page overflow
      await checkNoHorizontalOverflow(page);
    });

    test('Student Modal fits 320px mobile viewport with scrollable content', async ({ page }) => {
      await page.setViewportSize(TARGET_VIEWPORTS.phone320);
      await page.goto('/auth/login');
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      await page.fill('#email', 'student@uap.edu');
      await page.fill('#password', 'Student@123');
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/\/student\/dashboard/);

      // Check for available assessment cards or instructions modal
      const viewDetailsBtn = page.locator('button', { hasText: /Start|Resume|View Details/i }).first();
      if (await viewDetailsBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await viewDetailsBtn.click();
        const modal = page.locator('div[role="dialog"]');
        if (await modal.isVisible({ timeout: 3000 }).catch(() => false)) {
          const modalBox = await modal.boundingBox();
          expect(modalBox).not.toBeNull();
          expect(modalBox.width).toBeLessThanOrEqual(TARGET_VIEWPORTS.phone320.width);

          // Close modal
          const closeBtn = modal.locator('button[aria-label="Close modal"]');
          if (await closeBtn.isVisible()) {
            await closeBtn.click();
            await expect(modal).not.toBeVisible();
          }
        }
      }
      await checkNoHorizontalOverflow(page);
    });
  });

  // =========================================================================
  // 3. Instructor Workspace Across Viewports
  // =========================================================================
  test.describe('3. Instructor Workspace Across Target Viewports', () => {
    const representativeViewports = {
      phone320: TARGET_VIEWPORTS.phone320,
      phone390: TARGET_VIEWPORTS.phone390,
      tablet768: TARGET_VIEWPORTS.tablet768,
      laptop1280: TARGET_VIEWPORTS.laptop1280,
      desktop1920: TARGET_VIEWPORTS.desktop1920,
    };

    for (const [name, viewport] of Object.entries(representativeViewports)) {
      test(`Instructor Dashboard & Assessments at ${name} (${viewport.width}x${viewport.height})`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await page.goto('/auth/login');
        await page.evaluate(() => localStorage.clear());
        await page.reload();
        await page.fill('#email', 'instructor@uap.edu');
        await page.fill('#password', 'Instructor@123');
        await page.click('button[type="submit"]');
        await expect(page).toHaveURL(/\/instructor\/dashboard/);
        await page.waitForLoadState('networkidle');

        // Check horizontal overflow on Instructor Dashboard
        await checkNoHorizontalOverflow(page);
        await checkHeaderWithinViewport(page, viewport.width);

        // Navigate to assessments list
        await page.goto('/instructor/assessments');
        await page.waitForLoadState('networkidle');
        await checkNoHorizontalOverflow(page);

        // Navigate to question bank
        await page.goto('/instructor/question-bank');
        await page.waitForLoadState('networkidle');
        await checkNoHorizontalOverflow(page);
      });
    }

    test('Instructor Assessment Builder layout at 320px and 1920px', async ({ page }) => {
      await page.setViewportSize(TARGET_VIEWPORTS.desktop1920);
      await page.goto('/auth/login');
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      await page.fill('#email', 'instructor@uap.edu');
      await page.fill('#password', 'Instructor@123');
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/\/instructor\/dashboard/);

      await page.goto('/instructor/builder');
      await page.waitForLoadState('networkidle');
      await checkNoHorizontalOverflow(page);

      // Adapt to ultra-narrow 320px
      await page.setViewportSize(TARGET_VIEWPORTS.phone320);
      await page.waitForTimeout(300);
      await checkNoHorizontalOverflow(page);
    });
  });

  // =========================================================================
  // 4. Admin Workspace Across Viewports & Dropdown Positioning
  // =========================================================================
  test.describe('4. Admin Workspace Across Target Viewports', () => {
    const representativeViewports = {
      phone320: TARGET_VIEWPORTS.phone320,
      phone390: TARGET_VIEWPORTS.phone390,
      tablet768: TARGET_VIEWPORTS.tablet768,
      laptop1280: TARGET_VIEWPORTS.laptop1280,
      desktop1920: TARGET_VIEWPORTS.desktop1920,
    };

    for (const [name, viewport] of Object.entries(representativeViewports)) {
      test(`Admin Dashboard & Users at ${name} (${viewport.width}x${viewport.height})`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await page.goto('/auth/login');
        await page.evaluate(() => localStorage.clear());
        await page.reload();
        await page.fill('#email', 'admin@uap.edu');
        await page.fill('#password', 'Admin@123');
        await page.click('button[type="submit"]');
        await expect(page).toHaveURL(/\/admin\/dashboard/);
        await page.waitForLoadState('networkidle');

        // Verify no horizontal overflow on admin overview
        await checkNoHorizontalOverflow(page);
        await checkHeaderWithinViewport(page, viewport.width);

        // Switch to users tab
        const usersTab = page.locator('button', { hasText: 'User Management' }).first();
        if (await usersTab.isVisible()) {
          await usersTab.click();
          await page.waitForTimeout(500);
          await checkNoHorizontalOverflow(page);
        }
      });
    }

    test('Admin Profile Dropdown Menu fits within 320px mobile viewport without bleed', async ({ page }) => {
      await page.setViewportSize(TARGET_VIEWPORTS.phone320);
      await page.goto('/auth/login');
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      await page.fill('#email', 'admin@uap.edu');
      await page.fill('#password', 'Admin@123');
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/\/admin\/dashboard/);

      // Click Admin Profile button
      const profileBtn = page.locator('header button[aria-label="Admin Profile and System Menu"], header button[aria-haspopup="menu"]').first();
      await expect(profileBtn).toBeVisible();
      await profileBtn.click();

      // Locate open dropdown menu
      const menu = page.locator('div[role="menu"]');
      await expect(menu).toBeVisible();

      // Check menu bounding box strictly inside 320px
      const menuBox = await menu.boundingBox();
      expect(menuBox).not.toBeNull();
      expect(menuBox.x).toBeGreaterThanOrEqual(0);
      expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(TARGET_VIEWPORTS.phone320.width + 2);

      // Verify no horizontal page overflow
      await checkNoHorizontalOverflow(page);
    });

    test('Admin Dashboard tab bar scrolls smoothly on mobile without clipping', async ({ page }) => {
      await page.setViewportSize(TARGET_VIEWPORTS.phone390);
      await page.goto('/auth/login');
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      await page.fill('#email', 'admin@uap.edu');
      await page.fill('#password', 'Admin@123');
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/\/admin\/dashboard/);

      // Check tab container overflow
      const tabContainer = page.locator('.overflow-x-auto').first();
      await expect(tabContainer).toBeVisible();

      // Ensure all tabs exist and can be clicked
      const settingsTab = page.locator('button', { hasText: 'System Settings' });
      await expect(settingsTab).toBeVisible();
      await settingsTab.click();
      await page.waitForTimeout(300);
      await checkNoHorizontalOverflow(page);
    });
  });

  // =========================================================================
  // 5. Browser Zoom Suite (100%, 125%, 150%, 200%)
  // =========================================================================
  test.describe('5. Browser Zoom Responsiveness (100%, 125%, 150%, 200%)', () => {
    // Zoom levels mapped to their effective viewport widths from a 1280px desktop base
    const zoomCases = [
      { level: '100%', zoom: 1.0, effectiveWidth: 1280, height: 800 },
      { level: '125%', zoom: 1.25, effectiveWidth: 1024, height: 800 },
      { level: '150%', zoom: 1.5, effectiveWidth: 853, height: 800 },
      { level: '200%', zoom: 2.0, effectiveWidth: 640, height: 800 },
    ];

    for (const zc of zoomCases) {
      test(`Student Dashboard at ${zc.level} zoom (effective ${zc.effectiveWidth}x${zc.height}) has zero overflow`, async ({ page }) => {
        await page.setViewportSize({ width: zc.effectiveWidth, height: zc.height });
        await page.goto('/auth/login');
        await page.evaluate(() => localStorage.clear());
        await page.reload();
        await page.fill('#email', 'student@uap.edu');
        await page.fill('#password', 'Student@123');
        await page.click('button[type="submit"]');
        await expect(page).toHaveURL(/\/student\/dashboard/);
        await page.waitForLoadState('networkidle');

        // Apply CSS zoom emulation
        await page.evaluate((z) => {
          document.body.style.zoom = `${z}`;
        }, zc.zoom);
        await page.waitForTimeout(300);

        // Verify zero horizontal overflow
        await checkNoHorizontalOverflow(page);
        await checkHeaderWithinViewport(page, zc.effectiveWidth);
      });
    }
  });

});
