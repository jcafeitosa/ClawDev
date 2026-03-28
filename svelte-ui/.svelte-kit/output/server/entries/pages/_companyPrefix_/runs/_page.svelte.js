import { i as ensure_array_like, d as attr_class, e as escape_html, j as attr, o as stringify } from "../../../../chunks/index.js";
import "@sveltejs/kit/internal";
import "../../../../chunks/exports.js";
import "../../../../chunks/utils2.js";
import "@sveltejs/kit/internal/server";
import "../../../../chunks/root.js";
import "../../../../chunks/state.svelte.js";
import "../../../../chunks/company.svelte.js";
import "../../../../chunks/client.js";
import { S as Search } from "../../../../chunks/search.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let runs = [];
    let statusFilter = "all";
    let searchQuery = "";
    const STATUS_FILTERS = ["all", "running", "success", "failed", "cancelled"];
    function filterLabel(f) {
      const labels = {
        all: "All",
        running: "Running",
        success: "Success",
        failed: "Failed",
        cancelled: "Cancelled"
      };
      return labels[f] ?? f;
    }
    function countByFilter(filter) {
      if (filter === "all") return runs.length;
      return runs.filter((r) => normalizeStatus(r.status) === filter).length;
    }
    function normalizeStatus(status) {
      const s = status.toLowerCase();
      if (s === "running" || s === "in_progress" || s === "started") return "running";
      if (s === "success" || s === "completed" || s === "done" || s === "finished") return "success";
      if (s === "failed" || s === "error" || s === "errored") return "failed";
      if (s === "cancelled" || s === "canceled" || s === "aborted") return "cancelled";
      return s;
    }
    $$renderer2.push(`<div class="p-6 space-y-6"><div class="flex items-center justify-between"><div><h1 class="text-2xl font-bold text-[#F8FAFC]">Runs</h1> <p class="mt-1 text-sm text-[#94A3B8]">Agent execution history and active runs</p></div></div> <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div class="flex items-center gap-1.5 flex-wrap"><!--[-->`);
    const each_array = ensure_array_like(STATUS_FILTERS);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let filter = each_array[$$index];
      $$renderer2.push(`<button${attr_class(`rounded-lg px-3 py-1.5 text-sm font-medium transition ${stringify(statusFilter === filter ? "bg-[#2563EB] text-white" : "bg-white/[0.05] text-[#94A3B8] hover:bg-white/[0.08] hover:text-[#F8FAFC]")}`)}>${escape_html(filterLabel(filter))} <span class="ml-1 text-xs opacity-70">(${escape_html(countByFilter(filter))})</span></button>`);
    }
    $$renderer2.push(`<!--]--></div> <div class="relative">`);
    Search($$renderer2, {
      class: "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]"
    });
    $$renderer2.push(`<!----> <input type="text" placeholder="Search runs..."${attr("value", searchQuery)} class="w-full sm:w-64 rounded-lg border border-white/[0.08] bg-[#121218] pl-9 pr-3 py-2 text-sm text-[#F8FAFC] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#2563EB] transition"/></div></div> `);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="space-y-3"><!--[-->`);
      const each_array_1 = ensure_array_like(Array(8));
      for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
        each_array_1[$$index_1];
        $$renderer2.push(`<div class="h-[60px] animate-pulse rounded-xl bg-[#121218] border border-white/[0.08]"></div>`);
      }
      $$renderer2.push(`<!--]--></div>`);
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
export {
  _page as default
};
