/** Breadcrumb store — manages page breadcrumbs and document title */

export interface Breadcrumb {
  label: string;
  href?: string;
}

let breadcrumbs = $state<Breadcrumb[]>([]);

function updateDocumentTitle(crumbs: Breadcrumb[]) {
  if (typeof document === "undefined") return;
  if (crumbs.length === 0) {
    document.title = "ClawDev";
    return;
  }
  const parts = crumbs
    .map((c) => c.label)
    .reverse()
    .join(" · ");
  document.title = `${parts} · ClawDev`;
}

export const breadcrumbStore = {
  get items() {
    return breadcrumbs;
  },
  set(crumbs: Breadcrumb[]) {
    breadcrumbs = crumbs;
    updateDocumentTitle(crumbs);
  },
  clear() {
    breadcrumbs = [];
    updateDocumentTitle([]);
  },
};
