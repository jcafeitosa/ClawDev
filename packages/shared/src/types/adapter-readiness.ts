export interface AdapterReadinessCheck {
  adapterType: string;
  installed: boolean;
  upToDate: boolean;
  automation: {
    install: "verified" | "manual" | "not_supported";
    update: "verified" | "manual" | "not_supported";
  };
  currentVersion?: string | null;
  minimumVersion?: string | null;
  needsInstall: boolean;
  needsUpdate: boolean;
  remediation?: {
    kind: "install" | "update" | "manual";
    command?: string | null;
    installCommand?: string | null;
    updateCommand?: string | null;
    reason?: string | null;
  };
  detail?: string | null;
}
