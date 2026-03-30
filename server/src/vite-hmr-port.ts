/**
 * Resolves a Vite HMR port that avoids clashing with the server port.
 */
export function resolveViteHmrPort(serverPort: number): number {
  if (serverPort <= 55_535) {
    return serverPort + 10_000;
  }
  return Math.max(1_024, serverPort - 10_000);
}
