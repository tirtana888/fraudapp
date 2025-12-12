# Test Credentials

## Superadmin Account
- **Email:** Superadmin@hiregood.com
- **Password:** SuperAdmin123!
- **Role:** superadmin
- **Access:** Full system access

## Usage in Tests

The Playwright tests now use these real credentials:
- `tests/auth-and-core.spec.ts` - Updated to use superadmin account

## Running Tests

```bash
# Run all tests with real credentials
npx playwright test

# Run in UI mode to see tests execute
npx playwright test --ui

# Run with browser visible
npx playwright test --headed
```

## Expected Results

With real credentials, the following tests should now pass:
- ✅ TC001: Successful Login
- ✅ TC004: Job Posting Creation (superadmin has full access)

Tests that may still fail (need additional data):
- ⚠️ TC002: Failed Login (needs to test logout first)
- ⚠️ TC013: Public Routes (needs company slug)
- ⚠️ TC006: AI Interview (needs valid access code)

## Security Note

⚠️ **Important:** These are production credentials. Do not commit this file to version control.

Add to `.gitignore`:
```
test-credentials.md
tests/.env
```

Consider using environment variables:
```typescript
// In tests
const email = process.env.TEST_EMAIL || 'Superadmin@hiregood.com';
const password = process.env.TEST_PASSWORD || 'SuperAdmin123!';
```
