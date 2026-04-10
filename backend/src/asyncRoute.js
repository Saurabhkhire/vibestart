/**
 * Express 4 does not catch rejected promises from async route handlers.
 * This wrapper forwards failures to next() so the error middleware can respond.
 */
export function asyncRoute(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
