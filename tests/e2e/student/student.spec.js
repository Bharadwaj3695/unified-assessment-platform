const { test, expect } = require('@playwright/test');

test.describe('Student Assessment Engine & Autosave E2E', () => {
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

  test('1. Student views catalog and available open assessments', async ({ page, request }) => {
    // Author a fresh public published exam
    const title = `E2E Student Catalog Exam ${Date.now()}`;
    await request.post('http://localhost:5000/api/assessments', {
      headers: { Authorization: `Bearer ${instructorToken}` },
      data: {
        title,
        description: 'Catalog inspection test assessment',
        category: 'Computer Science',
        durationMinutes: 45,
        passingScore: 60,
        status: 'published',
        accessType: 'public',
        questions: [
          {
            questionText: 'What is O(1) time complexity?',
            type: 'mcq',
            points: 10,
            options: [
              { id: 'opt_1', text: 'Constant time' },
              { id: 'opt_2', text: 'Linear time' },
              { id: 'opt_3', text: 'Logarithmic time' },
              { id: 'opt_4', text: 'Quadratic time' },
            ],
            correctAnswer: 'opt_1',
          },
        ],
      },
    });

    // Refresh student dashboard/catalog
    await page.goto('/student/dashboard');
    await expect(page.locator(`text=${title}`)).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: 'Start Attempt' }).first()).toBeVisible();
  });

  test('2. Restricted assessment is blocked for unassigned student', async ({ page, request }) => {
    // Create a restricted assessment without assigning student@uap.edu
    const restrictedTitle = `E2E Secret Honors Exam ${Date.now()}`;
    const asmtRes = await request.post('http://localhost:5000/api/assessments', {
      headers: { Authorization: `Bearer ${instructorToken}` },
      data: {
        title: restrictedTitle,
        description: 'Restricted to honors cohort only',
        category: 'Advanced Research',
        durationMinutes: 60,
        passingScore: 75,
        status: 'published',
        accessType: 'restricted',
        assignedStudents: [], // unassigned
        questions: [
          {
            questionText: 'Explain quantum entanglement.',
            type: 'short_answer',
            points: 25,
          },
        ],
      },
    });
    const asmtJson = await asmtRes.json();
    const restrictedId = asmtJson.data?._id || asmtJson.data?.id;

    // 2A. Ensure restricted exam is not listed in student catalog
    await page.goto('/student/dashboard');
    await expect(page.locator(`text=${restrictedTitle}`)).not.toBeVisible();

    // 2B. Direct URL navigation to /student/attempt/:id must show access denied error state
    await page.goto(`/student/attempt/${restrictedId}`);
    await expect(page.locator('text=Cannot Access Assessment')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=You are not authorized to view or attempt this restricted assessment.')).toBeVisible();
  });

  test('3. Student starts attempt, answers question, observes autosave feedback, and submits exam', async ({ page, request }) => {
    const examTitle = `E2E Interactive Exam ${Date.now()}`;
    const asmtRes = await request.post('http://localhost:5000/api/assessments', {
      headers: { Authorization: `Bearer ${instructorToken}` },
      data: {
        title: examTitle,
        description: 'Testing live timer, answers, autosave feedback, and submission',
        category: 'Software Architecture',
        durationMinutes: 20,
        passingScore: 50,
        status: 'published',
        accessType: 'public',
        questions: [
          {
            questionText: 'Which HTTP method is idempotent?',
            type: 'mcq',
            points: 10,
            options: [
              { id: 'opt_1', text: 'POST' },
              { id: 'opt_2', text: 'PUT' },
              { id: 'opt_3', text: 'PATCH' },
              { id: 'opt_4', text: 'CONNECT' },
            ],
            correctAnswer: 'opt_2',
          },
          {
            questionText: 'Describe the primary difference between processes and threads.',
            type: 'short_answer',
            points: 15,
          },
        ],
      },
    });
    const asmtJson = await asmtRes.json();
    const asmtId = asmtJson.data?._id || asmtJson.data?.id;

    // Navigate to attempt
    await page.goto(`/student/attempt/${asmtId}`);
    await expect(page.locator(`text=${examTitle}`)).toBeVisible({ timeout: 10000 });

    // 3A. Verify authoritative timer pill is ticking
    const timerPill = page.locator('div[class*="font-mono"]', { hasText: /:\d{2}/ });
    await expect(timerPill).toBeVisible();

    // 3B. Answer Question 1 (MCQ) and observe autosave indicator
    await page.locator('button', { hasText: 'PUT' }).click();

    // Wait for autosave feedback in role="status"
    const autosaveStatus = page.locator('[role="status"]');
    await expect(autosaveStatus).toBeVisible();
    await expect(autosaveStatus).toContainText(/Saved|Autosaving/, { timeout: 5000 });

    // 3C. Navigate to Question 2 (Short Answer)
    await page.getByRole('button', { name: 'Next Question' }).click();
    await expect(page.locator('text=Describe the primary difference between processes and threads')).toBeVisible();

    // Type answer into textarea
    await page.fill('textarea[placeholder*="Type your short answer"]', 'Threads share memory space within the same process while processes have isolated memory.');

    // Wait for autosave indicator
    await expect(autosaveStatus).toContainText(/Saved|Autosaving/, { timeout: 5000 });

    // 3D. Open Submit Modal
    await page.getByRole('button', { name: /Submit Exam|Review & Submit/ }).first().click();
    await expect(page.locator('text=Finalize Assessment Submission')).toBeVisible({ timeout: 5000 });

    // Click Confirm Submission
    await page.getByRole('button', { name: 'Confirm Submission' }).click();

    // 3E. Verify redirected back to dashboard with submission recorded
    await expect(page).toHaveURL(/\/student\/dashboard/);
    await expect(page.locator('tr', { hasText: examTitle })).toBeVisible({ timeout: 10000 });
  });

  test('4. One-attempt rule: student cannot restart already submitted assessment', async ({ page, request }) => {
    const strictExamTitle = `E2E Single Attempt Exam ${Date.now()}`;
    const asmtRes = await request.post('http://localhost:5000/api/assessments', {
      headers: { Authorization: `Bearer ${instructorToken}` },
      data: {
        title: strictExamTitle,
        description: 'Single attempt rule validation',
        category: 'Security',
        durationMinutes: 15,
        passingScore: 50,
        status: 'published',
        accessType: 'public',
        questions: [
          {
            questionText: 'What does TLS guarantee?',
            type: 'mcq',
            points: 10,
            options: [
              { id: 'opt_1', text: 'Confidentiality, Integrity, and Authenticity' },
              { id: 'opt_2', text: 'High bandwidth transfer' },
              { id: 'opt_3', text: 'CPU acceleration' },
              { id: 'opt_4', text: 'Automatic code compilation' },
            ],
            correctAnswer: 'opt_1',
          },
        ],
      },
    });
    const asmtJson = await asmtRes.json();
    const asmtId = asmtJson.data?._id || asmtJson.data?.id;

    // Student starts and submits via API
    const startRes = await request.post('http://localhost:5000/api/submissions/start', {
      headers: { Authorization: `Bearer ${studentToken}` },
      data: { assessmentId: asmtId },
    });
    const startJson = await startRes.json();
    const subId = startJson.data?._id || startJson.data?.id;

    await request.post(`http://localhost:5000/api/submissions/${subId}/submit`, {
      headers: { Authorization: `Bearer ${studentToken}` },
      data: { answers: { [asmtJson.data.questions[0]._id]: 'opt_1' } },
    });

    // 4A. In student dashboard, the submitted assessment is filtered out from available exams
    await page.goto('/student/dashboard');
    const availableCard = page.locator('div', { hasText: 'Assigned & Open Assessments' });
    await expect(availableCard.locator(`text=${strictExamTitle}`)).not.toBeVisible();

    // 4B. Attempting to directly navigate to /student/attempt/:id must display one-attempt error
    await page.goto(`/student/attempt/${asmtId}`);
    await expect(page.locator('text=Cannot Access Assessment')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Only one attempt is permitted')).toBeVisible();
  });

  test('5. Regression: Authenticated student dashboard renders complete workspace without blank screen or hook errors', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('/student/dashboard');
    await expect(page.getByText('Student Workspace', { exact: true })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Welcome back, Alex Johnson!', { exact: false })).toBeVisible();
    await expect(page.getByText('Assigned & Open Assessments')).toBeVisible();
    await expect(page.getByText('Academic Performance')).toBeVisible();
    await expect(page.getByText('Recent Submissions')).toBeVisible();

    expect(pageErrors).toHaveLength(0);
  });
});
