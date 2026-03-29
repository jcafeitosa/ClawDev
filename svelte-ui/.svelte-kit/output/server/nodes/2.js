

export const index = 2;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/_companyPrefix_/_layout.svelte.js')).default;
export const universal = {
  "ssr": false,
  "prerender": false
};
export const universal_id = "src/routes/[companyPrefix]/+layout.ts";
export const imports = ["_app/immutable/nodes/2.4qHXfD46.js","_app/immutable/chunks/Bzak7iHL.js","_app/immutable/chunks/Ct3mSrsR.js","_app/immutable/chunks/DJW_FWg2.js","_app/immutable/chunks/CufsEo-p.js","_app/immutable/chunks/BlLisNem.js","_app/immutable/chunks/5Kx399zE.js","_app/immutable/chunks/DhVwA_JB.js","_app/immutable/chunks/B8L44Dme.js","_app/immutable/chunks/BvwYS_Wn.js","_app/immutable/chunks/DOskbVqy.js","_app/immutable/chunks/CJItKuqo.js","_app/immutable/chunks/B4iHg8RX.js","_app/immutable/chunks/C6nr1LQ0.js","_app/immutable/chunks/DFXkUBmq.js","_app/immutable/chunks/tBkfD-l1.js","_app/immutable/chunks/VQbwkz7C.js","_app/immutable/chunks/CKvYAhfF.js"];
export const stylesheets = [];
export const fonts = [];
