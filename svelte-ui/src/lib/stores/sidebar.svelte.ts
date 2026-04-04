/** Sidebar store — Aceternity-style expand-on-hover with mobile drawer */

const MOBILE_BREAKPOINT = 768;
const COLLAPSED_W = 64;
const EXPANDED_W = 240;

function getIsMobile(): boolean {
  if (typeof window === "undefined") return false;
  return window.innerWidth < MOBILE_BREAKPOINT;
}

let open = $state(!getIsMobile()); // mobile drawer
let isMobile = $state(getIsMobile());
let hovering = $state(false); // desktop hover expand
let pinned = $state(false); // user pinned sidebar open

export const sidebarStore = {
  get open() { return open; },
  get isMobile() { return isMobile; },
  get hovering() { return hovering; },
  get pinned() { return pinned; },
  /** True when sidebar should show full width (labels visible) */
  get expanded() { return isMobile ? open : (hovering || pinned); },
  get collapsedWidth() { return COLLAPSED_W; },
  get expandedWidth() { return EXPANDED_W; },
  get width() { return isMobile ? EXPANDED_W : (hovering || pinned ? EXPANDED_W : COLLAPSED_W); },

  set(value: boolean) { open = value; },
  toggle() { open = !open; },
  setHovering(value: boolean) { hovering = value; },
  togglePin() {
    pinned = !pinned;
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("clawdev.sidebar.pinned", String(pinned));
    }
  },
  init() {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const handler = (e: MediaQueryListEvent) => {
      isMobile = e.matches;
      open = !e.matches;
    };
    mql.addEventListener("change", handler);
    isMobile = mql.matches;
    open = !mql.matches;
    // Restore pinned preference
    try {
      const stored = localStorage.getItem("clawdev.sidebar.pinned");
      if (stored === "true") pinned = true;
    } catch { /* ignore */ }
  },
};
