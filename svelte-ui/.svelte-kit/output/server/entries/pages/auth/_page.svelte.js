import "clsx";
import { a as authClient } from "../../../chunks/auth-client.js";
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
      $$renderer2.push(`<div class="auth-page svelte-1s728sz" style="align-items:center;justify-content:center;"><p style="color:#64748b;font-size:0.875rem;">Loading…</p></div>`);
    }
    $$renderer2.push(`<!--]-->`);
  });
}
export {
  _page as default
};
