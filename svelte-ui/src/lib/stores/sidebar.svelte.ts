/** Sidebar store — manages sidebar visibility and responsive behavior */

const MOBILE_BREAKPOINT = 768;

function getIsMobile(): boolean {
  if (typeof window === "undefined") return false;
  return window.innerWidth < MOBILE_BREAKPOINT;
}

let open = $state(!getIsMobile());
let isMobile = $state(getIsMobile());

export const sidebarStore = {
  get open() {
    return open;
  },
  get isMobile() {
    return isMobile;
  },
  set(value: boolean) {
    open = value;
  },
  toggle() {
    open = !open;
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
  },
};
