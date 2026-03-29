/**
 * Fetch wrapper for API calls with credentials included.
 * Used across pages as: api('/api/companies').then(r => r.json())
 */
export function api(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
}
