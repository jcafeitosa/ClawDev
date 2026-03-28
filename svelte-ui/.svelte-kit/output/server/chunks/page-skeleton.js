import { i as ensure_array_like } from "./index.js";
function Page_skeleton($$renderer, $$props) {
  let { lines = 6, showSidebar = true } = $$props;
  $$renderer.push(`<div class="flex flex-col lg:flex-row gap-6 animate-pulse"><div class="flex-1 space-y-4"><div class="h-8 w-2/3 rounded bg-zinc-200 dark:bg-zinc-800"></div> <div class="h-4 w-1/3 rounded bg-zinc-200 dark:bg-zinc-800"></div> <!--[-->`);
  const each_array = ensure_array_like(Array(lines));
  for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
    each_array[$$index];
    $$renderer.push(`<div class="h-4 w-full rounded bg-zinc-100 dark:bg-zinc-800/50"></div>`);
  }
  $$renderer.push(`<!--]--></div> `);
  if (showSidebar) {
    $$renderer.push("<!--[0-->");
    $$renderer.push(`<div class="w-full lg:w-80 shrink-0 space-y-3"><div class="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"><!--[-->`);
    const each_array_1 = ensure_array_like(Array(4));
    for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
      each_array_1[$$index_1];
      $$renderer.push(`<div class="flex justify-between py-2"><div class="h-4 w-20 rounded bg-zinc-200 dark:bg-zinc-800"></div> <div class="h-4 w-24 rounded bg-zinc-100 dark:bg-zinc-800/50"></div></div>`);
    }
    $$renderer.push(`<!--]--></div></div>`);
  } else {
    $$renderer.push("<!--[-1-->");
  }
  $$renderer.push(`<!--]--></div>`);
}
export {
  Page_skeleton as P
};
