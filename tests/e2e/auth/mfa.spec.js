const { test, expect } = require('@playwright/test');
const { generateSync } = require('otplib');

test.describe('Two-Factor Authentication (MFA/2FA) Frontend Experience', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();
  });

  test('1. Direct navigation to /auth/mfa-verify without pending challenge redirects to /auth/login', async ({ page }) => {
    await page.goto('/auth/mfa-verify');

    // Should automatically redirect back to /auth/login
    await expect(page).toHaveURL(/\/auth\/login/);
    const toastError = page.locator('.Toastify__toast--error');
    await expect(toastError.first()).toBeVisible({ timeout: 5000 });
    await expect(toastError.first()).toContainText('No pending MFA challenge');
  });

  test('2. MFA Verification view supports UI mode switching between TOTP and Recovery Code', async ({ page }) => {
    // Inject mock pending challenge into sessionStorage
    await page.goto('/auth/login');
    await page.evaluate(() => {
      sessionStorage.setItem(
        'uap_mfa_challenge',
        JSON.stringify({
          mfaToken: 'mock_challenge_token_for_ui_test',
          email: 'student@uap.edu',
          role: 'student',
        })
      );
    });

    await page.goto('/auth/mfa-verify');
    await expect(page).toHaveURL(/\/auth\/mfa-verify/);

    // Initial state: TOTP mode
    await expect(page.getByText('Two-Factor Authentication', { exact: true })).toBeVisible();
    await expect(page.locator('input[inputmode="numeric"]')).toBeVisible();
    const verifyButton = page.getByRole('button', { name: /Verify & Continue/i });
    await expect(verifyButton).toBeDisabled();

    // Switch to Recovery Code mode
    const recoveryToggle = page.getByRole('button', { name: /Use a recovery code/i });
    await recoveryToggle.click();

    await expect(page.getByText('Use Backup Recovery Code', { exact: true })).toBeVisible();
    const recoveryInput = page.locator('input[placeholder="XXXXX-XXXXX"]');
    await expect(recoveryInput).toBeVisible();

    // Switch back to Authenticator mode
    const totpToggle = page.getByRole('button', { name: /Back to authenticator code/i });
    await totpToggle.click();

    await expect(page.locator('input[inputmode="numeric"]')).toBeVisible();
  });

  test('3. Full 2FA lifecycle: Enrollment, MFA-gated login, and 2FA teardown', async ({ page }) => {
    // --- Step A: Login with baseline password credentials ---
    await page.goto('/auth/login');
    await page.fill('#email', 'student@uap.edu');
    await page.fill('#password', 'Student@123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/student\/dashboard/);

    // --- Step B: Navigate to Student Profile ---
    await page.goto('/student/profile');
    await expect(page.getByText('Two-Factor Authentication (2FA)')).toBeVisible();
    await expect(page.getByText('Disabled', { exact: true })).toBeVisible();

    // --- Step C: Initiate 2FA Enrollment ---
    const enableBtn = page.getByRole('button', { name: /Enable 2FA/i });
    await enableBtn.click();

    // Modal opens
    await expect(page.getByText('Set Up Two-Factor Authentication')).toBeVisible();
    await expect(page.locator('img[alt="MFA QR Code"]')).toBeVisible();

    // Extract manual secret code from UI
    const secretCodeElem = page.locator('code');
    await expect(secretCodeElem).toBeVisible();
    const totpSecret = (await secretCodeElem.textContent()).trim();
    expect(totpSecret.length).toBeGreaterThan(10);

    // Generate real TOTP verification code using otplib
    const currentTotp = generateSync({ secret: totpSecret });

    // Enter 6-digit TOTP into setup input
    const setupInput = page.locator('input[placeholder="000000"]');
    await setupInput.fill(currentTotp);

    const activateBtn = page.getByRole('button', { name: /Verify & Activate/i });
    await activateBtn.click();

    // --- Step D: Recovery Codes Screen ---
    await expect(page.getByText('Important: Save Your Recovery Codes')).toBeVisible({ timeout: 10000 });
    const recoveryCodeItems = page.locator('[data-testid="recovery-code-item"]');
    await expect(recoveryCodeItems).toHaveCount(8);

    // Confirm acknowledgement
    const doneBtn = page.getByRole('button', { name: /I Have Saved My Recovery Codes/i });
    await doneBtn.click();

    // Modal closes, profile updates
    await expect(page.getByText('Enabled & Active')).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: /Disable 2FA/i })).toBeVisible();

    // --- Step E: Sign out & Test MFA-Gated Login ---
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto('/auth/login');

    await page.fill('#email', 'student@uap.edu');
    await page.fill('#password', 'Student@123');
    await page.click('button[type="submit"]');

    // Frontend intercepts challenge and redirects to MFA verification
    await expect(page).toHaveURL(/\/auth\/mfa-verify/, { timeout: 10000 });
    await expect(page.getByText('Two-Factor Authentication')).toBeVisible();

    // Enter fresh TOTP token
    const loginTotp = generateSync({ secret: totpSecret });
    const mfaCodeInput = page.locator('input[inputmode="numeric"]');
    await mfaCodeInput.fill(loginTotp);

    const verifyLoginBtn = page.getByRole('button', { name: /Verify & Continue/i });
    await verifyLoginBtn.click();

    // Should complete verification and enter dashboard
    await expect(page).toHaveURL(/\/student\/dashboard/, { timeout: 10000 });
    await expect(page.getByText('student Workspace', { exact: true })).toBeVisible();

    // --- Step F: Disable 2FA to restore baseline account state ---
    await page.goto('/student/profile');
    const disableBtn = page.getByRole('button', { name: /Disable 2FA/i });
    await disableBtn.click();

    await expect(page.getByText('Disable Two-Factor Authentication')).toBeVisible();
    await page.fill('input[type="password"]', 'Student@123');

    const confirmDisableBtn = page.getByRole('button', { name: /Confirm & Disable 2FA/i });
    await confirmDisableBtn.click();

    await expect(page.getByText('Disabled', { exact: true })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /Enable 2FA/i })).toBeVisible();
  });
});
