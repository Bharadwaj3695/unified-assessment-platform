const { test, expect } = require('@playwright/test');

test.use({
  permissions: ['camera', 'microphone'],
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

test.describe('UAP Two-Way Face-to-Face Interview Video & Faculty Media Controls E2E', () => {
  test('Faculty and Student establish live two-way WebRTC video/audio, faculty controls own & student media, and ending stops streams', async ({
    browser,
  }) => {
    const title = `E2E Live Video Interview ${Date.now()}`;

    // 1. Faculty logs in and creates a Ready interview assigned to Alex Johnson (student@uap.edu)
    const facultyCtx = await browser.newContext({
      viewport: { width: 1366, height: 900 },
      permissions: ['camera', 'microphone'],
    });
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
    await facultyPage.getByTestId('select-interview-type').selectOption('technical');

    const studentSelect = facultyPage.getByTestId('select-interview-student');
    const studentOption = await studentSelect
      .locator('option', { hasText: 'Alex Johnson' })
      .first()
      .getAttribute('value');
    if (studentOption) {
      await studentSelect.selectOption(studentOption);
    }

    await facultyPage
      .getByTestId('input-interview-question-0')
      .fill('Walk through WebRTC peer-to-peer signaling.');

    const createRespPromise = facultyPage.waitForResponse(
      (resp) => resp.url().includes('/api/interviews') && resp.request().method() === 'POST'
    );
    await facultyPage.getByTestId('btn-save-interview').click();
    const createResp = await createRespPromise;
    expect(createResp.status()).toBe(201);
    const interviewId = (await createResp.json()).data.id;
    expect(interviewId).toBeTruthy();

    // Faculty starts the live interview session
    await facultyPage.getByTestId(`btn-start-interview-${interviewId}`).click();
    await expect(facultyPage).toHaveURL(
      new RegExp(`/instructor/interviews/${interviewId}/session`),
      { timeout: 15000 }
    );
    await expect(facultyPage.getByTestId('interview-video-room')).toBeVisible({ timeout: 15000 });

    // 2. Student logs in (separate browser context) and joins the same interview
    const studentCtx = await browser.newContext({
      viewport: { width: 1366, height: 900 },
      permissions: ['camera', 'microphone'],
    });
    const studentPage = await studentCtx.newPage();

    await studentPage.goto('/auth/login');
    await studentPage.fill('#email', 'student@uap.edu');
    await studentPage.fill('#password', 'Student@123');
    await studentPage.click('button[type="submit"]');
    await expect(studentPage).toHaveURL(/\/student\/dashboard/, { timeout: 20000 });

    await studentPage.goto(`/student/interviews/${interviewId}`);
    await expect(studentPage.getByTestId('student-interview-room')).toBeVisible({ timeout: 15000 });
    await expect(studentPage.getByTestId('interview-video-room')).toBeVisible({ timeout: 15000 });
    // Faculty already started the session, so student grants camera & mic explicitly with disclosure visible
    await expect(studentPage.getByTestId('student-media-disclosure')).toBeVisible();
    await studentPage.getByTestId('btn-grant-interview-media').click();

    // 3. Both participants reach Connected state and receive live remote audio + video tracks
    await expect(facultyPage.getByTestId('video-connection-status')).toContainText('Connected', {
      timeout: 20000,
    });
    await expect(studentPage.getByTestId('video-connection-status')).toContainText('Connected', {
      timeout: 20000,
    });

    await expect(facultyPage.getByTestId('remote-video-student')).toBeVisible({ timeout: 15000 });
    await expect(facultyPage.getByTestId('remote-video-placeholder')).toBeHidden({ timeout: 15000 });
    await expect(facultyPage.getByTestId('local-video-faculty')).toBeVisible({ timeout: 15000 });
    await expect(studentPage.getByTestId('remote-video-faculty')).toBeVisible({ timeout: 15000 });
    await expect(studentPage.getByTestId('remote-video-placeholder')).toBeHidden({ timeout: 15000 });
    await expect(studentPage.getByTestId('local-video-student')).toBeVisible({ timeout: 15000 });

    // Verify real MediaStreamTracks (video + audio) are flowing on both remote video elements
    await expect
      .poll(
        async () =>
          facultyPage.evaluate(() => {
            const v = document.querySelector('[data-testid="remote-video-student"]');
            const s = v?.srcObject;
            return {
              videoTracks: s?.getVideoTracks?.().filter((t) => t.readyState === 'live').length || 0,
              audioTracks: s?.getAudioTracks?.().filter((t) => t.readyState === 'live').length || 0,
              width: v?.videoWidth || 0,
            };
          }),
        { timeout: 15000 }
      )
      .toMatchObject({ videoTracks: 1, audioTracks: 1 });

    await expect
      .poll(
        async () =>
          studentPage.evaluate(() => {
            const v = document.querySelector('[data-testid="remote-video-faculty"]');
            const s = v?.srcObject;
            return {
              videoTracks: s?.getVideoTracks?.().filter((t) => t.readyState === 'live').length || 0,
              audioTracks: s?.getAudioTracks?.().filter((t) => t.readyState === 'live').length || 0,
              width: v?.videoWidth || 0,
            };
          }),
        { timeout: 15000 }
      )
      .toMatchObject({ videoTracks: 1, audioTracks: 1 });

    // 4. Student UI must NOT expose interactive camera/mic toggles; shows locked faculty-controlled state
    await expect(studentPage.getByTestId('student-media-disclosure')).toBeVisible();
    await expect(studentPage.getByTestId('student-locked-media-status')).toBeVisible();
    await expect(studentPage.getByTestId('student-locked-media-status').locator('button')).toHaveCount(0);
    await expect(studentPage.getByTestId('btn-faculty-camera-toggle')).toHaveCount(0);
    await expect(studentPage.getByTestId('btn-student-camera-control')).toHaveCount(0);

    // 5. Faculty toggles OWN camera & mic OFF then ON (does not disable student media)
    await facultyPage.getByTestId('btn-faculty-camera-toggle').click();
    await expect(facultyPage.getByTestId('btn-faculty-camera-toggle')).toContainText('Faculty Camera: OFF');
    await expect(studentPage.getByTestId('remote-camera-indicator')).toContainText('Cam Off', {
      timeout: 10000,
    });
    await expect(studentPage.getByTestId('student-camera-status-badge')).toContainText('Active');

    await facultyPage.getByTestId('btn-faculty-camera-toggle').click();
    await expect(facultyPage.getByTestId('btn-faculty-camera-toggle')).toContainText('Faculty Camera: ON');
    await expect(studentPage.getByTestId('remote-camera-indicator')).toContainText('Cam On', {
      timeout: 10000,
    });

    await facultyPage.getByTestId('btn-faculty-mic-toggle').click();
    await expect(facultyPage.getByTestId('btn-faculty-mic-toggle')).toContainText('Faculty Mic: OFF');
    await expect(studentPage.getByTestId('remote-mic-indicator')).toContainText('Muted', {
      timeout: 10000,
    });
    await facultyPage.getByTestId('btn-faculty-mic-toggle').click();
    await expect(facultyPage.getByTestId('btn-faculty-mic-toggle')).toContainText('Faculty Mic: ON');

    // 6. Faculty disables & re-enables STUDENT camera and microphone via authorized signaling
    await facultyPage.getByTestId('btn-student-camera-control').click();
    await expect(facultyPage.getByTestId('btn-student-camera-control')).toContainText(
      'Student Camera: Disabled',
      { timeout: 10000 }
    );
    await expect(studentPage.getByTestId('student-camera-status-badge')).toContainText(
      'Disabled by Faculty',
      { timeout: 10000 }
    );
    const studentVideoDisabled = await studentPage.evaluate(() => {
      const v = document.querySelector('[data-testid="local-video-student"]');
      return v?.srcObject?.getVideoTracks?.()[0]?.enabled;
    });
    expect(studentVideoDisabled).toBe(false);

    // Re-enable student camera
    await facultyPage.getByTestId('btn-student-camera-control').click();
    await expect(facultyPage.getByTestId('btn-student-camera-control')).toContainText(
      'Student Camera: Enabled',
      { timeout: 10000 }
    );
    await expect(studentPage.getByTestId('student-camera-status-badge')).toContainText('Active', {
      timeout: 10000,
    });

    // Mute & unmute student microphone
    await facultyPage.getByTestId('btn-student-mic-control').click();
    await expect(studentPage.getByTestId('student-mic-status-badge')).toContainText(
      'Muted by Faculty',
      { timeout: 10000 }
    );
    const studentAudioDisabled = await studentPage.evaluate(() => {
      const v = document.querySelector('[data-testid="local-video-student"]');
      return v?.srcObject?.getAudioTracks?.()[0]?.enabled;
    });
    expect(studentAudioDisabled).toBe(false);

    await facultyPage.getByTestId('btn-student-mic-control').click();
    await expect(studentPage.getByTestId('student-mic-status-badge')).toContainText('Active', {
      timeout: 10000,
    });

    // 7. Preserve existing Evaluation & Transcript on the same Faculty page
    await facultyPage.getByTestId('input-transcript-text').fill('Walk through WebRTC peer-to-peer signaling.');
    await facultyPage.getByTestId('btn-add-transcript').click();
    await expect(facultyPage.getByTestId('transcript-segment-list')).toContainText('WebRTC');

    // 8. Ending interview stops media tracks & closes sessions on both sides
    await facultyPage.getByTestId('btn-end-video-interview').click();
    await expect(facultyPage.getByTestId('video-connection-status')).toContainText('Ended', {
      timeout: 15000,
    });
    await expect(studentPage.getByTestId('video-connection-status')).toContainText('Ended', {
      timeout: 15000,
    });

    const studentStreamCleared = await studentPage.evaluate(() => {
      const localV = document.querySelector('[data-testid="local-video-student"]');
      const remoteV = document.querySelector('[data-testid="remote-video-faculty"]');
      return !localV?.srcObject && !remoteV?.srcObject;
    });
    expect(studentStreamCleared).toBe(true);

    await facultyCtx.close();
    await studentCtx.close();
  });

  test('Handles student media permission denial clearly and notifies faculty', async ({ browser }) => {
    const title = `E2E Denied Media Test ${Date.now()}`;

    const facultyCtx = await browser.newContext({
      viewport: { width: 1366, height: 900 },
      permissions: ['camera', 'microphone'],
    });
    const facultyPage = await facultyCtx.newPage();

    await facultyPage.goto('/auth/login');
    await facultyPage.fill('#email', 'instructor@uap.edu');
    await facultyPage.fill('#password', 'Instructor@123');
    await facultyPage.click('button[type="submit"]');
    await expect(facultyPage).toHaveURL(/\/instructor\/dashboard/, { timeout: 20000 });

    await facultyPage.goto('/instructor/interviews');
    await facultyPage.getByTestId('btn-create-interview').click();
    await facultyPage.getByTestId('input-interview-title').fill(title);
    const studentSelect = facultyPage.getByTestId('select-interview-student');
    const studentOption = await studentSelect
      .locator('option', { hasText: 'Alex Johnson' })
      .first()
      .getAttribute('value');
    if (studentOption) await studentSelect.selectOption(studentOption);
    await facultyPage.getByTestId('input-interview-question-0').fill('Explain TLS handshake.');

    const createRespPromise = facultyPage.waitForResponse(
      (resp) => resp.url().includes('/api/interviews') && resp.request().method() === 'POST'
    );
    await facultyPage.getByTestId('btn-save-interview').click();
    const interviewId = (await (await createRespPromise).json()).data.id;

    await facultyPage.getByTestId(`btn-start-interview-${interviewId}`).click();
    await expect(facultyPage.getByTestId('interview-video-room')).toBeVisible({ timeout: 15000 });

    // Student context simulates browser permission denial for getUserMedia
    const studentCtx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    const studentPage = await studentCtx.newPage();
    await studentPage.addInitScript(() => {
      if (navigator.mediaDevices) {
        navigator.mediaDevices.getUserMedia = async () => {
          const err = new Error('Permission denied by user');
          err.name = 'NotAllowedError';
          throw err;
        };
      }
    });

    await studentPage.goto('/auth/login');
    await studentPage.fill('#email', 'student@uap.edu');
    await studentPage.fill('#password', 'Student@123');
    await studentPage.click('button[type="submit"]');
    await expect(studentPage).toHaveURL(/\/student\/dashboard/, { timeout: 20000 });

    await studentPage.goto(`/student/interviews/${interviewId}`);
    await expect(studentPage.getByTestId('interview-video-room')).toBeVisible({ timeout: 15000 });
    await studentPage.getByTestId('btn-grant-interview-media').click();

    await expect(studentPage.getByTestId('media-error-alert')).toBeVisible({ timeout: 15000 });
    await expect(studentPage.getByTestId('student-camera-status-badge')).toContainText(
      'Permission Denied',
      { timeout: 10000 }
    );

    // Faculty receives clear notification
    await expect(facultyPage.getByTestId('student-media-error-banner')).toBeVisible({
      timeout: 15000,
    });

    // Clean up: complete interview
    await facultyPage.getByTestId('btn-end-video-interview').click();
    await facultyCtx.close();
    await studentCtx.close();
  });
});
