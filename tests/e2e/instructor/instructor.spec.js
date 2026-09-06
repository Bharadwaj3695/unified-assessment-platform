const { test, expect } = require('@playwright/test');

test.describe('Instructor Assessment Management & Evaluation', () => {
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

  test('1. Instructor creates assessment and saves as draft', async ({ page }) => {
    await page.goto('/instructor/create');

    const draftTitle = `E2E Systems Draft Exam ${Date.now()}`;
    await page.fill('input[placeholder*="Distributed Systems"]', draftTitle);
    await page.fill('textarea[rows="3"]', 'Comprehensive evaluation of operating system concurrency primitives.');

    // Fill Question 1 prompt & options
    await page.fill('textarea[placeholder*="Enter question text"]', 'What synchronization primitive prevents deadlocks?');
    await page.fill('input[placeholder*="Option A"]', 'Mutex lock with lock hierarchy');
    await page.fill('input[placeholder*="Option B"]', 'Busy waiting loop');
    await page.fill('input[placeholder*="Option C"]', 'Ignoring concurrency completely');
    await page.fill('input[placeholder*="Option D"]', 'Unsynchronized shared memory');

    // Click Save Draft
    await page.getByRole('button', { name: 'Save Draft' }).click();

    // Verify redirected or draft saved successfully
    await expect(page).toHaveURL(/\/instructor\/assessments/);
    await expect(page.locator(`text=${draftTitle}`)).toBeVisible({ timeout: 10000 });
    await expect(page.locator('tr, div', { hasText: draftTitle }).locator('text=draft').first()).toBeVisible();
  });

  test('2. Instructor creates and publishes assessment live to students', async ({ page }) => {
    await page.goto('/instructor/create');

    const liveTitle = `E2E Live Published Exam ${Date.now()}`;
    await page.fill('input[placeholder*="Distributed Systems"]', liveTitle);
    await page.fill('textarea[rows="3"]', 'Public examination on asynchronous programming and events.');

    // Fill Question 1
    await page.fill('textarea[placeholder*="Enter question text"]', 'What is the JavaScript event loop queue order?');
    await page.fill('input[placeholder*="Option A"]', 'Microtasks execute before macrotasks');
    await page.fill('input[placeholder*="Option B"]', 'Macrotasks execute first always');
    await page.fill('input[placeholder*="Option C"]', 'Both execute in parallel');
    await page.fill('input[placeholder*="Option D"]', 'Synchronous blocks execute last');

    // Click Publish Live -> Confirm & Publish
    await page.getByRole('button', { name: 'Publish Live' }).click();
    await expect(page.locator('text=Publish Assessment')).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: 'Confirm & Publish' }).click();

    // Verify redirected and published badge is visible
    await expect(page).toHaveURL(/\/instructor\/assessments/);
    await expect(page.locator(`text=${liveTitle}`)).toBeVisible({ timeout: 10000 });
    await expect(page.locator('tr, div', { hasText: liveTitle }).locator('text=published').first()).toBeVisible();
  });

  test('3. Instructor searches assessments and enrolled students', async ({ page }) => {
    // 3A. Search assessments
    await page.goto('/instructor/assessments');
    const searchInput = page.locator('input[placeholder="Filter list..."]');
    if (await searchInput.isVisible()) {
      await searchInput.fill('Architecture');
      // Verify filtered result
      await expect(page.locator('text=Architecture').first()).toBeVisible({ timeout: 5000 });
    }

    // 3B. Search students
    await page.goto('/instructor/students');
    const studentSearchInput = page.locator('input[placeholder="Search students..."]');
    if (await studentSearchInput.isVisible()) {
      await studentSearchInput.fill('student@uap.edu');
      await expect(page.locator('text=student@uap.edu').first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('4. Instructor views submissions queue', async ({ page }) => {
    await page.goto('/instructor/submissions');
    await expect(page.locator('text=Submission Evaluation Queue')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('th', { hasText: 'Student' })).toBeVisible();
    await expect(page.locator('th', { hasText: 'Assessment' })).toBeVisible();
  });

  test('5. Instructor opens evaluation studio and evaluates subjective answers', async ({ page, request }) => {
    // 1. Instructor logs in via API to get auth token
    const instructorLoginRes = await request.post('http://localhost:5000/api/auth/login', {
      data: { email: 'instructor@uap.edu', password: 'Instructor@123' },
    });
    const instructorJson = await instructorLoginRes.json();
    const instructorToken = instructorJson.data?.accessToken;

    // 2. Student logs in via API to get auth token
    const studentLoginRes = await request.post('http://localhost:5000/api/auth/login', {
      data: { email: 'student@uap.edu', password: 'Student@123' },
    });
    const studentJson = await studentLoginRes.json();
    const studentToken = studentJson.data?.accessToken;

    // 3. Create an assessment with a subjective short_answer question
    const asmtRes = await request.post('http://localhost:5000/api/assessments', {
      headers: { Authorization: `Bearer ${instructorToken}` },
      data: {
        title: `Subjective Grading Test Exam ${Date.now()}`,
        description: 'Testing manual subjective score evaluation',
        category: 'Software Engineering',
        durationMinutes: 30,
        passingScore: 50,
        status: 'published',
        accessType: 'public',
        questions: [
          {
            questionText: 'Explain the single responsibility principle in OOP.',
            type: 'short_answer',
            points: 20,
            explanation: 'A module or class should be responsible to one, and only one, actor.',
          },
        ],
      },
    });
    const asmtJson = await asmtRes.json();
    const asmtId = asmtJson.data?._id || asmtJson.data?.id;

    // 4. Student starts attempt
    const attemptRes = await request.post('http://localhost:5000/api/submissions/start', {
      headers: { Authorization: `Bearer ${studentToken}` },
      data: { assessmentId: asmtId },
    });
    const attemptJson = await attemptRes.json();
    const subId = attemptJson.data?._id || attemptJson.data?.id;
    const qId = asmtJson.data?.questions?.[0]?._id || asmtJson.data?.questions?.[0]?.id;

    // 5. Student submits answer
    await request.post(`http://localhost:5000/api/submissions/${subId}/submit`, {
      headers: { Authorization: `Bearer ${studentToken}` },
      data: {
        answers: {
          [qId]: 'A class should have only one reason to change, meaning only one responsibility.',
        },
      },
    });

    // 6. Instructor navigates to Evaluation Studio for this submission
    await page.goto(`/instructor/evaluate/${subId}`);
    await expect(page.locator('text=Evaluation Studio')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Explain the single responsibility principle')).toBeVisible();

    // Fill subjective points awarded (20 / 20)
    const scoreInput = page.locator('input[placeholder*="0 -"]');
    await scoreInput.fill('18');

    // Fill overall feedback
    await page.fill('textarea[placeholder*="Provide a comprehensive summary"]', 'Exceptional precision in explaining SRP.');

    // Click Finalize Evaluation -> Publish Grade
    await page.getByRole('button', { name: 'Finalize Evaluation' }).click();
    await expect(page.locator('text=Finalize & Publish Grade')).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: 'Publish Grade' }).click();

    // Verify redirected or success notification and status is evaluated
    await expect(page).toHaveURL(/\/instructor\/submissions/);
    await expect(page.locator('tr', { hasText: subId.slice(-6) }).or(page.locator(`text=Subjective Grading Test`)).first()).toBeVisible({ timeout: 10000 });
  });
});
