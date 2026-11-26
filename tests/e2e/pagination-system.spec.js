const { test, expect } = require('@playwright/test');

async function loginAs(page, email, password, expectedUrlRegex) {
  await page.goto('/auth/login');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('#email', { state: 'visible', timeout: 30000 });
  await page.fill('#email', email);
  await page.fill('#password', password);
  const loginRespPromise = page.waitForResponse(
    (resp) => resp.url().includes('/api/auth/login') && resp.request().method() === 'POST',
    { timeout: 30000 }
  );
  await page.click('button[type="submit"]');
  const loginResp = await loginRespPromise;
  const loginJson = await loginResp.json();
  await expect(page).toHaveURL(expectedUrlRegex, { timeout: 20000 });
  return loginJson;
}

test.describe('Reusable Pagination System — Browser UI Verification', () => {
  test('Faculty pagination across My Tests, Assessments, Question Bank, Submissions, Students & Excluded Pages', async ({ page }) => {
    test.setTimeout(180000);
    await page.setViewportSize({ width: 1366, height: 900 });

    const loginJson = await loginAs(page, 'instructor@uap.edu', 'Instructor@123', /\/instructor\/dashboard/);
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

      // Ensure at least 6 published mock tests exist for MockTestsList pagination
      const mtListRes = await fetch('/api/mock-tests?limit=50', { headers });
      const mtListJson = await mtListRes.json();
      const existingMts = mtListJson?.data || [];
      const needMts = Math.max(0, 6 - existingMts.length);
      if (needMts > 0) {
        const subRes = await fetch('/api/subjects', { headers });
        const subJson = await subRes.json();
        const firstSub = (subJson?.data || [])[0];
        if (firstSub) {
          for (let i = 1; i <= needMts; i++) {
            const createMt = await fetch('/api/mock-tests', {
              method: 'POST',
              headers,
              body: JSON.stringify({
                title: `Pagination Mock Test ${String(i).padStart(2, '0')}`,
                examination: 'GATE',
                subjectId: firstSub._id || firstSub.id,
                durationMinutes: 30,
                totalMarks: 10,
                selectionMode: 'MANUAL',
              }),
            });
            const mtCreated = await createMt.json();
            const mtId = mtCreated?.data?._id || mtCreated?.data?.id;
            if (mtId) {
              await fetch(`/api/mock-tests/${mtId}/publish`, { method: 'POST', headers });
            }
          }
        }
      }

      // Fetch refreshed assessments list for student submission seeding
      const refreshedAsmtRes = await fetch('/api/assessments?limit=50', { headers });
      const refreshedAsmtJson = await refreshedAsmtRes.json();
      const allAsmts = (refreshedAsmtJson?.data || []).filter((a) => a.status === 'published');

      return {
        existingAsmts: existingAsmts.length,
        needAsmts,
        existingQs: existingQs.length,
        needQs,
        assessmentIds: allAsmts.slice(0, 8).map((a) => a._id || a.id),
      };
    }, token);
    expect(createdMeta).toBeTruthy();

    // Seed student submissions & evaluations in an isolated browser context so faculty cookies remain intact
    const studentCtx = await page.context().browser().newContext();
    const studentPage = await studentCtx.newPage();
    const stuLoginJson = await loginAs(studentPage, 'student@uap.edu', 'Student@123', /\/student\/dashboard/);
    const studentToken = stuLoginJson?.data?.accessToken || stuLoginJson?.accessToken;
    expect(studentToken).toBeTruthy();

    const submittedIds = await studentPage.evaluate(async ({ authToken, asmtIds }) => {
      const csrfMatch = document.cookie.match(/(?:^|;\s*)uap_csrf=([^;]*)/);
      const csrf = csrfMatch ? decodeURIComponent(csrfMatch[1]) : '';
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
        ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
      };
      const existingRes = await fetch('/api/submissions/student', { headers });
      const existingJson = await existingRes.json();
      const existing = Array.isArray(existingJson?.data) ? existingJson.data : [];
      const alreadyAttempted = new Set(
        existing.map((s) => String(s.assessment?._id || s.assessment?.id || s.assessmentId?._id || s.assessmentId))
      );
      const newSubIds = [];
      for (const aId of asmtIds) {
        if (alreadyAttempted.has(String(aId))) continue;
        const startRes = await fetch('/api/submissions/start', {
          method: 'POST',
          headers,
          body: JSON.stringify({ assessmentId: aId }),
        });
        if (!startRes.ok) continue;
        const startJson = await startRes.json();
        const subId = startJson?.data?._id || startJson?.data?.id;
        if (!subId) continue;
        const submitRes = await fetch(`/api/submissions/${subId}/submit`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ answers: {}, timeSpentSeconds: 30 }),
        });
        if (submitRes.ok) {
          newSubIds.push(subId);
        }
      }
      return newSubIds;
    }, { authToken: studentToken, asmtIds: createdMeta.assessmentIds });
    await studentCtx.close();

    // Evaluate newly created submissions as faculty so Evaluation History & My Results have >= 6 evaluated records
    if (Array.isArray(submittedIds) && submittedIds.length > 0) {
      await page.evaluate(async ({ authToken, subIds }) => {
        const csrfMatch = document.cookie.match(/(?:^|;\s*)uap_csrf=([^;]*)/);
        const csrf = csrfMatch ? decodeURIComponent(csrfMatch[1]) : '';
        const headers = {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
          ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
        };
        for (const sId of subIds.slice(0, 6)) {
          await fetch(`/api/evaluations/submission/${sId}`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              finalScore: 8,
              generalFeedback: 'Automated pagination evaluation check.',
              questionFeedback: {},
            }),
          });
        }
      }, { authToken: token, subIds: submittedIds });
    }

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

    // Dark theme verification on pagination component
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await expect(asmtPag).toBeVisible();
    await page.evaluate(() => document.documentElement.classList.remove('dark'));

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

    // 4. Submissions Queue & Evaluation History (/instructor/submissions)
    await page.goto('/instructor/submissions');
    await expect(page.getByText('Submission Evaluation Queue')).toBeVisible({ timeout: 15000 });
    const subPag = page.getByTestId('submissions-pagination');
    await expect(subPag).toBeVisible({ timeout: 15000 });
    await page.getByTestId('submissions-pagination-page-size').selectOption('5');
    await expect(page.getByTestId('submissions-pagination-summary')).toContainText('Showing 1–5 of');
    await page.getByTestId('submissions-pagination-next').click();
    await expect(page.getByTestId('submissions-pagination-summary')).toContainText('Showing 6–');
    // Switching to Evaluated tab (Evaluation History) resets to page 1
    await page.getByRole('button', { name: 'Evaluated', exact: true }).click();
    await expect(page.getByTestId('submissions-pagination-summary')).toContainText('Showing 1–5 of');

    // 5. Faculty Students (/instructor/students)
    await page.goto('/instructor/students');
    await expect(page.getByText('Active Students')).toBeVisible({ timeout: 15000 });
    const stuPag = page.getByTestId('students-pagination');
    await expect(stuPag).toBeVisible({ timeout: 15000 });
    await page.getByTestId('students-pagination-page-size').selectOption('5');
    await expect(page.getByTestId('students-pagination-summary')).toContainText('Showing 1–5 of');
    await page.getByTestId('students-pagination-next').click();
    await expect(page.getByTestId('students-pagination-summary')).toContainText('Showing 6–');

    // 6. Excluded pages must NOT render pagination
    await page.goto('/instructor/test-creator');
    await expect(page.locator('[data-testid$="-pagination"]')).toHaveCount(0);
    await page.goto('/instructor/question-studio');
    await expect(page.locator('[data-testid$="-pagination"]')).toHaveCount(0);
    await page.goto('/instructor/profile');
    await expect(page.locator('[data-testid$="-pagination"]')).toHaveCount(0);
  });

  test('Student pagination across Available Tests, My Attempts, My Results, Progress, Mock Tests & Excluded Pages', async ({ page }) => {
    test.setTimeout(180000);
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

    // Mock Tests List (/student/mock-tests)
    await page.goto('/student/mock-tests');
    await expect(page.getByText('Practice Tests & Mock Exams')).toBeVisible({ timeout: 15000 });
    const mtPag = page.getByTestId('mock-tests-pagination');
    if (await mtPag.isVisible().catch(() => false)) {
      await page.getByTestId('mock-tests-pagination-page-size').selectOption('5');
      await expect(page.getByTestId('mock-tests-pagination-summary')).toContainText('Showing 1–5 of');
      await page.getByTestId('mock-tests-pagination-next').click();
      await expect(page.getByTestId('mock-tests-pagination-summary')).toContainText('Showing 6–');
    }

    // My Attempts (/student/attempts)
    await page.goto('/student/attempts');
    await expect(page.getByText('My Attempts').first()).toBeVisible({ timeout: 15000 });
    const attPag = page.getByTestId('attempts-pagination');
    await expect(attPag).toBeVisible({ timeout: 15000 });
    await page.getByTestId('attempts-pagination-page-size').selectOption('5');
    await expect(page.getByTestId('attempts-pagination-summary')).toContainText('Showing 1–5 of');
    await page.getByTestId('attempts-pagination-next').click();
    await expect(page.getByTestId('attempts-pagination-summary')).toContainText('Showing 6–');

    // My Results (/student/results)
    await page.goto('/student/results');
    await expect(page.getByText('My Results').first()).toBeVisible({ timeout: 15000 });
    const resPag = page.getByTestId('results-pagination');
    await expect(resPag).toBeVisible({ timeout: 15000 });
    await page.getByTestId('results-pagination-page-size').selectOption('5');
    await expect(page.getByTestId('results-pagination-summary')).toContainText('Showing 1–5 of');
    await page.getByTestId('results-pagination-next').click();
    await expect(page.getByTestId('results-pagination-summary')).toContainText('Showing 6–');

    // Exam Performance Progress (/student/progress)
    await page.goto('/student/progress');
    await expect(page.getByTestId('student-exam-progress-view')).toBeVisible({ timeout: 15000 });
    const progPag = page.getByTestId('progress-evaluated-pagination');
    await expect(progPag).toBeVisible({ timeout: 15000 });
    await page.getByTestId('progress-evaluated-pagination-page-size').selectOption('5');
    await expect(page.getByTestId('progress-evaluated-pagination-summary')).toContainText('Showing 1–5 of');
    await page.getByTestId('progress-evaluated-pagination-next').click();
    await expect(page.getByTestId('progress-evaluated-pagination-summary')).toContainText('Showing 6–');

    // My Certificates (/student/certificates)
    await page.goto('/student/certificates');
    await expect(page.getByRole('heading', { name: 'My Certificates', level: 1 })).toBeVisible({ timeout: 15000 });

    // Student Profile must NOT render pagination
    await page.goto('/student/profile');
    await expect(page.locator('[data-testid$="-pagination"]')).toHaveCount(0);
  });
});
