import { i as ensure_array_like } from "../../../../chunks/index.js";
import "../../../../chunks/client.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    $$renderer2.push(`<div class="mx-auto max-w-2xl space-y-6 p-6"><div class="flex gap-3 border-b border-zinc-200 pb-3 dark:border-zinc-800"><a href="/settings/general" class="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">General</a> <a href="/settings/experimental" class="text-sm font-medium text-indigo-600 dark:text-indigo-400">Experimental</a> <a href="/settings/users" class="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">Users</a> <a href="/settings/status" class="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">Status</a> <a href="/settings/api-keys" class="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">API Keys</a></div> <h1 class="text-xl font-bold text-zinc-900 dark:text-zinc-50">Experimental Features</h1> `);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="space-y-4"><!--[-->`);
      const each_array = ensure_array_like(Array(5));
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        each_array[$$index];
        $$renderer2.push(`<div class="h-16 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800"></div>`);
      }
      $$renderer2.push(`<!--]--></div>`);
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
export {
  _page as default
};
