import "clsx";
import "@sveltejs/kit/internal";
import "../../chunks/exports.js";
import "../../chunks/utils2.js";
import "@sveltejs/kit/internal/server";
import "../../chunks/root.js";
import "../../chunks/state.svelte.js";
import { a as authClient } from "../../chunks/auth-client.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    authClient.useSession();
    $$renderer2.push(`<div class="flex h-full items-center justify-center"><div class="text-sm text-muted-foreground">Loading…</div></div>`);
  });
}
export {
  _page as default
};
