// Next 16 renamed middleware.ts to proxy.ts.
// Keep this compatibility shim so a future upgrade can reuse the same session-refresh boundary.
export { middleware as proxy, config } from './middleware';
