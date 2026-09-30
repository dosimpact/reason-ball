// Share one origin between browser navigation, API contexts and CSRF headers.
export const liveBaseURL = process.env.PLAYWRIGHT_BASE_URL
  ?? (process.env.PLAYWRIGHT_LIVE_PRODUCTION === "1" ? "http://127.0.0.1:3310" : "http://localhost:3000");
