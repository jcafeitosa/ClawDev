import { i as ensure_array_like, d as attr_class, e as escape_html, j as attr, o as stringify } from "../../../../chunks/index.js";
import "@sveltejs/kit/internal";
import "../../../../chunks/exports.js";
import "../../../../chunks/utils2.js";
import "@sveltejs/kit/internal/server";
import "../../../../chunks/root.js";
import "../../../../chunks/state.svelte.js";
import "../../../../chunks/company.svelte.js";
import "../../../../chunks/client.js";
import { P as Plus } from "../../../../chunks/plus.js";
import { S as Search } from "../../../../chunks/search.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let routines = [];
    let activeFilter = "all";
    let searchQuery = "";
    const STATUS_FILTERS = ["all", "active", "paused", "archived"];
    function filterLabel(f) {
      const labels = {
        all: "All",
        active: "Active",
        paused: "Paused",
        archived: "Archived"
      };
      return labels[f] ?? f;
    }
    function countByFilter(filter) {
      if (filter === "all") return routines.length;
      return routines.filter((r) => r.status === filter).length;
    }
    $$renderer2.push(`<div class="p-6 space-y-6"><div class="flex items-center justify-between"><div><h1 class="text-2xl font-bold text-[#F8FAFC]">Routines</h1> <p class="mt-1 text-sm text-[#94A3B8]">Scheduled recurring tasks and automations</p></div> <button class="inline-flex items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1d4ed8] active:scale-[0.98]">`);
    Plus($$renderer2, { class: "w-4 h-4" });
    $$renderer2.push(`<!----> New Routine</button></div> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div class="flex items-center gap-1.5 flex-wrap"><!--[-->`);
    const each_array_1 = ensure_array_like(STATUS_FILTERS);
    for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
      let filter = each_array_1[$$index_1];
      $$renderer2.push(`<button${attr_class(`rounded-lg px-3 py-1.5 text-sm font-medium transition ${stringify(activeFilter === filter ? "bg-[#2563EB] text-white" : "bg-white/[0.05] text-[#94A3B8] hover:bg-white/[0.08] hover:text-[#F8FAFC]")}`)}>${escape_html(filterLabel(filter))} <span class="ml-1 text-xs opacity-70">(${escape_html(countByFilter(filter))})</span></button>`);
    }
    $$renderer2.push(`<!--]--></div> <div class="relative">`);
    Search($$renderer2, {
      class: "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]"
    });
    $$renderer2.push(`<!----> <input type="text" placeholder="Search routines..."${attr("value", searchQuery)} class="w-full sm:w-64 rounded-lg border border-white/[0.08] bg-[#121218] pl-9 pr-3 py-2 text-sm text-[#F8FAFC] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#2563EB] transition"/></div></div> `);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="space-y-3"><!--[-->`);
      const each_array_2 = ensure_array_like(Array(5));
      for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
        each_array_2[$$index_2];
        $$renderer2.push(`<div class="h-20 animate-pulse rounded-xl border border-white/[0.08] bg-[#121218]"></div>`);
      }
      $$renderer2.push(`<!--]--></div>`);
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
export {
  _page as default
};
