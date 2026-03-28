import "clsx";
const DEFAULT_TTL = { info: 4e3, success: 3500, warn: 8e3, error: 1e4 };
const MIN_TTL = 1500;
const MAX_TTL = 15e3;
const DEDUPE_COOLDOWN = 3500;
let toasts = [];
const timers = /* @__PURE__ */ new Map();
const dedupeMap = /* @__PURE__ */ new Map();
function makeDedupeKey(input) {
  return input.dedupeKey ?? `${input.tone ?? "info"}|${input.title}|${input.body ?? ""}|${input.action?.href ?? ""}`;
}
const toastStore = {
  get items() {
    return toasts;
  },
  push(input) {
    const now = Date.now();
    const key = makeDedupeKey(input);
    const lastSeen = dedupeMap.get(key);
    if (lastSeen && now - lastSeen < DEDUPE_COOLDOWN) return;
    dedupeMap.set(key, now);
    for (const [k, t] of dedupeMap) {
      if (now - t > 2e4) dedupeMap.delete(k);
    }
    const tone = input.tone ?? "info";
    const ttl = Math.min(MAX_TTL, Math.max(MIN_TTL, input.ttlMs ?? DEFAULT_TTL[tone] ?? 4e3));
    const id = input.id ?? crypto.randomUUID();
    const item = {
      id,
      title: input.title,
      body: input.body,
      tone,
      ttlMs: ttl,
      action: input.action,
      createdAt: now
    };
    toasts = [...toasts, item].slice(-5);
    const timer = setTimeout(() => this.dismiss(id), ttl);
    timers.set(id, timer);
  },
  dismiss(id) {
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
  }
};
export {
  toastStore as t
};
