const { test, expect } = require('@playwright/test');

const VIEWPORTS = [
  { name: '320px', width: 320, height: 568 },
  { name: '360px', width: 360, height: 800 },
  { name: '390px', width: 390, height: 844 },
  { name: '430px', width: 430, height: 932 },
  { name: '768px', width: 768, height: 1024 },
  { name: '1024px', width: 1024, height: 768 },
  { name: '1280px', width: 1280, height: 800 },
  { name: '1440px', width: 1440, height: 900 },
  { name: '1920px', width: 1920, height: 1080 },
];

async function checkNoOverflow(page) {
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
  expect(overflow.hasOverflow, `Horizontal overflow detected: scrollWidth (${overflow.scrollWidth}px) > clientWidth (${overflow.clientWidth}px)`).toBe(false);
}

test.describe('Role-Specific Compact Search & Layout Verification', () => {
  // 1. Student Portal Search
  test('1. Student portal top nav search renders exact placeholder and handles keyboard/results', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/auth/login');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Login as Student
    await page.fill('#email', 'student@uap.edu');
    await page.fill('#password', 'Student@123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/student\/dashboard/);

    // Verify search input in header
    const studentSearch = page.locator('header input[placeholder="Search assessments, submissions..."]');
    await expect(studentSearch).toBeVisible();

    // Type query
    await studentSearch.fill('Catalog');
    await page.waitForTimeout(400); // Wait for debounce

    // Verify dropdown results list appears
    const dropdown = page.locator('#student-search-results');
    await expect(dropdown).toBeVisible();
    await expect(dropdown.locator('text=Assessment Catalog')).toBeVisible();

    // Keyboard navigation: Escape closes dropdown
    await page.keyboard.press('Escape');
    await expect(dropdown).not.toBeVisible();

    // Reopen and press Enter to navigate
    await studentSearch.focus();
    await studentSearch.fill('Catalog');
    await page.waitForTimeout(400);
    await expect(dropdown).toBeVisible();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/student\/catalog/);

    // Verify catalog page has zero page-level search inputs
    const pageSearchInputs = page.locator('main input[type="text"], main input[type="search"]');
    await expect(pageSearchInputs).toHaveCount(0);
  });

  // 2. Instructor Portal Search
  test('2. Instructor portal top nav search renders exact placeholder and removes duplicate search cards', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/auth/login');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Login as Instructor
    await page.fill('#email', 'instructor@uap.edu');
    await page.fill('#password', 'Instructor@123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/instructor\/dashboard/);

    // Verify search input in header
    const instructorSearch = page.locator('header input[placeholder="Search assessments, students..."]');
    await expect(instructorSearch).toBeVisible();

    // Verify duplicate prominent search card is NOT on the Dashboard
    const redundantDashboardCard = page.locator('main').locator('text=Search course assessments, students, or submissions');
    await expect(redundantDashboardCard).toHaveCount(0);

    // Navigate to Submissions Queue via navigation link
    await page.locator('nav a[href="/instructor/submissions"]').click();
    await page.waitForURL(/\/instructor\/submissions/);
    await expect(instructorSearch).toBeVisible();

    // Verify local queue filter and tabs are preserved, with zero page-level search inputs
    await expect(page.locator('button', { hasText: 'Needs Review' })).toBeVisible();
    await expect(page.locator('button', { hasText: 'Evaluated' })).toBeVisible();
    const queuePageSearch = page.locator('main input');
    await expect(queuePageSearch).toHaveCount(0);

    // Verify duplicate card is NOT on submissions page
    const redundantQueueCard = page.locator('main').locator('text=Search student name, email, or assessment title');
    await expect(redundantQueueCard).toHaveCount(0);

    // Navigate to Assessments List via navigation link
    await page.locator('nav a[href="/instructor/assessments"]').click();
    await page.waitForURL(/\/instructor\/assessments/);
    await expect(instructorSearch).toBeVisible();
    const asmtPageSearch = page.locator('main input');
    await expect(asmtPageSearch).toHaveCount(0);

    // Type query in top search and verify dropdown
    await instructorSearch.fill('Assessment');
    await page.waitForTimeout(400);
    const dropdown = page.locator('#instructor-search-results');
    await expect(dropdown).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dropdown).not.toBeVisible();
  });

  // 3. Admin Portal Search
  test('3. Admin portal top nav search renders exact placeholder and navigates to resources', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/auth/login');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Login as Admin
    await page.fill('#email', 'admin@uap.edu');
    await page.fill('#password', 'Admin@123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/admin\/dashboard/);

    // Verify search input in header
    const adminSearch = page.locator('header input[placeholder="Search users, assessments..."]');
    await expect(adminSearch).toBeVisible();

    // Search for a navigation page
    await adminSearch.fill('Audit');
    await page.waitForTimeout(400);
    const dropdown = page.locator('#admin-search-results');
    await expect(dropdown).toBeVisible();
    await expect(dropdown.locator('text=Security & Audit Logs')).toBeVisible();

    // Select with Enter
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/admin\/logs/);

    // Redundant local audit log search is removed and Action filter select is preserved
    await expect(page.locator('input[placeholder*="Search by action, username"]')).toHaveCount(0);
    await expect(page.locator('select option', { hasText: 'All Logged Actions' })).toBeAttached();
  });

  // 4. Responsive Viewports Zero Overflow Check
  test.describe('4. Zero Horizontal Overflow Across All Target Viewports', () => {
    for (const vp of VIEWPORTS) {
      test(`Viewport ${vp.name} (${vp.width}x${vp.height}) has zero horizontal overflow in Student portal`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto('/auth/login');
        await page.evaluate(() => localStorage.clear());
        await page.reload();

        await page.fill('#email', 'student@uap.edu');
        await page.fill('#password', 'Student@123');
        await page.click('button[type="submit"]');
        await expect(page).toHaveURL(/\/student\/dashboard/);

        // On mobile (< 640px), verify mobile search toggle button is visible
        if (vp.width < 640) {
          const mobileSearchBtn = page.locator('header button[aria-label="Open student search"]');
          await expect(mobileSearchBtn).toBeVisible();
        } else {
          const desktopSearch = page.locator('header input[placeholder="Search assessments, submissions..."]');
          await expect(desktopSearch).toBeVisible();
        }

        // Verify zero horizontal overflow
        await checkNoOverflow(page);
      });
    }
  });
});
