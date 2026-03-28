
// this file is generated — do not edit it


declare module "svelte/elements" {
	export interface HTMLAttributes<T> {
		'data-sveltekit-keepfocus'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-noscroll'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-preload-code'?:
			| true
			| ''
			| 'eager'
			| 'viewport'
			| 'hover'
			| 'tap'
			| 'off'
			| undefined
			| null;
		'data-sveltekit-preload-data'?: true | '' | 'hover' | 'tap' | 'off' | undefined | null;
		'data-sveltekit-reload'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-replacestate'?: true | '' | 'off' | undefined | null;
	}
}

export {};


declare module "$app/types" {
	type MatcherParam<M> = M extends (param : string) => param is (infer U extends string) ? U : string;

	export interface AppTypes {
		RouteId(): "/" | "/auth" | "/claim" | "/cli-auth" | "/companies" | "/design-guide" | "/invite" | "/not-found" | "/onboarding" | "/settings" | "/settings/api-keys" | "/settings/experimental" | "/settings/general" | "/settings/status" | "/settings/users" | "/setup" | "/[companyPrefix]" | "/[companyPrefix]/activity" | "/[companyPrefix]/agents" | "/[companyPrefix]/agents/new" | "/[companyPrefix]/agents/[agentId]" | "/[companyPrefix]/approvals" | "/[companyPrefix]/approvals/[approvalId]" | "/[companyPrefix]/budgets" | "/[companyPrefix]/costs" | "/[companyPrefix]/dashboard" | "/[companyPrefix]/export" | "/[companyPrefix]/goals" | "/[companyPrefix]/goals/[goalId]" | "/[companyPrefix]/import" | "/[companyPrefix]/inbox" | "/[companyPrefix]/issues" | "/[companyPrefix]/issues/mine" | "/[companyPrefix]/issues/new" | "/[companyPrefix]/issues/[issueId]" | "/[companyPrefix]/labels" | "/[companyPrefix]/members" | "/[companyPrefix]/org" | "/[companyPrefix]/org/chart" | "/[companyPrefix]/plugins" | "/[companyPrefix]/plugins/[pluginId]" | "/[companyPrefix]/plugins/[pluginId]/settings" | "/[companyPrefix]/projects" | "/[companyPrefix]/projects/[projectId]" | "/[companyPrefix]/routines" | "/[companyPrefix]/routines/[routineId]" | "/[companyPrefix]/runs" | "/[companyPrefix]/runs/[runId]" | "/[companyPrefix]/secrets" | "/[companyPrefix]/settings" | "/[companyPrefix]/skills" | "/[companyPrefix]/workspaces" | "/[companyPrefix]/workspaces/[workspaceId]";
		RouteParams(): {
			"/[companyPrefix]": { companyPrefix: string };
			"/[companyPrefix]/activity": { companyPrefix: string };
			"/[companyPrefix]/agents": { companyPrefix: string };
			"/[companyPrefix]/agents/new": { companyPrefix: string };
			"/[companyPrefix]/agents/[agentId]": { companyPrefix: string; agentId: string };
			"/[companyPrefix]/approvals": { companyPrefix: string };
			"/[companyPrefix]/approvals/[approvalId]": { companyPrefix: string; approvalId: string };
			"/[companyPrefix]/budgets": { companyPrefix: string };
			"/[companyPrefix]/costs": { companyPrefix: string };
			"/[companyPrefix]/dashboard": { companyPrefix: string };
			"/[companyPrefix]/export": { companyPrefix: string };
			"/[companyPrefix]/goals": { companyPrefix: string };
			"/[companyPrefix]/goals/[goalId]": { companyPrefix: string; goalId: string };
			"/[companyPrefix]/import": { companyPrefix: string };
			"/[companyPrefix]/inbox": { companyPrefix: string };
			"/[companyPrefix]/issues": { companyPrefix: string };
			"/[companyPrefix]/issues/mine": { companyPrefix: string };
			"/[companyPrefix]/issues/new": { companyPrefix: string };
			"/[companyPrefix]/issues/[issueId]": { companyPrefix: string; issueId: string };
			"/[companyPrefix]/labels": { companyPrefix: string };
			"/[companyPrefix]/members": { companyPrefix: string };
			"/[companyPrefix]/org": { companyPrefix: string };
			"/[companyPrefix]/org/chart": { companyPrefix: string };
			"/[companyPrefix]/plugins": { companyPrefix: string };
			"/[companyPrefix]/plugins/[pluginId]": { companyPrefix: string; pluginId: string };
			"/[companyPrefix]/plugins/[pluginId]/settings": { companyPrefix: string; pluginId: string };
			"/[companyPrefix]/projects": { companyPrefix: string };
			"/[companyPrefix]/projects/[projectId]": { companyPrefix: string; projectId: string };
			"/[companyPrefix]/routines": { companyPrefix: string };
			"/[companyPrefix]/routines/[routineId]": { companyPrefix: string; routineId: string };
			"/[companyPrefix]/runs": { companyPrefix: string };
			"/[companyPrefix]/runs/[runId]": { companyPrefix: string; runId: string };
			"/[companyPrefix]/secrets": { companyPrefix: string };
			"/[companyPrefix]/settings": { companyPrefix: string };
			"/[companyPrefix]/skills": { companyPrefix: string };
			"/[companyPrefix]/workspaces": { companyPrefix: string };
			"/[companyPrefix]/workspaces/[workspaceId]": { companyPrefix: string; workspaceId: string }
		};
		LayoutParams(): {
			"/": { companyPrefix?: string; agentId?: string; approvalId?: string; goalId?: string; issueId?: string; pluginId?: string; projectId?: string; routineId?: string; runId?: string; workspaceId?: string };
			"/auth": Record<string, never>;
			"/claim": Record<string, never>;
			"/cli-auth": Record<string, never>;
			"/companies": Record<string, never>;
			"/design-guide": Record<string, never>;
			"/invite": Record<string, never>;
			"/not-found": Record<string, never>;
			"/onboarding": Record<string, never>;
			"/settings": Record<string, never>;
			"/settings/api-keys": Record<string, never>;
			"/settings/experimental": Record<string, never>;
			"/settings/general": Record<string, never>;
			"/settings/status": Record<string, never>;
			"/settings/users": Record<string, never>;
			"/setup": Record<string, never>;
			"/[companyPrefix]": { companyPrefix: string; agentId?: string; approvalId?: string; goalId?: string; issueId?: string; pluginId?: string; projectId?: string; routineId?: string; runId?: string; workspaceId?: string };
			"/[companyPrefix]/activity": { companyPrefix: string };
			"/[companyPrefix]/agents": { companyPrefix: string; agentId?: string };
			"/[companyPrefix]/agents/new": { companyPrefix: string };
			"/[companyPrefix]/agents/[agentId]": { companyPrefix: string; agentId: string };
			"/[companyPrefix]/approvals": { companyPrefix: string; approvalId?: string };
			"/[companyPrefix]/approvals/[approvalId]": { companyPrefix: string; approvalId: string };
			"/[companyPrefix]/budgets": { companyPrefix: string };
			"/[companyPrefix]/costs": { companyPrefix: string };
			"/[companyPrefix]/dashboard": { companyPrefix: string };
			"/[companyPrefix]/export": { companyPrefix: string };
			"/[companyPrefix]/goals": { companyPrefix: string; goalId?: string };
			"/[companyPrefix]/goals/[goalId]": { companyPrefix: string; goalId: string };
			"/[companyPrefix]/import": { companyPrefix: string };
			"/[companyPrefix]/inbox": { companyPrefix: string };
			"/[companyPrefix]/issues": { companyPrefix: string; issueId?: string };
			"/[companyPrefix]/issues/mine": { companyPrefix: string };
			"/[companyPrefix]/issues/new": { companyPrefix: string };
			"/[companyPrefix]/issues/[issueId]": { companyPrefix: string; issueId: string };
			"/[companyPrefix]/labels": { companyPrefix: string };
			"/[companyPrefix]/members": { companyPrefix: string };
			"/[companyPrefix]/org": { companyPrefix: string };
			"/[companyPrefix]/org/chart": { companyPrefix: string };
			"/[companyPrefix]/plugins": { companyPrefix: string; pluginId?: string };
			"/[companyPrefix]/plugins/[pluginId]": { companyPrefix: string; pluginId: string };
			"/[companyPrefix]/plugins/[pluginId]/settings": { companyPrefix: string; pluginId: string };
			"/[companyPrefix]/projects": { companyPrefix: string; projectId?: string };
			"/[companyPrefix]/projects/[projectId]": { companyPrefix: string; projectId: string };
			"/[companyPrefix]/routines": { companyPrefix: string; routineId?: string };
			"/[companyPrefix]/routines/[routineId]": { companyPrefix: string; routineId: string };
			"/[companyPrefix]/runs": { companyPrefix: string; runId?: string };
			"/[companyPrefix]/runs/[runId]": { companyPrefix: string; runId: string };
			"/[companyPrefix]/secrets": { companyPrefix: string };
			"/[companyPrefix]/settings": { companyPrefix: string };
			"/[companyPrefix]/skills": { companyPrefix: string };
			"/[companyPrefix]/workspaces": { companyPrefix: string; workspaceId?: string };
			"/[companyPrefix]/workspaces/[workspaceId]": { companyPrefix: string; workspaceId: string }
		};
		Pathname(): "/" | "/auth" | "/claim" | "/cli-auth" | "/companies" | "/design-guide" | "/invite" | "/not-found" | "/onboarding" | "/settings" | "/settings/api-keys" | "/settings/experimental" | "/settings/general" | "/settings/status" | "/settings/users" | "/setup" | `/${string}` & {} | `/${string}/activity` & {} | `/${string}/agents` & {} | `/${string}/agents/new` & {} | `/${string}/agents/${string}` & {} | `/${string}/approvals` & {} | `/${string}/approvals/${string}` & {} | `/${string}/budgets` & {} | `/${string}/costs` & {} | `/${string}/dashboard` & {} | `/${string}/export` & {} | `/${string}/goals` & {} | `/${string}/goals/${string}` & {} | `/${string}/import` & {} | `/${string}/inbox` & {} | `/${string}/issues` & {} | `/${string}/issues/mine` & {} | `/${string}/issues/new` & {} | `/${string}/issues/${string}` & {} | `/${string}/labels` & {} | `/${string}/members` & {} | `/${string}/org` & {} | `/${string}/org/chart` & {} | `/${string}/plugins` & {} | `/${string}/plugins/${string}` & {} | `/${string}/plugins/${string}/settings` & {} | `/${string}/projects` & {} | `/${string}/projects/${string}` & {} | `/${string}/routines` & {} | `/${string}/routines/${string}` & {} | `/${string}/runs` & {} | `/${string}/runs/${string}` & {} | `/${string}/secrets` & {} | `/${string}/settings` & {} | `/${string}/skills` & {} | `/${string}/workspaces` & {} | `/${string}/workspaces/${string}` & {};
		ResolvedPathname(): `${"" | `/${string}`}${ReturnType<AppTypes['Pathname']>}`;
		Asset(): "/favicon.svg" | string & {};
	}
}