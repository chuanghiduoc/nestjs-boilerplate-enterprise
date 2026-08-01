import { SanitizePipe } from './sanitize.pipe';
import { TrimStringPipe } from './trim-string.pipe';

describe('input normalization pipes', () => {
  it.each([new TrimStringPipe(), new SanitizePipe()])(
    'preserves Buffer and non-plain objects in %s',
    (pipe) => {
      const buffer = Buffer.from('upload');
      const date = new Date();
      const result = pipe.transform({ buffer, date }) as { buffer: Buffer; date: Date };

      expect(result.buffer).toBe(buffer);
      expect(Buffer.isBuffer(result.buffer)).toBe(true);
      expect(result.date).toBe(date);
    },
  );

  it('normalizes nested arrays and plain objects', () => {
    const value = [{ name: '  Alice  ', path: '../safe\0' }];
    const trimmed = new TrimStringPipe().transform(value);
    const sanitized = new SanitizePipe().transform(trimmed) as Record<string, string>[];

    expect(sanitized).toEqual([{ name: 'Alice', path: 'safe' }]);
  });
});
