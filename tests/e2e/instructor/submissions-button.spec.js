const { test, expect } = require('@playwright/test');

test.describe('Assessment Builder Action Controls — Submissions Button', () => {
  test.beforeEach(async ({ page }) => {
    // Log in as instructor
    await page.goto('/auth/login');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.fill('#email', 'instructor@uap.edu');
    await page.fill('#password', 'Instructor@123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/instructor\/dashboard/);
  });

  test('1. Submissions button is visible alongside Save Draft and Publish Live, and navigates to submissions queue', async ({ page }) => {
    await page.goto('/instructor/create');

    const subsBtn = page.getByRole('button', { name: 'Submissions', exact: true });
    const saveDraftBtn = page.getByRole('button', { name: 'Save Draft', exact: true });
    const publishLiveBtn = page.getByRole('button', { name: 'Publish Live', exact: true });

    // Verify all 3 buttons are visible
    await expect(subsBtn).toBeVisible();
    await expect(saveDraftBtn).toBeVisible();
    await expect(publishLiveBtn).toBeVisible();

    // Click Submissions button
    await subsBtn.click();

    // Verify navigation to Instructor Submissions & Grading queue
    await expect(page).toHaveURL(/\/instructor\/submissions/);
    await expect(page.locator('text=Submission Evaluation Queue')).toBeVisible();
  });
});
