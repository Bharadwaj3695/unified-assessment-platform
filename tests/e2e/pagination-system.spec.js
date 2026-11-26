const { test, expect } = require('@playwright/test');

async function loginAs(page, email, password, expectedUrlRegex) {
  await page.goto('/auth/login');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(expectedUrlRegex, { timeout: 20000 });
}

test.describe('Reusable Pagination System — Browser UI Verification', () => {
  test('Faculty pagination across My Tests, Assessments, Question Bank, Submissions, Students & Excluded Pages', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });

    // Capture access token from login response
    const loginRespPromise = page.waitForResponse(
      (resp) => resp.url().includes('/api/auth/login') && resp.request().method() === 'POST'
    );
    await loginAs(page, 'instructor@uap.edu', 'Instructor@123', /\/instructor\/dashboard/);
    const loginResp = await loginRespPromise;
    const loginJson = await loginResp.json();
    const token = loginJson?.data?.accessToken || loginJson?.accessToken;
    expect(token).toBeTruthy();

    // Ensure at least 12 assessments and 12 questions exist for multi-page verification
    const createdMeta = await page.evaluate(async (authToken) => {
      const csrfMatch = document.cookie.match(/(?:^|;\s*)uap_csrf=([^;]*)/);
      const csrf = csrfMatch ? decodeURIComponent(csrfMatch[1]) : '';
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
        ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
      };

      const asmtListRes = await fetch('/api/assessments?limit=50', { headers });
      const asmtListJson = await asmtListRes.json();
      const existingAsmts = asmtListJson?.data || [];
      const needAsmts = Math.max(0, 12 - existingAsmts.length);
      for (let i = 1; i <= needAsmts; i++) {
        await fetch('/api/assessments', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            title: `Pagination Verify Exam ${String(i).padStart(2, '0')}`,
            description: 'Automated pagination verification exam',
            category: 'Computer Science',
            durationMinutes: 25,
            totalPoints: 10,
            passingScore: 60,
            status: 'published',
            accessType: 'public',
            questions: [
              {
                questionText: `Sample Q${i}`,
                type: 'mcq',
                points: 10,
                options: [
                  { id: 'a', text: 'Option A' },
                  { id: 'b', text: 'Option B' },
                ],
                correctAnswer: 'a',
              },
            ],
          }),
        });
      }

      const qListRes = await fetch('/api/questions?limit=50', { headers });
      const qListJson = await qListRes.json();
      const existingQs = qListJson?.data || [];
      const needQs = Math.max(0, 12 - existingQs.length);
      for (let i = 1; i <= needQs; i++) {
        await fetch('/api/questions', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            statement: `Pagination Bank Question ${String(i).padStart(2, '0')}`,
            questionType: 'SINGLE_MCQ',
            difficulty: 'EASY',
            marks: 2,
            subject: 'Computer Science',
            options: [
              { id: 'a', text: 'True', isCorrect: true },
              { id: 'b', text: 'False', isCorrect: false },
            ],
            answerKey: 'a',
          }),
        });
      }
      return { existingAsmts: existingAsmts.length, needAsmts, existingQs: existingQs.length, needQs };
    }, token);
    expect(createdMeta).toBeTruthy();

    // Verify excluded Instructor Dashboard has NO pagination
    await expect(page.locator('[data-testid$="-pagination"]')).toHaveCount(0);

    // 1. My Tests (/instructor/tests)
    await page.goto('/instructor/tests');
    const asmtPag = page.getByTestId('assessments-pagination');
    await expect(asmtPag).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('assessments-pagination-page-size')).toHaveValue('10');
    await expect(page.getByTestId('assessments-pagination-summary')).toContainText('Showing 1–10 of');
    await expect(page.getByTestId('assessments-pagination-prev')).toBeDisabled();
    await expect(page.getByTestId('assessments-pagination-first')).toBeDisabled();

    // Capture page 1 first row title, click Next, verify page 2 has different rows
    const firstRowPage1 = await page.locator('tbody tr').first().innerText();
    await page.getByTestId('assessments-pagination-next').click();
    await expect(page.getByTestId('assessments-pagination-summary')).toContainText('Showing 11–');
    const firstRowPage2 = await page.locator('tbody tr').first().innerText();
    expect(firstRowPage2).not.toEqual(firstRowPage1);

    // First page button returns to page 1
    await page.getByTestId('assessments-pagination-first').click();
    await expect(page.getByTestId('assessments-pagination-summary')).toContainText('Showing 1–10 of');

    // Last page button goes to last page & disables Next/Last
    await page.getByTestId('assessments-pagination-last').click();
    await expect(page.getByTestId('assessments-pagination-next')).toBeDisabled();
    await expect(page.getByTestId('assessments-pagination-last')).toBeDisabled();

    // Page-size change to 5 resets to page 1 and displays 5 rows
    await page.getByTestId('assessments-pagination-page-size').selectOption('5');
    await expect(page.getByTestId('assessments-pagination-summary')).toContainText('Showing 1–5 of');
    await expect(page.locator('tbody tr')).toHaveCount(5);

    // Filter reset: switching status tab resets to page 1
    await page.getByTestId('assessments-pagination-next').click();
    await expect(page.getByTestId('assessments-pagination-summary')).toContainText('Showing 6–10 of');
    await page.getByRole('button', { name: 'Published' }).click();
    await expect(page.getByTestId('assessments-pagination-summary')).toContainText('Showing 1–5 of');

    // 2. Assessment List alias (/instructor/assessments)
    await page.goto('/instructor/assessments');
    await expect(page.getByTestId('assessments-pagination')).toBeVisible({ timeout: 15000 });

    // 3. Question Bank (/instructor/question-bank)
    await page.goto('/instructor/question-bank');
    const qbPag = page.getByTestId('question-bank-pagination');
    await expect(qbPag).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('question-bank-pagination-summary')).toContainText('Showing 1–10 of');
    await page.getByTestId('question-bank-pagination-page-size').selectOption('5');
    await expect(page.getByTestId('question-bank-pagination-summary')).toContainText('Showing 1–5 of');
    await page.getByTestId('question-bank-pagination-next').click();
    await expect(page.getByTestId('question-bank-pagination-summary')).toContainText('Showing 6–10 of');

    // Empty search hides pagination & shows empty state
    await page.getByLabel('Search questions').fill('zz_no_match_99999');
    await expect(page.getByText('No questions match your search or filter criteria.')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('question-bank-pagination')).toHaveCount(0);

    // 4. Submissions Queue (/instructor/submissions)
    await page.goto('/instructor/submissions');
    await expect(page.getByText('Submission Evaluation Queue')).toBeVisible({ timeout: 15000 });

    // 5. Faculty Students (/instructor/students)
    await page.goto('/instructor/students');
    await expect(page.getByText('Active Students')).toBeVisible({ timeout: 15000 });

    // 6. Excluded pages must NOT render pagination
    await page.goto('/instructor/test-creator');
    await expect(page.locator('[data-testid$="-pagination"]')).toHaveCount(0);
    await page.goto('/instructor/question-studio');
    await expect(page.locator('[data-testid$="-pagination"]')).toHaveCount(0);
    await page.goto('/instructor/profile');
    await expect(page.locator('[data-testid$="-pagination"]')).toHaveCount(0);
  });

  test('Student pagination across Available Tests, My Attempts, My Results, Progress & Excluded Pages', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await loginAs(page, 'student@uap.edu', 'Student@123', /\/student\/dashboard/);

    // Dashboard overview must NOT render pagination
    await expect(page.getByText('Assessment Performance').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid$="-pagination"]')).toHaveCount(0);

    // Available Tests (/student/tests)
    await page.goto('/student/tests');
    await expect(page.getByText('Available Tests').first()).toBeVisible({ timeout: 15000 });
    const catalogPag = page.getByTestId('catalog-pagination');
    await expect(catalogPag).toBeVisible({ timeout: 15000 });
    await page.getByTestId('catalog-pagination-page-size').selectOption('5');
    await expect(page.getByTestId('catalog-pagination-summary')).toContainText('Showing 1–5 of');
    await page.getByTestId('catalog-pagination-next').click();
    await expect(page.getByTestId('catalog-pagination-summary')).toContainText('Showing 6–10 of');

    // Category filter resets back to page 1
    await page.getByRole('button', { name: 'Computer Science', exact: true }).click();
    await expect(page.getByTestId('catalog-pagination-summary')).toContainText('Showing 1–5 of');

    // My Attempts (/student/attempts)
    await page.goto('/student/attempts');
    await expect(page.getByText('My Attempts').first()).toBeVisible({ timeout: 15000 });

    // My Results (/student/results)
    await page.goto('/student/results');
    await expect(page.getByText('My Results').first()).toBeVisible({ timeout: 15000 });

    // Exam Performance Progress (/student/progress)
    await page.goto('/student/progress');
    await expect(page.getByTestId('student-exam-progress-view')).toBeVisible({ timeout: 15000 });

    // My Certificates (/student/certificates)
    await page.goto('/student/certificates');
    await expect(page.getByRole('heading', { name: 'My Certificates', level: 1 })).toBeVisible({ timeout: 15000 });

    // Student Profile must NOT render pagination
    await page.goto('/student/profile');
    await expect(page.locator('[data-testid$="-pagination"]')).toHaveCount(0);
  });
});
