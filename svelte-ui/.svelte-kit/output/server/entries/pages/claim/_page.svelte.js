import { j as attr } from "../../../chunks/index.js";
import "../../../chunks/client.js";
import "@sveltejs/kit/internal";
import "../../../chunks/exports.js";
import "../../../chunks/utils2.js";
import "@sveltejs/kit/internal/server";
import "../../../chunks/root.js";
import "../../../chunks/state.svelte.js";
import { Z as Zap } from "../../../chunks/zap.js";
import { S as Shield_check } from "../../../chunks/shield-check.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let token = "";
    let claimState = "idle";
    $$renderer2.push(`<div class="claim-page svelte-1fpk6rr"><div class="claim-container svelte-1fpk6rr"><div class="claim-logo svelte-1fpk6rr">`);
    Zap($$renderer2, { size: 20 });
    $$renderer2.push(`<!----> <span>ClawDev</span></div> <div class="claim-card svelte-1fpk6rr">`);
    {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<div class="claim-header svelte-1fpk6rr"><div class="claim-header-icon svelte-1fpk6rr">`);
      Shield_check($$renderer2, { size: 24 });
      $$renderer2.push(`<!----></div> <h2 class="claim-title svelte-1fpk6rr">Board Access Claim</h2> <p class="claim-desc svelte-1fpk6rr">Enter the claim token from your server console to gain admin access.</p></div> <form class="claim-form svelte-1fpk6rr"><div class="claim-field svelte-1fpk6rr"><label for="claim-token" class="svelte-1fpk6rr">Claim Token</label> <input id="claim-token" type="text"${attr("value", token)} placeholder="paste-your-token-here"${attr("disabled", claimState === "ready", true)} class="claim-input claim-input--mono svelte-1fpk6rr" autocomplete="off" spellcheck="false"/></div> `);
      {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> <div class="claim-actions svelte-1fpk6rr">`);
      {
        $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<button type="submit" class="claim-btn claim-btn--primary claim-btn--full svelte-1fpk6rr"${attr("disabled", !token.trim() || claimState === "checking", true)}>`);
        {
          $$renderer2.push("<!--[-1-->");
          $$renderer2.push(`Verify Token`);
        }
        $$renderer2.push(`<!--]--></button>`);
      }
      $$renderer2.push(`<!--]--></div></form>`);
    }
    $$renderer2.push(`<!--]--></div> <p class="claim-footer svelte-1fpk6rr">Already have access? <a href="/auth" class="claim-footer-link svelte-1fpk6rr">Sign in</a></p></div></div>`);
  });
}
export {
  _page as default
};
