import { i as ensure_array_like, j as attr, d as attr_class, o as stringify, e as escape_html } from "../../../../chunks/index.js";
import "../../../../chunks/client.js";
import { K as Key } from "../../../../chunks/key.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const tabs = [
      { href: "/settings/general", label: "General" },
      { href: "/settings/experimental", label: "Experimental" },
      { href: "/settings/users", label: "Users" },
      { href: "/settings/status", label: "Status" },
      { href: "/settings/api-keys", label: "API Keys" }
    ];
    $$renderer2.push(`<div class="mx-auto max-w-3xl space-y-6 p-6"><div class="flex gap-3 border-b border-zinc-200 pb-3 dark:border-zinc-800"><!--[-->`);
    const each_array = ensure_array_like(tabs);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let tab = each_array[$$index];
      $$renderer2.push(`<a${attr("href", tab.href)}${attr_class(`text-sm ${stringify(tab.href === "/settings/api-keys" ? "font-medium text-indigo-600 dark:text-indigo-400" : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300")}`)}>${escape_html(tab.label)}</a>`);
    }
    $$renderer2.push(`<!--]--></div> <div class="flex items-center justify-between"><div class="flex items-center gap-3">`);
    Key($$renderer2, { class: "h-6 w-6 text-zinc-400" });
    $$renderer2.push(`<!----> <h1 class="text-xl font-bold text-zinc-900 dark:text-zinc-50">Board API Keys</h1></div></div> <p class="text-sm text-zinc-500 dark:text-zinc-400">Board API keys are created through the CLI authentication flow. Use <code class="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs dark:bg-zinc-800">claude-cli auth login</code> to create a new key, or revoke your current key below.</p> `);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="space-y-4"><!--[-->`);
      const each_array_1 = ensure_array_like(Array(3));
      for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
        each_array_1[$$index_1];
        $$renderer2.push(`<div class="h-20 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800"></div>`);
      }
      $$renderer2.push(`<!--]--></div>`);
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
