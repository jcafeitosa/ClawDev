import "clsx";
import "@sveltejs/kit/internal";
import "../../../../../chunks/exports.js";
import "../../../../../chunks/utils2.js";
import "@sveltejs/kit/internal/server";
import "../../../../../chunks/root.js";
import "../../../../../chunks/state.svelte.js";
import "../../../../../chunks/client.js";
import { P as Page_skeleton } from "../../../../../chunks/page-skeleton.js";
import "../../../../../chunks/company.svelte.js";
import "../../../../../chunks/badge.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      {
        $$renderer3.push("<!--[0-->");
        $$renderer3.push(`<div class="p-6">`);
        Page_skeleton($$renderer3, { lines: 8 });
        $$renderer3.push(`<!----></div>`);
      }
      $$renderer3.push(`<!--]-->`);
    }
    do {
      $$settled = true;
      $$inner_renderer = $$renderer2.copy();
      $$render_inner($$inner_renderer);
    } while (!$$settled);
    $$renderer2.subsume($$inner_renderer);
  });
}
export {
  _page as default
};
