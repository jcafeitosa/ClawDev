import { a as sanitize_props, b as spread_props, c as slot, i as ensure_array_like, e as escape_html } from "../../../../chunks/index.js";
import "@sveltejs/kit/internal";
import "../../../../chunks/exports.js";
import "../../../../chunks/utils2.js";
import "@sveltejs/kit/internal/server";
import "../../../../chunks/root.js";
import "../../../../chunks/state.svelte.js";
import "../../../../chunks/company.svelte.js";
import "../../../../chunks/client.js";
import { I as Icon } from "../../../../chunks/Icon.js";
function Filter($$renderer, $$props) {
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
    [
      "polygon",
      { "points": "22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" }
    ]
  ];
  Icon($$renderer, spread_props([
    { name: "filter" },
    $$sanitized_props,
    {
      /**
       * @component @name Filter
       * @description Lucide SVG icon component, renders SVG Element with children.
       *
       * @preview ![img](data:image/svg+xml;base64,PHN2ZyAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogIHdpZHRoPSIyNCIKICBoZWlnaHQ9IjI0IgogIHZpZXdCb3g9IjAgMCAyNCAyNCIKICBmaWxsPSJub25lIgogIHN0cm9rZT0iIzAwMCIgc3R5bGU9ImJhY2tncm91bmQtY29sb3I6ICNmZmY7IGJvcmRlci1yYWRpdXM6IDJweCIKICBzdHJva2Utd2lkdGg9IjIiCiAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogIHN0cm9rZS1saW5lam9pbj0icm91bmQiCj4KICA8cG9seWdvbiBwb2ludHM9IjIyIDMgMiAzIDEwIDEyLjQ2IDEwIDE5IDE0IDIxIDE0IDEyLjQ2IDIyIDMiIC8+Cjwvc3ZnPgo=) - https://lucide.dev/icons/filter
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
    let filterType = "all";
    const entityTypes = [
      { value: "all", label: "All Activity" },
      { value: "agent", label: "Agents" },
      { value: "issue", label: "Issues" },
      { value: "project", label: "Projects" },
      { value: "run", label: "Runs" },
      { value: "comment", label: "Comments" }
    ];
    $$renderer2.push(`<div class="space-y-6 p-6"><div class="flex items-center justify-between"><div><h1 class="text-2xl font-bold text-[#F8FAFC]">Activity</h1> <p class="mt-1 text-sm text-[#94A3B8]">Recent events across your workspace</p></div> <div class="relative"><div class="inline-flex items-center gap-2">`);
    Filter($$renderer2, { class: "h-4 w-4 text-[#94A3B8]" });
    $$renderer2.push(`<!----> `);
    $$renderer2.select(
      {
        value: filterType,
        class: "appearance-none rounded-lg border border-white/[0.08] bg-[#121218] px-3 py-2 pr-8 text-sm text-[#F8FAFC] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      },
      ($$renderer3) => {
        $$renderer3.push(`<!--[-->`);
        const each_array = ensure_array_like(entityTypes);
        for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
          let t = each_array[$$index];
          $$renderer3.option({ value: t.value }, ($$renderer4) => {
            $$renderer4.push(`${escape_html(t.label)}`);
          });
        }
        $$renderer3.push(`<!--]-->`);
      }
    );
    $$renderer2.push(`</div></div></div> `);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="space-y-3"><!--[-->`);
      const each_array_1 = ensure_array_like(Array(8));
      for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
        each_array_1[$$index_1];
        $$renderer2.push(`<div class="flex items-center gap-4 rounded-xl border border-white/[0.08] bg-[#121218] p-4"><div class="h-9 w-9 animate-pulse rounded-lg bg-white/[0.05]"></div> <div class="flex-1 space-y-2"><div class="h-4 w-3/4 animate-pulse rounded bg-white/[0.05]"></div> <div class="h-3 w-1/4 animate-pulse rounded bg-white/[0.05]"></div></div></div>`);
      }
      $$renderer2.push(`<!--]--></div>`);
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
export {
  _page as default
};
