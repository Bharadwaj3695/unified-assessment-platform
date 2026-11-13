const { test, expect } = require('@playwright/test');

test.describe('Student Portal: Request Reassignment Feature E2E', () => {
  let instructorToken;
  let studentToken;
  let missedExamTitle;
  let failedExamTitle;

  test.beforeAll(async ({ request }) => {
    // 1. Authenticate instructor to provision test assessments
    const instRes = await request.post('http://localhost:5000/api/auth/login', {
      data: { email: 'instructor@uap.edu', password: 'Instructor@123' },
    });
    const instJson = await instRes.json();
    instructorToken = instJson.data?.accessToken;

    // 2. Authenticate student
    const studRes = await request.post('http://localhost:5000/api/auth/login', {
      data: { email: 'student@uap.edu', password: 'Student@123' },
    });
    const studJson = await studRes.json();
    studentToken = studJson.data?.accessToken;
    const studentUser = studJson.data?.user;

    // 3. Create a Missed Assessment (past deadline, public)
    missedExamTitle = `Missed Biology Quiz ${Date.now()}`;
    await request.post('http://localhost:5000/api/assessments', {
      headers: { Authorization: `Bearer ${instructorToken}` },
      data: {
        title: missedExamTitle,
        description: 'Comprehensive quiz covering cellular biology and respiration.',
        category: 'Computer Science',
        durationMinutes: 45,
        passingScore: 60,
        status: 'published',
        accessType: 'public',
        deadlineAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        questions: [
          {
            questionText: 'What is the powerhouse of the cell?',
            type: 'mcq',
            points: 10,
            options: [
              { id: 'opt_1', text: 'Mitochondria' },
              { id: 'opt_2', text: 'Ribosome' },
            ],
            correctAnswer: 'opt_1',
          },
        ],
      },
    });
  });

  test.beforeEach(async ({ page }) => {
    page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message));

    // Log in as student
    await page.goto('/auth/login');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.fill('#email', 'student@uap.edu');
    await page.fill('#password', 'Student@123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/student\/dashboard/);
  });

  test('1. Assessments table displays missed assessment with Request Reassignment button', async ({ page }) => {
    await page.goto('/student/catalog');
    console.log('Current URL after goto catalog:', page.url());
    const bodyText = await page.locator('body').innerText();
    console.log('BODY TEXT PREVIEW:', bodyText.slice(0, 500));
    await expect(page.getByRole('heading', { name: 'My Assessments' })).toBeVisible({ timeout: 10000 });

    // Verify view mode switcher buttons exist (Table and Cards)
    await expect(page.getByRole('button', { name: /Table/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Cards/i })).toBeVisible();

    // Verify table headers
    await expect(page.getByRole('columnheader', { name: 'Assessment Title' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Category' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Due Date' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Action' })).toBeVisible();

    // Find row with missed assessment
    const row = page.locator('tr', { hasText: missedExamTitle });
    await expect(row).toBeVisible();
    await expect(row.getByText('Missed', { exact: true })).toBeVisible();

    // Verify "Request Reassignment" button is rendered
    const requestBtn = row.getByRole('button', { name: 'Request Reassignment' });
    await expect(requestBtn).toBeVisible();
  });

  test('2. Request Reassignment Modal elements, validation, character counter and cancellation', async ({ page }) => {
    await page.goto('/student/catalog');
    const row = page.locator('tr', { hasText: missedExamTitle });
    await expect(row).toBeVisible({ timeout: 10000 });

    // Open modal
    await row.getByRole('button', { name: 'Request Reassignment' }).click();

    // Verify modal title and close icon
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();
    await expect(modal.getByRole('heading', { name: 'Request Reassignment' })).toBeVisible();
    await expect(modal.getByRole('button', { name: 'Close modal' })).toBeVisible();

    // Verify assessment information card
    await expect(modal.getByText(missedExamTitle)).toBeVisible();
    await expect(modal.getByText('Due:')).toBeVisible();

    // Verify required label and helper text
    await expect(modal.getByText('Reason for Request')).toBeVisible();
    await expect(modal.getByText('Please provide a clear and valid reason for your reassignment request.')).toBeVisible();

    // Verify textarea and placeholder
    const textarea = modal.locator('textarea#reassignment-reason');
    await expect(textarea).toBeVisible();
    await expect(textarea).toHaveAttribute('placeholder', 'Enter your reason here...');

    // Verify initial character counter 0/500
    await expect(modal.getByText('0/500')).toBeVisible();

    // Verify footer buttons: Cancel and Submit Request
    const cancelBtn = modal.getByRole('button', { name: 'Cancel' });
    const submitBtn = modal.getByRole('button', { name: 'Submit Request' });
    await expect(cancelBtn).toBeVisible();
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toBeDisabled();

    // Test too-short reason (< 10 non-whitespace chars)
    await textarea.fill('Short');
    await textarea.blur();
    await expect(modal.getByText('5/500')).toBeVisible();
    await expect(modal.getByText('Reason must contain at least 10 non-whitespace characters.')).toBeVisible();
    await expect(submitBtn).toBeDisabled();

    // Test whitespace-only reason
    await textarea.fill('          ');
    await textarea.blur();
    await expect(modal.getByText('Reason must contain at least 10 non-whitespace characters.')).toBeVisible();
    await expect(submitBtn).toBeDisabled();

    // Test Cancel button closes modal without submitting
    await cancelBtn.click();
    await expect(modal).not.toBeVisible();
  });

  test('3. Submit valid reassignment request and verify immediate status transition to Request Pending', async ({ page }) => {
    await page.goto('/student/catalog');
    const row = page.locator('tr', { hasText: missedExamTitle });
    await expect(row).toBeVisible({ timeout: 10000 });

    // Open modal
    await row.getByRole('button', { name: 'Request Reassignment' }).click();

    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();

    const textarea = modal.locator('textarea#reassignment-reason');
    const validReason = 'I experienced an urgent medical hospitalization with documentation available upon request.';
    await textarea.fill(validReason);

    // Verify counter reflects character count and submit button is enabled
    await expect(modal.getByText(`${validReason.length}/500`)).toBeVisible();
    const submitBtn = modal.getByRole('button', { name: 'Submit Request' });
    await expect(submitBtn).toBeEnabled();

    // Click submit
    await submitBtn.click();

    // Modal closes
    await expect(modal).not.toBeVisible();

    // Status on the row updates to "Request Pending" and "Pending Approval"
    await expect(row.getByText('Request Pending')).toBeVisible({ timeout: 5000 });
    await expect(row.getByText('Pending Approval')).toBeVisible();

    // Verify "Request Reassignment" button is replaced by pending status (cannot duplicate request)
    await expect(row.getByRole('button', { name: 'Request Reassignment' })).not.toBeVisible();
  });
});
