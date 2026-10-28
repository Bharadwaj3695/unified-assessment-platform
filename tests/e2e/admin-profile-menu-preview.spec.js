const { test, expect } = require('@playwright/test');

test.describe('UAP Admin Profile Menu & Responsive Viewport Preview E2E', () => {

  test.describe('1. Role-Based Menu Isolation (Student & Instructor)', () => {
    test('Student avatar click navigates directly to /student/profile without admin menu', async ({ page }) => {
      await page.goto('/auth/login');
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      await page.fill('#email', 'student@uap.edu');
      await page.fill('#password', 'Student@123');
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/\/student\/dashboard/);

      // Student avatar should not have aria-haspopup="menu"
      const studentAvatar = page.locator('header div[title="View Profile"]');
      await expect(studentAvatar).toBeVisible();
      await expect(page.locator('button[aria-label="Admin Profile and System Menu"]')).not.toBeVisible();

      // Clicking student avatar navigates directly to /student/profile
      await studentAvatar.click();
      await expect(page).toHaveURL(/\/student\/profile/);
      await expect(page.getByRole('heading', { name: 'Student Academic Profile' })).toBeVisible();

      // Ensure no Responsive Preview or Return to Desktop option exists
      await expect(page.getByText('Responsive Preview')).not.toBeVisible();
      await expect(page.getByText('Return to Desktop')).not.toBeVisible();
    });

    test('Instructor avatar click navigates directly to /instructor/profile without admin menu', async ({ page }) => {
      await page.goto('/auth/login');
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      await page.fill('#email', 'instructor@uap.edu');
      await page.fill('#password', 'Instructor@123');
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/\/instructor\/dashboard/);

      const instructorAvatar = page.locator('header div[title="View Profile"]');
      await expect(instructorAvatar).toBeVisible();
      await expect(page.locator('button[aria-label="Admin Profile and System Menu"]')).not.toBeVisible();

      await instructorAvatar.click();
      await expect(page).toHaveURL(/\/instructor\/profile/);
      await expect(page.getByRole('heading', { name: 'Faculty Academic Profile' })).toBeVisible();

      await expect(page.getByText('Responsive Preview')).not.toBeVisible();
      await expect(page.getByText('Return to Desktop')).not.toBeVisible();
    });
  });

  test.describe('2. Admin Profile Menu & View Profile Action', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/auth/login');
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      await page.fill('#email', 'admin@uap.edu');
      await page.fill('#password', 'Admin@123');
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/\/admin\/dashboard/);
    });

    test('Admin clicks avatar to display accessible popover with View Profile and Responsive Preview', async ({ page }) => {
      const menuTrigger = page.locator('button[aria-label="Admin Profile and System Menu"]');
      await expect(menuTrigger).toBeVisible();

      // Open menu
      await menuTrigger.click();
      const menu = page.locator('div[role="menu"][aria-label="Admin Profile Menu"]');
      await expect(menu).toBeVisible();

      // Check Admin info in popover
      await expect(menu.getByText('Administrator', { exact: true })).toBeVisible();
      await expect(menu.locator('text=ADM-')).toBeVisible();

      // Check menu entries
      const viewProfileBtn = menu.getByRole('menuitem', { name: /View Profile/i });
      const responsivePreviewBtn = menu.getByRole('menuitem', { name: /Responsive Preview/i });
      await expect(viewProfileBtn).toBeVisible();
      await expect(responsivePreviewBtn).toBeVisible();

      // "Return to Desktop" must NOT be shown when preview is inactive
      await expect(menu.getByRole('menuitem', { name: /Return to Desktop/i })).not.toBeVisible();

      // Click View Profile
      await viewProfileBtn.click();
      await expect(page).toHaveURL(/\/admin\/profile/);
      await expect(page.getByRole('heading', { name: 'Administrator Profile' })).toBeVisible();
      await expect(page.getByText('Administrative Authority')).toBeVisible();
      await expect(page.getByText('Level 4 Institutional Governance')).toBeVisible();
    });

    test('Admin menu closes on outside click and on Escape key', async ({ page }) => {
      const menuTrigger = page.locator('button[aria-label="Admin Profile and System Menu"]');
      await menuTrigger.click();
      const menu = page.locator('div[role="menu"][aria-label="Admin Profile Menu"]');
      await expect(menu).toBeVisible();

      // Press Escape
      await page.keyboard.press('Escape');
      await expect(menu).not.toBeVisible();

      // Reopen and click outside
      await menuTrigger.click();
      await expect(menu).toBeVisible();
      await page.click('header');
      await expect(menu).not.toBeVisible();
    });
  });

  test.describe('3. Responsive Viewport Preview Functionality', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/auth/login');
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      await page.fill('#email', 'admin@uap.edu');
      await page.fill('#password', 'Admin@123');
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/\/admin\/dashboard/);
    });

    test('Opens Responsive Preview modal and switches between Mobile, Tablet, Laptop, and Desktop presets', async ({ page }) => {
      const menuTrigger = page.locator('button[aria-label="Admin Profile and System Menu"]');
      await menuTrigger.click();

      // Click Responsive Preview
      await page.locator('div[role="menu"]').getByRole('menuitem', { name: /Responsive Preview/i }).click();

      // Preview dialog opens
      const previewModal = page.locator('div[role="dialog"][aria-label="Responsive Device Viewport Preview"]');
      await expect(previewModal).toBeVisible();

      // Body scroll must be locked
      const bodyOverflow = await page.evaluate(() => document.body.style.overflow);
      expect(bodyOverflow).toBe('hidden');

      // The iframe must be rendered
      const iframe = previewModal.locator('iframe[title="UAP Responsive Viewport Preview"]');
      await expect(iframe).toBeVisible();

      // Default preset is Mobile (390 x 844)
      await expect(previewModal.getByText('390', { exact: true })).toBeVisible();
      await expect(previewModal.getByText('844', { exact: true })).toBeVisible();

      // Switch to Tablet (768 x 1024)
      const tabletBtn = previewModal.getByTestId('preset-tablet');
      await tabletBtn.click();
      await expect(previewModal.getByText('768', { exact: true })).toBeVisible();
      await expect(previewModal.getByText('1024', { exact: true })).toBeVisible();

      // Switch to Laptop (1366 x 768)
      const laptopBtn = previewModal.getByTestId('preset-laptop');
      await laptopBtn.click();
      await expect(previewModal.getByText('1366', { exact: true })).toBeVisible();
      await expect(previewModal.getByText('768', { exact: true })).toBeVisible();

      // Switch to Desktop (1920 x 1080)
      const desktopBtn = previewModal.getByTestId('preset-desktop');
      await desktopBtn.click();
      await expect(previewModal.getByText('1920', { exact: true })).toBeVisible();
      await expect(previewModal.getByText('1080', { exact: true })).toBeVisible();

      // Click Return to Desktop button in top control bar
      const returnBtn = previewModal.getByRole('button', { name: 'Return to Desktop' });
      await expect(returnBtn).toBeVisible();
      await returnBtn.click();

      // Modal closes and desktop view is restored
      await expect(previewModal).not.toBeVisible();
      const restoredOverflow = await page.evaluate(() => document.body.style.overflow);
      expect(restoredOverflow).toBe('unset');
    });

    test('Return to Desktop is visible in Admin Profile Menu when preview mode is active', async ({ page }) => {
      const menuTrigger = page.locator('button[aria-label="Admin Profile and System Menu"]');
      await menuTrigger.click();
      await page.locator('div[role="menu"]').getByRole('menuitem', { name: /Responsive Preview/i }).click();

      // Preview is open. Verify iframe is ready
      const previewModal = page.locator('div[role="dialog"][aria-label="Responsive Device Viewport Preview"]');
      await expect(previewModal).toBeVisible();

      // Inside the preview iframe, wait for the header to render
      const iframeFrame = page.frameLocator('iframe[title="UAP Responsive Viewport Preview"]');
      const innerMenuTrigger = iframeFrame.locator('button[aria-label="Admin Profile and System Menu"]');
      await expect(innerMenuTrigger).toBeVisible({ timeout: 15000 });

      // Click avatar inside preview iframe
      await innerMenuTrigger.click();
      const innerMenu = iframeFrame.locator('div[role="menu"][aria-label="Admin Profile Menu"]');
      await expect(innerMenu).toBeVisible();

      // "Return to Desktop" must be visible inside preview mode!
      const returnToDesktopItem = innerMenu.getByRole('menuitem', { name: /Return to Desktop/i });
      await expect(returnToDesktopItem).toBeVisible();

      // Clicking "Return to Desktop" inside the iframe closes the preview modal
      await returnToDesktopItem.click();
      await expect(previewModal).not.toBeVisible();
    });

    test('Preview closes with Escape key', async ({ page }) => {
      const menuTrigger = page.locator('button[aria-label="Admin Profile and System Menu"]');
      await menuTrigger.click();
      await page.locator('div[role="menu"]').getByRole('menuitem', { name: /Responsive Preview/i }).click();

      const previewModal = page.locator('div[role="dialog"][aria-label="Responsive Device Viewport Preview"]');
      await expect(previewModal).toBeVisible();

      await page.keyboard.press('Escape');
      await expect(previewModal).not.toBeVisible();
    });
  });
});
