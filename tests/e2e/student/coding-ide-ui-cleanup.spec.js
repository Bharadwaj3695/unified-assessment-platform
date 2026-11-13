const { test, expect } = require('@playwright/test');

test.describe('UAP Coding Assessment Engine — Faculty IDE & Student Clean IDE E2E', () => {
  let instructorToken;
  let studentToken;

  test.beforeAll(async ({ request }) => {
    // Get instructor auth token
    const instRes = await request.post('http://localhost:5000/api/auth/login', {
      headers: { 'x-test-bypass': 'true' },
      data: { email: 'instructor@uap.edu', password: 'Instructor@123' },
    });
    const instJson = await instRes.json();
    instructorToken = instJson.data?.accessToken;

    // Get student auth token
    const studRes = await request.post('http://localhost:5000/api/auth/login', {
      headers: { 'x-test-bypass': 'true' },
      data: { email: 'student@uap.edu', password: 'Student@123' },
    });
    const studJson = await studRes.json();
    studentToken = studJson.data?.accessToken;
  });

  test('Student Clean Coding IDE layout and exclusion of technical infrastructure metrics', async ({ page, request }) => {
    const examTitle = `E2E Student Clean IDE Test ${Date.now()}`;

    // Create a published assessment with a coding question
    const asmtRes = await request.post('http://localhost:5000/api/assessments', {
      headers: { Authorization: `Bearer ${instructorToken}`, 'x-test-bypass': 'true' },
      data: {
        title: examTitle,
        description: 'Testing clean student IDE layout without infrastructure metrics',
        category: 'Computer Science',
        durationMinutes: 45,
        passingScore: 60,
        status: 'published',
        accessType: 'public',
        questions: [
          {
            questionText: 'Write a program to print Welcome.',
            type: 'code',
            points: 25,
            codingConfig: {
              problemTitle: 'Welcome Message Generator',
              problemDescription: 'Print the string Welcome on a single line.',
              inputFormat: 'None',
              outputFormat: 'Print Welcome',
              constraints: '1 <= execution time <= 2000ms',
              cpuTimeLimitMs: 2000,
              memoryLimitMb: 256,
              allowedLanguages: ['python', 'javascript'],
              testCases: [
                { input: '', expectedOutput: 'Welcome', isHidden: false, isEnabled: true, weight: 10, explanation: 'Basic public test' },
                { input: '', expectedOutput: 'Welcome', isHidden: true, isEnabled: true, weight: 15, explanation: 'Hidden validation test' },
              ],
            },
          },
        ],
      },
    });

    const asmtJson = await asmtRes.json();
    const assessmentId = asmtJson.data?._id;
    expect(assessmentId).toBeTruthy();

    // Log in as student
    await page.goto('/auth/login');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.fill('#email', 'student@uap.edu');
    await page.fill('#password', 'Student@123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/student\/dashboard/);

    // Navigate to the assessment attempt
    await page.goto(`/student/attempt/${assessmentId}`);

    // Verify student IDE elements are visible
    // 1. Problem Specification (Left Panel)
    await expect(page.getByText('Welcome Message Generator')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Print the string Welcome on a single line.')).toBeVisible();
    await expect(page.getByText('Sample Examples (1)')).toBeVisible();

    // 2. Editor & Controls (Right Panel)
    await expect(page.getByText('Python 3.11')).toBeVisible();
    await expect(page.getByRole('button', { name: /Run Code/i })).toBeVisible();

    // 3. Technical infrastructure diagnostic metrics MUST NOT BE VISIBLE
    const cpuMetric = page.getByText(/CPU Limit: \d+ms/i);
    await expect(cpuMetric).not.toBeVisible();

    const memMetric = page.getByText(/Memory Limit: \d+MB/i);
    await expect(memMetric).not.toBeVisible();

    const modeMetric = page.getByText(/Execution Mode: Sandboxed Code/i);
    await expect(modeMetric).not.toBeVisible();

    // 4. Hidden test cases MUST NOT BE VISIBLE to student
    await expect(page.getByText('Hidden validation test')).not.toBeVisible();
    await expect(page.getByText('Sample Examples (2)')).not.toBeVisible();

    // 5. Submit solution as student
    await page.getByRole('button', { name: 'Submit Exam' }).click();
    await page.getByRole('button', { name: 'Confirm Submission' }).click();
    await expect(page).toHaveURL(/\/student\/dashboard/);
  });

  test('Faculty Evaluation Studio enforces maximum marks validation and 100% pass calculation', async ({ page, request }) => {
    // 1. Create published assessment
    const examTitle = `E2E Scoring Validation Test ${Date.now()}`;
    const asmtRes = await request.post('http://localhost:5000/api/assessments', {
      headers: { Authorization: `Bearer ${instructorToken}`, 'x-test-bypass': 'true' },
      data: {
        title: examTitle,
        category: 'Computer Science',
        durationMinutes: 45,
        passingScore: 60,
        status: 'published',
        accessType: 'public',
        questions: [
          {
            questionText: 'Implement an algorithm to compute sum of integers.',
            type: 'code',
            points: 25,
            codingConfig: {
              problemTitle: 'Sum of Numbers',
              problemDescription: 'Compute sum of numbers.',
              cpuTimeLimitMs: 2000,
              memoryLimitMb: 256,
              allowedLanguages: ['python'],
              testCases: [
                { input: '5', expectedOutput: '5', isHidden: false, isEnabled: true, weight: 25 },
              ],
            },
          },
        ],
      },
    });

    const asmtJson = await asmtRes.json();
    const asmtId = asmtJson.data?._id;
    expect(asmtId).toBeTruthy();

    // 2. Student starts and submits an attempt
    const subRes = await request.post('http://localhost:5000/api/submissions/start', {
      headers: { Authorization: `Bearer ${studentToken}`, 'x-test-bypass': 'true' },
      data: { assessmentId: asmtId },
    });
    const subJson = await subRes.json();
    const submissionId = subJson.data?._id || subJson.data?.id;

    // Submit answer
    const qId = asmtJson.data.questions[0]._id;
    await request.post(`http://localhost:5000/api/submissions/${submissionId}/submit`, {
      headers: { Authorization: `Bearer ${studentToken}`, 'x-test-bypass': 'true' },
      data: {
        answers: {
          [qId]: { code: 'print("5")', language: 'python' },
        },
      },
    });

    // 3. Faculty logs in and navigates to Evaluation Studio
    await page.goto('/auth/login');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.fill('#email', 'instructor@uap.edu');
    await page.fill('#password', 'Instructor@123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/instructor\/dashboard/);

    await page.goto(`/instructor/evaluate/${submissionId}`);
    await expect(page.getByText('Evaluation Studio')).toBeVisible({ timeout: 15000 });

    // 4. Test Bug 1: Enter score > 25 (e.g. 55)
    const scoreInput = page.locator('input[type="number"]').first();
    await scoreInput.fill('55');

    // Inline error must appear
    await expect(page.getByText(/cannot exceed maximum allowed marks/i)).toBeVisible();

    // Finalize button must be disabled
    const finalizeBtn = page.getByRole('button', { name: /Finalize Evaluation/i });
    await expect(finalizeBtn).toBeDisabled();

    // 5. Enter negative score: -5
    await scoreInput.fill('-5');
    await expect(page.getByText(/cannot be negative/i)).toBeVisible();
    await expect(finalizeBtn).toBeDisabled();

    // 6. Test Bug 2: Enter valid score 25/25
    await scoreInput.fill('25');
    await expect(page.getByText(/cannot exceed maximum allowed marks/i)).not.toBeVisible();
    await expect(page.getByText(/cannot be negative/i)).not.toBeVisible();
    await expect(finalizeBtn).toBeEnabled();

    // Verify calculated score displays 25 / 25
    await expect(page.getByText('25 / 25')).toBeVisible();
  });
});
