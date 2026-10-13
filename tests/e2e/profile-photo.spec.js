const { test, expect } = require('@playwright/test');

test.describe('Profile Photo Management for All RBAC Roles (Student, Faculty, Admin)', () => {
  // 1x1 PNG sample image buffer
  const samplePngBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );

  // 1x1 JPEG sample image buffer
  const sampleJpgBuffer = Buffer.from(
    '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
    'base64'
  );

  test.describe('Student Profile Photo Lifecycle', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/auth/login');
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      await page.fill('#email', 'student@uap.edu');
      await page.fill('#password', 'Student@123');
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/\/student\/dashboard/);
    });

    test('Student: View initials fallback, Add photo, Change photo, and Remove photo', async ({ page }) => {
      await page.goto('/student/profile');
      await expect(page.getByText('Student Academic Profile')).toBeVisible({ timeout: 10000 });

      // Clean up if photo exists from prior session
      const changeMenuBtn = page.locator('main button[aria-label="Upload/Change Image"], main button[aria-label="Change or remove profile photo"]').first();
      if (await changeMenuBtn.isVisible()) {
        await changeMenuBtn.click();
        await page.getByRole('menuitem', { name: /Remove/i }).click();
        await expect(page.locator('main button[aria-label="Upload Image"], main button[aria-label="Add Profile Photo"]').first()).toBeVisible({ timeout: 10000 });
      }

      // 1. Initial State: Initials avatar displayed ("AJ" for Alex Johnson)
      const initialsBox = page.locator('main div[title="Alex Johnson"]');
      await expect(initialsBox).toBeVisible({ timeout: 10000 });
      await expect(initialsBox).toHaveText('AJ');

      // Verify State 1: Upload Image action button is visible
      const uploadImageBtn = page.locator('main button[aria-label="Upload Image"]').first();
      await expect(uploadImageBtn).toBeVisible();
      await uploadImageBtn.click();
      const uploadMenuItem = page.getByRole('menuitem', { name: /Upload Image|Add Photo/i });
      await expect(uploadMenuItem).toBeVisible();
      // Close menu by clicking button again
      await uploadImageBtn.click();
      await expect(uploadMenuItem).not.toBeVisible();

      // 2. Add Photo: select valid PNG
      const fileInput = page.locator('main input[type="file"][accept*="image"]');
      await fileInput.setInputFiles({
        name: 'student-test-photo.png',
        mimeType: 'image/png',
        buffer: samplePngBuffer,
      });

      // Verify photo displayed in main profile card
      const uploadedImg = page.locator('main img.w-24');
      await expect(uploadedImg).toBeVisible({ timeout: 10000 });
      await expect(uploadedImg).toHaveAttribute('src', /^\/uploads\/avatar-.*\.png$/);

      // Verify action button now offers Upload/Change and Remove
      const actionButton = page.locator('main button[aria-label="Upload/Change Image"]').first();
      await expect(actionButton).toBeVisible();
      const directRemoveBtn = page.locator('main button[aria-label="Remove"]').first();
      await expect(directRemoveBtn).toBeVisible();

      // 3. Change Photo: open dropdown menu and trigger change
      await actionButton.click();
      const changeMenuItem = page.getByRole('menuitem', { name: /Upload\/Change Image|Change Photo/i });
      const removeMenuItem = page.getByRole('menuitem', { name: /Remove/i });
      await expect(changeMenuItem).toBeVisible();
      await expect(removeMenuItem).toBeVisible();

      // Upload replacement JPEG photo
      await fileInput.setInputFiles({
        name: 'student-replacement-photo.jpg',
        mimeType: 'image/jpeg',
        buffer: sampleJpgBuffer,
      });

      // Verify updated photo is displayed
      await expect(uploadedImg).toBeVisible({ timeout: 10000 });
      await expect(uploadedImg).toHaveAttribute('src', /^\/uploads\/avatar-.*\.jpe?g$/);

      // 4. Remove Photo: open menu and click Remove
      await actionButton.click();
      await expect(removeMenuItem).toBeVisible();
      await removeMenuItem.click();

      // 5. Verify Initials fallback returns ("AJ")
      await expect(initialsBox).toBeVisible({ timeout: 10000 });
      await expect(initialsBox).toHaveText('AJ');
      await expect(page.locator('main button[aria-label="Upload Image"]').first()).toBeVisible();
    });
  });

  test.describe('Faculty Profile Photo Lifecycle', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/auth/login');
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      await page.fill('#email', 'instructor@uap.edu');
      await page.fill('#password', 'Instructor@123');
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/\/instructor\/dashboard/);
    });

    test('Faculty: Add photo, verify photo, and remove photo with initials fallback', async ({ page }) => {
      await page.goto('/instructor/profile');
      await expect(page.getByText('Faculty Academic Profile')).toBeVisible({ timeout: 10000 });

      // Clean up if photo exists
      const changeMenuBtn = page.locator('main button[aria-label="Upload/Change Image"], main button[aria-label="Change or remove profile photo"]').first();
      if (await changeMenuBtn.isVisible()) {
        await changeMenuBtn.click();
        await page.getByRole('menuitem', { name: /Remove/i }).click();
        await expect(page.locator('main button[aria-label="Upload Image"], main button[aria-label="Add Profile Photo"]').first()).toBeVisible({ timeout: 10000 });
      }

      // Verify initial state: Upload Image button and State 1 popover "Upload Image"
      const uploadImageBtn = page.locator('main button[aria-label="Upload Image"]').first();
      await expect(uploadImageBtn).toBeVisible({ timeout: 10000 });
      await uploadImageBtn.click();
      await expect(page.getByRole('menuitem', { name: /Upload Image|Add Photo/i })).toBeVisible();
      await uploadImageBtn.click();

      // Add Photo
      const fileInput = page.locator('main input[type="file"][accept*="image"]');
      await fileInput.setInputFiles({
        name: 'faculty-test-photo.png',
        mimeType: 'image/png',
        buffer: samplePngBuffer,
      });

      // Verify photo visible in main profile
      const uploadedImg = page.locator('main img.w-24');
      await expect(uploadedImg).toBeVisible({ timeout: 10000 });

      // State 2: Verify Change and Remove Photo options
      const actionButton = page.locator('main button[aria-label="Upload/Change Image"]').first();
      await actionButton.click();
      await expect(page.getByRole('menuitem', { name: /Upload\/Change Image|Change Photo/i })).toBeVisible();
      const removeMenuItem = page.getByRole('menuitem', { name: /Remove/i });
      await expect(removeMenuItem).toBeVisible();

      // Remove Photo
      await removeMenuItem.click();

      // Verify initials / Upload Image button returns
      await expect(page.locator('main button[aria-label="Upload Image"]').first()).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Admin Profile Photo Lifecycle', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/auth/login');
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      await page.fill('#email', 'admin@uap.edu');
      await page.fill('#password', 'Admin@123');
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/\/admin\/dashboard/);
    });

    test('Admin: Add photo, verify photo, and remove photo in Administrator Profile', async ({ page }) => {
      await page.goto('/admin/settings');
      await expect(page.getByText('Administrator Profile')).toBeVisible({ timeout: 10000 });

      // Clean up if photo exists
      const changeMenuBtn = page.locator('main button[aria-label="Upload/Change Image"], main button[aria-label="Change or remove profile photo"]').first();
      if (await changeMenuBtn.isVisible()) {
        await changeMenuBtn.click();
        await page.getByRole('menuitem', { name: /Remove/i }).click();
        await expect(page.locator('main button[aria-label="Upload Image"], main button[aria-label="Add Profile Photo"]').first()).toBeVisible({ timeout: 10000 });
      }

      // Verify initial state: Upload Image button and State 1 popover "Upload Image"
      const uploadImageBtn = page.locator('main button[aria-label="Upload Image"]').first();
      await expect(uploadImageBtn).toBeVisible({ timeout: 10000 });
      await uploadImageBtn.click();
      await expect(page.getByRole('menuitem', { name: /Upload Image|Add Photo/i })).toBeVisible();
      await uploadImageBtn.click();

      // Add Photo
      const fileInput = page.locator('main input[type="file"][accept*="image"]');
      await fileInput.setInputFiles({
        name: 'admin-test-photo.png',
        mimeType: 'image/png',
        buffer: samplePngBuffer,
      });

      // Verify photo displayed in main profile
      const uploadedImg = page.locator('main img.w-24');
      await expect(uploadedImg).toBeVisible({ timeout: 10000 });

      // State 2: Verify Change and Remove Photo options
      const actionButton = page.locator('main button[aria-label="Upload/Change Image"]').first();
      await actionButton.click();
      await expect(page.getByRole('menuitem', { name: /Upload\/Change Image|Change Photo/i })).toBeVisible();
      const removeMenuItem = page.getByRole('menuitem', { name: /Remove/i });
      await expect(removeMenuItem).toBeVisible();

      // Remove Photo
      await removeMenuItem.click();

      // Verify Initials / Upload Image returns
      await expect(page.locator('main button[aria-label="Upload Image"]').first()).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Security & Data Isolation for Profile Photo Removal', () => {
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

      // 3. Faculty uploads a profile photo
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
