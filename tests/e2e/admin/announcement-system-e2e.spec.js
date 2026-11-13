const { test, expect } = require('@playwright/test');

test.describe('UAP System-Wide Announcement E2E Verification', () => {
  test.beforeEach(async ({ page }) => {
    // Authenticate as administrator
    await page.goto('/auth/login');
    await page.fill('#email', 'admin@uap.edu');
    await page.fill('#password', 'Admin@123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/admin/, { timeout: 20000 });
    // Navigate to Settings tab via sidebar
    await page.locator('aside nav a', { hasText: 'Settings' }).click();
    await expect(page.getByText('System-wide Announcement Management')).toBeVisible({ timeout: 15000 });
  });

  test('1. Draft typing, repeated Backspace operations, and empty state behavior', async ({ page }) => {
    const textarea = page.locator('#announcementText');
    await expect(textarea).toBeVisible();

    // Type a sample message
    await textarea.fill('Temporary draft announcement');
    await expect(textarea).toHaveValue('Temporary draft announcement');

    // Live preview must show unsaved draft preview
    await expect(page.getByText('Unsaved Draft Preview')).toBeVisible();
    const previewMarquee = page.locator('[data-testid="live-banner-preview"] .animate-marquee');
    await expect(previewMarquee).toContainText('Temporary draft announcement');

    // Repeated backspace until empty
    await textarea.focus();
    await textarea.selectText();
    await page.keyboard.press('Backspace');

    // Verify textarea is completely empty
    await expect(textarea).toHaveValue('');

    // Wait a brief moment to ensure no background timer or effect resets it
    await page.waitForTimeout(500);
    await expect(textarea).toHaveValue('');

    // Preview must cleanly indicate empty draft without error or ticker loop
    await expect(page.getByText('Empty Draft')).toBeVisible();
    await expect(page.getByText('No announcement message entered — banner will remain hidden')).toBeVisible();
  });

  test('2. Publish Now, navbar visibility, persistence on reload, and cancel unpublish', async ({ page }) => {
    const uniqueMessage = `Campus alert: Convocation on Friday ${Date.now()}`;

    const textarea = page.locator('#announcementText');
    await textarea.fill(uniqueMessage);

    // Target audience: all platform users
    await page.selectOption('#announcementAudience', 'all');

    // Select Publish Now mode
    await page.getByRole('button', { name: 'Publish Now' }).click();

    // Click Publish Announcement action button
    const publishBtn = page.getByRole('button', { name: 'Publish Announcement' });
    await expect(publishBtn).toBeEnabled();
    await publishBtn.click();

    // Verify success toast notification
    await expect(page.getByText(/Announcement published immediately/i)).toBeVisible({ timeout: 10000 });

    // Verify dynamic status badge updates to Active / Published
    await expect(page.getByText('Active / Published')).toBeVisible({ timeout: 10000 });

    // Verify preview indicates published announcement live in navbar
    await expect(page.getByText('Published (Live in Navbar)')).toBeVisible();

    // Verify announcement ticker appears in top shared navbar between Brand and Search
    const navbarTicker = page.locator('header [role="region"][aria-label="Platform Announcement"]');
    await expect(navbarTicker).toBeVisible({ timeout: 10000 });
    await expect(navbarTicker).toContainText(uniqueMessage);

    // Reload page and verify persistence across reloads
    await page.reload();
    await expect(page.getByText('Active / Published')).toBeVisible({ timeout: 15000 });
    await expect(navbarTicker).toBeVisible();
    await expect(navbarTicker).toContainText(uniqueMessage);

    // Cancel / Unpublish announcement
    const cancelBtn = page.getByRole('button', { name: 'Cancel Announcement' });
    await expect(cancelBtn).toBeVisible();
    await cancelBtn.click();

    // Verify confirmation toast
    await expect(page.getByText(/Announcement cancelled and removed/i)).toBeVisible({ timeout: 10000 });

    // Verify status transitions away from published
    await expect(page.getByText('Cancelled / Withdrawn')).toBeVisible();

    // Verify navbar ticker is removed immediately
    await expect(navbarTicker).not.toBeVisible();
  });

  test('3. Scheduled announcement is hidden until start time is reached', async ({ page }) => {
    const scheduledMessage = `Scheduled maintenance notice ${Date.now()}`;

    const textarea = page.locator('#announcementText');
    await textarea.fill(scheduledMessage);

    // Select Schedule Later mode
    await page.getByRole('button', { name: 'Schedule Later' }).click();

    // Ensure start date is in the future
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // Tomorrow
    const pad = (n) => String(n).padStart(2, '0');
    const isoString = `${futureDate.getFullYear()}-${pad(futureDate.getMonth() + 1)}-${pad(futureDate.getDate())}T10:00`;
    await page.fill('#scheduledStart', isoString);

    // Click Schedule Announcement
    const scheduleBtn = page.getByRole('button', { name: 'Schedule Announcement' });
    await scheduleBtn.click();

    // Verify scheduled toast & status
    await expect(page.getByText(/Announcement scheduled for/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Scheduled', { exact: true })).toBeVisible({ timeout: 10000 });

    // Navbar ticker must NOT be visible because start time is in the future
    const navbarTicker = page.locator('header [role="region"][aria-label="Platform Announcement"]');
    await expect(navbarTicker).not.toBeVisible();
  });
});
