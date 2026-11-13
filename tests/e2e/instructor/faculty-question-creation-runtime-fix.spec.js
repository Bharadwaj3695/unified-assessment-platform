const { test, expect } = require('@playwright/test');

test.describe('Faculty Question Creation — Runtime Error Fix & End-to-End Workflow Verification', () => {
  let instructorToken;

  test.beforeAll(async ({ request }) => {
    // Authenticate instructor
    const res = await request.post('http://localhost:5000/api/auth/login', {
      headers: { 'x-test-bypass': 'true' },
      data: { email: 'instructor@uap.edu', password: 'Instructor@123' },
    });
    const json = await res.json();
    instructorToken = json.data?.accessToken;
  });

  test.beforeEach(async ({ page }) => {
    // Reset storage and clear cookies
    await page.goto('/auth/login');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Log in as instructor
    await page.fill('#email', 'instructor@uap.edu');
    await page.fill('#password', 'Instructor@123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/instructor\/dashboard/);
  });

  test('Complete Faculty Question Creation workflow operates without FileCode ReferenceError', async ({ page, request }) => {
    // Catch any uncaught page errors (e.g. ReferenceError: FileCode is not defined)
    const pageErrors = [];
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    // 1. Verify Faculty Dashboard loads
    await expect(page.getByText('instructor Workspace', { exact: true })).toBeVisible({ timeout: 10000 });

    // 2. Navigate to Create Assessment page (/instructor/create)
    await page.goto('/instructor/create');
    await expect(page.locator('h1', { hasText: 'Author New Assessment' })).toBeVisible();

    // Verify ErrorBoundary did not catch any error
    await expect(page.getByText('Something went wrong')).not.toBeVisible();
    await expect(page.getByText('FileCode is not defined')).not.toBeVisible();

    // 3. Set Assessment Details
    const uniqueExamTitle = `E2E Faculty IDE Test ${Date.now()}`;
    const titleInput = page.locator('input[placeholder*="Distributed Systems"]').first();
    await titleInput.fill(uniqueExamTitle);

    // 4. Add a Coding Question by clicking "Add Coding & SQL"
    const addCodeBtn = page.getByRole('button', { name: /Add Coding & SQL/i });
    await expect(addCodeBtn).toBeVisible();
    await addCodeBtn.click();

    // 5. Verify Faculty Code IDE component renders without runtime errors
    await expect(page.getByText('Faculty Coding IDE & Test Validator')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('FileCode is not defined')).not.toBeVisible();
    await expect(page.getByText('Something went wrong')).not.toBeVisible();

    // Fill in question prompt
    const questionPromptTextarea = page.locator('textarea[placeholder*="Enter question text here..."]').last();
    await questionPromptTextarea.fill('Write a program to output Welcome.');

    // 6. Navigate to Problem Specs tab (renders the FileCode icon!)
    const specsTab = page.getByRole('button', { name: /Problem Specs/i });
    await expect(specsTab).toBeVisible();
    await specsTab.click();

    // Verify Problem Specs form inputs are functional
    const problemTitleInput = page.getByPlaceholder(/Second Largest Distinct Element/i).first();
    await expect(problemTitleInput).toBeVisible();
    await problemTitleInput.fill('Welcome Program');

    const descTextarea = page.getByPlaceholder(/Comprehensive problem explanation/i).first();
    await expect(descTextarea).toBeVisible();
    await descTextarea.fill('Print Welcome to the console.');

    // 7. Navigate to Code Editor tab and test Language Selector
    const editorTab = page.getByRole('button', { name: /Code Editor/i });
    await editorTab.click();

    // Language buttons: Python 3.11, JavaScript 20
    const jsBtn = page.getByRole('button', { name: 'JavaScript 20' }).first();
    await expect(jsBtn).toBeVisible();
    await jsBtn.click();

    const pyBtn = page.getByRole('button', { name: 'Python 3.11' }).first();
    await expect(pyBtn).toBeVisible();
    await pyBtn.click();

    // 8. Navigate to Test Cases tab
    const testCasesTab = page.getByRole('button', { name: /Test Cases/i });
    await testCasesTab.click();

    // Configure Test Case 1: Public
    const tc1Input = page.getByLabel('Test case 1 input');
    await tc1Input.fill('');
    const tc1Expected = page.getByLabel('Test case 1 expected output');
    await tc1Expected.fill('Welcome');

    // 9. Add Hidden Test Case: Click "Add Test Case"
    const addTcBtn = page.getByRole('button', { name: /Add Test Case/i });
    await addTcBtn.click();

    // Configure Test Case 2
    const tc2Input = page.getByLabel('Test case 2 input');
    await tc2Input.fill('');
    const tc2Expected = page.getByLabel('Test case 2 expected output');
    await tc2Expected.fill('Welcome');

    // Toggle TC2 visibility checkbox to Hidden
    const tc2VisibilityCheckbox = page.getByRole('checkbox', { name: /Public \(Sample\)/i }).last();
    await tc2VisibilityCheckbox.check();
    await expect(page.getByRole('checkbox', { name: /Hidden \(Grading\)/i }).last()).toBeChecked();

    // 10. Test "Run All Tests" execution
    const runAllBtn = page.getByRole('button', { name: /Run All/i }).first();
    await expect(runAllBtn).toBeVisible();
    await runAllBtn.click();

    // Verify Execution Report tab displays results
    await expect(page.getByText(/Report \(/i)).toBeVisible({ timeout: 15000 });

    // Delete question 1 (the default MCQ) to keep only the coding question
    const deleteQ1Btn = page.locator('button[title*="Delete question"]').first();
    if (await deleteQ1Btn.isVisible()) {
      await deleteQ1Btn.click();
      const confirmDeleteModalBtn = page.locator('div[role="dialog"]').getByRole('button', { name: 'Delete Question' });
      if (await confirmDeleteModalBtn.isVisible()) {
        await confirmDeleteModalBtn.click();
      }
    }

    // 11. Save Assessment Draft
    const saveDraftBtn = page.getByRole('button', { name: 'Save Draft' });
    await expect(saveDraftBtn).toBeVisible();
    await saveDraftBtn.click();

    // Verify navigation back to assessments list
    await expect(page).toHaveURL(/\/instructor\/assessments/, { timeout: 15000 });

    // 12. Edit Coding Question: Re-open the created assessment
    const examRow = page.locator('tr', { hasText: uniqueExamTitle });
    await expect(examRow).toBeVisible();
    const editBtn = examRow.locator('button[title="Edit Assessment"]');
    await editBtn.click();

    // Verify Edit Assessment page loads with FacultyCodeIDE intact
    await expect(page.locator('h1', { hasText: /Edit Assessment|Author New Assessment/ })).toBeVisible();
    await expect(page.getByText('Faculty Coding IDE & Test Validator')).toBeVisible();
    await expect(page.getByText('Something went wrong')).not.toBeVisible();
    await expect(page.getByText('FileCode is not defined')).not.toBeVisible();

    // 13. Publish Assessment Live
    const publishBtn = page.getByRole('button', { name: 'Publish Live' });
    await publishBtn.click();

    // Confirm modal publish
    const modalConfirmBtn = page.getByRole('button', { name: 'Confirm & Publish' });
    if (await modalConfirmBtn.isVisible()) {
      await modalConfirmBtn.click();
    }

    // Verify redirection to assessments list with published status
    await expect(page).toHaveURL(/\/instructor\/assessments/, { timeout: 15000 });
    await expect(page.locator('tr', { hasText: uniqueExamTitle })).toBeVisible();

    // Assert that zero runtime errors occurred on page
    const fileCodeErrors = pageErrors.filter((e) => e.includes('FileCode'));
    expect(fileCodeErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });
});
