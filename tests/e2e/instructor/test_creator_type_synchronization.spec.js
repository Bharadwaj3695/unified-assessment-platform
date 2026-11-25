const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

test.describe.serial('UAP Test Creator Studio — Test Type State, URL & Draft Persistence E2E', () => {
  const screenshotsDir = path.resolve(__dirname, '../../../tests/screenshots');

  test.beforeAll(() => {
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
  });

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 960 });
    // Login as instructor
    await page.goto('/auth/login');
    await page.fill('#email', 'instructor@uap.edu');
    await page.fill('#password', 'Instructor@123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/instructor\/dashboard/);
  });

  test('Scenario A — Launch Mock Test and verify refresh maintains Mock Test', async ({ page }) => {
    // 1. Open Create Test Hub
    await page.goto('/instructor/create-test');
    await page.waitForLoadState('networkidle');

    // 2. Select Mock Test
    const mockOption = page.locator('[data-testid="option-mock-test"]');
    await expect(mockOption).toBeVisible();
    await mockOption.click();

    // 3. Click Launch
    const launchBtn = page.locator('[data-testid="btn-launch-creator"]');
    await expect(launchBtn).toBeVisible();
    await launchBtn.click();

    // 4. Verify URL contains ?type=mock
    await expect(page).toHaveURL(/\/instructor\/test-creator\?type=mock/);

    // 5. Verify header badge displays Mock Test
    const typeBadge = page.locator('[data-testid="badge-test-type"]');
    await expect(typeBadge).toBeVisible();
    await expect(typeBadge).toHaveText('Mock Test');

    // 6. Verify Test Type dropdown displays Mock Test (value="mock")
    const typeSelect = page.locator('[data-testid="select-test-type"]');
    await expect(typeSelect).toBeVisible();
    await expect(typeSelect).toHaveValue('mock');

    // 7. Refresh the page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // 8. Verify Mock Test remains selected after refresh
    await expect(page).toHaveURL(/\/instructor\/test-creator\?type=mock/);
    await expect(page.locator('[data-testid="badge-test-type"]')).toHaveText('Mock Test');
    await expect(page.locator('[data-testid="select-test-type"]')).toHaveValue('mock');

    await page.screenshot({
      path: path.join(screenshotsDir, 'scenario-a-mock-test-refresh.png'),
    });
  });

  test('Scenario B — Change Mock Test to Assessment, Save Draft, and Refresh', async ({ page }) => {
    // 1. Open Test Creator Studio with ?type=mock
    await page.goto('/instructor/test-creator?type=mock');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('[data-testid="badge-test-type"]')).toHaveText('Mock Test');

    // 2. Change Test Type dropdown to Course Assessment
    const typeSelect = page.locator('[data-testid="select-test-type"]');
    await typeSelect.selectOption('assessment');

    // 3. Verify URL changes to ?type=assessment immediately
    await expect(page).toHaveURL(/\/instructor\/test-creator\?type=assessment/);

    // 4. Verify header badge changes to Course Assessment
    await expect(page.locator('[data-testid="badge-test-type"]')).toHaveText('Course Assessment');

    // 5. Verify Assessment configuration is visible
    await expect(page.getByText('Assessment Rules & Scheduling')).toBeVisible();

    // 6. Fill title and Save Draft
    const testTitle = `Assessment Draft Synced ${Date.now()}`;
    await page.locator('input[placeholder*="Distributed Systems Midterm"]').fill(testTitle);
    await page.locator('[data-testid="btn-save-draft"]').click();

    // Wait for save completion
    await expect(page.getByText(/Draft saved for/)).toBeVisible({ timeout: 10000 });

    // 7. Refresh the page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // 8. Verify Course Assessment remains selected and draft title is preserved
    await expect(page).toHaveURL(/type=assessment/);
    await expect(page.locator('[data-testid="badge-test-type"]')).toHaveText('Course Assessment');
    await expect(page.locator('[data-testid="select-test-type"]')).toHaveValue('assessment');
    await expect(page.locator('input[placeholder*="Distributed Systems Midterm"]')).toHaveValue(testTitle);

    await page.screenshot({
      path: path.join(screenshotsDir, 'scenario-b-change-to-assessment-saved.png'),
    });
  });

  test('Scenario C — Change Assessment to Mock Test, Save Draft, and Refresh', async ({ page }) => {
    // 1. Open Test Creator Studio with ?type=assessment
    await page.goto('/instructor/test-creator?type=assessment');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('[data-testid="badge-test-type"]')).toHaveText('Course Assessment');

    // 2. Change Test Type dropdown to Mock Test
    const typeSelect = page.locator('[data-testid="select-test-type"]');
    await typeSelect.selectOption('mock');

    // 3. Verify URL changes to ?type=mock immediately
    await expect(page).toHaveURL(/\/instructor\/test-creator\?type=mock/);

    // 4. Verify header badge changes to Mock Test
    await expect(page.locator('[data-testid="badge-test-type"]')).toHaveText('Mock Test');

    // 5. Verify Mock Test Blueprint configuration is visible
    await expect(page.getByText('Blueprint Distribution & Rules')).toBeVisible();

    // 6. Fill title and Save Draft
    const mockTitle = `Mock Test Draft Synced ${Date.now()}`;
    await page.locator('input[placeholder*="Distributed Systems Midterm"]').fill(mockTitle);
    await page.locator('[data-testid="btn-save-draft"]').click();

    // Wait for save completion
    await expect(page.getByText(/Mock test draft saved for/)).toBeVisible({ timeout: 10000 });

    // 7. Refresh the page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // 8. Verify Mock Test remains selected and title is preserved
    await expect(page).toHaveURL(/type=mock/);
    await expect(page.locator('[data-testid="badge-test-type"]')).toHaveText('Mock Test');
    await expect(page.locator('[data-testid="select-test-type"]')).toHaveValue('mock');
    await expect(page.locator('input[placeholder*="Distributed Systems Midterm"]')).toHaveValue(mockTitle);

    await page.screenshot({
      path: path.join(screenshotsDir, 'scenario-c-change-to-mock-saved.png'),
    });
  });

  test('Scenario D — Direct URL Access for both types', async ({ page }) => {
    // Direct URL: Mock Test
    await page.goto('/instructor/test-creator?type=mock');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('[data-testid="badge-test-type"]')).toHaveText('Mock Test');
    await expect(page.locator('[data-testid="select-test-type"]')).toHaveValue('mock');
    await expect(page.getByText('Blueprint Distribution & Rules')).toBeVisible();

    // Direct URL: Assessment
    await page.goto('/instructor/test-creator?type=assessment');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('[data-testid="badge-test-type"]')).toHaveText('Course Assessment');
    await expect(page.locator('[data-testid="select-test-type"]')).toHaveValue('assessment');
    await expect(page.getByText('Assessment Rules & Scheduling')).toBeVisible();

    await page.screenshot({
      path: path.join(screenshotsDir, 'scenario-d-direct-urls.png'),
    });
  });

  test('Scenario E — Draft Reopening across page navigation', async ({ page }) => {
    // 1. Create and Save Mock Test draft
    await page.goto('/instructor/test-creator?type=mock');
    await page.waitForLoadState('networkidle');

    const mockTitle = `Persisted Reopen Mock ${Date.now()}`;
    await page.locator('input[placeholder*="Distributed Systems Midterm"]').fill(mockTitle);
    await page.locator('[data-testid="btn-save-draft"]').click();
    await expect(page.getByText(/Mock test draft saved for/)).toBeVisible({ timeout: 10000 });

    // Capture the current URL with saved draft ID
    const savedMockUrl = page.url();
    expect(savedMockUrl).toContain('type=mock');
    expect(savedMockUrl).toContain('id=');

    // 2. Navigate away to dashboard
    await page.goto('/instructor/dashboard');
    await expect(page).toHaveURL(/\/instructor\/dashboard/);

    // 3. Reopen the saved mock test draft via URL
    await page.goto(savedMockUrl);
    await page.waitForLoadState('networkidle');

    // Verify it reloads as Mock Test with preserved title
    await expect(page.locator('[data-testid="badge-test-type"]')).toHaveText('Mock Test');
    await expect(page.locator('[data-testid="select-test-type"]')).toHaveValue('mock');
    await expect(page.locator('input[placeholder*="Distributed Systems Midterm"]')).toHaveValue(mockTitle);

    // 4. Create and Save Course Assessment draft
    await page.goto('/instructor/test-creator?type=assessment');
    await page.waitForLoadState('networkidle');

    const asmtTitle = `Persisted Reopen Asmt ${Date.now()}`;
    await page.locator('input[placeholder*="Distributed Systems Midterm"]').fill(asmtTitle);
    await page.locator('[data-testid="btn-save-draft"]').click();
    await expect(page.getByText(/Draft saved for/)).toBeVisible({ timeout: 10000 });

    const savedAsmtUrl = page.url();
    expect(savedAsmtUrl).toContain('type=assessment');
    expect(savedAsmtUrl).toContain('id=');

    // 5. Navigate away
    await page.goto('/instructor/dashboard');
    await expect(page).toHaveURL(/\/instructor\/dashboard/);

    // 6. Reopen the saved assessment draft
    await page.goto(savedAsmtUrl);
    await page.waitForLoadState('networkidle');

    // Verify it reloads as Course Assessment with preserved title
    await expect(page.locator('[data-testid="badge-test-type"]')).toHaveText('Course Assessment');
    await expect(page.locator('[data-testid="select-test-type"]')).toHaveValue('assessment');
    await expect(page.locator('input[placeholder*="Distributed Systems Midterm"]')).toHaveValue(asmtTitle);

    await page.screenshot({
      path: path.join(screenshotsDir, 'scenario-e-draft-reopening.png'),
    });
  });
});
