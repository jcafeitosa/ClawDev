/** Company store — manages selected company and company list */

export interface Company {
  id: string;
  name: string;
  slug?: string;
  issuePrefix?: string;
  status?: string;
  createdAt?: string;
  [key: string]: unknown;
}

/** Derive a URL-friendly slug from a company name (e.g. "Acme Corp" → "acme-corp"). */
function slugifyName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function matchesCompany(company: Company, prefix: string): boolean {
  if (company.id === prefix) return true;
  if (company.slug === prefix) return true;
  const upperPrefix = prefix.toUpperCase();
  if (String(company.issuePrefix ?? "").trim().toUpperCase() === upperPrefix) return true;
  // Fallback: match by slugified company name (covers cases where slug column is absent)
  if (slugifyName(company.name) === prefix) return true;
  return false;
}

const STORAGE_KEY = "clawdev.selectedCompanyId";

let companies = $state<Company[]>([]);
let rawSelectedCompanyId = $state<string | null>(
  typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null,
);
let loading = $state(false);
let error = $state<Error | null>(null);
let selectionSource = $state<"bootstrap" | "manual" | "route_sync">("bootstrap");

function resolveCompanyIdFromLocation(list: Company[]): string | null {
  if (typeof window === "undefined") return null;

  const prefix = window.location.pathname.split("/").filter(Boolean)[0];
  if (!prefix) return null;

  const matchedCompanyId = list.find((c) => matchesCompany(c, prefix))?.id ?? null;
  if (matchedCompanyId) return matchedCompanyId;

  // When we land directly on a UUID-prefixed company route before the
  // company list has loaded, treat the UUID itself as the best available
  // company context so pages can start fetching immediately.
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(prefix)
    ? prefix
    : null;
}

export function resolveCompanyIdFromPrefix(prefix: string | null | undefined): string | null {
  const normalizedPrefix = String(prefix ?? "").trim();
  if (!normalizedPrefix) return null;

  return (
    companies.find((company) => matchesCompany(company, normalizedPrefix))?.id ??
    (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(normalizedPrefix) ? normalizedPrefix : null)
  );
}

/** Returns the best URL prefix for a company (slug > slugified name > id). */
export function getCompanyPrefix(company: Company): string {
  return company.slug ?? (slugifyName(company.name) || company.id);
}

export const companyStore = {
  get companies() {
    return companies;
  },
  get selectedCompanyId() {
    const routeCompanyId = resolveCompanyIdFromLocation(companies);
    if (routeCompanyId) return routeCompanyId;

    if (!rawSelectedCompanyId) return null;
    if (companies.length === 0) return null;
    return companies.some((c) => c.id === rawSelectedCompanyId) ? rawSelectedCompanyId : null;
  },
  get selectedCompany(): Company | null {
    const selectedId = this.selectedCompanyId;
    if (!selectedId) return null;
    return companies.find((c) => c.id === selectedId) ?? {
      id: selectedId,
      name: selectedId,
      slug: selectedId,
      issuePrefix: selectedId,
    };
  },
  get company() {
    return this.selectedCompany;
  },
  get loading() {
    return loading;
  },
  get error() {
    return error;
  },
  get selectionSource() {
    return selectionSource;
  },

  setCompanies(list: Company[]) {
    companies = list;
    const routeCompanyId = resolveCompanyIdFromLocation(list);
    if (routeCompanyId) {
      this.select(routeCompanyId, "route_sync");
      return;
    }
    // Auto-select first if none selected or if the persisted selection is stale.
    if ((!this.selectedCompanyId || !list.some((c) => c.id === this.selectedCompanyId)) && list.length > 0) {
      this.select(list[0].id, "bootstrap");
    }
  },
  select(companyId: string, source: "bootstrap" | "manual" | "route_sync" = "manual") {
    rawSelectedCompanyId = companyId;
    selectionSource = source;
    localStorage.setItem(STORAGE_KEY, companyId);
  },
  setLoading(val: boolean) {
    loading = val;
  },
  setError(err: Error | null) {
    error = err;
  },
};
