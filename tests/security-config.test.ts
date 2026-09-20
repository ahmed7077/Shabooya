import { describe, expect, it } from 'vitest';
import config from '../next.config';

describe('browser security policy', () => {
  it('permits the pinned OCR CDN inside its worker and script contexts', async () => {
    const rules = await config.headers!();
    const policy = rules
      .flatMap((rule) => rule.headers)
      .find((header) => header.key === 'Content-Security-Policy')?.value;

    expect(policy).toMatch(/script-src[^;]*https:\/\/cdn\.jsdelivr\.net/);
    expect(policy).toMatch(/worker-src[^;]*https:\/\/cdn\.jsdelivr\.net/);
  });
});
