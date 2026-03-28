import type * as Kit from '@sveltejs/kit';

type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;
type MatcherParam<M> = M extends (param : string) => param is (infer U extends string) ? U : string;
type RouteParams = { companyPrefix: string };
type RouteId = '/[companyPrefix]';
type MaybeWithVoid<T> = {} extends T ? T | void : T;
export type RequiredKeys<T> = { [K in keyof T]-?: {} extends { [P in K]: T[K] } ? never : K; }[keyof T];
type OutputDataShape<T> = MaybeWithVoid<Omit<App.PageData, RequiredKeys<T>> & Partial<Pick<App.PageData, keyof T & keyof App.PageData>> & Record<string, any>>
type EnsureDefined<T> = T extends null | undefined ? {} : T;
type OptionalUnion<U extends Record<string, any>, A extends keyof U = U extends U ? keyof U : never> = U extends unknown ? { [P in Exclude<A, keyof U>]?: never } & U : never;
export type Snapshot<T = any> = Kit.Snapshot<T>;
type PageParentData = Omit<EnsureDefined<import('../$types.js').LayoutData>, keyof LayoutData> & EnsureDefined<LayoutData>;
type LayoutRouteId = RouteId | "/[companyPrefix]" | "/[companyPrefix]/activity" | "/[companyPrefix]/agents" | "/[companyPrefix]/agents/[agentId]" | "/[companyPrefix]/agents/new" | "/[companyPrefix]/approvals" | "/[companyPrefix]/approvals/[approvalId]" | "/[companyPrefix]/budgets" | "/[companyPrefix]/costs" | "/[companyPrefix]/dashboard" | "/[companyPrefix]/export" | "/[companyPrefix]/goals" | "/[companyPrefix]/goals/[goalId]" | "/[companyPrefix]/import" | "/[companyPrefix]/inbox" | "/[companyPrefix]/issues" | "/[companyPrefix]/issues/[issueId]" | "/[companyPrefix]/issues/mine" | "/[companyPrefix]/issues/new" | "/[companyPrefix]/labels" | "/[companyPrefix]/members" | "/[companyPrefix]/org" | "/[companyPrefix]/org/chart" | "/[companyPrefix]/plugins" | "/[companyPrefix]/plugins/[pluginId]" | "/[companyPrefix]/plugins/[pluginId]/settings" | "/[companyPrefix]/projects" | "/[companyPrefix]/projects/[projectId]" | "/[companyPrefix]/routines" | "/[companyPrefix]/routines/[routineId]" | "/[companyPrefix]/runs" | "/[companyPrefix]/runs/[runId]" | "/[companyPrefix]/secrets" | "/[companyPrefix]/settings" | "/[companyPrefix]/skills" | "/[companyPrefix]/workspaces" | "/[companyPrefix]/workspaces/[workspaceId]"
type LayoutParams = RouteParams & { companyPrefix?: string; agentId?: string; approvalId?: string; goalId?: string; issueId?: string; pluginId?: string; projectId?: string; routineId?: string; runId?: string; workspaceId?: string }
type LayoutParentData = EnsureDefined<import('../$types.js').LayoutData>;

export type EntryGenerator = () => Promise<Array<RouteParams>> | Array<RouteParams>;
export type PageServerData = null;
export type PageData = Expand<PageParentData>;
export type PageProps = { params: RouteParams; data: PageData }
export type LayoutServerData = null;
export type LayoutLoad<OutputData extends OutputDataShape<LayoutParentData> = OutputDataShape<LayoutParentData>> = Kit.Load<LayoutParams, LayoutServerData, LayoutParentData, OutputData, LayoutRouteId>;
export type LayoutLoadEvent = Parameters<LayoutLoad>[0];
export type LayoutData = Expand<Omit<LayoutParentData, keyof LayoutParentData & EnsureDefined<LayoutServerData>> & OptionalUnion<EnsureDefined<LayoutParentData & EnsureDefined<LayoutServerData>>>>;
export type LayoutProps = { params: LayoutParams; data: LayoutData; children: import("svelte").Snippet }