import { a as sanitize_props, b as spread_props, c as slot, j as attr, e as escape_html, i as ensure_array_like } from "../../../../chunks/index.js";
import "../../../../chunks/company.svelte.js";
import "../../../../chunks/client.js";
import { I as Icon } from "../../../../chunks/Icon.js";
import { D as Download } from "../../../../chunks/download.js";
import { S as Search } from "../../../../chunks/search.js";
function Scan_search($$renderer, $$props) {
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
    ["path", { "d": "M3 7V5a2 2 0 0 1 2-2h2" }],
    ["path", { "d": "M17 3h2a2 2 0 0 1 2 2v2" }],
    ["path", { "d": "M21 17v2a2 2 0 0 1-2 2h-2" }],
    ["path", { "d": "M7 21H5a2 2 0 0 1-2-2v-2" }],
    ["circle", { "cx": "12", "cy": "12", "r": "3" }],
    ["path", { "d": "m16 16-1.9-1.9" }]
  ];
  Icon($$renderer, spread_props([
    { name: "scan-search" },
    $$sanitized_props,
    {
      /**
       * @component @name ScanSearch
       * @description Lucide SVG icon component, renders SVG Element with children.
       *
       * @preview ![img](data:image/svg+xml;base64,PHN2ZyAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogIHdpZHRoPSIyNCIKICBoZWlnaHQ9IjI0IgogIHZpZXdCb3g9IjAgMCAyNCAyNCIKICBmaWxsPSJub25lIgogIHN0cm9rZT0iIzAwMCIgc3R5bGU9ImJhY2tncm91bmQtY29sb3I6ICNmZmY7IGJvcmRlci1yYWRpdXM6IDJweCIKICBzdHJva2Utd2lkdGg9IjIiCiAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogIHN0cm9rZS1saW5lam9pbj0icm91bmQiCj4KICA8cGF0aCBkPSJNMyA3VjVhMiAyIDAgMCAxIDItMmgyIiAvPgogIDxwYXRoIGQ9Ik0xNyAzaDJhMiAyIDAgMCAxIDIgMnYyIiAvPgogIDxwYXRoIGQ9Ik0yMSAxN3YyYTIgMiAwIDAgMS0yIDJoLTIiIC8+CiAgPHBhdGggZD0iTTcgMjFINWEyIDIgMCAwIDEtMi0ydi0yIiAvPgogIDxjaXJjbGUgY3g9IjEyIiBjeT0iMTIiIHI9IjMiIC8+CiAgPHBhdGggZD0ibTE2IDE2LTEuOS0xLjkiIC8+Cjwvc3ZnPgo=) - https://lucide.dev/icons/scan-search
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
    let searchQuery = "";
    let scanning = false;
    $$renderer2.push(`<div class="p-6 space-y-4"><div class="flex items-center justify-between gap-4"><h1 class="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Company Skills</h1> <div class="flex items-center gap-2"><button${attr("disabled", scanning, true)} class="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50">`);
    Scan_search($$renderer2, { class: "w-3.5 h-3.5" });
    $$renderer2.push(`<!----> ${escape_html("Scan Projects")}</button> <button class="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 dark:bg-zinc-100 px-3 py-1.5 text-xs font-medium text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors">`);
    Download($$renderer2, { class: "w-3.5 h-3.5" });
    $$renderer2.push(`<!----> Import Skills</button></div></div> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="relative">`);
    Search($$renderer2, {
      class: "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400"
    });
    $$renderer2.push(`<!----> <input type="text"${attr("value", searchQuery)} placeholder="Search skills..." class="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent pl-10 pr-4 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"/></div> `);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="space-y-3"><!--[-->`);
      const each_array_1 = ensure_array_like(Array(4));
      for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
        each_array_1[$$index_1];
        $$renderer2.push(`<div class="h-16 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800"></div>`);
      }
      $$renderer2.push(`<!--]--></div>`);
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
export {
  _page as default
};
