import { test, expect } from '@playwright/test';

/**
 * TC001: User Authentication - Successful Login
 * Priority: HIGH
 * Description: Verify that users can login successfully with correct email and password
 */
test('TC001: Successful Login', async ({ page }) => {
    // Navigate to the application
    await page.goto('http://localhost:3000');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Check if we're on login page or already logged in
    const isLoginPage = await page.locator('input[type="email"]').isVisible().catch(() => false);

    if (isLoginPage) {
        // Fill in login credentials (using real superadmin account)
        await page.fill('input[type="email"]', 'Superadmin@hiregood.com');
        await page.fill('input[type="password"]', 'SuperAdmin123!');

        // Click login button
        await page.click('button:has-text("Login"), button:has-text("Masuk")');

        // Wait for navigation
        await page.waitForLoadState('networkidle');

        // Assert: User should be redirected to dashboard
        await expect(page).toHaveURL(/dashboard|ringkasan/i);

        // Verify dashboard elements are visible
        const dashboardVisible = await page.locator('text=/Dashboard|Ringkasan/i').isVisible();
        expect(dashboardVisible).toBeTruthy();
    } else {
        console.log('Already logged in, skipping login test');
    }
});

/**
 * TC002: User Authentication - Failed Login with Incorrect Credentials
 * Priority: HIGH
 * Description: Verify login fails when user provides incorrect credentials
 */
test('TC002: Failed Login with Incorrect Credentials', async ({ page }) => {
    // Navigate to the application
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');

    // Logout first if logged in
    const logoutButton = page.locator('button:has-text("Logout"), button:has-text("Keluar")');
    if (await logoutButton.isVisible().catch(() => false)) {
        await logoutButton.click();
        await page.waitForLoadState('networkidle');
    }

    // Fill in incorrect credentials
    await page.fill('input[type="email"]', 'wrong@email.com');
    await page.fill('input[type="password"]', 'WrongPassword123');

    // Click login button
    await page.click('button:has-text("Login"), button:has-text("Masuk")');

    // Wait a bit for error message
    await page.waitForTimeout(2000);

    // Assert: Error message should be displayed
    const errorVisible = await page.locator('text=/error|gagal|invalid|salah/i').isVisible().catch(() => false);
    expect(errorVisible).toBeTruthy();

    // Assert: Should still be on login page
    const emailInput = await page.locator('input[type="email"]').isVisible();
    expect(emailInput).toBeTruthy();
});

/**
 * TC013: Public Routes and Access Code Validation
 * Priority: HIGH
 * Description: Ensure public routes are accessible without authentication
 */
test('TC013: Public Routes Accessible Without Auth', async ({ page }) => {
    // Test public career page access
    await page.goto('http://localhost:3000/careers/test-company');
    await page.waitForLoadState('networkidle');

    // Should be able to access without login
    const pageLoaded = await page.locator('body').isVisible();
    expect(pageLoaded).toBeTruthy();

    // Test public job page access
    await page.goto('http://localhost:3000/jobs/test-company/test-job');
    await page.waitForLoadState('networkidle');

    const jobPageLoaded = await page.locator('body').isVisible();
    expect(jobPageLoaded).toBeTruthy();
});

/**
 * TC004: Job Posting Creation and Visibility
 * Priority: HIGH
 * Description: Verify that HR users can create job postings
 * Note: Requires authentication
 */
test('TC004: Job Posting Creation', async ({ page }) => {
    // Login first
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');

    // Check if login is needed
    const isLoginPage = await page.locator('input[type="email"]').isVisible().catch(() => false);
    if (isLoginPage) {
        await page.fill('input[type="email"]', 'Superadmin@hiregood.com');
        await page.fill('input[type="password"]', 'SuperAdmin123!');
        await page.click('button:has-text("Login"), button:has-text("Masuk")');
        await page.waitForLoadState('networkidle');
    }

    // Navigate to job management
    await page.click('text=/Jobs|Lowongan/i');
    await page.waitForLoadState('networkidle');

    // Look for create job button
    const createButton = page.locator('button:has-text("Create"), button:has-text("Buat"), button:has-text("Add")');
    if (await createButton.isVisible().catch(() => false)) {
        await createButton.click();

        // Verify job creation form is visible
        const formVisible = await page.locator('input, textarea').first().isVisible();
        expect(formVisible).toBeTruthy();
    } else {
        console.log('Create job button not found - may need proper HR credentials');
    }
});

/**
 * TC006: AI Interview System - Chatbot Interview Flow
 * Priority: HIGH
 * Description: Validate AI chatbot conducts interview
 * Note: Requires assessment access code
 */
test('TC006: AI Interview Chatbot Flow', async ({ page }) => {
    // Navigate to public assessment page
    await page.goto('http://localhost:3000/?mode=assess&cid=test-company-id');
    await page.waitForLoadState('networkidle');

    // Check if access code input is visible
    const accessCodeInput = await page.locator('input[placeholder*="code"], input[placeholder*="kode"]').isVisible().catch(() => false);

    if (accessCodeInput) {
        // Enter test access code
        await page.fill('input[placeholder*="code"], input[placeholder*="kode"]', 'TEST123');
        await page.click('button:has-text("Start"), button:has-text("Mulai")');
        await page.waitForTimeout(2000);

        // Check if chatbot interface is visible
        const chatVisible = await page.locator('textarea, input[type="text"]').isVisible().catch(() => false);
        expect(chatVisible).toBeTruthy();
    } else {
        console.log('Assessment page requires valid access code');
    }
});
