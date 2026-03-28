import "clsx";
import { a as authClient } from "../../../chunks/auth-client.js";
import "../../../chunks/client.js";
import "@sveltejs/kit/internal";
import "../../../chunks/exports.js";
import "../../../chunks/utils2.js";
import "@sveltejs/kit/internal/server";
import "../../../chunks/root.js";
import "../../../chunks/state.svelte.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    authClient.useSession();
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="setup-page svelte-g40i6i"><p class="setup-loading svelte-g40i6i">Loading...</p></div>`);
    }
    $$renderer2.push(`<!--]-->`);
  });
}
export {
  _page as default
};
