

export const index = 0;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/_layout.svelte.js')).default;
export const universal = {
  "ssr": false,
  "prerender": true
};
export const universal_id = "src/routes/+layout.ts";
export const imports = ["_app/immutable/nodes/0.V6ewtgRE.js","_app/immutable/chunks/Bzak7iHL.js","_app/immutable/chunks/DJW_FWg2.js","_app/immutable/chunks/CufsEo-p.js","_app/immutable/chunks/DhVwA_JB.js","_app/immutable/chunks/5Kx399zE.js"];
export const stylesheets = ["_app/immutable/assets/0.Dq986NzN.css"];
export const fonts = [];
