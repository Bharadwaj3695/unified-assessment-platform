const { test, expect } = require('@playwright/test');

test.describe('Security, RBAC & Data Isolation E2E', () => {
  let adminToken;
  let instructorToken;
  let studentToken;

  test.beforeAll(async ({ request }) => {
    // 1. Admin login token
    const adminRes = await request.post('http://localhost:5000/api/auth/login', {
      data: { email: 'admin@uap.edu', password: 'Admin@123' },
    });
    const adminJson = await adminRes.json();
    adminToken = adminJson.data?.accessToken;

    // 2. Primary instructor login token
    const instRes = await request.post('http://localhost:5000/api/auth/login', {
      data: { email: 'instructor@uap.edu', password: 'Instructor@123' },
    });
    const instJson = await instRes.json();
    instructorToken = instJson.data?.accessToken;

    // 3. Student login token
    const studRes = await request.post('http://localhost:5000/api/auth/login', {
      data: { email: 'student@uap.edu', password: 'Student@123' },
    });
    const studJson = await studRes.json();
    studentToken = studJson.data?.accessToken;
  });

  test('1. Unauthenticated users are redirected to login and direct API calls are rejected', async ({ page, request }) => {
    // 1A. Browser navigation to protected areas without session
    await page.goto('/auth/login');
    await page.evaluate(() => localStorage.clear());

    await page.goto('/student/dashboard');
    await expect(page).toHaveURL(/\/auth\/login/);

    await page.goto('/instructor/dashboard');
    await expect(page).toHaveURL(/\/auth\/login/);

    await page.goto('/admin/dashboard');
    await expect(page).toHaveURL(/\/auth\/login/);

    // 1B. Direct unauthenticated API calls
    const protectedApiRes = await request.get('http://localhost:5000/api/auth/profile');
    expect(protectedApiRes.status()).toBe(401);
    const apiJson = await protectedApiRes.json();
    expect(apiJson.success).toBe(false);
  });

  test('2. Role boundary enforcement: student cannot access instructor or admin areas', async ({ page }) => {
    // Log in as student
    await page.goto('/auth/login');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.fill('#email', 'student@uap.edu');
    await page.fill('#password', 'Student@123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/student\/dashboard/);

    // Attempt to access /instructor/create
    await page.goto('/instructor/create');
    await expect(page.locator('text=Access Denied')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Your current role')).toBeVisible();

    // Attempt to access /admin/dashboard
    await page.goto('/admin/dashboard');
    await expect(page.locator('text=Access Denied')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Your current role')).toBeVisible();
  });

  test('3. Cross-instructor isolation: Instructor cannot edit or delete another instructor\'s assessment', async ({ request }) => {
    // Create a secondary instructor via admin API or signup
    const secondaryEmail = `instructor2_${Date.now()}@uap.edu`;
    const signupRes = await request.post('http://localhost:5000/api/auth/register', {
      data: {
        name: 'Secondary Instructor',
        email: secondaryEmail,
        password: 'Password@123',
        role: 'instructor',
      },
    });
    const signupJson = await signupRes.json();
    const secondaryId = signupJson.data?.user?.id || signupJson.data?.user?._id;

    // Approve secondary instructor using admin
    await request.put(`http://localhost:5000/api/admin/users/${secondaryId}/approve`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    // Login secondary instructor
    const secLoginRes = await request.post('http://localhost:5000/api/auth/login', {
      data: { email: secondaryEmail, password: 'Password@123' },
    });
    const secLoginJson = await secLoginRes.json();
    const secondaryToken = secLoginJson.data?.accessToken;

    // Primary instructor authors an assessment
    const asmtRes = await request.post('http://localhost:5000/api/assessments', {
      headers: { Authorization: `Bearer ${instructorToken}` },
      data: {
        title: `Primary Instructor Private Exam ${Date.now()}`,
        description: 'Ownership boundary test',
        category: 'Information Security',
        durationMinutes: 30,
        passingScore: 60,
        status: 'draft',
        accessType: 'public',
        questions: [
          {
            questionText: 'What is principle of least privilege?',
            type: 'short_answer',
            points: 10,
          },
        ],
      },
    });
    const asmtJson = await asmtRes.json();
    const asmtId = asmtJson.data?._id || asmtJson.data?.id;

    // 3A. Secondary instructor attempts to update primary instructor's assessment -> 403
    const updateRes = await request.put(`http://localhost:5000/api/assessments/${asmtId}`, {
      headers: { Authorization: `Bearer ${secondaryToken}` },
      data: { title: 'Tampered by Instructor 2' },
    });
    expect(updateRes.status()).toBe(403);

    // 3B. Secondary instructor attempts to delete primary instructor's assessment -> 403
    const deleteRes = await request.delete(`http://localhost:5000/api/assessments/${asmtId}`, {
      headers: { Authorization: `Bearer ${secondaryToken}` },
    });
    expect(deleteRes.status()).toBe(403);
  });

  test('4. Data leak prevention: Student never receives correctAnswer or answer keys', async ({ request }) => {
    // Instructor creates an assessment with confidential answer key
    const secretAnswerKey = 'opt_secret_correct_key_42';
    const asmtRes = await request.post('http://localhost:5000/api/assessments', {
      headers: { Authorization: `Bearer ${instructorToken}` },
      data: {
        title: `Confidential Key Verification Exam ${Date.now()}`,
        description: 'Verifying student payload sanitization',
        category: 'Cryptography',
        durationMinutes: 20,
        passingScore: 50,
        status: 'published',
        accessType: 'public',
        questions: [
          {
            questionText: 'Which cipher is an asymmetric cipher?',
            type: 'mcq',
            points: 10,
            options: [
              { id: secretAnswerKey, text: 'RSA' },
              { id: 'opt_aes', text: 'AES' },
              { id: 'opt_des', text: 'DES' },
              { id: 'opt_rc4', text: 'RC4' },
            ],
            correctAnswer: secretAnswerKey,
            explanation: 'RSA is asymmetric using public/private key pairs.',
          },
        ],
      },
    });
    const asmtJson = await asmtRes.json();
    const asmtId = asmtJson.data?._id || asmtJson.data?.id;

    // 4A. Student calls GET /api/assessments/:id
    const studentFetchRes = await request.get(`http://localhost:5000/api/assessments/${asmtId}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    expect(studentFetchRes.status()).toBe(200);
    const studentFetchJson = await studentFetchRes.json();
    const questionForStudent = studentFetchJson.data?.questions?.[0];

    // Assert that correctAnswer and answer explanation are stripped
    expect(questionForStudent.correctAnswer).toBeUndefined();
    expect(questionForStudent.explanation).toBeUndefined();

    // 4B. Student starts attempt: POST /api/submissions/start
    const startRes = await request.post('http://localhost:5000/api/submissions/start', {
      headers: { Authorization: `Bearer ${studentToken}` },
      data: { assessmentId: asmtId },
    });
    expect(startRes.status()).toBe(200);
    const startJson = await startRes.json();
    const rawSubmissionString = JSON.stringify(startJson);

    // Verify raw submission payload does NOT leak correctAnswer
    expect(rawSubmissionString.includes('correctAnswer')).toBe(false);
  });
});
