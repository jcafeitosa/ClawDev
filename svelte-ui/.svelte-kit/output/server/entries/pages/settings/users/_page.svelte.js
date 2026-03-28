import { i as ensure_array_like } from "../../../../chunks/index.js";
import "../../../../chunks/client.js";
import { a as authClient } from "../../../../chunks/auth-client.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    authClient.useSession();
    $$renderer2.push(`<div class="mx-auto max-w-2xl space-y-6 p-6"><div class="flex gap-3 border-b border-zinc-200 pb-3 dark:border-zinc-800"><a href="/settings/general" class="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">General</a> <a href="/settings/experimental" class="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">Experimental</a> <a href="/settings/users" class="text-sm font-medium text-indigo-600 dark:text-indigo-400">Users</a> <a href="/settings/status" class="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">Status</a> <a href="/settings/api-keys" class="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">API Keys</a></div> <div><h1 class="text-xl font-bold text-zinc-900 dark:text-zinc-50">Instance Users</h1> <p class="mt-1 text-sm text-zinc-500">Manage instance-level user roles and admin access.</p></div> `);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="space-y-3"><!--[-->`);
      const each_array = ensure_array_like(Array(4));
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        each_array[$$index];
        $$renderer2.push(`<div class="h-16 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800"></div>`);
      }
      $$renderer2.push(`<!--]--></div>`);
    }
    $$renderer2.push(`<!--]--></div> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
  });
}
export {
  _page as default
};
