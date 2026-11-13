const { test, expect } = require('@playwright/test');

test.describe('Student MCQ Answer Selection and Save & Next Enhancement', () => {
  let instructorToken;
  let studentToken;

  test.beforeAll(async ({ request }) => {
    // Get instructor auth token to author test assessments
    const instRes = await request.post('http://localhost:5000/api/auth/login', {
      data: { email: 'instructor@uap.edu', password: 'Instructor@123' },
    });
    const instJson = await instRes.json();
    instructorToken = instJson.data?.accessToken;

    // Get student auth token
    const studRes = await request.post('http://localhost:5000/api/auth/login', {
      data: { email: 'student@uap.edu', password: 'Student@123' },
    });
    const studJson = await studRes.json();
    studentToken = studJson.data?.accessToken;
  });

  test.beforeEach(async ({ page }) => {
    // Log in as student
    await page.goto('/auth/login');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.fill('#email', 'student@uap.edu');
    await page.fill('#password', 'Student@123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/student\/dashboard/);
    await expect(page.getByText('Student Workspace', { exact: true })).toBeVisible({ timeout: 10000 });
  });

  test('Scenario 1 to 4: Immediate selection, selection change, Save & Next preservation, and return to question', async ({ page, request }) => {
    const examTitle = `E2E MCQ Selection Flow ${Date.now()}`;
    const asmtRes = await request.post('http://localhost:5000/api/assessments', {
      headers: { Authorization: `Bearer ${instructorToken}` },
      data: {
        title: examTitle,
        description: 'Testing MCQ immediate highlight and Save & Next in-memory persistence',
        category: 'Computer Science',
        durationMinutes: 30,
        passingScore: 50,
        status: 'published',
        accessType: 'public',
        questions: [
          {
            questionText: 'What is the time complexity of binary search?',
            type: 'mcq',
            points: 10,
            options: [
              { id: 'opt_a', text: 'O(1) - Constant' },
              { id: 'opt_b', text: 'O(log n) - Logarithmic' },
              { id: 'opt_c', text: 'O(n) - Linear' },
              { id: 'opt_d', text: 'O(n^2) - Quadratic' },
            ],
            correctAnswer: 'opt_b',
          },
          {
            questionText: 'Which protocol is connection-oriented?',
            type: 'mcq',
            points: 10,
            options: [
              { id: 'opt_a', text: 'UDP' },
              { id: 'opt_b', text: 'TCP' },
              { id: 'opt_c', text: 'IP' },
              { id: 'opt_d', text: 'ICMP' },
            ],
            correctAnswer: 'opt_b',
          },
        ],
      },
    });
    const asmtJson = await asmtRes.json();
    const asmtId = asmtJson.data?._id || asmtJson.data?.id;

    // Navigate to attempt page
    await page.goto(`/student/attempt/${asmtId}`);
    await expect(page.locator(`text=${examTitle}`)).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Question 1 of 2')).toBeVisible();

    // 1. Select option A: it highlights immediately without extra button
    const optAButton = page.locator('button', { hasText: 'O(1) - Constant' });
    const optBButton = page.locator('button', { hasText: 'O(log n) - Logarithmic' });

    await optAButton.click();
    await expect(optAButton).toHaveClass(/ring-1 ring-\[#E05D38\]/);
    await expect(optBButton).not.toHaveClass(/ring-1 ring-\[#E05D38\]/);

    // 2. Change selection to B: B becomes selected immediately
    await optBButton.click();
    await expect(optBButton).toHaveClass(/ring-1 ring-\[#E05D38\]/);
    await expect(optAButton).not.toHaveClass(/ring-1 ring-\[#E05D38\]/);

    // 2B. Test Next Question navigation alone: does NOT save selection
    // Let's test that clicking "Next Question" without Save & Next does not save
    // First, let's click Next Question on Q1 without saving B
    await page.getByRole('button', { name: 'Next Question' }).click();
    await expect(page.locator('text=Question 2 of 2')).toBeVisible();

    // Go back to Question 1: verify B was not saved because Save & Next was not clicked
    await page.getByRole('button', { name: 'Previous Question' }).click();
    await expect(page.locator('text=Question 1 of 2')).toBeVisible();
    await expect(page.locator('button', { hasText: 'O(log n) - Logarithmic' })).not.toHaveClass(/ring-1 ring-\[#E05D38\]/);

    // 3. Now select B again, and click Save & Next
    await page.locator('button', { hasText: 'O(log n) - Logarithmic' }).click();
    await expect(page.locator('button', { hasText: 'O(log n) - Logarithmic' })).toHaveClass(/ring-1 ring-\[#E05D38\]/);

    await page.getByRole('button', { name: 'Save & Next' }).click();

    // 3B. Moves to Question 2
    await expect(page.locator('text=Question 2 of 2')).toBeVisible();

    // Verify Question 1 is marked answered in palette
    const q1PaletteBtn = page.getByRole('button', { name: 'Q1' });
    await expect(q1PaletteBtn).toHaveClass(/bg-\[#EAF4F1\]/);

    // 4. Return to Question 1: B remains selected in the current page session
    await page.getByRole('button', { name: 'Previous Question' }).click();
    await expect(page.locator('text=Question 1 of 2')).toBeVisible();
    await expect(page.locator('button', { hasText: 'O(log n) - Logarithmic' })).toHaveClass(/ring-1 ring-\[#E05D38\]/);

    // 4B. Test that unsaved edit does not overwrite previously saved B:
    // Change selection to C, but click Next Question without Save & Next
    const optCButton = page.locator('button', { hasText: 'O(n) - Linear' });
    await optCButton.click();
    await expect(optCButton).toHaveClass(/ring-1 ring-\[#E05D38\]/);
    await page.getByRole('button', { name: 'Next Question' }).click();
    await expect(page.locator('text=Question 2 of 2')).toBeVisible();

    // Return to Question 1: B is still saved! C was discarded because Save & Next was not clicked
    await page.getByRole('button', { name: 'Previous Question' }).click();
    await expect(page.locator('text=Question 1 of 2')).toBeVisible();
    await expect(page.locator('button', { hasText: 'O(log n) - Logarithmic' })).toHaveClass(/ring-1 ring-\[#E05D38\]/);
    await expect(optCButton).not.toHaveClass(/ring-1 ring-\[#E05D38\]/);
  });

  test('Scenario 5 to 8: Page reload clears all answers, draft is not restored, and submit submits only active session', async ({ page, request }) => {
    const examTitle = `E2E Refresh Clearing Exam ${Date.now()}`;
    const asmtRes = await request.post('http://localhost:5000/api/assessments', {
      headers: { Authorization: `Bearer ${instructorToken}` },
      data: {
        title: examTitle,
        description: 'Testing complete refresh answer clearing and clean submission',
        category: 'Networking',
        durationMinutes: 25,
        passingScore: 50,
        status: 'published',
        accessType: 'public',
        questions: [
          {
            questionText: 'What layer does IP operate at in OSI model?',
            type: 'mcq',
            points: 10,
            options: [
              { id: 'opt_1', text: 'Data Link Layer' },
              { id: 'opt_2', text: 'Network Layer' },
              { id: 'opt_3', text: 'Transport Layer' },
              { id: 'opt_4', text: 'Application Layer' },
            ],
            correctAnswer: 'opt_2',
          },
          {
            questionText: 'Is HTTP stateless?',
            type: 'mcq',
            points: 10,
            options: [
              { id: 'opt_1', text: 'Yes, HTTP is stateless' },
              { id: 'opt_2', text: 'No, HTTP is stateful' },
            ],
            correctAnswer: 'opt_1',
          },
        ],
      },
    });
    const asmtJson = await asmtRes.json();
    const asmtId = asmtJson.data?._id || asmtJson.data?.id;

    // Navigate to attempt
    await page.goto(`/student/attempt/${asmtId}`);
    await expect(page.locator(`text=${examTitle}`)).toBeVisible({ timeout: 10000 });

    // Answer Q1 with Option 2 and Save & Next
    const netLayerBtn = page.locator('button', { hasText: 'Network Layer' });
    await netLayerBtn.click();
    await page.getByRole('button', { name: 'Save & Next' }).click();

    // Verify Q2 is active and Q1 is marked answered
    await expect(page.locator('text=Question 2 of 2')).toBeVisible();
    const q1Palette = page.getByRole('button', { name: 'Q1' });
    await expect(q1Palette).toHaveClass(/bg-\[#EAF4F1\]/);

    // 5. Refresh the page: all answers, including Network Layer (opt_2), must be cleared
    await page.reload();
    await expect(page.locator(`text=${examTitle}`)).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Question 1 of 2')).toBeVisible();

    // 6. Verify that old answers are NOT restored from backend or draft
    const netLayerAfterReload = page.locator('button', { hasText: 'Network Layer' });
    await expect(netLayerAfterReload).not.toHaveClass(/ring-1 ring-\[#E05D38\]/);

    // Verify palette shows all questions unanswered (0 of 2 answered)
    await expect(page.locator('text=0 of 2 answered')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Q1' })).not.toHaveClass(/bg-\[#EAF4F1\]/);
    await expect(page.getByRole('button', { name: 'Q2' })).not.toHaveClass(/bg-\[#EAF4F1\]/);

    // Also navigate to Q2: verify Q2 is also unanswered
    await page.getByRole('button', { name: 'Next Question' }).click();
    await expect(page.locator('text=Question 2 of 2')).toBeVisible();
    await expect(page.locator('button', { hasText: 'Yes, HTTP is stateless' })).not.toHaveClass(/ring-1 ring-\[#E05D38\]/);

    // 7. Submit after refresh: previously cleared answers must NOT be submitted
    // Submit exam with 0 answers
    await page.getByRole('button', { name: 'Review & Submit' }).click();
    await expect(page.locator('text=Finalize Assessment Submission')).toBeVisible();
    await expect(page.locator('text=Questions Answered:').locator('..').getByText('0')).toBeVisible();

    await page.getByRole('button', { name: 'Confirm Submission' }).click();
    await expect(page).toHaveURL(/\/student\/dashboard/, { timeout: 20000 });

    // 8. Verify submission on dashboard: score is 0, autoScore is 0, percentage is 0%
    const submissionRow = page.locator('tr', { hasText: examTitle });
    await expect(submissionRow).toBeVisible({ timeout: 10000 });
    await expect(submissionRow).toContainText('0 / 20 (0%)');
    await expect(submissionRow).toContainText('evaluated');
  });
});
