export const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "_app",
	assets: new Set(["favicon.svg"]),
	mimeTypes: {".svg":"image/svg+xml"},
	_: {
		client: {start:"_app/immutable/entry/start.BhZCc83i.js",app:"_app/immutable/entry/app.CBJZ3eRm.js",imports:["_app/immutable/entry/start.BhZCc83i.js","_app/immutable/chunks/R66MwjyA.js","_app/immutable/chunks/CnU8mnEz.js","_app/immutable/chunks/BSIspAl0.js","_app/immutable/chunks/Cp_94M0a.js","_app/immutable/chunks/yW07mADH.js","_app/immutable/entry/app.CBJZ3eRm.js","_app/immutable/chunks/CnU8mnEz.js","_app/immutable/chunks/DlhN6X_b.js","_app/immutable/chunks/5NMuA5Ut.js","_app/immutable/chunks/DXa51RsP.js","_app/immutable/chunks/Bzak7iHL.js","_app/immutable/chunks/yW07mADH.js","_app/immutable/chunks/CrEqN3lB.js","_app/immutable/chunks/C-1Wk0r7.js","_app/immutable/chunks/f2LqGyhV.js","_app/immutable/chunks/DDgAFMIo.js","_app/immutable/chunks/BxXsfR4t.js","_app/immutable/chunks/B_T3PCa2.js","_app/immutable/chunks/BSIspAl0.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('./nodes/0.js')),
			__memo(() => import('./nodes/1.js')),
			__memo(() => import('./nodes/2.js')),
			__memo(() => import('./nodes/4.js')),
			__memo(() => import('./nodes/5.js')),
			__memo(() => import('./nodes/6.js')),
			__memo(() => import('./nodes/7.js')),
			__memo(() => import('./nodes/8.js')),
			__memo(() => import('./nodes/9.js')),
			__memo(() => import('./nodes/10.js')),
			__memo(() => import('./nodes/11.js')),
			__memo(() => import('./nodes/12.js')),
			__memo(() => import('./nodes/13.js')),
			__memo(() => import('./nodes/14.js')),
			__memo(() => import('./nodes/15.js')),
			__memo(() => import('./nodes/16.js')),
			__memo(() => import('./nodes/17.js')),
			__memo(() => import('./nodes/18.js')),
			__memo(() => import('./nodes/19.js')),
			__memo(() => import('./nodes/20.js')),
			__memo(() => import('./nodes/21.js')),
			__memo(() => import('./nodes/22.js')),
			__memo(() => import('./nodes/23.js')),
			__memo(() => import('./nodes/24.js')),
			__memo(() => import('./nodes/25.js')),
			__memo(() => import('./nodes/26.js')),
			__memo(() => import('./nodes/27.js')),
			__memo(() => import('./nodes/28.js')),
			__memo(() => import('./nodes/29.js')),
			__memo(() => import('./nodes/30.js')),
			__memo(() => import('./nodes/31.js')),
			__memo(() => import('./nodes/32.js')),
			__memo(() => import('./nodes/33.js')),
			__memo(() => import('./nodes/34.js')),
			__memo(() => import('./nodes/35.js')),
			__memo(() => import('./nodes/36.js')),
			__memo(() => import('./nodes/37.js')),
			__memo(() => import('./nodes/38.js')),
			__memo(() => import('./nodes/39.js')),
			__memo(() => import('./nodes/40.js'))
		],
		remotes: {
			
		},
		routes: [
			{
				id: "/[companyPrefix]",
				pattern: /^\/([^/]+?)\/?$/,
				params: [{"name":"companyPrefix","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,2,], errors: [1,,], leaf: 3 },
				endpoint: null
			},
			{
				id: "/[companyPrefix]/activity",
				pattern: /^\/([^/]+?)\/activity\/?$/,
				params: [{"name":"companyPrefix","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,2,], errors: [1,,], leaf: 4 },
				endpoint: null
			},
			{
				id: "/[companyPrefix]/agents",
				pattern: /^\/([^/]+?)\/agents\/?$/,
				params: [{"name":"companyPrefix","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,2,], errors: [1,,], leaf: 5 },
				endpoint: null
			},
			{
				id: "/[companyPrefix]/agents/new",
				pattern: /^\/([^/]+?)\/agents\/new\/?$/,
				params: [{"name":"companyPrefix","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,2,], errors: [1,,], leaf: 7 },
				endpoint: null
			},
			{
				id: "/[companyPrefix]/agents/[agentId]",
				pattern: /^\/([^/]+?)\/agents\/([^/]+?)\/?$/,
				params: [{"name":"companyPrefix","optional":false,"rest":false,"chained":false},{"name":"agentId","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,2,], errors: [1,,], leaf: 6 },
				endpoint: null
			},
			{
				id: "/[companyPrefix]/approvals",
				pattern: /^\/([^/]+?)\/approvals\/?$/,
				params: [{"name":"companyPrefix","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,2,], errors: [1,,], leaf: 8 },
				endpoint: null
			},
			{
				id: "/[companyPrefix]/approvals/[approvalId]",
				pattern: /^\/([^/]+?)\/approvals\/([^/]+?)\/?$/,
				params: [{"name":"companyPrefix","optional":false,"rest":false,"chained":false},{"name":"approvalId","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,2,], errors: [1,,], leaf: 9 },
				endpoint: null
			},
			{
				id: "/[companyPrefix]/budgets",
				pattern: /^\/([^/]+?)\/budgets\/?$/,
				params: [{"name":"companyPrefix","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,2,], errors: [1,,], leaf: 10 },
				endpoint: null
			},
			{
				id: "/[companyPrefix]/costs",
				pattern: /^\/([^/]+?)\/costs\/?$/,
				params: [{"name":"companyPrefix","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,2,], errors: [1,,], leaf: 11 },
				endpoint: null
			},
			{
				id: "/[companyPrefix]/dashboard",
				pattern: /^\/([^/]+?)\/dashboard\/?$/,
				params: [{"name":"companyPrefix","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,2,], errors: [1,,], leaf: 12 },
				endpoint: null
			},
			{
				id: "/[companyPrefix]/export",
				pattern: /^\/([^/]+?)\/export\/?$/,
				params: [{"name":"companyPrefix","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,2,], errors: [1,,], leaf: 13 },
				endpoint: null
			},
			{
				id: "/[companyPrefix]/goals",
				pattern: /^\/([^/]+?)\/goals\/?$/,
				params: [{"name":"companyPrefix","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,2,], errors: [1,,], leaf: 14 },
				endpoint: null
			},
			{
				id: "/[companyPrefix]/goals/[goalId]",
				pattern: /^\/([^/]+?)\/goals\/([^/]+?)\/?$/,
				params: [{"name":"companyPrefix","optional":false,"rest":false,"chained":false},{"name":"goalId","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,2,], errors: [1,,], leaf: 15 },
				endpoint: null
			},
			{
				id: "/[companyPrefix]/import",
				pattern: /^\/([^/]+?)\/import\/?$/,
				params: [{"name":"companyPrefix","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,2,], errors: [1,,], leaf: 16 },
				endpoint: null
			},
			{
				id: "/[companyPrefix]/inbox",
				pattern: /^\/([^/]+?)\/inbox\/?$/,
				params: [{"name":"companyPrefix","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,2,], errors: [1,,], leaf: 17 },
				endpoint: null
			},
			{
				id: "/[companyPrefix]/issues",
				pattern: /^\/([^/]+?)\/issues\/?$/,
				params: [{"name":"companyPrefix","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,2,], errors: [1,,], leaf: 18 },
				endpoint: null
			},
			{
				id: "/[companyPrefix]/issues/mine",
				pattern: /^\/([^/]+?)\/issues\/mine\/?$/,
				params: [{"name":"companyPrefix","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,2,], errors: [1,,], leaf: 20 },
				endpoint: null
			},
			{
				id: "/[companyPrefix]/issues/new",
				pattern: /^\/([^/]+?)\/issues\/new\/?$/,
				params: [{"name":"companyPrefix","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,2,], errors: [1,,], leaf: 21 },
				endpoint: null
			},
			{
				id: "/[companyPrefix]/issues/[issueId]",
				pattern: /^\/([^/]+?)\/issues\/([^/]+?)\/?$/,
				params: [{"name":"companyPrefix","optional":false,"rest":false,"chained":false},{"name":"issueId","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,2,], errors: [1,,], leaf: 19 },
				endpoint: null
			},
			{
				id: "/[companyPrefix]/labels",
				pattern: /^\/([^/]+?)\/labels\/?$/,
				params: [{"name":"companyPrefix","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,2,], errors: [1,,], leaf: 22 },
				endpoint: null
			},
			{
				id: "/[companyPrefix]/members",
				pattern: /^\/([^/]+?)\/members\/?$/,
				params: [{"name":"companyPrefix","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,2,], errors: [1,,], leaf: 23 },
				endpoint: null
			},
			{
				id: "/[companyPrefix]/org",
				pattern: /^\/([^/]+?)\/org\/?$/,
				params: [{"name":"companyPrefix","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,2,], errors: [1,,], leaf: 24 },
				endpoint: null
			},
			{
				id: "/[companyPrefix]/org/chart",
				pattern: /^\/([^/]+?)\/org\/chart\/?$/,
				params: [{"name":"companyPrefix","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,2,], errors: [1,,], leaf: 25 },
				endpoint: null
			},
			{
				id: "/[companyPrefix]/plugins",
				pattern: /^\/([^/]+?)\/plugins\/?$/,
				params: [{"name":"companyPrefix","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,2,], errors: [1,,], leaf: 26 },
				endpoint: null
			},
			{
				id: "/[companyPrefix]/plugins/[pluginId]",
				pattern: /^\/([^/]+?)\/plugins\/([^/]+?)\/?$/,
				params: [{"name":"companyPrefix","optional":false,"rest":false,"chained":false},{"name":"pluginId","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,2,], errors: [1,,], leaf: 27 },
				endpoint: null
			},
			{
				id: "/[companyPrefix]/plugins/[pluginId]/settings",
				pattern: /^\/([^/]+?)\/plugins\/([^/]+?)\/settings\/?$/,
				params: [{"name":"companyPrefix","optional":false,"rest":false,"chained":false},{"name":"pluginId","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,2,], errors: [1,,], leaf: 28 },
				endpoint: null
			},
			{
				id: "/[companyPrefix]/projects",
				pattern: /^\/([^/]+?)\/projects\/?$/,
				params: [{"name":"companyPrefix","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,2,], errors: [1,,], leaf: 29 },
				endpoint: null
			},
			{
				id: "/[companyPrefix]/projects/[projectId]",
				pattern: /^\/([^/]+?)\/projects\/([^/]+?)\/?$/,
				params: [{"name":"companyPrefix","optional":false,"rest":false,"chained":false},{"name":"projectId","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,2,], errors: [1,,], leaf: 30 },
				endpoint: null
			},
			{
				id: "/[companyPrefix]/routines",
				pattern: /^\/([^/]+?)\/routines\/?$/,
				params: [{"name":"companyPrefix","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,2,], errors: [1,,], leaf: 31 },
				endpoint: null
			},
			{
				id: "/[companyPrefix]/routines/[routineId]",
				pattern: /^\/([^/]+?)\/routines\/([^/]+?)\/?$/,
				params: [{"name":"companyPrefix","optional":false,"rest":false,"chained":false},{"name":"routineId","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,2,], errors: [1,,], leaf: 32 },
				endpoint: null
			},
			{
				id: "/[companyPrefix]/runs",
				pattern: /^\/([^/]+?)\/runs\/?$/,
				params: [{"name":"companyPrefix","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,2,], errors: [1,,], leaf: 33 },
				endpoint: null
			},
			{
				id: "/[companyPrefix]/runs/[runId]",
				pattern: /^\/([^/]+?)\/runs\/([^/]+?)\/?$/,
				params: [{"name":"companyPrefix","optional":false,"rest":false,"chained":false},{"name":"runId","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,2,], errors: [1,,], leaf: 34 },
				endpoint: null
			},
			{
				id: "/[companyPrefix]/secrets",
				pattern: /^\/([^/]+?)\/secrets\/?$/,
				params: [{"name":"companyPrefix","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,2,], errors: [1,,], leaf: 35 },
				endpoint: null
			},
			{
				id: "/[companyPrefix]/settings",
				pattern: /^\/([^/]+?)\/settings\/?$/,
				params: [{"name":"companyPrefix","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,2,], errors: [1,,], leaf: 36 },
				endpoint: null
			},
			{
				id: "/[companyPrefix]/skills",
				pattern: /^\/([^/]+?)\/skills\/?$/,
				params: [{"name":"companyPrefix","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,2,], errors: [1,,], leaf: 37 },
				endpoint: null
			},
			{
				id: "/[companyPrefix]/workspaces",
				pattern: /^\/([^/]+?)\/workspaces\/?$/,
				params: [{"name":"companyPrefix","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,2,], errors: [1,,], leaf: 38 },
				endpoint: null
			},
			{
				id: "/[companyPrefix]/workspaces/[workspaceId]",
				pattern: /^\/([^/]+?)\/workspaces\/([^/]+?)\/?$/,
				params: [{"name":"companyPrefix","optional":false,"rest":false,"chained":false},{"name":"workspaceId","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,2,], errors: [1,,], leaf: 39 },
				endpoint: null
			}
		],
		prerendered_routes: new Set(["/","/auth","/claim","/cli-auth","/companies","/design-guide","/invite","/not-found","/onboarding","/settings","/settings/api-keys","/settings/experimental","/settings/general","/settings/status","/settings/users","/setup"]),
		matchers: async () => {
			
			return {  };
		},
		server_assets: {}
	}
}
})();
