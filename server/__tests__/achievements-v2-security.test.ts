import { describe, expect, it } from 'vitest';
import { isAuthenticated } from '../auth';
import router from '../routes/achievements-v2';

describe('achievements v2 route hardening', () => {
  it('registers static user routes before the generic achievementId wildcard route', () => {
    const paths = router.stack
      .filter((layer) => layer.route)
      .map((layer) => layer.route.path);

    expect(paths.indexOf('/user/progress')).toBeLessThan(paths.indexOf('/:achievementId'));
    expect(paths.indexOf('/user/badges')).toBeLessThan(paths.indexOf('/:achievementId'));
    expect(paths.indexOf('/leaderboard')).toBeLessThan(paths.indexOf('/:achievementId'));
  });

  it('enforces authentication on user-owned endpoints', () => {
    const routes = router.stack
      .filter((layer) => layer.route)
      .map((layer) => ({ path: layer.route.path, handlers: layer.route.stack.map((entry) => entry.handle) }));

    const unlockRoute = routes.find((route) => route.path === '/:achievementId/unlock');
    const mintRoute = routes.find((route) => route.path === '/:achievementId/mint-nft');
    const badgesRoute = routes.find((route) => route.path === '/user/badges');

    expect(unlockRoute?.handlers).toContain(isAuthenticated);
    expect(mintRoute?.handlers).toContain(isAuthenticated);
    expect(badgesRoute?.handlers).toContain(isAuthenticated);
  });
});
