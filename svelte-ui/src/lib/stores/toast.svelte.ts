/** Toast store — queue and display temporary notifications */

export interface ToastItem {
  id: string;
  title: string;
  body?: string;
  tone: "info" | "success" | "warn" | "error";
  ttlMs: number;
  action?: { label: string; href: string };
  createdAt: number;
}

export interface ToastInput {
  id?: string;
  dedupeKey?: string;
  title: string;
  body?: string;
  tone?: "info" | "success" | "warn" | "error";
  ttlMs?: number;
  action?: { label: string; href: string };
}

const DEFAULT_TTL: Record<string, number> = {
  info: 4000,
  success: 3500,
  warn: 8000,
  error: 10000,
};
const MIN_TTL = 1500;
const MAX_TTL = 15000;
const MAX_TOASTS = 5;
const DEDUPE_COOLDOWN = 3500;

let toasts = $state<ToastItem[]>([]);
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const dedupeMap = new Map<string, number>();

function makeDedupeKey(input: ToastInput): string {
  return input.dedupeKey ?? `${input.tone ?? "info"}|${input.title}|${input.body ?? ""}|${input.action?.href ?? ""}`;
}

export const toastStore = {
  get items() {
    return toasts;
  },
  push(input: ToastInput) {
    const now = Date.now();
    const key = makeDedupeKey(input);
    const lastSeen = dedupeMap.get(key);
    if (lastSeen && now - lastSeen < DEDUPE_COOLDOWN) return;
    dedupeMap.set(key, now);

    // Cleanup old dedupe entries
    for (const [k, t] of dedupeMap) {
      if (now - t > 20000) dedupeMap.delete(k);
    }

    const tone = input.tone ?? "info";
    const ttl = Math.min(MAX_TTL, Math.max(MIN_TTL, input.ttlMs ?? DEFAULT_TTL[tone] ?? 4000));
    const id = input.id ?? crypto.randomUUID();
    const item: ToastItem = { id, title: input.title, body: input.body, tone, ttlMs: ttl, action: input.action, createdAt: now };

    toasts = [...toasts, item].slice(-MAX_TOASTS);

    const timer = setTimeout(() => this.dismiss(id), ttl);
    timers.set(id, timer);
  },
  dismiss(id: string) {
    const timer = timers.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.delete(id);
    }
    toasts = toasts.filter((t) => t.id !== id);
  },
  clear() {
    for (const timer of timers.values()) clearTimeout(timer);
    timers.clear();
    toasts = [];
  },
};
