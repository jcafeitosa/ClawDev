import { e as escape_html } from "../../../../../../chunks/index.js";
import "clsx";
import "@sveltejs/kit/internal";
import "../../../../../../chunks/exports.js";
import "../../../../../../chunks/utils2.js";
import "@sveltejs/kit/internal/server";
import "../../../../../../chunks/root.js";
import "../../../../../../chunks/state.svelte.js";
import "../../../../../../chunks/client.js";
import { P as Page_skeleton } from "../../../../../../chunks/page-skeleton.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    $$renderer2.push(`<div class="mx-auto max-w-2xl p-6 space-y-6"><div class="flex items-center justify-between"><h1 class="text-xl font-bold text-zinc-900 dark:text-zinc-50">Plugin Settings</h1> <button class="rounded-md border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">${escape_html("Raw JSON")}</button></div> `);
    {
      $$renderer2.push("<!--[0-->");
      Page_skeleton($$renderer2, {});
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
export {
  _page as default
};
