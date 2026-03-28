import { i as ensure_array_like, d as attr_class, o as stringify, e as escape_html } from "../../../../chunks/index.js";
import "@sveltejs/kit/internal";
import "../../../../chunks/exports.js";
import "../../../../chunks/utils2.js";
import "@sveltejs/kit/internal/server";
import "../../../../chunks/root.js";
import "../../../../chunks/state.svelte.js";
import "../../../../chunks/client.js";
import "../../../../chunks/company.svelte.js";
import { P as Page_skeleton } from "../../../../chunks/page-skeleton.js";
import "../../../../chunks/badge.js";
import "clsx";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let filter = "all";
    const FILTER_OPTIONS = [
      { value: "all", label: "All" },
      { value: "active", label: "Active" },
      { value: "archived", label: "Archived" }
    ];
    $$renderer2.push(`<div class="p-6 space-y-5"><div class="flex items-center justify-between"><h1 class="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Workspaces</h1></div> <div class="flex items-center gap-2"><!--[-->`);
    const each_array = ensure_array_like(FILTER_OPTIONS);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let opt = each_array[$$index];
      $$renderer2.push(`<button${attr_class(`rounded-full px-3 py-1 text-xs font-medium transition-colors ${stringify(filter === opt.value ? "bg-primary text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700")}`)}>${escape_html(opt.label)}</button>`);
    }
    $$renderer2.push(`<!--]--></div> `);
    {
      $$renderer2.push("<!--[0-->");
      Page_skeleton($$renderer2, { lines: 6 });
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
export {
  _page as default
};
