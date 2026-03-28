import "clsx";
import { B as Box } from "../../../chunks/box.js";
function _page($$renderer) {
  $$renderer.push(`<div class="flex h-full items-center justify-center"><div class="flex flex-col items-center gap-6 w-full max-w-sm px-4"><div class="flex flex-col items-center gap-2">`);
  Box($$renderer, { class: "size-10 text-foreground" });
  $$renderer.push(`<!----> <h1 class="text-xl font-semibold">ClawDev</h1> <p class="text-sm text-muted-foreground">Sign in to continue</p></div> <div class="w-full space-y-3"><p class="text-sm text-muted-foreground text-center">Auth page — migration in progress.</p></div></div></div>`);
}
export {
  _page as default
};
