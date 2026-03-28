import { i as ensure_array_like } from "../../../chunks/index.js";
import "../../../chunks/client.js";
import "@sveltejs/kit/internal";
import "../../../chunks/exports.js";
import "../../../chunks/utils2.js";
import "@sveltejs/kit/internal/server";
import "../../../chunks/root.js";
import "../../../chunks/state.svelte.js";
import "../../../chunks/company.svelte.js";
import { Z as Zap } from "../../../chunks/zap.js";
import { P as Plus } from "../../../chunks/plus.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    $$renderer2.push(`<div class="companies-page svelte-1n5mo3k"><div class="companies-container svelte-1n5mo3k"><div class="companies-logo svelte-1n5mo3k">`);
    Zap($$renderer2, { size: 20 });
    $$renderer2.push(`<!----> <span class="svelte-1n5mo3k">ClawDev</span></div> <div class="companies-header svelte-1n5mo3k"><div class="svelte-1n5mo3k"><h1 class="companies-title svelte-1n5mo3k">Your Companies</h1> <p class="companies-subtitle svelte-1n5mo3k">Select an agent company or create a new one</p></div> <button class="companies-btn-primary svelte-1n5mo3k">`);
    Plus($$renderer2, { size: 16 });
    $$renderer2.push(`<!----> New Company</button></div> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="companies-grid svelte-1n5mo3k"><!--[-->`);
      const each_array = ensure_array_like(Array(3));
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        each_array[$$index];
        $$renderer2.push(`<div class="companies-skeleton svelte-1n5mo3k"></div>`);
      }
      $$renderer2.push(`<!--]--></div>`);
    }
    $$renderer2.push(`<!--]--></div></div> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
  });
}
export {
  _page as default
};
