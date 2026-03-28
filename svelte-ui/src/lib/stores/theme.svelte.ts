/** Theme store — manages light/dark theme preference */

const STORAGE_KEY = "paperclip.theme";

function resolveInitialTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "dark";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return document.documentElement.classList.contains("dark") ? "dark" : "dark";
}

function applyTheme(theme: "light" | "dark") {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "dark" ? "#18181b" : "#ffffff");
}

let theme = $state<"light" | "dark">(resolveInitialTheme());

export const themeStore = {
  get current() {
    return theme;
  },
  set(value: "light" | "dark") {
    theme = value;
    localStorage.setItem(STORAGE_KEY, value);
    applyTheme(value);
  },
  toggle() {
    this.set(theme === "dark" ? "light" : "dark");
  },
  init() {
    applyTheme(theme);
  },
};
