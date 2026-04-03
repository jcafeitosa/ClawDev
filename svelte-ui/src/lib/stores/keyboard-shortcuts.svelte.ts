/** Keyboard shortcuts store — global key bindings for the workspace */

import { goto } from "$app/navigation";
import { dialogStore } from "./dialog.svelte.js";
import { companyStore, resolveCompanyIdFromPrefix } from "./company.svelte.js";
import { sidebarStore } from "./sidebar.svelte.js";

interface ShortcutDef {
  /** Human-readable key combo for display, e.g. "c", "[", "Ctrl+K" */
  label: string;
  /** Description of what it does */
  description: string;
  /** Key to match (KeyboardEvent.key) */
  key: string;
  /** Modifier requirements */
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  /** If true, the shortcut fires even when an input/textarea is focused */
  allowInInput?: boolean;
  /** Handler */
  action: () => void;
}

const INTERACTIVE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

function isTyping(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null;
  if (!target) return false;
  if (INTERACTIVE_TAGS.has(target.tagName)) return true;
  if (target.isContentEditable) return true;
  return false;
}

const shortcuts: ShortcutDef[] = [
  {
    label: "c",
    description: "Create new issue",
    key: "c",
    action: () => dialogStore.openNewIssue(),
  },
  {
    label: "o",
    description: "Open onboarding",
    key: "o",
    action: () => {
      const prefix = typeof window !== "undefined" ? window.location.pathname.split("/").filter(Boolean)[0] ?? "" : "";
      const companyId = resolveCompanyIdFromPrefix(prefix) ?? companyStore.selectedCompanyId ?? null;
      if (companyId && prefix) {
        void goto(`/${prefix}/onboarding?companyId=${companyId}&companyPrefix=${prefix}&step=2`);
        return;
      }
      void goto("/setup");
    },
  },
  {
    label: "[",
    description: "Toggle sidebar",
    key: "[",
    action: () => sidebarStore.toggle(),
  },
];

let teardown: (() => void) | null = null;

function handleKeydown(event: KeyboardEvent) {
  const typing = isTyping(event);

  for (const shortcut of shortcuts) {
    // Skip non-input shortcuts when user is typing
    if (typing && !shortcut.allowInInput) continue;

    // Match modifiers
    if (shortcut.ctrl && !event.ctrlKey) continue;
    if (shortcut.meta && !event.metaKey) continue;
    if (shortcut.shift && !event.shiftKey) continue;
    if (shortcut.alt && !event.altKey) continue;

    // Don't fire plain-key shortcuts when a modifier is held (except shift for uppercase)
    if (!shortcut.ctrl && !shortcut.meta && !shortcut.alt) {
      if (event.ctrlKey || event.metaKey || event.altKey) continue;
    }

    if (event.key === shortcut.key) {
      event.preventDefault();
      shortcut.action();
      return;
    }
  }
}

export const keyboardShortcutsStore = {
  /** Get all registered shortcuts (for display in a help modal) */
  get shortcuts() {
    return shortcuts.map((s) => ({ label: s.label, description: s.description }));
  },

  /** Initialize global keyboard listener. Call once from the layout. */
  init() {
    if (typeof window === "undefined") return;
    if (teardown) return; // already initialized

    window.addEventListener("keydown", handleKeydown);
    teardown = () => {
      window.removeEventListener("keydown", handleKeydown);
      teardown = null;
    };
  },

  /** Remove global keyboard listener. Call on unmount if needed. */
  destroy() {
    teardown?.();
  },
};
