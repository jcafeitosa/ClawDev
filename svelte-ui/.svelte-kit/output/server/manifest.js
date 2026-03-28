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
		client: {start:"_app/immutable/entry/start.UfEpth5h.js",app:"_app/immutable/entry/app.BvaTANuh.js",imports:["_app/immutable/entry/start.UfEpth5h.js","_app/immutable/chunks/VQbwkz7C.js","_app/immutable/chunks/DJW_FWg2.js","_app/immutable/chunks/BvwYS_Wn.js","_app/immutable/chunks/Ct3mSrsR.js","_app/immutable/entry/app.BvaTANuh.js","_app/immutable/chunks/DJW_FWg2.js","_app/immutable/chunks/DOskbVqy.js","_app/immutable/chunks/CJItKuqo.js","_app/immutable/chunks/CufsEo-p.js","_app/immutable/chunks/Bzak7iHL.js","_app/immutable/chunks/Ct3mSrsR.js","_app/immutable/chunks/BlLisNem.js","_app/immutable/chunks/5Kx399zE.js","_app/immutable/chunks/DFXkUBmq.js","_app/immutable/chunks/B8L44Dme.js","_app/immutable/chunks/BvwYS_Wn.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
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
			__memo(() => import('./nodes/16.js'))
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
				id: "/[companyPrefix]/approvals",
				pattern: /^\/([^/]+?)\/approvals\/?$/,
				params: [{"name":"companyPrefix","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,2,], errors: [1,,], leaf: 6 },
				endpoint: null
			},
			{
				id: "/[companyPrefix]/costs",
				pattern: /^\/([^/]+?)\/costs\/?$/,
				params: [{"name":"companyPrefix","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,2,], errors: [1,,], leaf: 7 },
				endpoint: null
			},
			{
				id: "/[companyPrefix]/dashboard",
				pattern: /^\/([^/]+?)\/dashboard\/?$/,
				params: [{"name":"companyPrefix","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,2,], errors: [1,,], leaf: 8 },
				endpoint: null
			},
			{
				id: "/[companyPrefix]/goals",
				pattern: /^\/([^/]+?)\/goals\/?$/,
				params: [{"name":"companyPrefix","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,2,], errors: [1,,], leaf: 9 },
				endpoint: null
			},
			{
				id: "/[companyPrefix]/inbox",
				pattern: /^\/([^/]+?)\/inbox\/?$/,
				params: [{"name":"companyPrefix","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,2,], errors: [1,,], leaf: 10 },
				endpoint: null
			},
			{
				id: "/[companyPrefix]/issues",
				pattern: /^\/([^/]+?)\/issues\/?$/,
				params: [{"name":"companyPrefix","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,2,], errors: [1,,], leaf: 11 },
				endpoint: null
			},
			{
				id: "/[companyPrefix]/org",
				pattern: /^\/([^/]+?)\/org\/?$/,
				params: [{"name":"companyPrefix","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,2,], errors: [1,,], leaf: 12 },
				endpoint: null
			},
			{
				id: "/[companyPrefix]/projects",
				pattern: /^\/([^/]+?)\/projects\/?$/,
				params: [{"name":"companyPrefix","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,2,], errors: [1,,], leaf: 13 },
				endpoint: null
			},
			{
				id: "/[companyPrefix]/routines",
				pattern: /^\/([^/]+?)\/routines\/?$/,
				params: [{"name":"companyPrefix","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,2,], errors: [1,,], leaf: 14 },
				endpoint: null
			},
			{
				id: "/[companyPrefix]/settings",
				pattern: /^\/([^/]+?)\/settings\/?$/,
				params: [{"name":"companyPrefix","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,2,], errors: [1,,], leaf: 15 },
				endpoint: null
			}
		],
		prerendered_routes: new Set(["/","/auth"]),
		matchers: async () => {
			
			return {  };
		},
		server_assets: {}
	}
}
})();
