import { d as attr_class, o as stringify } from "../../../../chunks/index.js";
import "../../../../chunks/company.svelte.js";
import "../../../../chunks/client.js";
import { U as Upload } from "../../../../chunks/upload.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    $$renderer2.push(`<div class="mx-auto max-w-lg p-6 space-y-6"><div><h1 class="text-xl font-bold text-[#F8FAFC]">Import Company Data</h1> <p class="mt-1 text-sm text-[#94A3B8]">Upload a ZIP or JSON file to import data into your workspace</p></div> `);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div${attr_class(`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 transition-colors ${stringify("border-white/[0.12] hover:border-white/[0.2]")}`)} role="presentation">`);
      Upload($$renderer2, { class: "mb-3 h-8 w-8 text-[#94A3B8]" });
      $$renderer2.push(`<!----> <p class="text-sm text-[#94A3B8]">Drag &amp; drop a ZIP or JSON file, or</p> <label class="mt-3 cursor-pointer rounded-lg border border-white/[0.08] bg-[#121218] px-4 py-2 text-sm font-medium text-[#F8FAFC] transition-colors hover:bg-white/[0.05]">Browse files <input type="file" accept=".zip,.json" class="hidden"/></label></div>`);
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[-1-->");
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
