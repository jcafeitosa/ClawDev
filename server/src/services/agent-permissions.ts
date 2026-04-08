import { hasLevelCAgentPermissions } from "@clawdev/shared";

export type NormalizedAgentPermissions = Record<string, unknown> & {
  canCreateAgents: boolean;
  canUseInternet: boolean;
  canRespondWithoutMention: boolean;
};

export function defaultPermissionsForRole(role: string): NormalizedAgentPermissions {
  return {
    canCreateAgents: hasLevelCAgentPermissions(role),
    canUseInternet: true,            // All agents get internet access by default
    canRespondWithoutMention: role === "ceo",  // Only CEO responds without @mention
  };
}

export function normalizeAgentPermissions(
  permissions: unknown,
  role: string,
): NormalizedAgentPermissions {
  const defaults = defaultPermissionsForRole(role);
  if (typeof permissions !== "object" || permissions === null || Array.isArray(permissions)) {
    return defaults;
  }

  const record = permissions as Record<string, unknown>;
  return {
    canCreateAgents: hasLevelCAgentPermissions(role)
      ? true
      : typeof record.canCreateAgents === "boolean"
        ? record.canCreateAgents
        : defaults.canCreateAgents,
    canUseInternet: typeof record.canUseInternet === "boolean"
      ? record.canUseInternet
      : defaults.canUseInternet,
    canRespondWithoutMention: role === "ceo"
      ? true
      : typeof record.canRespondWithoutMention === "boolean"
        ? record.canRespondWithoutMention
        : defaults.canRespondWithoutMention,
  };
}
