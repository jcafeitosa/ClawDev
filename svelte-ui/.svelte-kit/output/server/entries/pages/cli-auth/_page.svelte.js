import { a as sanitize_props, b as spread_props, c as slot, e as escape_html, j as attr, m as derived, k as store_get, l as unsubscribe_stores } from "../../../chunks/index.js";
import { p as page } from "../../../chunks/stores.js";
import { T as Triangle_alert } from "../../../chunks/triangle-alert.js";
import { T as Terminal } from "../../../chunks/terminal.js";
import { S as Shield_alert } from "../../../chunks/shield-alert.js";
import { I as Icon } from "../../../chunks/Icon.js";
import { C as Circle_x } from "../../../chunks/circle-x.js";
function Circle_check($$renderer, $$props) {
  const $$sanitized_props = sanitize_props($$props);
  /**
   * @license lucide-svelte v0.474.0 - ISC
   *
   * ISC License
   *
   * Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2022.
   *
   * Permission to use, copy, modify, and/or distribute this software for any
   * purpose with or without fee is hereby granted, provided that the above
   * copyright notice and this permission notice appear in all copies.
   *
   * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
   * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
   * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
   * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
   * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
   * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
   * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
   *
   */
  const iconNode = [
    ["circle", { "cx": "12", "cy": "12", "r": "10" }],
    ["path", { "d": "m9 12 2 2 4-4" }]
  ];
  Icon($$renderer, spread_props([
    { name: "circle-check" },
    $$sanitized_props,
    {
      /**
       * @component @name CircleCheck
       * @description Lucide SVG icon component, renders SVG Element with children.
       *
       * @preview ![img](data:image/svg+xml;base64,PHN2ZyAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogIHdpZHRoPSIyNCIKICBoZWlnaHQ9IjI0IgogIHZpZXdCb3g9IjAgMCAyNCAyNCIKICBmaWxsPSJub25lIgogIHN0cm9rZT0iIzAwMCIgc3R5bGU9ImJhY2tncm91bmQtY29sb3I6ICNmZmY7IGJvcmRlci1yYWRpdXM6IDJweCIKICBzdHJva2Utd2lkdGg9IjIiCiAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogIHN0cm9rZS1saW5lam9pbj0icm91bmQiCj4KICA8Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIxMCIgLz4KICA8cGF0aCBkPSJtOSAxMiAyIDIgNC00IiAvPgo8L3N2Zz4K) - https://lucide.dev/icons/circle-check
       * @see https://lucide.dev/guide/packages/lucide-svelte - Documentation
       *
       * @param {Object} props - Lucide icons props and any valid SVG attribute
       * @returns {FunctionalComponent} Svelte component
       *
       */
      iconNode,
      children: ($$renderer2) => {
        $$renderer2.push(`<!--[-->`);
        slot($$renderer2, $$props, "default", {});
        $$renderer2.push(`<!--]-->`);
      },
      $$slots: { default: true }
    }
  ]));
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let code = derived(() => store_get($$store_subs ??= {}, "$page", page).url.searchParams.get("code") ?? "");
    let loading = false;
    let displayCode = derived(() => code() ? code().split("").join(" ") : "");
    $$renderer2.push(`<div class="cli-auth-page svelte-1s0qe4c"><div class="cli-auth-bg svelte-1s0qe4c"></div> <div class="cli-auth-card svelte-1s0qe4c">`);
    if (!code()) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="cli-auth-icon cli-auth-icon--warning svelte-1s0qe4c">`);
      Triangle_alert($$renderer2, { size: 28 });
      $$renderer2.push(`<!----></div> <h1 class="cli-auth-title svelte-1s0qe4c">No Authentication Code</h1> <p class="cli-auth-desc svelte-1s0qe4c">No authentication code was provided. Please open this page from your CLI terminal.</p>`);
    } else {
      $$renderer2.push("<!--[1-->");
      $$renderer2.push(`<div class="cli-auth-icon cli-auth-icon--primary svelte-1s0qe4c">`);
      Terminal($$renderer2, { size: 28 });
      $$renderer2.push(`<!----></div> <h1 class="cli-auth-title svelte-1s0qe4c">CLI Authentication Request</h1> <p class="cli-auth-desc svelte-1s0qe4c">A CLI session is requesting access to your ClawDev instance.</p> <div class="cli-auth-code-box svelte-1s0qe4c"><span class="cli-auth-code-label svelte-1s0qe4c">Authentication Code</span> <code class="cli-auth-code svelte-1s0qe4c">${escape_html(displayCode())}</code></div> <div class="cli-auth-warning svelte-1s0qe4c">`);
      Shield_alert($$renderer2, { size: 16 });
      $$renderer2.push(`<!----> <span>Only approve this request if you initiated it from your terminal.</span></div> <div class="cli-auth-actions svelte-1s0qe4c"><button class="cli-auth-btn cli-auth-btn--approve svelte-1s0qe4c"${attr("disabled", loading, true)}>`);
      Circle_check($$renderer2, { size: 18 });
      $$renderer2.push(`<!----> ${escape_html("Approve")}</button> <button class="cli-auth-btn cli-auth-btn--deny svelte-1s0qe4c"${attr("disabled", loading, true)}>`);
      Circle_x($$renderer2, { size: 18 });
      $$renderer2.push(`<!----> ${escape_html("Deny")}</button></div>`);
    }
    $$renderer2.push(`<!--]--></div></div>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
export {
  _page as default
};
