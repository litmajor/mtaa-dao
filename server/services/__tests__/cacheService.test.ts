import { beforeEach, describe, expect, it } from 'vitest';
import { cacheService } from '../cacheService';

describe('cacheService (in-memory fallback)', () => {
  beforeEach(async () => {
    // ensure in-memory map is clean for each test
    (cacheService as any).memoryCache.clear();
  });

  it('set/get/delete in-memory works', async () => {
    await cacheService.set('test:key', { a: 1 }, 60);
    const v = await cacheService.get('test:key');
    expect(v).toEqual({ a: 1 });

    await cacheService.delete('test:key');
    const v2 = await cacheService.get('test:key');
    expect(v2).toBeNull();
  });

  it('keys(pattern) supports glob-style patterns', async () => {
    await cacheService.set('ohlcv:BTC:1h:1', { v: 1 }, 60);
    await cacheService.set('ohlcv:BTC:1h:2', { v: 2 }, 60);
    await cacheService.set('other:foo', { foo: true }, 60);

    const keys = await cacheService.keys('ohlcv:BTC:1h:*');
    expect(keys.sort()).toEqual(['ohlcv:BTC:1h:1', 'ohlcv:BTC:1h:2']);
  });

  it('clear(pattern) with regex clears matching keys', async () => {
    await cacheService.set('prefix:one', { x: 1 }, 60);
    await cacheService.set('prefix:two', { x: 2 }, 60);

    // clear uses RegExp(pattern) in fallback mode, so pass a regex string
    await cacheService.clear('^prefix:.*$');

    const k1 = await cacheService.get('prefix:one');
    const k2 = await cacheService.get('prefix:two');
    expect(k1).toBeNull();
    expect(k2).toBeNull();
  });
});
