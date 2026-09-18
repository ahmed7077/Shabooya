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
    .selectOption(String(new Date().getDay()));
  await page.getByLabel('Start time', { exact: true }).fill('00:00');
  await page.getByLabel('End time', { exact: true }).fill('00:01');
  await page.addStyleTag({content:'.panel,.stack,.field,.editor-grid>*,.form-grid>*,.content-grid>*{min-width:0}.form-grid{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}html{scroll-padding-block:24px 110px}input,button{scroll-margin-block:24px 110px}'});
  console.log('layout',await page.evaluate(()=>({width:innerWidth,visual:visualViewport?.width,scroll:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll('*')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).map(e=>[e.tagName,e.className,e.getBoundingClientRect().width]).slice(0,20)})));
  await page
    .getByLabel('I reviewed all dates, times, subjects and groups.')
    .check();
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
  await nav(page, 'Timetable');
  await expect(
    page.getByRole('heading', { name: 'Your week, laid out.' }),
  ).toBeVisible();
  await nav(page, 'Profile');
  await page.getByLabel('Appearance').selectOption('dark');
  await page.getByRole('button', { name: 'Save preferences' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('body')).not.toHaveJSProperty('scrollWidth', 0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/settings-${page.viewportSize()!.width}.png`,
    fullPage: true,
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
  if (!(await page.locator('.entry-editor').first().getAttribute('open') !== null)) await page.locator('.entry-editor summary').first().click();
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
  for (const width of [320, 375, 390, 430, 768, 1440]) {
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
