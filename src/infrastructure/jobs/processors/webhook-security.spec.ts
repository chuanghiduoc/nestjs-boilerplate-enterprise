import { assertSafeWebhookUrl, validateWebhookUrlSyntax } from './webhook-security';

describe('webhook security', () => {
  it('accepts public HTTP(S) URL syntax', () => {
    expect(validateWebhookUrlSyntax('https://hooks.example.com/v1')).toBeInstanceOf(URL);
  });

  it.each(['file:///etc/passwd', 'http://localhost:8080', 'http://127.0.0.1', 'http://[::1]'])(
    'rejects unsafe URL %s',
    (url) => {
      expect(() => validateWebhookUrlSyntax(url)).toThrow();
    },
  );

  it('rejects credentials embedded in a URL', () => {
    expect(() => validateWebhookUrlSyntax('https://user:pass@example.com')).toThrow();
  });

  it('enforces an explicit host allowlist', async () => {
    await expect(
      assertSafeWebhookUrl('https://example.com', ['hooks.example.com']),
    ).rejects.toThrow('allowlisted');
  });
});
