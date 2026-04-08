export type ProviderBillingType = "subscription" | "paid" | "unknown";

export function inferProviderBillingType(authMethods: Array<"api" | "oauth" | "custom">): ProviderBillingType {
  if (authMethods.includes("oauth")) return "subscription";
  if (authMethods.includes("api")) return "paid";
  return "unknown";
}
