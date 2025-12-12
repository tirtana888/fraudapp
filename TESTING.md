# Playwright Test Guide for FraudGuard

## Setup Complete ✅

Playwright has been configured for the FraudGuard project with:
- 5 initial test cases covering high-priority features
- Auto-start dev server configuration
- Screenshot and video capture on failures

## Running Tests

### Run All Tests
```bash
npx playwright test
```

### Run Tests in UI Mode (Recommended for Development)
```bash
npx playwright test --ui
```

### Run Specific Test File
```bash
npx playwright test tests/auth-and-core.spec.ts
```

### Run Tests in Headed Mode (See Browser)
```bash
npx playwright test --headed
```

### View Test Report
```bash
npx playwright show-report
```

## Implemented Tests

### ✅ TC001: Successful Login
- Tests login with valid credentials
- Verifies redirect to dashboard
- Checks for dashboard elements

### ✅ TC002: Failed Login
- Tests login with invalid credentials
- Verifies error message display
- Ensures user stays on login page

### ✅ TC013: Public Routes
- Tests public career page access
- Tests public job page access
- Verifies no authentication required

### ✅ TC004: Job Posting Creation
- Tests navigation to job management
- Verifies create job button
- Checks job creation form

### ✅ TC006: AI Interview Chatbot
- Tests public assessment access
- Verifies access code validation
- Checks chatbot interface

## Test Data Requirements

To run tests successfully, you'll need:

1. **Test User Accounts:**
   - Email: `test@company.com`, Password: `TestPassword123`
   - Email: `hr@company.com`, Password: `HRPassword123`

2. **Test Company:**
   - Company slug: `test-company`
   - Company ID: `test-company-id`

3. **Test Job:**
   - Job slug: `test-job`

4. **Test Access Code:**
   - Code: `TEST123`

## Adding More Tests

To implement the remaining 15 test cases from the test plan:

1. Create new test files in `tests/` directory:
   - `tests/multi-tenant.spec.ts` (TC003)
   - `tests/fraud-detection.spec.ts` (TC008)
   - `tests/kyc.spec.ts` (TC009, TC010)
   - `tests/credits.spec.ts` (TC011, TC016)
   - `tests/email.spec.ts` (TC012)
   - `tests/workflow.spec.ts` (TC015)
   - `tests/dashboard.spec.ts` (TC014, TC020)
   - `tests/edge-cases.spec.ts` (TC017, TC018)

2. Follow the same pattern as `auth-and-core.spec.ts`

3. Reference the detailed test steps in `testsprite_tests/frontend-test-plan-summary.md`

## Troubleshooting

### Tests Fail with "Page not found"
- Ensure dev server is running: `npm run dev`
- Or let Playwright auto-start it (configured in `playwright.config.ts`)

### Tests Fail with "Element not found"
- The app might use different text/selectors
- Update selectors in test files to match actual UI
- Use Playwright Inspector: `npx playwright test --debug`

### Need to Update Test Credentials
- Create test users in Firebase
- Update credentials in test files

## Next Steps

1. **Create test data** in Firebase (users, companies, jobs)
2. **Run initial tests** to see current state
3. **Update selectors** based on actual UI elements
4. **Implement remaining tests** from the test plan
5. **Add to CI/CD** pipeline for automated testing

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Test Plan Summary](testsprite_tests/frontend-test-plan-summary.md)
- [Backend Test Report](testsprite_tests/testsprite-mcp-test-report.md)
