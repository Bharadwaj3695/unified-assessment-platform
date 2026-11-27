const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

test.describe.serial('UAP Question Bank, Question Import & Certification E2E Workflow', () => {
  const screenshotsDir = path.resolve(__dirname, '../../../tests/screenshots');

  test.beforeAll(() => {
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
  });

  test('1. Question Bank Page — Renaming, Blueprint Removal, Filters, and Question Preview', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 960 });

    // Login as instructor
    await page.goto('/auth/login');
    await page.fill('#email', 'instructor@uap.edu');
    await page.fill('#password', 'Instructor@123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/instructor\/dashboard/);

    // Navigate to Question Bank
    await page.goto('/instructor/question-bank');
    await page.waitForLoadState('networkidle');

    // 1. Verify visible page title is Question Bank
    const heading = page.locator('[data-testid="heading-question-bank"]');
    await expect(heading).toBeVisible({ timeout: 10000 });
    await expect(heading).toHaveText('Question Bank');

    // 2. Verify visible absence of Mock Test Blueprint button
    const blueprintBtn = page.locator('button:has-text("Mock Test Blueprint")').filter({ hasNot: page.locator('.hidden *') });
    await expect(blueprintBtn).toHaveCount(0);

    // 3. Verify visible absence of Mock Tests & Blueprints tab
    const mockTestsTab = page.locator('button:has-text("Mock Tests & Blueprints")').filter({ hasNot: page.locator('.hidden *') });
    await expect(mockTestsTab).toHaveCount(0);

    // 4. Verify presence of AI Generator, Bulk Import, Create Question buttons
    await expect(page.locator('[data-testid="btn-ai-generator"]')).toBeVisible();
    await expect(page.locator('[data-testid="btn-bulk-import"]')).toBeVisible();
    await expect(page.locator('[data-testid="btn-create-question"]')).toBeVisible();

    // 5. Verify search and filter controls
    const searchInput = page.locator('input[placeholder*="Search statement"]');
    await expect(searchInput).toBeVisible();

    // 6. Test Question Preview modal
    const viewButtons = page.locator('[data-testid^="btn-view-question-"]');
    await expect(viewButtons.first()).toBeVisible({ timeout: 10000 });
    await viewButtons.first().click();
    const previewModal = page.locator('[data-testid="modal-view-question"]');
    await expect(previewModal).toBeVisible({ timeout: 5000 });
    await expect(previewModal.getByText('Question Preview')).toBeVisible();
    // Close preview
    await previewModal.locator('button:has-text("Close Preview")').click();
    await expect(previewModal).not.toBeVisible();

    // Capture screenshot of Question Bank
    await page.screenshot({
      path: path.join(screenshotsDir, 'question-bank-page-verified.png'),
      fullPage: true,
    });
  });

  test('2. Test Creator Studio — Certification Workflow & Question Bank Import', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 960 });

    // Login as instructor
    await page.goto('/auth/login');
    await page.fill('#email', 'instructor@uap.edu');
    await page.fill('#password', 'Instructor@123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/instructor\/dashboard/);

    // Navigate to Create Test Hub
    await page.goto('/instructor/create-test');
    await page.waitForLoadState('networkidle');

    // Select Course Assessment and launch Test Creator Studio
    const assessmentOpt = page.locator('[data-testid="option-course-assessment"]');
    await expect(assessmentOpt).toBeVisible();
    await assessmentOpt.click();

    const launchBtn = page.locator('[data-testid="btn-launch-creator"]');
    await expect(launchBtn).toBeVisible();
    await launchBtn.click();

    // Verify Test Creator Studio loads
    await expect(page).toHaveURL(/\/instructor\/test-creator\?type=assessment/);
    const studio = page.locator('[data-testid="test-creator-studio"]');
    await expect(studio).toBeVisible({ timeout: 10000 });

    // Verify Header details
    await expect(page.locator('h1', { hasText: 'Test Creator Studio' })).toBeVisible();
    await expect(page.locator('[data-testid="btn-save-draft"]')).toBeVisible();
    await expect(page.locator('[data-testid="btn-publish"]')).toBeVisible();

    // Enter test title
    const titleInput = page.locator('input[placeholder*="Midterm Examination"]');
    await titleInput.fill('Distributed Systems & Cloud Architecture Exam');

    // Test Certification section
    const certSection = page.locator('[data-testid="section-certification"]');
    await expect(certSection).toBeVisible();

    const certToggle = page.locator('[data-testid="toggle-enable-certification"]');
    await expect(certToggle).toBeVisible();
    await certToggle.check();

    // Verify Certification config panel appears
    const certConfigPanel = page.locator('[data-testid="panel-certification-config"]');
    await expect(certConfigPanel).toBeVisible({ timeout: 5000 });

    // Fill certification fields
    const certTitleInput = page.locator('[data-testid="input-certificate-title"]');
    await certTitleInput.fill('Certificate of Distinction in Distributed Systems');

    const issuingOrgInput = page.locator('[data-testid="input-issuing-org"]');
    await issuingOrgInput.fill('Department of Computer Science & Engineering');

    const signatoryInput = page.locator('[data-testid="input-signatory-name"]');
    await signatoryInput.fill('Dr. Leslie Lamport');

    // Test Certificate Preview modal
    const previewCertBtn = page.locator('[data-testid="btn-preview-certificate"]');
    await expect(previewCertBtn).toBeVisible();
    await previewCertBtn.click();

    const certPreviewModal = page.locator('[data-testid="modal-certificate-preview"]');
    await expect(certPreviewModal).toBeVisible({ timeout: 5000 });
    await expect(certPreviewModal.getByText('Certificate of Distinction in Distributed Systems')).toBeVisible();
    await expect(certPreviewModal.getByText('Department of Computer Science & Engineering')).toBeVisible();
    await expect(certPreviewModal.getByText('Dr. Leslie Lamport')).toBeVisible();
    await expect(certPreviewModal.getByText('Verified Credential')).toBeVisible();

    // Close certificate preview modal
    await certPreviewModal.locator('button:has-text("Close Preview")').click();
    await expect(certPreviewModal).not.toBeVisible();

    // Test Question Bank Import
    // Check both Add Question buttons exist (Top and Bottom)
    const addFromBankTop = page.locator('[data-testid="btn-from-question-bank-top"]');
    const createNewTop = page.locator('[data-testid="btn-add-question-top"]');
    await expect(addFromBankTop).toBeVisible();
    await expect(createNewTop).toBeVisible();

    const addFromBankBottom = page.locator('[data-testid="btn-from-bank-bottom"]');
    const createNewBottom = page.locator('[data-testid="btn-add-question-bottom"]');
    await expect(addFromBankBottom).toBeVisible();
    await expect(createNewBottom).toBeVisible();

    // Click "From Question Bank"
    await addFromBankTop.click();

    // Verify Question Bank selection modal opens
    const bankModal = page.locator('[data-testid="question-bank-selection-drawer"]');
    await expect(bankModal).toBeVisible({ timeout: 5000 });

    // Verify search and filter controls inside modal
    await expect(page.locator('[data-testid="input-search-bank-questions"]')).toBeVisible();
    await expect(page.locator('[data-testid="select-filter-subject"]')).toBeVisible();
    await expect(page.locator('[data-testid="select-filter-type"]')).toBeVisible();
    await expect(page.locator('[data-testid="select-filter-difficulty"]')).toBeVisible();

    // Wait for questions to load in modal
    const questionRows = page.locator('[data-testid^="bank-question-row-"]');
    await expect(questionRows.first()).toBeVisible({ timeout: 10000 });

    // Test select all & deselect all
    const selectAllBtn = page.locator('[data-testid="btn-select-all"]');
    await expect(selectAllBtn).toBeVisible();
    await expect(selectAllBtn).toBeEnabled({ timeout: 5000 });
    await selectAllBtn.click();

    const badgeSelected = page.locator('[data-testid="badge-selected-count"]');
    await expect(badgeSelected).toBeVisible();

    const deselectBtn = page.locator('[data-testid="btn-deselect-all"]');
    await expect(deselectBtn).toBeVisible({ timeout: 5000 });
    await deselectBtn.click();
    await expect(badgeSelected).toHaveText('Selected: 0');

    // Select individual items
    const selectableRows = page.locator('[data-testid^="bank-question-row-"]:not(.cursor-not-allowed)');
    const countSelectable = await selectableRows.count();
    expect(countSelectable).toBeGreaterThan(0);
    await selectableRows.first().click();
    if (countSelectable > 1) {
      await selectableRows.nth(1).click();
    }

    const addSelectedBtn = page.locator('[data-testid="btn-add-selected-questions"]');
    await expect(addSelectedBtn).toBeEnabled();
    await addSelectedBtn.click();

    // Modal closes
    await expect(bankModal).not.toBeVisible();

    // Verify coding IDE question capability is available
    const typeSelect = page.locator('select').filter({ hasText: /Single Choice|Multiple Select/ }).first();
    if (await typeSelect.isVisible()) {
      await typeSelect.selectOption('CODING');
      // Verify FacultyCodeIDE is present
      const codeIDE = page.locator('[data-testid="faculty-code-ide"]');
      await expect(codeIDE).toBeVisible({ timeout: 5000 });
      await expect(page.locator('button:has-text("Run Code")').first()).toBeVisible();
    }

    // Capture screenshot of Test Creator Studio
    await page.screenshot({
      path: path.join(screenshotsDir, 'test-creator-studio-certification-verified.png'),
      fullPage: true,
    });

    // Save draft
    const saveDraftBtn = page.locator('[data-testid="btn-save-draft"]');
    await saveDraftBtn.click();
    await page.waitForTimeout(2000);
  });
});
