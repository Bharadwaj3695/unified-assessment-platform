const { test, expect } = require('@playwright/test');

test.describe('Assessment Builder Simplified 3-Section Layout', () => {
  test.beforeEach(async ({ page }) => {
    // Log in as instructor
    await page.goto('/auth/login');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.fill('#email', 'instructor@uap.edu');
    await page.fill('#password', 'Instructor@123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/instructor\/dashboard/);
    await expect(page.getByText('instructor Workspace', { exact: true })).toBeVisible({ timeout: 10000 });
  });

  test('1. Three primary sections appear in exact 01, 02, 03 order with question summary', async ({ page }) => {
    await page.goto('/instructor/create');

    // Verify Title & Breadcrumb & Action Controls
    await expect(page.locator('h1', { hasText: 'Author New Assessment' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Assessments', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save Draft' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Publish Live' })).toBeVisible();

    // Verify Section 01: Assessment Details is first
    const sec1 = page.locator('text=01 — Assessment Details');
    await expect(sec1).toBeVisible();

    // Verify Section 02: Questions & Answers is second
    const sec2 = page.locator('text=02 — Questions & Answers');
    await expect(sec2).toBeVisible();

    // Verify Section 03: Certification & Grading is third / last
    const sec3 = page.locator('text=03 — Certification & Grading');
    await expect(sec3).toBeVisible();

    // Verify Vertical ordering on page (sec1.top < sec2.top < sec3.top)
    const box1 = await sec1.boundingBox();
    const box2 = await sec2.boundingBox();
    const box3 = await sec3.boundingBox();
    expect(box1.y).toBeLessThan(box2.y);
    expect(box2.y).toBeLessThan(box3.y);

    // Verify Section 01 contains core metadata & configuration fields
    await expect(page.locator('input[placeholder*="Distributed Systems"]')).toBeVisible();
    await expect(page.locator('text=Assessment Configuration & Rules')).toBeVisible();
    await expect(page.locator('text=Audience & Access Mode')).toBeVisible();
    await expect(page.locator('text=AI-Assisted Proctoring')).toBeVisible();
    await expect(page.locator('text=Question Randomization')).toBeVisible();

    // Verify Section 02 contains the question-type toolbar at the top of Section 02
    await expect(page.getByRole('button', { name: 'Add Multiple Choice' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Short Answer' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Long Essay' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add File Upload' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Import from Question Bank' })).toBeVisible();

    // Verify compact question count and total marks summary in Section 02
    await expect(page.locator('text=1 Question').first()).toBeVisible();
    await expect(page.locator('text=5 pts Total').first()).toBeVisible();
  });

  test('2. Question interactions: add multiple types, reorder, expand/collapse, and safe delete', async ({ page }) => {
    await page.goto('/instructor/create');

    // Initial question is 1 item (5 pts)
    await expect(page.locator('text=1 Question').first()).toBeVisible();

    // Add Short Answer question from toolbar
    await page.getByRole('button', { name: 'Add Short Answer' }).click();
    await expect(page.locator('text=2 Questions').first()).toBeVisible();

    // Add File Upload question from toolbar
    await page.getByRole('button', { name: 'Add File Upload' }).click();
    await expect(page.locator('text=3 Questions').first()).toBeVisible();

    // Add Long Essay question from toolbar
    await page.getByRole('button', { name: 'Add Long Essay' }).click();
    await expect(page.locator('text=4 Questions').first()).toBeVisible();

    // Test Expand All & Collapse All
    const toggleAllBtn = page.getByRole('button', { name: /Expand All|Collapse All/ });
    await expect(toggleAllBtn).toBeVisible();
    await toggleAllBtn.click();
    await toggleAllBtn.click();

    // Fill Question 1 prompt
    const q1Prompt = page.locator('textarea[placeholder*="Enter question text"]').first();
    await q1Prompt.fill('Explain the difference between TCP and UDP.');

    // Test Question Deletion with confirmation for non-empty question (at index 0)
    const deleteButtons = page.locator('button[title="Delete Question"]');
    await deleteButtons.first().click();

    // Confirmation modal should appear for non-empty question
    await expect(page.locator('text=Are you sure you want to delete Question')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.locator('text=Are you sure you want to delete Question')).not.toBeVisible();

    // Test Question Reordering: move Question 2 up
    const moveUpButtons = page.locator('button[title="Move Question Up"]');
    await expect(moveUpButtons.nth(1)).toBeEnabled();
    await moveUpButtons.nth(1).click();

    // Delete an empty question directly without confirmation modal
    await deleteButtons.last().click();
    await expect(page.locator('text=3 Questions').first()).toBeVisible();
  });

  test('3. Certification & Grading toggle, collapsible scheme editor and simulator', async ({ page }) => {
    await page.goto('/instructor/create');

    // Certification is disabled by default
    await expect(page.locator('text=Certification is currently disabled')).toBeVisible();

    // Toggle Certification ON
    const certToggle = page.locator('#certification-toggle');
    await certToggle.check({ force: true });

    // Dependent fields should now be visible
    await expect(page.locator('text=Passing Percentage for Certification (%)')).toBeVisible();
    await expect(page.locator('text=Approved Certificate Template')).toBeVisible();
    await expect(page.locator('text=Configurable Grading Scheme')).toBeVisible();
    await expect(page.locator('text=Live Grading & Qualification Simulator')).toBeVisible();

    // Test Collapsible Grading Scheme editor
    const schemeHeader = page.locator('text=Configurable Grading Scheme');
    await schemeHeader.click();
    // Bands table header should now be collapsed
    await expect(page.locator('text=Student-Facing Label')).not.toBeVisible();
    // Expand again
    await schemeHeader.click();
    await expect(page.locator('text=Student-Facing Label')).toBeVisible();

    // Test Collapsible Live Simulator
    const simulatorHeader = page.locator('text=Live Grading & Qualification Simulator');
    await simulatorHeader.click();
    // Outcome card should be collapsed
    await expect(page.locator('text=Letter Grade')).not.toBeVisible();
    // Expand again
    await simulatorHeader.click();
    await expect(page.locator('text=Letter Grade')).toBeVisible();
  });

  test('4. Full lifecycle: save draft with certification and reopen to verify persistence', async ({ page }) => {
    await page.goto('/instructor/create');

    const uniqueTitle = `Persisted 3-Section Exam ${Date.now()}`;
    await page.fill('input[placeholder*="Distributed Systems"]', uniqueTitle);
    await page.fill('textarea[rows="3"]', 'Verification of 3-section layout and certification settings persistence.');

    // Fill Question 1 prompt & choices
    await page.fill('textarea[placeholder*="Enter question text"]', 'What is the consensus algorithm used by Raft?');
    await page.fill('input[placeholder*="Option A"]', 'Leader election and log replication');
    await page.fill('input[placeholder*="Option B"]', 'Proof of work hashing');
    await page.fill('input[placeholder*="Option C"]', 'Random lottery selection');
    await page.fill('input[placeholder*="Option D"]', 'Uncoordinated writes');

    // Enable certification and configure custom parameters
    const certToggle = page.locator('#certification-toggle');
    await certToggle.check({ force: true });
    await page.fill('#certPassingPercentage', '65'); // Change passing percentage to 65%
    await page.fill('#certSignatoryName', 'Prof. Alan Turing');

    // Save Draft
    await page.getByRole('button', { name: 'Save Draft' }).click();

    // Verify redirected to assessments list
    await expect(page).toHaveURL(/\/instructor\/assessments/);
    await expect(page.locator(`text=${uniqueTitle}`)).toBeVisible({ timeout: 10000 });

    // Open assessment for editing to verify persistence
    await page.locator('tr, div', { hasText: uniqueTitle }).getByRole('button', { name: /Edit/i }).first().click();

    // Verify Title & Description
    await expect(page.locator(`input[value="${uniqueTitle}"]`)).toBeVisible({ timeout: 10000 });

    // Verify Certification is enabled and values persisted
    await expect(page.locator('input[value="65"]')).toBeVisible();
    await expect(page.locator('input[value="Prof. Alan Turing"]')).toBeVisible();

    // Verify Question survived
    await expect(page.locator('text=What is the consensus algorithm used by Raft?').first()).toBeVisible();
  });

  test('5. Responsive viewports: mobile and tablet rendering', async ({ page }) => {
    // 5A. Test on Tablet viewport (768 x 1024)
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/instructor/create');
    await expect(page.locator('h1', { hasText: 'Author New Assessment' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save Draft' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Publish Live' })).toBeVisible();
    await expect(page.locator('text=01 — Assessment Details')).toBeVisible();
    await expect(page.locator('text=02 — Questions & Answers')).toBeVisible();
    await expect(page.locator('text=03 — Certification & Grading')).toBeVisible();

    // 5B. Test on Mobile viewport (375 x 667)
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/instructor/create');
    await expect(page.locator('h1', { hasText: 'Author New Assessment' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save Draft' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Publish Live' })).toBeVisible();

    // Verify Section 02 Add Buttons wrap neatly on mobile
    await expect(page.getByRole('button', { name: 'Add Multiple Choice' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Short Answer' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Long Essay' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add File Upload' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Import from Question Bank' })).toBeVisible();
  });
});
