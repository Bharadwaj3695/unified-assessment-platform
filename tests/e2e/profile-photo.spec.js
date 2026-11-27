const { test, expect } = require('@playwright/test');

test.describe('Profile Image Upload and Edit Functionality Across All Roles', () => {
  // 1x1 valid PNG image buffer
  const samplePngBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );

  test.describe('Student Profile Image Upload, Preview, Cancel, Save, and Remove', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/auth/login');
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      await page.fill('#email', 'student@uap.edu');
      await page.fill('#password', 'Student@123');
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/\/student\/dashboard/);
    });

    test('Student: verify display avatar, dedicated Profile Photo section, cancel, save, and removal lifecycle', async ({ page }) => {
      await page.goto('/student/profile');
      await expect(page.getByText('Student Academic Profile')).toBeVisible({ timeout: 10000 });

      const leftCard = page.locator('.md\\:col-span-5');

      // Clean up previous avatar if present from earlier runs
      const existingRemoveBtn = leftCard.getByRole('button', { name: 'Remove Photo' });
      if (await existingRemoveBtn.isVisible()) {
        await existingRemoveBtn.click();
        const saveBtn = page.getByRole('button', { name: 'Save Profile Changes' });
        await saveBtn.click();
        await expect(page.getByText(/profile updated successfully/i).first()).toBeVisible();
      }

      // 1. Left card: Initials avatar displayed ("AJ"), NO floating upload button
      const initialsBox = page.locator('main div[title="Alex Johnson"]').first();
      await expect(initialsBox).toBeVisible();
      await expect(initialsBox).toHaveText('AJ');

      // Floating upload icon MUST NOT exist
      const floatingUpload = page.locator('main button[title*="Upload"], main button[aria-label*="Upload"]').filter({
        hasNotText: /Upload Photo|Change Photo/i,
      });
      await expect(floatingUpload).toHaveCount(0);

      // 2. Left card contains compact image upload controls below name and badge
      const uploadBtn = leftCard.getByRole('button', { name: 'Upload Photo' });
      await expect(uploadBtn).toBeVisible();

      // Right form does NOT have a separate Profile Photo section or upload controls
      await expect(page.locator('form').getByRole('heading', { name: 'Profile Photo' })).toHaveCount(0);
      await expect(page.locator('form').getByRole('button', { name: /Upload Photo|Change Photo|Remove Photo/i })).toHaveCount(0);

      // 3. Staging a photo selection updates preview before saving
      const fileInput = page.locator('input[type="file"][aria-label="Select profile image"]');
      await fileInput.setInputFiles({
        name: 'test-student-avatar.png',
        mimeType: 'image/png',
        buffer: samplePngBuffer,
      });

      // Preview immediately updates to show image and staged notice
      await expect(page.getByText('New photo selected (click Save Changes to apply)')).toBeVisible();
      const previewImg = leftCard.locator('img[alt="Alex Johnson"]');
      await expect(previewImg).toBeVisible();

      // 4. Cancel discards unsaved image changes
      const cancelBtn = page.getByRole('button', { name: 'Cancel' });
      await cancelBtn.click();

      // Staged change discarded: initials avatar restored, Upload Photo button reappears
      await expect(page.getByText('New photo selected (click Save Changes to apply)')).not.toBeVisible();
      await expect(uploadBtn).toBeVisible();
      await expect(initialsBox).toBeVisible();

      // 5. Select photo again and persist with Save Profile Changes
      await fileInput.setInputFiles({
        name: 'test-student-avatar.png',
        mimeType: 'image/png',
        buffer: samplePngBuffer,
      });
      await expect(previewImg).toBeVisible();

      const saveBtn = page.getByRole('button', { name: 'Save Profile Changes' });
      await saveBtn.click();

      // Success notification
      await expect(page.getByText(/profile updated successfully/i).first()).toBeVisible();

      // After save: left card shows image and controls show "Change Photo" & "Remove Photo"
      const leftCardImg = leftCard.locator('img[alt="Alex Johnson"]');
      await expect(leftCardImg).toBeVisible();
      await expect(leftCard.getByRole('button', { name: 'Change Photo' })).toBeVisible();
      const removeBtn = leftCard.getByRole('button', { name: 'Remove Photo' });
      await expect(removeBtn).toBeVisible();

      // 6. Test Remove Photo: staging removal updates preview
      await removeBtn.click();
      await expect(page.getByText('Photo marked for removal (click Save Changes to apply)')).toBeVisible();

      // Test cancel on removal discards staged removal
      await cancelBtn.click();
      await expect(leftCard.getByRole('button', { name: 'Change Photo' })).toBeVisible();
      await expect(leftCardImg).toBeVisible();

      // Now remove and Save Changes
      await removeBtn.click();
      await saveBtn.click();
      await expect(page.getByText(/profile updated successfully/i).last()).toBeVisible();

      // Saved avatar is removed: initials fallback is restored
      await expect(page.locator('main div[title="Alex Johnson"]').first()).toBeVisible();
      await expect(leftCard.getByRole('button', { name: 'Upload Photo' })).toBeVisible();
    });
  });

  test.describe('Faculty Profile Image Section & Consistency', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/auth/login');
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      await page.fill('#email', 'instructor@uap.edu');
      await page.fill('#password', 'Instructor@123');
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/\/instructor\/dashboard/);
    });

    test('Faculty: verify no duplicate floating icon, dedicated Profile Photo section, and upload/remove flow', async ({ page }) => {
      await page.goto('/instructor/profile');
      await expect(page.getByText('Faculty Academic Profile')).toBeVisible({ timeout: 10000 });

      const leftCard = page.locator('.md\\:col-span-5');

      // Clean up previous avatar if present from earlier runs
      const existingRemoveBtn = leftCard.getByRole('button', { name: 'Remove Photo' });
      if (await existingRemoveBtn.isVisible()) {
        await existingRemoveBtn.click();
        const saveBtn = page.getByRole('button', { name: 'Save Changes' });
        await saveBtn.click();
        await expect(page.getByText(/updated successfully/i).first()).toBeVisible();
      }

      // Initials fallback
      const initialsBox = page.locator('main div[title="Prof. Alan Turing"]').first();
      await expect(initialsBox).toBeVisible();
      await expect(initialsBox).toHaveText('AT');

      // No floating upload badge
      const floatingUpload = page.locator('main button[title*="Upload"], main button[aria-label*="Upload"]').filter({
        hasNotText: /Upload Photo|Change Photo/i,
      });
      await expect(floatingUpload).toHaveCount(0);

      // Left card contains compact image upload controls below name and badge
      const uploadBtn = leftCard.getByRole('button', { name: 'Upload Photo' });
      await expect(uploadBtn).toBeVisible();

      // Right form does NOT have a separate Profile Photo section or upload controls
      await expect(page.locator('form').getByRole('heading', { name: 'Profile Photo' })).toHaveCount(0);
      await expect(page.locator('form').getByRole('button', { name: /Upload Photo|Change Photo|Remove Photo/i })).toHaveCount(0);

      // Stage photo
      const fileInput = page.locator('input[type="file"][aria-label="Select profile image"]');
      await fileInput.setInputFiles({
        name: 'faculty-avatar.png',
        mimeType: 'image/png',
        buffer: samplePngBuffer,
      });

      await expect(page.getByText('New photo selected (click Save Changes to apply)')).toBeVisible();
      const previewImg = leftCard.locator('img[alt="Prof. Alan Turing"]');
      await expect(previewImg).toBeVisible();

      // Save changes
      const saveBtn = page.getByRole('button', { name: 'Save Changes' });
      await saveBtn.click();
      await expect(page.getByText(/updated successfully/i).first()).toBeVisible();

      // Verify buttons updated to Change Photo and Remove Photo
      await expect(leftCard.getByRole('button', { name: 'Change Photo' })).toBeVisible();
      const removeBtn = leftCard.getByRole('button', { name: 'Remove Photo' });
      await expect(removeBtn).toBeVisible();

      // Remove and clean up
      await removeBtn.click();
      await saveBtn.click();
      await expect(page.getByText(/updated successfully/i).last()).toBeVisible();
      await expect(leftCard.getByRole('button', { name: 'Upload Photo' })).toBeVisible();
      await expect(initialsBox).toBeVisible();
    });
  });

  test.describe('Admin Profile Image Section & Consistency', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/auth/login');
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      await page.fill('#email', 'admin@uap.edu');
      await page.fill('#password', 'Admin@123');
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/\/admin\/dashboard/);
    });

    test('Admin: verify no floating blue icon, dedicated Profile Photo section, and upload/remove flow', async ({ page }) => {
      await page.goto('/admin/profile');
      await expect(page.getByText('Administrator Profile')).toBeVisible({ timeout: 10000 });

      const leftCard = page.locator('.md\\:col-span-5');

      // Clean up previous avatar if present from earlier runs
      const existingRemoveBtn = leftCard.getByRole('button', { name: 'Remove Photo' });
      if (await existingRemoveBtn.isVisible()) {
        await existingRemoveBtn.click();
        const saveBtn = page.getByRole('button', { name: 'Save Profile Changes' });
        await saveBtn.click();
        await expect(page.getByText(/administrator profile updated successfully/i).first()).toBeVisible();
      }

      // Initials fallback
      const initialsBox = page.locator('main div[title="System Administrator"]').first();
      await expect(initialsBox).toBeVisible();
      await expect(initialsBox).toHaveText('SA');

      // No floating upload icon
      const floatingUpload = page.locator('main button[title*="Upload"], main button[aria-label*="Upload"]').filter({
        hasNotText: /Upload Photo|Change Photo/i,
      });
      await expect(floatingUpload).toHaveCount(0);

      // Left card contains compact image upload controls below name and badge
      const uploadBtn = leftCard.getByRole('button', { name: 'Upload Photo' });
      await expect(uploadBtn).toBeVisible();

      // Right form does NOT have a separate Profile Photo section or upload controls
      await expect(page.locator('form').getByRole('heading', { name: 'Profile Photo' })).toHaveCount(0);
      await expect(page.locator('form').getByRole('button', { name: /Upload Photo|Change Photo|Remove Photo/i })).toHaveCount(0);

      // Stage photo
      const fileInput = page.locator('input[type="file"][aria-label="Select profile image"]');
      await fileInput.setInputFiles({
        name: 'admin-avatar.png',
        mimeType: 'image/png',
        buffer: samplePngBuffer,
      });

      await expect(page.getByText('New photo selected (click Save Changes to apply)')).toBeVisible();
      const previewImg = leftCard.locator('img[alt="System Administrator"]');
      await expect(previewImg).toBeVisible();

      // Save changes
      const saveBtn = page.getByRole('button', { name: 'Save Profile Changes' });
      await saveBtn.click();
      await expect(page.getByText(/administrator profile updated successfully/i).first()).toBeVisible();

      // Verify buttons
      await expect(leftCard.getByRole('button', { name: 'Change Photo' })).toBeVisible();
      const removeBtn = leftCard.getByRole('button', { name: 'Remove Photo' });
      await expect(removeBtn).toBeVisible();

      // Remove photo
      await removeBtn.click();
      await saveBtn.click();
      await expect(page.getByText(/administrator profile updated successfully/i).last()).toBeVisible();
      await expect(leftCard.getByRole('button', { name: 'Upload Photo' })).toBeVisible();
      await expect(initialsBox).toBeVisible();
    });
  });

  test.describe('Security & Data Isolation for Profile Photo Backend API', () => {
    test('Unauthenticated remove request is rejected with 401', async ({ request }) => {
      const res = await request.delete('http://localhost:5000/api/users/avatar');
      expect(res.status()).toBe(401);
      const body = await res.json();
      expect(body.success).toBe(false);
    });

    test('User cannot remove another user\'s profile image (JWT ownership strictly enforced)', async ({ request }) => {
      // 1. Log in as Student
      const studentLoginRes = await request.post('http://localhost:5000/api/auth/login', {
        data: { email: 'student@uap.edu', password: 'Student@123' },
      });
      const studentData = await studentLoginRes.json();
      const studentToken = studentData.data.accessToken;

      // 2. Log in as Faculty
      const facultyLoginRes = await request.post('http://localhost:5000/api/auth/login', {
        data: { email: 'instructor@uap.edu', password: 'Instructor@123' },
      });
      const facultyData = await facultyLoginRes.json();
      const facultyToken = facultyData.data.accessToken;
      const facultyId = facultyData.data.user.id;

      // 3. Faculty uploads a profile photo via API
      const uploadRes = await request.post('http://localhost:5000/api/users/avatar', {
        headers: { Authorization: `Bearer ${facultyToken}` },
        multipart: {
          avatar: {
            name: 'faculty-photo.png',
            mimeType: 'image/png',
            buffer: samplePngBuffer,
          },
        },
      });
      expect(uploadRes.status()).toBe(200);

      // Verify Faculty now has avatar
      const facultyProfileBefore = await request.get('http://localhost:5000/api/users/profile', {
        headers: { Authorization: `Bearer ${facultyToken}` },
      });
      const facultyProfileBeforeJson = await facultyProfileBefore.json();
      expect(facultyProfileBeforeJson.data.avatar).toBeTruthy();

      // 4. Student attempts to delete Faculty's avatar by forging userId in query/body
      const attackerAttempt = await request.delete(`http://localhost:5000/api/users/avatar?userId=${facultyId}`, {
        headers: { Authorization: `Bearer ${studentToken}` },
        data: { userId: facultyId },
      });
      expect(attackerAttempt.status()).toBe(200);

      // 5. Verify Faculty's avatar was NOT touched (strictly protected)
      const facultyProfileAfter = await request.get('http://localhost:5000/api/users/profile', {
        headers: { Authorization: `Bearer ${facultyToken}` },
      });
      const facultyProfileAfterJson = await facultyProfileAfter.json();
      expect(facultyProfileAfterJson.data.avatar).toBeTruthy();
      expect(facultyProfileAfterJson.data.avatar).toBe(facultyProfileBeforeJson.data.avatar);

      // 6. Faculty cleans up own avatar
      const facultyCleanup = await request.delete('http://localhost:5000/api/users/avatar', {
        headers: { Authorization: `Bearer ${facultyToken}` },
      });
      expect(facultyCleanup.status()).toBe(200);

      // 7. Verify Faculty's profile avatar is now null, but other fields are untouched
      const facultyFinalProfile = await request.get('http://localhost:5000/api/users/profile', {
        headers: { Authorization: `Bearer ${facultyToken}` },
      });
      const facultyFinalJson = await facultyFinalProfile.json();
      expect(facultyFinalJson.data.avatar).toBeNull();
      expect(facultyFinalJson.data.email).toBe('instructor@uap.edu');
      expect(facultyFinalJson.data.role).toBe('instructor');
      expect(facultyFinalJson.data.isActive).toBe(true);
      expect(facultyFinalJson.data.department).toBeTruthy();
    });
  });
});
