/** Panel store — manages side panel visibility */

const STORAGE_KEY = "paperclip:panel-visible";

function getInitialVisibility(): boolean {
  if (typeof window === "undefined") return true;
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === null ? true : stored === "true";
}

let visible = $state(getInitialVisibility());

export const panelStore = {
  get visible() {
    return visible;
  },
  set(value: boolean) {
    visible = value;
    localStorage.setItem(STORAGE_KEY, String(value));
  },
  toggle() {
    this.set(!visible);
  },
};
