import { d as attr_class, e as escape_html, j as attr, i as ensure_array_like, m as derived, o as stringify } from "../../../../chunks/index.js";
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
    let members = [];
    let searchQuery = "";
    let activeMembers = derived(() => members.filter((m) => m.status === "active"));
    let pendingMembers = derived(() => members.filter((m) => m.status === "pending"));
    $$renderer2.push(`<div class="space-y-6 p-6"><div class="flex items-center justify-between"><div><h1 class="text-2xl font-bold text-[#F8FAFC]">Members</h1> <p class="mt-1 text-sm text-[#94A3B8]">Manage team access and roles</p></div> <button class="inline-flex items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1d4ed8] active:scale-[0.98]">`);
    {
      $$renderer2.push("<!--[-1-->");
      Plus($$renderer2, { class: "w-4 h-4" });
      $$renderer2.push(`<!----> Invite`);
    }
    $$renderer2.push(`<!--]--></button></div> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div class="flex items-center gap-1 border-b border-white/[0.08]"><button${attr_class(`relative px-4 py-2.5 text-sm font-medium transition-colors ${stringify(
      "text-[#F8FAFC]"
    )}`)}>All <span class="ml-1 text-xs opacity-70">(${escape_html(members.length)})</span> `);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<span class="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full"></span>`);
    }
    $$renderer2.push(`<!--]--></button> <button${attr_class(`relative px-4 py-2.5 text-sm font-medium transition-colors ${stringify("text-[#94A3B8] hover:text-[#F8FAFC]")}`)}>Active <span class="ml-1 text-xs opacity-70">(${escape_html(activeMembers().length)})</span> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></button> <button${attr_class(`relative px-4 py-2.5 text-sm font-medium transition-colors ${stringify("text-[#94A3B8] hover:text-[#F8FAFC]")}`)}>Pending `);
    if (pendingMembers().length > 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<span class="ml-1.5 inline-flex items-center justify-center rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">${escape_html(pendingMembers().length)}</span>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<span class="ml-1 text-xs opacity-70">(0)</span>`);
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></button></div> <div class="relative">`);
    Search($$renderer2, {
      class: "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]"
    });
    $$renderer2.push(`<!----> <input type="text" placeholder="Search members..."${attr("value", searchQuery)} class="w-full sm:w-64 rounded-lg border border-white/[0.08] bg-[#121218] pl-9 pr-3 py-2 text-sm text-[#F8FAFC] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#2563EB] transition"/></div></div> `);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="space-y-3"><!--[-->`);
      const each_array_1 = ensure_array_like(Array(5));
      for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
        each_array_1[$$index_1];
        $$renderer2.push(`<div class="h-[72px] animate-pulse rounded-xl bg-[#121218] border border-white/[0.08]"></div>`);
      }
      $$renderer2.push(`<!--]--></div>`);
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
export {
  _page as default
};
