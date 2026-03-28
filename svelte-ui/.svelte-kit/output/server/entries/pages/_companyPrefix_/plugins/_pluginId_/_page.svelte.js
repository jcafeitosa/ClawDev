import "clsx";
import "@sveltejs/kit/internal";
import "../../../../../chunks/exports.js";
import "../../../../../chunks/utils2.js";
import "@sveltejs/kit/internal/server";
import "../../../../../chunks/root.js";
import "../../../../../chunks/state.svelte.js";
import "../../../../../chunks/client.js";
import { P as Page_skeleton } from "../../../../../chunks/page-skeleton.js";
import "../../../../../chunks/badge.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    $$renderer2.push(`<div class="p-6 space-y-6">`);
    {
      $$renderer2.push("<!--[0-->");
      Page_skeleton($$renderer2, {});
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
export {
  _page as default
};
