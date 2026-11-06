import type { RequestHandler } from 'express';

const REDIRECTABLE_METHODS = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']);
const LEGACY_PREFIX = '/api/yuki';

export const deprecatedYukiRedirect: RequestHandler = (req, res, next) => {
  if (!REDIRECTABLE_METHODS.has(req.method)) return next();

  const suffix = req.originalUrl.slice(LEGACY_PREFIX.length);
  const newPath = `/api/v1/yuki${suffix}`;
  const sunsetDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

  res.status(307);
  res.setHeader('Location', newPath);
  res.setHeader('Deprecation', 'true');
  res.setHeader('Sunset', sunsetDate.toUTCString());
  res.setHeader('X-Redirect-To', newPath);
  return res.json({
    deprecated: true,
    message: 'Yuki API has been moved to /api/v1/yuki',
    newLocation: newPath,
    sunsetDate: sunsetDate.toISOString()
  });
};
