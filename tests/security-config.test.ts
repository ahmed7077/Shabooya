import { describe, expect, it } from 'vitest';
import config from '../next.config';

describe('browser security policy', () => {
  it('keeps executable OCR code same-origin while allowing language data', async () => {
    const rules = await config.headers!();
    const policy = rules
      .flatMap((rule) => rule.headers)
      .find((header) => header.key === 'Content-Security-Policy')?.value;

    expect(policy).not.toMatch(/script-src[^;]*cdn\.jsdelivr\.net/);
    expect(policy).not.toMatch(/worker-src[^;]*cdn\.jsdelivr\.net/);
    expect(policy).toMatch(/connect-src[^;]*https:\/\/cdn\.jsdelivr\.net/);
  });
});
