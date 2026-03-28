import { i as ensure_array_like } from "../../../../chunks/index.js";
import "@sveltejs/kit/internal";
import "../../../../chunks/exports.js";
import "../../../../chunks/utils2.js";
import "@sveltejs/kit/internal/server";
import "../../../../chunks/root.js";
import "../../../../chunks/state.svelte.js";
import "../../../../chunks/company.svelte.js";
import "../../../../chunks/client.js";
import { P as Plus } from "../../../../chunks/plus.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    $$renderer2.push(`<div class="space-y-6 p-6"><div class="flex items-center justify-between"><div><h1 class="text-2xl font-bold text-[#F8FAFC]">Secrets</h1> <p class="mt-1 text-sm text-[#94A3B8]">Manage API keys, tokens, and credentials</p></div> <button class="inline-flex items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1d4ed8] active:scale-[0.98]">`);
    {
      $$renderer2.push("<!--[-1-->");
      Plus($$renderer2, { class: "w-4 h-4" });
      $$renderer2.push(`<!----> Add Secret`);
    }
    $$renderer2.push(`<!--]--></button></div> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="space-y-3"><!--[-->`);
      const each_array = ensure_array_like(Array(5));
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        each_array[$$index];
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
