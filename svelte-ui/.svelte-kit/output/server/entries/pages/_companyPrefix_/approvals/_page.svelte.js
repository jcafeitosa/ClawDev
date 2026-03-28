import { d as attr_class, e as escape_html, i as ensure_array_like, m as derived, o as stringify } from "../../../../chunks/index.js";
import "@sveltejs/kit/internal";
import "../../../../chunks/exports.js";
import "../../../../chunks/utils2.js";
import "@sveltejs/kit/internal/server";
import "../../../../chunks/root.js";
import "../../../../chunks/state.svelte.js";
import "../../../../chunks/company.svelte.js";
import "../../../../chunks/client.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let approvals = [];
    let pendingApprovals = derived(() => approvals.filter((a) => a.status === "pending"));
    let pendingCount = derived(() => pendingApprovals().length);
    $$renderer2.push(`<div class="space-y-6 p-6"><div><h1 class="text-2xl font-bold text-[#F8FAFC]">Approvals</h1> <p class="mt-1 text-sm text-[#94A3B8]">Review and approve pending requests</p></div> <div class="flex items-center gap-1 border-b border-white/[0.08]"><button${attr_class(`relative px-4 py-2.5 text-sm font-medium transition-colors ${stringify(
      "text-[#F8FAFC]"
    )}`)}>Pending `);
    if (pendingCount() > 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<span class="ml-1.5 inline-flex items-center justify-center rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">${escape_html(pendingCount())}</span>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<span class="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full"></span>`);
    }
    $$renderer2.push(`<!--]--></button> <button${attr_class(`relative px-4 py-2.5 text-sm font-medium transition-colors ${stringify("text-[#94A3B8] hover:text-[#F8FAFC]")}`)}>All `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></button></div> `);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="space-y-3"><!--[-->`);
      const each_array = ensure_array_like(Array(4));
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        each_array[$$index];
        $$renderer2.push(`<div class="h-24 animate-pulse rounded-xl border border-white/[0.08] bg-[#121218]"></div>`);
      }
      $$renderer2.push(`<!--]--></div>`);
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
export {
  _page as default
};
