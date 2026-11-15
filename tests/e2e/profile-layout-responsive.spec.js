const { test, expect } = require('@playwright/test');

const TARGET_VIEWPORTS = [
  { name: 'mobile-320', width: 320, height: 600 },
  { name: 'mobile-375', width: 375, height: 667 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'laptop-1024', width: 1024, height: 768 },
  { name: 'desktop-1366', width: 1366, height: 768 },
  { name: 'desktop-1920', width: 1920, height: 1080 },
];

async function checkNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const mainEl = document.querySelector('main');
    const scrollW = Math.max(doc.scrollWidth, body.scrollWidth, mainEl ? mainEl.scrollWidth : 0);
    const clientW = window.innerWidth;
    return {
      scrollWidth: scrollW,
      clientWidth: clientW,
      hasOverflow: scrollW > clientW + 1.5,
    };
  });
  expect(overflow.hasOverflow, `Horizontal overflow detected: scrollWidth (${overflow.scrollWidth}px) > viewport width (${overflow.clientWidth}px)`).toBe(false);
}

test.describe('Profile Layout Refinement & Viewport Responsiveness Suite', () => {

  // -------------------------------------------------------------------------
  // 1. Student Profile Layout & Responsive Verification
  // -------------------------------------------------------------------------
  test('1. Student Profile layout and responsive behavior across all target viewports (320px - 1920px, 200% zoom)', async ({ page }) => {
    await page.goto('/auth/login');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.fill('#email', 'student@uap.edu');
    await page.fill('#password', 'Student@123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/student\/dashboard/);

    await page.goto('/student/profile');
    await expect(page.getByText('Student Academic Profile')).toBeVisible({ timeout: 15000 });

    for (const vp of TARGET_VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(200);

      // Verify zero horizontal overflow
      await checkNoHorizontalOverflow(page);

      // Header positioned cleanly at the top without clipping
      const headerEl = page.getByRole('heading', { name: 'Student Academic Profile' });
      await expect(headerEl).toBeVisible();
      const headerBox = await headerEl.boundingBox();
      expect(headerBox.y).toBeGreaterThanOrEqual(0);

      // Identity & Student ID Card
      await expect(page.locator('main').getByRole('heading', { name: 'Alex Johnson' })).toBeVisible();
      await expect(page.locator('main').getByText('STU-2026-001')).toBeVisible();

      // Academic Summary Card with milestone checklist
      await expect(page.getByRole('heading', { name: 'Academic Summary' })).toBeVisible();
      await expect(page.getByText('Enrolled Degree Candidate')).toBeVisible();

      // Institutional Information Form & Dedicated Profile Photo Section
      await expect(page.getByRole('heading', { name: 'Institutional Information' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Profile Photo' })).toBeVisible();

      // Save Profile Changes button within viewport bounds
      const saveBtn = page.getByRole('button', { name: 'Save Profile Changes' });
      await expect(saveBtn).toBeVisible();
      const saveBox = await saveBtn.boundingBox();
      expect(saveBox.x + saveBox.width).toBeLessThanOrEqual(vp.width + 5);

      // Two-Factor Authentication Section
      await expect(page.getByRole('heading', { name: 'Two-Factor Authentication (2FA)' })).toBeVisible();
    }

    // Emulate 200% browser zoom
    await page.setViewportSize({ width: 640, height: 800 });
    await page.evaluate(() => {
      document.body.style.zoom = '2.0';
    });
    await page.waitForTimeout(300);
    await checkNoHorizontalOverflow(page);
    await page.evaluate(() => {
      document.body.style.zoom = '1.0';
    });
  });

  // -------------------------------------------------------------------------
  // 2. Instructor Profile Layout & Responsive Verification
  // -------------------------------------------------------------------------
  test('2. Instructor Profile layout and responsive behavior across all target viewports (320px - 1920px, 200% zoom)', async ({ page }) => {
    await page.goto('/auth/login');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.fill('#email', 'instructor@uap.edu');
    await page.fill('#password', 'Instructor@123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/instructor\/dashboard/);

    await page.goto('/instructor/profile');
    await expect(page.getByText('Faculty Academic Profile')).toBeVisible({ timeout: 15000 });

    for (const vp of TARGET_VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(200);

      // Verify zero horizontal overflow
      await checkNoHorizontalOverflow(page);

      // Header not clipped at top
      const headerEl = page.getByRole('heading', { name: 'Faculty Academic Profile' });
      await expect(headerEl).toBeVisible();
      const headerBox = await headerEl.boundingBox();
      expect(headerBox.y).toBeGreaterThanOrEqual(0);

      // Faculty Identity & Permanent ID
      await expect(page.locator('main').getByRole('heading', { name: 'Prof. Alan Turing' })).toBeVisible();
      await expect(page.locator('main').getByText('FAC-2026-001')).toBeVisible();

      // Subject Portfolio card & Faculty Examiner authority checklist
      await expect(page.getByRole('heading', { name: 'Subject Portfolio' })).toBeVisible();
      await expect(page.getByText('Verified Faculty Examiner')).toBeVisible();

      // Faculty Details Form & Dedicated Profile Photo Section
      await expect(page.getByRole('heading', { name: 'Faculty Details & Academic Curriculum' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Profile Photo' })).toBeVisible();

      // Save Changes button aligned with form content
      const saveBtn = page.getByRole('button', { name: 'Save Changes' });
      await expect(saveBtn).toBeVisible();
      const saveBox = await saveBtn.boundingBox();
      expect(saveBox.x + saveBox.width).toBeLessThanOrEqual(vp.width + 5);

      // Two-Factor Authentication Section
      await expect(page.getByRole('heading', { name: 'Two-Factor Authentication (2FA)' })).toBeVisible();
    }

    // Emulate 200% browser zoom
    await page.setViewportSize({ width: 640, height: 800 });
    await page.evaluate(() => {
      document.body.style.zoom = '2.0';
    });
    await page.waitForTimeout(300);
    await checkNoHorizontalOverflow(page);
    await page.evaluate(() => {
      document.body.style.zoom = '1.0';
    });
  });

  // -------------------------------------------------------------------------
  // 3. Admin Profile Regression Safeguards
  // -------------------------------------------------------------------------
  test('3. Admin Profile regression safeguards across all target viewports (320px - 1920px)', async ({ page }) => {
    await page.goto('/auth/login');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.fill('#email', 'admin@uap.edu');
    await page.fill('#password', 'Admin@123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/admin\/dashboard/);

    await page.goto('/admin/profile');
    await expect(page.getByText('Administrator Profile')).toBeVisible({ timeout: 15000 });

    for (const vp of TARGET_VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(200);

      // Verify zero horizontal overflow
      await checkNoHorizontalOverflow(page);

      // Administrative Authority Card
      await expect(page.locator('main').getByRole('heading', { name: 'System Administrator' })).toBeVisible();
      await expect(page.locator('main').getByText('ADM-2026-001')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Administrative Authority' })).toBeVisible();

      // Form & 2FA Section
      await expect(page.getByRole('heading', { name: 'Institutional Identity' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Two-Factor Authentication (2FA)' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Save Profile Changes' })).toBeVisible();
    }
  });

});
