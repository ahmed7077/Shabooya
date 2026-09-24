import { expect, test, type Page } from '@playwright/test';
import { addDays, format } from 'date-fns';
async function nav(page: Page, name: string) {
  const mobile = page.viewportSize()!.width < 850;
  await page
    .getByRole('navigation', {
      name: mobile ? 'Mobile navigation' : 'Main navigation',
      exact: true,
    })
    .getByRole('button', { name, exact: true })
    .click();
}
async function onboard(page: Page) {
  await page.goto('/');
  await page
    .getByRole('button', { name: 'Create an account', exact: true })
    .click();
  await page.getByLabel('Email address').fill('student@example.com');
  await page.getByLabel('Password', { exact: true }).fill('test-password-123');
  await page
    .getByRole('button', { name: 'Create account', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Let’s start with you.' }),
  ).toBeVisible();
  await page.getByLabel('Your name').fill('Ahmed');
  await page.getByLabel('University / college').fill('Independent University');
  await page.getByLabel('Course', { exact: true }).fill('Medicine');
  await page.getByLabel('Semester / year').fill('Year 2');
  await page.getByLabel('Timezone', { exact: true }).fill('UTC');
  await page.getByRole('button', { name: 'Continue to my timetable' }).click();
  await expect(
    page.getByRole('heading', { name: 'A little more on track.' }),
  ).toBeVisible();
}
async function timetable(page: Page) {
  await page
    .getByRole('button', { name: 'Create manually', exact: true })
    .click();
  await page
    .getByLabel('Academic start', { exact: true })
    .fill(format(addDays(new Date(), -8), 'yyyy-MM-dd'));
  await page
    .getByLabel('Academic end', { exact: true })
    .fill(format(addDays(new Date(), 20), 'yyyy-MM-dd'));
  await page.getByRole('button', { name: 'Add a class', exact: true }).click();
  await page.getByLabel('Subject 1', { exact: true }).fill('Anatomy');
  await page
    .getByLabel('Day', { exact: true })
    .selectOption(String(new Date().getUTCDay()));
  await page.getByLabel('Start time', { exact: true }).fill('00:00');
  await page.getByLabel('End time', { exact: true }).fill('00:01');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByLabel('I reviewed all dates, times, subjects and groups.')
    .check();
  await page.screenshot({
    path: `test-results/editor-${page.viewportSize()!.width}.png`,
    fullPage: true,
    animations: 'disabled',
  });
  await page
    .getByRole('button', { name: 'Confirm timetable', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'A little more on track.' }),
  ).toBeVisible();
}
test.beforeEach(async ({ request }) => {
  await request.post('http://127.0.0.1:54329/__reset');
});
test('student journey: onboarding, confirmation, marking, history, calendar, theme and sign out', async ({
  page,
}) => {
  await onboard(page);
  await timetable(page);
  await page
    .getByRole('button', { name: 'Mark Anatomy present', exact: true })
    .click();
  await expect(page.locator('.hero-number')).toContainText('100.0%');
  await page.screenshot({
    path: `test-results/dashboard-light-${page.viewportSize()!.width}.png`,
    fullPage: true,
    animations: 'disabled',
  });
  await page
    .getByRole('button', { name: 'Mark Anatomy absent', exact: true })
    .click();
  await expect(page.locator('.hero-number')).toContainText('0.0%');
  await page
    .getByRole('button', { name: 'Mark Anatomy present', exact: true })
    .click();
  await nav(page, 'Attendance');
  await expect(
    page.getByRole('heading', { name: 'Your progress, clearly.' }),
  ).toBeVisible();
  await page.locator('.subject-detail-card').click();
  await expect(
    page.getByRole('heading', { name: 'Anatomy', exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Coming up' })).toBeVisible();
  await nav(page, 'Calendar');
  await expect(
    page.getByRole('heading', { name: 'See the bigger picture.' }),
  ).toBeVisible();
  await page.screenshot({
    path: `test-results/calendar-${page.viewportSize()!.width}.png`,
    fullPage: true,
    animations: 'disabled',
  });
  await nav(page, 'Timetable');
  await expect(
    page.getByRole('heading', { name: 'Your week, laid out.' }),
  ).toBeVisible();
  await nav(page, 'Profile');
  await page.getByLabel('Appearance').selectOption('dark');
  await page.getByRole('button', { name: 'Save preferences' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/settings-${page.viewportSize()!.width}.png`,
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Welcome back.' }),
  ).toBeVisible();
  await page.getByLabel('Email address').fill('student@example.com');
  await page.getByLabel('Password', { exact: true }).fill('test-password-123');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.locator('.hero-number')).toContainText('100.0%');
  await page.screenshot({
    path: `test-results/dashboard-${page.viewportSize()!.width}.png`,
    fullPage: true,
    animations: 'disabled',
  });
});
test('offline reload retains queued attendance and syncs on reconnect', async ({
  page,
  context,
}) => {
  await onboard(page);
  await timetable(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Mark Anatomy present', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.connection')).toContainText('All up to date');
  await context.setOffline(true);
  await page
    .getByRole('button', { name: 'Mark Anatomy present', exact: true })
    .click();
  await expect(page.locator('.hero-number')).toContainText('100.0%');
  await page.reload();
  await expect(page.locator('.hero-number')).toContainText('100.0%');
  await expect(page.locator('.connection')).toContainText('Offline');
  await context.setOffline(false);
  await expect(page.locator('.connection')).toContainText('All up to date');
  await page.reload();
  await expect(page.locator('.hero-number')).toContainText('100.0%');
});
test('private image upload, holiday, cancellation correction, timetable replacement, account deletion', async ({
  page,
}) => {
  await onboard(page);
  await timetable(page);
  await page
    .getByRole('button', { name: 'Mark Anatomy present', exact: true })
    .click();
  await expect(page.locator('.connection')).toContainText('All up to date');
  await page.getByRole('button', { name: 'Options for Anatomy' }).click();
  await page.getByRole('button', { name: 'Cancel class', exact: true }).click();
  await expect(page.locator('.hero-number')).toContainText('—');
  await page.getByRole('button', { name: 'Options for Anatomy' }).click();
  await page.getByRole('button', { name: 'Restore this class' }).click();
  await expect(page.locator('.hero-number')).toContainText('100.0%');
  await nav(page, 'Profile');
  await page.getByRole('button', { name: 'Replace / edit timetable' }).click();
  await page
    .locator('input[type=file]')
    .setInputFiles('public/icons/icon-512.png');
  await expect(
    page.getByText('Image uploaded privately. Ready to extract.'),
  ).toBeVisible();
  if (
    !(
      (await page.locator('.entry-editor').first().getAttribute('open')) !==
      null
    )
  )
    await page.locator('.entry-editor summary').first().click();
  await page.getByLabel('Subject 1', { exact: true }).fill('Physiology');
  await page
    .getByLabel('I reviewed all dates, times, subjects and groups.')
    .check();
  await page.getByRole('button', { name: 'Confirm timetable' }).click();
  await nav(page, 'Home');
  await expect(page.locator('.hero-number')).toContainText('100.0%');
  await expect(
    page.getByRole('heading', { name: 'Anatomy', exact: true }),
  ).toBeVisible();
  await nav(page, 'Calendar');
  await page.getByRole('button', { name: 'Add holiday', exact: true }).click();
  await page
    .getByLabel('Holiday date')
    .fill(format(addDays(new Date(), 7), 'yyyy-MM-dd'));
  await page.getByLabel('Reason', { exact: true }).fill('College holiday');
  await page.getByRole('button', { name: 'Save holiday' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await nav(page, 'Profile');
  await page.getByText('Data & account deletion', { exact: true }).click();
  await page
    .getByRole('button', { name: 'Delete my account and all data' })
    .click();
  await page.getByLabel('Type DELETE to confirm').fill('DELETE');
  await page.getByRole('button', { name: 'Permanently delete' }).click();
  await expect(
    page.getByRole('heading', { name: 'Welcome back.' }),
  ).toBeVisible();
});
test('responsive first-use layout and password reset request', async ({
  page,
}) => {
  await page.goto('/');
  for (const width of [320, 375, 390, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.getByRole('button', { name: 'Forgot password?' }).click();
  await page.getByLabel('Email address').fill('student@example.com');
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(page.getByRole('status')).toContainText('If an account exists');
});

test('timetable confirmation explains incomplete setup', async ({ page }) => {
  await onboard(page);
  await page.getByRole('button', { name: 'Create manually' }).click();
  await page.getByRole('button', { name: 'Confirm timetable' }).click();
  await expect(page.locator('.confirm-area').getByRole('alert')).toContainText(
    'Add valid academic dates and at least one complete class',
  );
});

test('tabs apply distinct themes and mobile haptics', async ({ page }) => {
  await page.addInitScript(() => {
    const vibrations: unknown[] = [];
    Object.defineProperty(window, '__vibrations', { value: vibrations });
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: (pattern: unknown) => {
        vibrations.push(pattern);
        return true;
      },
    });
  });
  await onboard(page);
  const layout = page.locator('.app-layout');
  await expect(layout).toHaveAttribute('data-section', 'home');
  await nav(page, 'Timetable');
  await expect(layout).toHaveAttribute('data-section', 'timetable');
  await expect(layout).toHaveAttribute('data-motion-direction', 'forward');
  await nav(page, 'Attendance');
  await expect(layout).toHaveAttribute('data-section', 'attendance');
  await nav(page, 'Calendar');
  await expect(layout).toHaveAttribute('data-section', 'calendar');
  await nav(page, 'Profile');
  await expect(layout).toHaveAttribute('data-section', 'profile');
  await expect(layout).toHaveAttribute('data-motion-direction', 'forward');
  await expect(page.locator('.tab-backdrop.active')).toHaveClass(/profile/);
  await nav(page, 'Home');
  await expect(layout).toHaveAttribute('data-motion-direction', 'backward');
  await expect(page.locator('.tab-backdrop.active')).toHaveClass(/home/);
  await nav(page, 'Calendar');
  await nav(page, 'Attendance');
  await expect(layout).toHaveAttribute('data-motion-direction', 'backward');
  await page.goBack();
  await expect(layout).toHaveAttribute('data-section', 'calendar');
  await expect(layout).toHaveAttribute('data-motion-direction', 'forward');
  for (const background of [
    'home',
    'timetable',
    'attendance',
    'calendar',
    'profile',
  ]) {
    const response = await page.request.get(`/backgrounds/${background}.webp`);
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toContain('image/webp');
  }
  if (await page.evaluate(() => matchMedia('(pointer: coarse)').matches)) {
    expect(
      await page.evaluate(
        () =>
          (
            window as unknown as {
              __vibrations: unknown[];
            }
          ).__vibrations.length,
      ),
    ).toBeGreaterThanOrEqual(4);
  }
});

test('brand detail and password controls are accessible', async ({ page }) => {
  await page.goto('/signup');
  const rollCall = page.locator('.brand-subtitle:visible').first();
  await expect(rollCall).toHaveText('Roll call');
  await rollCall.click();
  const dialog = page.getByRole('dialog', { name: 'Why Shabooya?' });
  await expect(dialog).toContainText('A little nod to “Shabooya Roll Call.”');
  await expect(dialog).toContainText('Roll call, but smarter.');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(rollCall).toBeFocused();

  const password = page.getByLabel('Password', { exact: true });
  await expect(password).toHaveAttribute('type', 'password');
  await expect(password).toHaveAttribute('autocomplete', 'new-password');
  await expect(page.getByText('At least 10 characters')).not.toHaveClass(/met/);
  await password.fill('long-password');
  await expect(page.getByText('At least 10 characters')).toHaveClass(/met/);
  await page.getByRole('button', { name: 'Show password' }).click();
  await expect(password).toHaveAttribute('type', 'text');
  await expect(password).toHaveValue('long-password');
  await page.getByRole('button', { name: 'Hide password' }).click();
  await expect(password).toHaveAttribute('type', 'password');
  await expect(page).toHaveURL(/\/signup$/);

  await page.goto('/login');
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute(
    'autocomplete',
    'current-password',
  );
});

test('protected URLs, browser history, saved session and accessible analytics', async ({
  page,
}) => {
  await page.goto('/attendance');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator('.stat-grid')).toHaveCount(0);
  await page.getByLabel('Email address').fill('unknown@example.com');
  await page.getByLabel('Password', { exact: true }).fill('wrong-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.locator('.error-text')).toContainText('Could not sign in');
  await onboard(page);
  await expect(page).toHaveURL(/\/home$/);
  await timetable(page);
  await page
    .getByRole('button', { name: 'Mark Anatomy present', exact: true })
    .click();
  await nav(page, 'Attendance');
  await expect(page).toHaveURL(/\/attendance$/);
  await expect(
    page.getByRole('heading', { name: 'Attendance trend' }),
  ).toBeVisible();
  await page.getByLabel('Explore a date').selectOption({ index: 0 });
  await expect(page.locator('.chart-readout')).toContainText('100.0%');
  await page.getByLabel('Miss next N classes').fill('1');
  await expect(page.locator('.projected-result')).toContainText('80.0%');
  await page.screenshot({
    path: `test-results/analytics-${page.viewportSize()?.width ?? 'default'}.png`,
    fullPage: true,
    animations: 'disabled',
  });
  await nav(page, 'Calendar');
  await page.goBack();
  await expect(page).toHaveURL(/\/attendance$/);
  await expect(
    page.getByRole('heading', { name: 'Attendance trend' }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Attendance trend' }),
  ).toBeVisible();
  await page.goto('/login');
  await expect(page).toHaveURL(/\/home$/);
});

test('invalid recovery links and Shabooya install metadata', async ({
  page,
  request,
}) => {
  await page.goto(
    '/reset-password#error=access_denied&error_description=expired',
  );
  await expect(
    page.getByRole('button', { name: 'Send reset link' }),
  ).toBeVisible();
  await expect(page.locator('.error-text')).toContainText('invalid or expired');
  const manifest = await (await request.get('/manifest.webmanifest')).json();
  expect(manifest).toMatchObject({
    name: 'Shabooya',
    short_name: 'Shabooya',
    display: 'standalone',
    icons: expect.arrayContaining([
      expect.objectContaining({
        src: '/icons/icon-192.png',
        sizes: '192x192',
      }),
      expect.objectContaining({
        src: '/icons/icon-512.png',
        sizes: '512x512',
        purpose: 'any',
      }),
      expect.objectContaining({
        src: '/icons/maskable-512.png',
        purpose: 'maskable',
      }),
    ]),
  });
  for (const icon of [
    '/favicon.ico',
    '/icons/favicon-32.png',
    '/icons/brand-mark-64.png',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    '/icons/maskable-512.png',
    '/icons/apple-touch-icon.png',
  ]) {
    const response = await request.get(icon);
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toMatch(
      icon.endsWith('.ico')
        ? /image\/(x-icon|vnd\.microsoft\.icon)/
        : /image\/png/,
    );
  }
  await expect(
    page.locator('link[rel="icon"][href="/favicon.ico"]'),
  ).toHaveCount(1);
  await expect(
    page.locator(
      'link[rel="apple-touch-icon"][href="/icons/apple-touch-icon.png"]',
    ),
  ).toHaveCount(1);
  await expect(page).toHaveTitle(/Shabooya/);
});

test('valid password recovery updates credentials and returns to onboarding', async ({
  page,
  request,
}) => {
  const response = await request.post('http://127.0.0.1:54329/auth/v1/signup', {
    data: { email: 'recovery@example.com', password: 'original-password-123' },
  });
  const session = await response.json();
  await page.goto(
    `/reset-password#access_token=${session.access_token}&refresh_token=${session.refresh_token}&expires_in=3600&token_type=bearer&type=recovery`,
  );
  await expect(page.getByLabel('New password')).toBeVisible();
  await page.getByLabel('New password').fill('replacement-password-123');
  await page.getByRole('button', { name: 'Save new password' }).click();
  await expect(
    page.getByRole('heading', { name: 'Let’s start with you.' }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/onboarding$/);
  const result = await request.post(
    'http://127.0.0.1:54329/auth/v1/token?grant_type=password',
    {
      data: {
        email: 'recovery@example.com',
        password: 'replacement-password-123',
      },
    },
  );
  expect(result.ok()).toBe(true);
});

test('draft save, cancel, duplicate and confirmed deletion preserve the active schedule', async ({
  page,
}) => {
  await onboard(page);
  await timetable(page);
  await nav(page, 'Profile');
  await page.getByRole('button', { name: 'Replace / edit timetable' }).click();
  await page.getByLabel('Subject 1', { exact: true }).fill('Temporary edit');
  await page.getByRole('button', { name: 'Cancel edit', exact: true }).click();
  await page.locator('.entry-editor > summary').click();
  await expect(page.getByLabel('Subject 1', { exact: true })).toHaveValue(
    'Anatomy',
  );
  await page.getByLabel('Subject 1', { exact: true }).fill('Physiology');
  await page.getByRole('button', { name: 'Save class', exact: true }).click();
  await expect(page.locator('.entry-editor')).not.toHaveAttribute('open', '');
  await page.locator('.entry-editor > summary').click();
  await page.getByRole('button', { name: 'Duplicate', exact: true }).click();
  await expect(page.locator('.entry-editor')).toHaveCount(2);
  await page
    .locator('.entry-editor')
    .last()
    .getByRole('button', { name: 'Delete', exact: true })
    .click();
  await expect(
    page.getByRole('dialog', { name: 'Delete this class?' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Keep it', exact: true }).click();
  await expect(page.locator('.entry-editor')).toHaveCount(2);
  await page
    .locator('.entry-editor')
    .last()
    .getByRole('button', { name: 'Delete', exact: true })
    .click();
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(page.locator('.entry-editor')).toHaveCount(1);
  await nav(page, 'Home');
  await expect(
    page.getByRole('heading', { name: 'Anatomy', exact: true }),
  ).toBeVisible();
});

test('cross-device conflicts keep both marks until the student chooses', async ({
  page,
  context,
  browser,
}) => {
  await onboard(page);
  await timetable(page);
  const second = await browser.newContext({
    baseURL: 'http://127.0.0.1:3100',
    viewport: { width: 1440, height: 1000 },
  });
  try {
    const other = await second.newPage();
    await other.goto('/');
    await other.getByLabel('Email address').fill('student@example.com');
    await other
      .getByLabel('Password', { exact: true })
      .fill('test-password-123');
    await other.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(
      other.getByRole('button', { name: 'Mark Anatomy absent', exact: true }),
    ).toBeVisible();
    await context.setOffline(true);
    await page
      .getByRole('button', { name: 'Mark Anatomy present', exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: 'Mark Anatomy present', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    const remoteMark = other.waitForResponse(
      (response) =>
        response.url().endsWith('/rpc/mark_attendance') &&
        response.request().method() === 'POST',
    );
    await other
      .getByRole('button', { name: 'Mark Anatomy absent', exact: true })
      .click();
    expect(await (await remoteMark).json()).toMatchObject({
      version: 1,
      status: 'absent',
    });
    await expect(other.locator('.connection')).toContainText('All up to date');
    await context.setOffline(false);
    await expect(
      page.getByText('A mark changed on another device.', { exact: true }),
    ).toBeVisible();
    const resolvedMark = page.waitForResponse(
      (response) =>
        response.url().endsWith('/rpc/mark_attendance') &&
        response.request().method() === 'POST',
    );
    await page
      .getByRole('button', { name: 'Keep this device', exact: true })
      .click();
    expect(await (await resolvedMark).json()).toMatchObject({
      version: 2,
      status: 'present',
    });
    await expect(page.locator('.connection')).toContainText('All up to date');
    await other.reload();
    await expect(other.locator('.hero-number')).toContainText('100.0%');
  } finally {
    await second.close();
  }
});

test('all primary screens fit small phones through desktop', async ({
  page,
}) => {
  await onboard(page);
  await timetable(page);
  for (const width of [320, 375, 390, 430, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const name of [
      'Home',
      'Timetable',
      'Attendance',
      'Calendar',
      'Profile',
    ]) {
      await nav(page, name);
      const fit = await page.evaluate(() => ({
        fits: document.documentElement.scrollWidth <= innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        viewport: innerWidth,
        overflow: [...document.querySelectorAll<HTMLElement>('body *')]
          .map((node) => ({
            node: `${node.tagName.toLowerCase()}.${node.className}`,
            left: Math.round(node.getBoundingClientRect().left),
            right: Math.round(node.getBoundingClientRect().right),
          }))
          .filter(({ left, right }) => left < -1 || right > innerWidth + 1)
          .slice(0, 8),
      }));
      expect(fit.fits, `${name} at ${width}px: ${JSON.stringify(fit)}`).toBe(
        true,
      );
    }
  }
});
