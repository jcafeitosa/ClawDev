import "clsx";
import { B as Box } from "../../chunks/box.js";
function _page($$renderer) {
  $$renderer.push(`<div class="flex h-full items-center justify-center"><div class="flex flex-col items-center gap-4 text-muted-foreground">`);
  Box($$renderer, { class: "size-12" });
  $$renderer.push(`<!----> <h1 class="text-2xl font-semibold text-foreground">ClawDev</h1> <p class="text-sm">SvelteKit + Tailwind v4 — SPA mode</p></div></div>`);
}
export {
  _page as default
};
