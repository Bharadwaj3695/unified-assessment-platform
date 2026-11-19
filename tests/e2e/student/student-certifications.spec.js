const { test, expect } = require('@playwright/test');

test.describe('Student Portal: Assessment & Certification Navigation & My Certifications Page', () => {
  test.beforeEach(async ({ page }) => {
    // Login as default student
    await page.goto('/auth/login');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.fill('#email', 'student@uap.edu');
    await page.fill('#password', 'Student@123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/student\/dashboard/);
    await expect(page.locator('aside')).toBeVisible({ timeout: 10000 });
  });

  test('1. Sidebar displays ASSESSMENT & CERTIFICATION section with My Assessments and My Certifications', async ({ page }) => {
    const aside = page.locator('aside');

    // Section header should be present in sidebar
    const sectionHeader = aside.getByText(/Assessment & Certification/i);
    await expect(sectionHeader).toBeVisible();

    // Both navigation items must be present under the section
    const assessmentsLink = aside.locator('nav a', { hasText: 'My Assessments' });
    const certificationsLink = aside.locator('nav a', { hasText: 'My Certifications' });

    await expect(assessmentsLink).toBeVisible();
    await expect(certificationsLink).toBeVisible();

    // Verify award icon is rendered inside My Certifications item
    const certIcon = certificationsLink.locator('svg');
    await expect(certIcon).toBeVisible();
  });

  test('2. Navigation between My Assessments and My Certifications works with active highlighting', async ({ page }) => {
    const aside = page.locator('aside');
    const assessmentsLink = aside.locator('nav a', { hasText: 'My Assessments' });
    const certificationsLink = aside.locator('nav a', { hasText: 'My Certifications' });

    // Click My Certifications
    await certificationsLink.click();
    await expect(page).toHaveURL(/\/student\/certifications/);
    await expect(certificationsLink).toHaveClass(/bg-brand-primary-light/);
    await expect(certificationsLink).toHaveAttribute('aria-current', 'page');

    // Page title and heading
    await expect(page.getByRole('heading', { name: 'My Certifications', level: 1 })).toBeVisible();
    await expect(page.getByRole('main').getByText('Assessment & Certification')).toBeVisible();

    // Click My Assessments
    await assessmentsLink.click();
    await expect(page).toHaveURL(/\/student\/catalog/);
    await expect(assessmentsLink).toHaveClass(/bg-brand-primary-light/);
    await expect(assessmentsLink).toHaveAttribute('aria-current', 'page');
    await expect(certificationsLink).not.toHaveClass(/bg-brand-primary-light/);

    // Click back to My Certifications
    await certificationsLink.click();
    await expect(page).toHaveURL(/\/student\/certifications/);
    await expect(certificationsLink).toHaveClass(/bg-brand-primary-light/);

    // Refresh page and ensure active highlighting persists
    await page.reload();
    await expect(page).toHaveURL(/\/student\/certifications/);
    const refreshedCertLink = aside.locator('nav a', { hasText: 'My Certifications' });
    await expect(refreshedCertLink).toHaveClass(/bg-brand-primary-light/);
    await expect(refreshedCertLink).toHaveAttribute('aria-current', 'page');
  });

  test('3. My Certifications page displays the exact empty state when student has no certificates', async ({ page }) => {
    await page.goto('/student/certifications');
    await expect(page).toHaveURL(/\/student\/certifications/);

    // Heading
    await expect(page.getByRole('heading', { name: 'My Certifications', level: 1 })).toBeVisible();

    // Required empty state heading and message
    const emptyStateHeading = page.getByText('No certificates earned yet', { exact: true });
    await expect(emptyStateHeading).toBeVisible({ timeout: 10000 });

    const emptyStateMessage = page.getByText(
      'Complete an eligible assessment and meet its certification requirements to earn your certificate.',
      { exact: true }
    );
    await expect(emptyStateMessage).toBeVisible();

    // Action button navigates to assessments
    const browseButton = page.getByRole('button', { name: 'View Assessments' });
    await expect(browseButton).toBeVisible();
    await browseButton.click();
    await expect(page).toHaveURL(/\/student\/catalog/);
  });

  test('4. Security: Unauthenticated users cannot access /student/certifications directly', async ({ page, context }) => {
    // Clear cookies/storage to simulate unauthenticated visitor
    await context.clearCookies();
    await page.goto('/auth/login');
    await page.evaluate(() => localStorage.clear());

    // Attempt direct navigation to student certifications
    await page.goto('/student/certifications');
    // Must be redirected to login
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('5. Populated state: Displays certificate title, assessment name, grade & percentage, ID, date, status, and download action', async ({ page }) => {
    // Mock populated certificates payload
    await page.route('**/api/certificates/mine', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Certificates retrieved successfully',
          data: [
            {
              id: '671234567890abcdef123456',
              _id: '671234567890abcdef123456',
              certificateId: 'CERT-2026-DIST01',
              title: 'Specialist in Distributed Systems',
              certificateTitle: 'Specialist in Distributed Systems',
              assessmentName: 'Distributed Systems & Cloud Architecture',
              assessmentTitle: 'Distributed Systems & Cloud Architecture',
              category: 'Computer Science',
              grade: 'A+',
              gradeLabel: 'Outstanding',
              percentage: 96,
              score: 96,
              totalPoints: 100,
              issuedAt: '2026-10-24T12:00:00.000Z',
              status: 'active',
              verificationCode: 'VERIFY-TOKEN-998877',
              downloadAvailable: false,
              downloadDependencyMessage: 'Certificate PDF rendering and download service is pending backend implementation.',
            },
          ],
        }),
      });
    });

    // Mock download endpoint returning 501 (pending backend dependency)
    await page.route('**/api/certificates/*/download', async (route) => {
      await route.fulfill({
        status: 501,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          message: 'Certificate PDF download functionality is currently pending backend implementation',
        }),
      });
    });

    await page.goto('/student/certifications');
    await expect(page).toHaveURL(/\/student\/certifications/);

    // Verify all required table fields are displayed
    await expect(page.getByText('Specialist in Distributed Systems')).toBeVisible();
    await expect(page.getByText('Distributed Systems & Cloud Architecture')).toBeVisible();
    await expect(page.getByText('A+ (Outstanding)')).toBeVisible();
    await expect(page.getByText('96%')).toBeVisible();
    await expect(page.getByText('CERT-2026-DIST01')).toBeVisible();
    await expect(page.getByText('Oct 24, 2026')).toBeVisible();
    await expect(page.getByRole('table').getByText('Active')).toBeVisible();

    // Verify download action button exists
    const downloadButton = page.getByRole('button', { name: 'Download' });
    await expect(downloadButton).toBeVisible();
    await downloadButton.click();

    // Toast/notice informing about backend dependency
    await expect(
      page.getByText(/Certificate PDF rendering service is pending backend implementation/i)
    ).toBeVisible({ timeout: 5000 });

    // Open Credential snapshot modal
    const viewButton = page.getByRole('button', { name: 'View Credential Snapshot' });
    await expect(viewButton).toBeVisible();
    await viewButton.click();

    await expect(page.getByText('Authoritative Credential Snapshot')).toBeVisible();
    await expect(page.getByText('VERIFY-TOKEN-998877')).toBeVisible();
  });

  test('6. Error state: Displays friendly error message and retry button on fetch failure', async ({ page }) => {
    await page.route('**/api/certificates/mine', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, message: 'Server database connection timeout' }),
      });
    });

    await page.goto('/student/certifications');
    await expect(page).toHaveURL(/\/student\/certifications/);

    await expect(page.getByText('Could not load certifications')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Try Again' })).toBeVisible();
  });
});
