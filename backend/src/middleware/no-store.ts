import { createMiddleware } from 'hono/factory';

// Responses that can carry a generated ntfy password must never be cached by the
// browser or an intermediary. The header is set after next() so it also covers
// early returns (409/429/502), error responses, and, when mounted ahead of the
// auth middleware, the 401s too.
export const noStore = createMiddleware(async (c, next) => {
  await next();
  c.header('Cache-Control', 'no-store');
});
