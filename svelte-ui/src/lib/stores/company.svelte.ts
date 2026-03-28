/** Company store — manages selected company and company list */

export interface Company {
  id: string;
  name: string;
  slug?: string;
  status?: string;
  createdAt?: string;
  [key: string]: unknown;
}

const STORAGE_KEY = "paperclip.selectedCompanyId";

let companies = $state<Company[]>([]);
let selectedCompanyId = $state<string | null>(
  typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null,
);
let loading = $state(false);
let error = $state<Error | null>(null);
let selectionSource = $state<"bootstrap" | "manual" | "route_sync">("bootstrap");

export const companyStore = {
  get companies() {
    return companies;
  },
  get selectedCompanyId() {
    return selectedCompanyId;
  },
  get selectedCompany(): Company | null {
    return companies.find((c) => c.id === selectedCompanyId) ?? null;
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
    // Auto-select first if none selected
    if (!selectedCompanyId && list.length > 0) {
      this.select(list[0].id, "bootstrap");
    }
  },
  select(companyId: string, source: "bootstrap" | "manual" | "route_sync" = "manual") {
    selectedCompanyId = companyId;
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
