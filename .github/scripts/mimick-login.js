// Completes `mimick auth login` without a person: opens the sign-in URL the
// CLI printed in headless Chrome, enters the credentials and lets the page
// redirect to the CLI's localhost callback on this same machine.
//
// Env: MIMICK_LOGIN_URL, MIMICK_USERNAME, MIMICK_PASSWORD,
//      SCREENSHOT_DIR (where a screenshot goes if the sign-in fails).
const { chromium } = require('playwright');

const {
  MIMICK_LOGIN_URL,
  MIMICK_USERNAME,
  MIMICK_PASSWORD,
  SCREENSHOT_DIR = '.',
} = process.env;

const TIMEOUT_MS = 60_000;

(async () => {
  // channel 'chrome' uses the Google Chrome preinstalled on ubuntu-latest.
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage();
  page.setDefaultTimeout(TIMEOUT_MS);

  try {
    await page.goto(MIMICK_LOGIN_URL);

    // ZITADEL asks for the login name first, then the password on a second page.
    await page
      .locator('input[name="loginName"], input[type="email"], input[autocomplete="username"]')
      .first()
      .fill(MIMICK_USERNAME);
    await page.locator('button[type="submit"]').first().click();

    await page.locator('input[type="password"]').first().fill(MIMICK_PASSWORD);
    await page.locator('button[type="submit"]').first().click();

    // Wait for the redirect to the CLI; skip ZITADEL's optional
    // "set up MFA" prompt if it shows up on the way.
    const deadline = Date.now() + TIMEOUT_MS;
    while (!page.url().startsWith('http://localhost')) {
      if (Date.now() > deadline) {
        throw new Error(`sign-in did not reach the CLI callback; stuck at ${page.url()}`);
      }
      const skip = page.locator('#skip-button, button:has-text("Skip")');
      if (await skip.count()) await skip.first().click().catch(() => {});
      await page.waitForTimeout(1000);
    }
    console.log('[OK] MIMICK sign-in completed');
  } catch (err) {
    await page.screenshot({ path: `${SCREENSHOT_DIR}/mimick-login-failure.png`, fullPage: true }).catch(() => {});
    console.error(`ERROR: MIMICK sign-in failed: ${err.message}`);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
