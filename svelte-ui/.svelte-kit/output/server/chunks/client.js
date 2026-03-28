import { treaty } from "@elysiajs/eden";
function getBaseUrl() {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return "http://localhost:3100";
}
treaty(getBaseUrl(), {
  // Include credentials (cookies) for session-based auth
  fetch: {
    credentials: "include"
  }
});
