const { test, expect } = require('@playwright/test');

test.use({
  permissions: ['camera'],
  launchOptions: {
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
    ],
  },
});

test.describe('UAP Faculty-to-Student Interview & Proctoring E2E', () => {

  test('Full Faculty -> Student -> Camera Proctoring -> Role-Separated Reports E2E', async ({ browser }) => {
    const title = `E2E Technical Viva ${Date.now()}`;

    // 1. Faculty creates interview, assigns student, configures camera proctoring
    const facultyCtx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    const facultyPage = await facultyCtx.newPage();

    await facultyPage.goto('/auth/login');
    await facultyPage.fill('#email', 'instructor@uap.edu');
    await facultyPage.fill('#password', 'Instructor@123');
    await facultyPage.click('button[type="submit"]');
    await expect(facultyPage).toHaveURL(/\/instructor\/dashboard/, { timeout: 20000 });

    await facultyPage.goto('/instructor/interviews');
    await expect(facultyPage.getByTestId('faculty-interviews-page')).toBeVisible({ timeout: 15000 });

    await facultyPage.getByTestId('btn-create-interview').click();
    await facultyPage.getByTestId('input-interview-title').fill(title);
    await facultyPage.getByTestId('select-interview-type').selectOption('viva');
    await facultyPage.getByTestId('input-interview-instructions').fill('Keep your webcam visible throughout the viva.');

    // Select Demo Student / Alex Johnson (student@uap.edu)
    const studentSelect = facultyPage.getByTestId('select-interview-student');
    const studentOption = await studentSelect.locator('option', { hasText: 'Alex Johnson' }).first().getAttribute('value');
    if (studentOption) {
      await studentSelect.selectOption(studentOption);
    }

    await facultyPage.getByTestId('input-interview-question-0').fill('Explain supervised vs unsupervised learning.');
    await facultyPage.getByTestId('toggle-camera-proctoring').check();
    await facultyPage.getByTestId('toggle-camera-permission-required').check();
    // Ensure AI Proctoring remains OFF independently
    await expect(facultyPage.getByTestId('toggle-ai-proctoring')).not.toBeChecked();

    const createRespPromise = facultyPage.waitForResponse(
      (resp) => resp.url().includes('/api/interviews') && resp.request().method() === 'POST'
    );
    await facultyPage.getByTestId('btn-save-interview').click();
    const createResp = await createRespPromise;
    expect(createResp.status()).toBe(201);
    const createdJson = await createResp.json();
    const interviewId = createdJson.data.id;
    expect(interviewId).toBeTruthy();

    await expect(facultyPage.getByTestId(`interview-card-${interviewId}`)).toBeVisible({ timeout: 10000 });

    // 2. Student opens assigned session, grants mocked camera, sees floating preview, completes session
    const studentCtx = await browser.newContext({
      viewport: { width: 1366, height: 900 },
      permissions: ['camera'],
    });
    const studentPage = await studentCtx.newPage();

    await studentPage.goto('/auth/login');
    await studentPage.fill('#email', 'student@uap.edu');
    await studentPage.fill('#password', 'Student@123');
    await studentPage.click('button[type="submit"]');
    await expect(studentPage).toHaveURL(/\/student\/dashboard/, { timeout: 20000 });

    await studentPage.goto('/student/interviews');
    await expect(studentPage.getByTestId('student-interviews-page')).toBeVisible({ timeout: 15000 });
    await expect(studentPage.getByTestId(`student-interview-card-${interviewId}`)).toBeVisible({ timeout: 10000 });

    await studentPage.getByTestId(`btn-join-interview-${interviewId}`).click();
    await expect(studentPage).toHaveURL(new RegExp(`/student/interviews/${interviewId}`), { timeout: 15000 });

    // Camera gate blocks session start until camera permission granted
    await expect(studentPage.getByTestId('camera-permission-gate')).toBeVisible({ timeout: 10000 });
    await expect(studentPage.getByTestId('btn-enter-active-session')).toBeDisabled();

    // Grant mocked camera access
    await studentPage.getByTestId('btn-enable-camera').click();
    await expect(studentPage.getByTestId('floating-camera-preview')).toBeVisible({ timeout: 10000 });
    await expect(studentPage.getByTestId('btn-enter-active-session')).toBeEnabled();

    // Enter active session & complete
    await studentPage.getByTestId('btn-enter-active-session').click();
    await expect(studentPage.getByTestId('btn-complete-interview')).toBeVisible({ timeout: 10000 });
    await studentPage.getByTestId('btn-complete-interview').click();

    await expect(studentPage.getByTestId('btn-view-performance-report')).toBeVisible({ timeout: 10000 });

    // 3. Faculty adds transcript, evaluates, and opens complete faculty report
    await facultyPage.goto(`/instructor/interviews/${interviewId}/session`);
    await expect(facultyPage.getByTestId('faculty-interview-session')).toBeVisible({ timeout: 15000 });

    await facultyPage.getByTestId('input-transcript-text').fill('Explain supervised learning.');
    await facultyPage.getByTestId('btn-add-transcript').click();
    await expect(facultyPage.getByTestId('transcript-segment-list')).toContainText('Explain supervised learning.');

    await facultyPage.getByTestId('input-eval-marks-0').fill('9');
    await facultyPage.getByTestId('input-faculty-feedback').fill('Well structured explanation.');
    await facultyPage.getByTestId('input-faculty-only-notes').fill('Confidential faculty observation.');
    await facultyPage.getByTestId('btn-save-evaluation').click();

    await facultyPage.goto(`/instructor/interviews/${interviewId}/report`);
    await expect(facultyPage.getByTestId('interview-report-page')).toBeVisible({ timeout: 15000 });
    await expect(facultyPage.getByTestId('faculty-report-tabs')).toBeVisible();
    await expect(facultyPage.getByTestId('faculty-only-notes-box')).toContainText('Confidential faculty observation.');

    await facultyPage.getByTestId('tab-behavioral-report').click();
    await expect(facultyPage.getByTestId('behavioral-report-section')).toBeVisible();

    await facultyPage.getByTestId('tab-transcript').click();
    await expect(facultyPage.getByTestId('transcript-report-section')).toContainText('Explain supervised learning.');

    // 4. Student opens report — sees Performance Report ONLY, never behavioral/transcript/faculty notes
    await studentPage.getByTestId('btn-view-performance-report').click();
    await expect(studentPage.getByTestId('interview-report-page')).toBeVisible({ timeout: 15000 });
    await expect(studentPage.getByTestId('performance-report-section')).toContainText('Well structured explanation.');
    await expect(studentPage.getByTestId('faculty-report-tabs')).toHaveCount(0);
    await expect(studentPage.getByTestId('behavioral-report-section')).toHaveCount(0);
    await expect(studentPage.getByTestId('transcript-report-section')).toHaveCount(0);
    await expect(studentPage.getByText('Confidential faculty observation.')).toHaveCount(0);

    // 5. Verify direct API requests by student to behavioral report and transcript return 403
    const loginRes = await studentCtx.request.post('http://localhost:5000/api/auth/login', {
      data: { email: 'student@uap.edu', password: 'Student@123' },
    });
    const loginBody = await loginRes.json();
    const studentToken = loginBody.data?.accessToken || loginBody.accessToken;
    expect(studentToken).toBeTruthy();

    const behApiRes = await studentCtx.request.get(
      `http://localhost:5000/api/interviews/${interviewId}/reports/behavioral`,
      { headers: { Authorization: `Bearer ${studentToken}` } }
    );
    expect(behApiRes.status()).toBe(403);

    const transApiRes = await studentCtx.request.get(
      `http://localhost:5000/api/interviews/${interviewId}/transcript`,
      { headers: { Authorization: `Bearer ${studentToken}` } }
    );
    expect(transApiRes.status()).toBe(403);

    await facultyCtx.close();
    await studentCtx.close();
  });
});
