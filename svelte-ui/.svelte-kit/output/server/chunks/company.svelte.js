import "clsx";
const STORAGE_KEY = "paperclip.selectedCompanyId";
let companies = [];
let selectedCompanyId = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
const companyStore = {
  get companies() {
    return companies;
  },
  get selectedCompanyId() {
    return selectedCompanyId;
  },
  get selectedCompany() {
    return companies.find((c) => c.id === selectedCompanyId) ?? null;
  }
};
export {
  companyStore as c
};
