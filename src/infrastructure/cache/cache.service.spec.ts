import { ConfigService } from '@nestjs/config';
import { CacheService } from './cache.service';

describe('CacheService', () => {
  function createCache(max = 100): CacheService {
    return new CacheService(
      new ConfigService({
        cache: { keyPrefix: 'test:', ttl: 60, max },
      }),
    );
  }

  it('enforces the configured maximum number of entries', async () => {
    const cache = createCache(2);

    await cache.set('first', 1);
    await cache.set('second', 2);
    await cache.set('third', 3);

    await expect(cache.get('first')).resolves.toBeNull();
    await expect(cache.get('second')).resolves.toBe(2);
    await expect(cache.get('third')).resolves.toBe(3);
  });

  it('treats non-wildcard pattern characters literally', async () => {
    const cache = createCache();
    await cache.set('user.1', 'dot');
    await cache.set('userX1', 'plain');

    await expect(cache.deleteByPattern('user.1')).resolves.toBe(1);
    await expect(cache.get('userX1')).resolves.toBe('plain');
  });

  it('coalesces concurrent cache misses', async () => {
    const cache = createCache();
    const factory = jest.fn().mockResolvedValue('value');

    await expect(
      Promise.all([cache.getOrSet('key', factory), cache.getOrSet('key', factory)]),
    ).resolves.toEqual(['value', 'value']);
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('reports a stored null value as existing', async () => {
    const cache = createCache();
    await cache.set('nullable', null);

    await expect(cache.exists('nullable')).resolves.toBe(true);
  });
});
