
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
		RouteId(): "/" | "/auth" | "/[companyPrefix]" | "/[companyPrefix]/activity" | "/[companyPrefix]/agents" | "/[companyPrefix]/approvals" | "/[companyPrefix]/costs" | "/[companyPrefix]/dashboard" | "/[companyPrefix]/goals" | "/[companyPrefix]/inbox" | "/[companyPrefix]/issues" | "/[companyPrefix]/org" | "/[companyPrefix]/projects" | "/[companyPrefix]/routines" | "/[companyPrefix]/settings";
		RouteParams(): {
			"/[companyPrefix]": { companyPrefix: string };
			"/[companyPrefix]/activity": { companyPrefix: string };
			"/[companyPrefix]/agents": { companyPrefix: string };
			"/[companyPrefix]/approvals": { companyPrefix: string };
			"/[companyPrefix]/costs": { companyPrefix: string };
			"/[companyPrefix]/dashboard": { companyPrefix: string };
			"/[companyPrefix]/goals": { companyPrefix: string };
			"/[companyPrefix]/inbox": { companyPrefix: string };
			"/[companyPrefix]/issues": { companyPrefix: string };
			"/[companyPrefix]/org": { companyPrefix: string };
			"/[companyPrefix]/projects": { companyPrefix: string };
			"/[companyPrefix]/routines": { companyPrefix: string };
			"/[companyPrefix]/settings": { companyPrefix: string }
		};
		LayoutParams(): {
			"/": { companyPrefix?: string };
			"/auth": Record<string, never>;
			"/[companyPrefix]": { companyPrefix: string };
			"/[companyPrefix]/activity": { companyPrefix: string };
			"/[companyPrefix]/agents": { companyPrefix: string };
			"/[companyPrefix]/approvals": { companyPrefix: string };
			"/[companyPrefix]/costs": { companyPrefix: string };
			"/[companyPrefix]/dashboard": { companyPrefix: string };
			"/[companyPrefix]/goals": { companyPrefix: string };
			"/[companyPrefix]/inbox": { companyPrefix: string };
			"/[companyPrefix]/issues": { companyPrefix: string };
			"/[companyPrefix]/org": { companyPrefix: string };
			"/[companyPrefix]/projects": { companyPrefix: string };
			"/[companyPrefix]/routines": { companyPrefix: string };
			"/[companyPrefix]/settings": { companyPrefix: string }
		};
		Pathname(): "/" | "/auth" | `/${string}` & {} | `/${string}/activity` & {} | `/${string}/agents` & {} | `/${string}/approvals` & {} | `/${string}/costs` & {} | `/${string}/dashboard` & {} | `/${string}/goals` & {} | `/${string}/inbox` & {} | `/${string}/issues` & {} | `/${string}/org` & {} | `/${string}/projects` & {} | `/${string}/routines` & {} | `/${string}/settings` & {};
		ResolvedPathname(): `${"" | `/${string}`}${ReturnType<AppTypes['Pathname']>}`;
		Asset(): "/favicon.svg" | string & {};
	}
}