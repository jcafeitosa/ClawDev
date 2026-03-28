

export const index = 0;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/_layout.svelte.js')).default;
export const universal = {
  "ssr": false,
  "prerender": true
};
export const universal_id = "src/routes/+layout.ts";
export const imports = ["_app/immutable/nodes/0.CKCMXr6o.js","_app/immutable/chunks/Bzak7iHL.js","_app/immutable/chunks/CnU8mnEz.js","_app/immutable/chunks/DXa51RsP.js","_app/immutable/chunks/DxsSN_Sr.js","_app/immutable/chunks/C-1Wk0r7.js"];
export const stylesheets = ["_app/immutable/assets/0.DwdB5B-P.css"];
export const fonts = [];
