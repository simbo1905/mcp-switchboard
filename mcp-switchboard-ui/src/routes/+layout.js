// Disable SSR for the entire app since this is a Tauri desktop application
export const ssr = false;
// Enable prerender when STATIC_BUILD is set for browser testing
export const prerender = process.env.STATIC_BUILD === 'true';