import { a as sanitize_props, b as spread_props, c as slot, j as attr, o as stringify, k as store_get, e as escape_html, d as attr_class, f as clsx, i as ensure_array_like, l as unsubscribe_stores } from "../../../../chunks/index.js";
import { p as page } from "../../../../chunks/stores.js";
import "../../../../chunks/company.svelte.js";
import "../../../../chunks/client.js";
import { c as cn } from "../../../../chunks/cn.js";
import { P as Plus } from "../../../../chunks/plus.js";
import { C as Chevron_down } from "../../../../chunks/chevron-down.js";
import { S as Search } from "../../../../chunks/search.js";
import { L as List } from "../../../../chunks/list.js";
import { I as Icon } from "../../../../chunks/Icon.js";
function Layout_grid($$renderer, $$props) {
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
      "rect",
      { "width": "7", "height": "7", "x": "3", "y": "3", "rx": "1" }
    ],
    [
      "rect",
      { "width": "7", "height": "7", "x": "14", "y": "3", "rx": "1" }
    ],
    [
      "rect",
      { "width": "7", "height": "7", "x": "14", "y": "14", "rx": "1" }
    ],
    [
      "rect",
      { "width": "7", "height": "7", "x": "3", "y": "14", "rx": "1" }
    ]
  ];
  Icon($$renderer, spread_props([
    { name: "layout-grid" },
    $$sanitized_props,
    {
      /**
       * @component @name LayoutGrid
       * @description Lucide SVG icon component, renders SVG Element with children.
       *
       * @preview ![img](data:image/svg+xml;base64,PHN2ZyAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogIHdpZHRoPSIyNCIKICBoZWlnaHQ9IjI0IgogIHZpZXdCb3g9IjAgMCAyNCAyNCIKICBmaWxsPSJub25lIgogIHN0cm9rZT0iIzAwMCIgc3R5bGU9ImJhY2tncm91bmQtY29sb3I6ICNmZmY7IGJvcmRlci1yYWRpdXM6IDJweCIKICBzdHJva2Utd2lkdGg9IjIiCiAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogIHN0cm9rZS1saW5lam9pbj0icm91bmQiCj4KICA8cmVjdCB3aWR0aD0iNyIgaGVpZ2h0PSI3IiB4PSIzIiB5PSIzIiByeD0iMSIgLz4KICA8cmVjdCB3aWR0aD0iNyIgaGVpZ2h0PSI3IiB4PSIxNCIgeT0iMyIgcng9IjEiIC8+CiAgPHJlY3Qgd2lkdGg9IjciIGhlaWdodD0iNyIgeD0iMTQiIHk9IjE0IiByeD0iMSIgLz4KICA8cmVjdCB3aWR0aD0iNyIgaGVpZ2h0PSI3IiB4PSIzIiB5PSIxNCIgcng9IjEiIC8+Cjwvc3ZnPgo=) - https://lucide.dev/icons/layout-grid
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
    let statusFilter = "";
    let priorityFilter = "";
    let searchQuery = "";
    const ALL_STATUSES = [
      { value: "", label: "All Statuses" },
      { value: "backlog", label: "Backlog" },
      { value: "todo", label: "To Do" },
      { value: "in_progress", label: "In Progress" },
      { value: "in_review", label: "In Review" },
      { value: "blocked", label: "Blocked" },
      { value: "done", label: "Done" },
      { value: "cancelled", label: "Cancelled" }
    ];
    const ALL_PRIORITIES = [
      { value: "", label: "All Priorities" },
      { value: "critical", label: "Critical" },
      { value: "high", label: "High" },
      { value: "medium", label: "Medium" },
      { value: "low", label: "Low" }
    ];
    function selectedStatusLabel() {
      return ALL_STATUSES.find((s) => s.value === statusFilter)?.label ?? "All Statuses";
    }
    function selectedPriorityLabel() {
      return ALL_PRIORITIES.find((p) => p.value === priorityFilter)?.label ?? "All Priorities";
    }
    $$renderer2.push(`<div class="p-6 space-y-6 svelte-ifasx"><div class="flex items-center justify-between svelte-ifasx"><h1 class="text-xl font-semibold text-[#F8FAFC] svelte-ifasx">Issues</h1> <a${attr("href", `/${stringify(store_get($$store_subs ??= {}, "$page", page).params.companyPrefix)}/issues/new`)} class="inline-flex items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1d4ed8] active:scale-[0.98] svelte-ifasx">`);
    Plus($$renderer2, { class: "w-4 h-4" });
    $$renderer2.push(`<!----> New Issue</a></div> <div class="flex flex-col gap-3 sm:flex-row sm:items-center svelte-ifasx"><div class="relative svelte-ifasx" data-dropdown=""><button class="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-[#121218] px-3 py-2 text-sm text-[#F8FAFC] transition hover:bg-white/[0.05] svelte-ifasx">${escape_html(selectedStatusLabel())} `);
    Chevron_down($$renderer2, { class: "w-3.5 h-3.5 text-[#94A3B8]" });
    $$renderer2.push(`<!----></button> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> <div class="relative svelte-ifasx" data-dropdown=""><button class="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-[#121218] px-3 py-2 text-sm text-[#F8FAFC] transition hover:bg-white/[0.05] svelte-ifasx">${escape_html(selectedPriorityLabel())} `);
    Chevron_down($$renderer2, { class: "w-3.5 h-3.5 text-[#94A3B8]" });
    $$renderer2.push(`<!----></button> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> <div class="relative flex-1 sm:max-w-xs svelte-ifasx">`);
    Search($$renderer2, {
      class: "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]"
    });
    $$renderer2.push(`<!----> <input type="text" placeholder="Search issues..."${attr("value", searchQuery)} class="w-full rounded-lg border border-white/[0.08] bg-[#121218] pl-9 pr-3 py-2 text-sm text-[#F8FAFC] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#2563EB] transition svelte-ifasx"/></div> <div class="flex items-center rounded-lg border border-white/[0.08] bg-[#121218] p-0.5 shrink-0 svelte-ifasx"><button${attr_class(
      clsx(cn(
        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
        "bg-[rgba(255,255,255,0.1)] text-[#F8FAFC]"
      )),
      "svelte-ifasx"
    )} aria-label="List view">`);
    List($$renderer2, { class: "w-3.5 h-3.5" });
    $$renderer2.push(`<!----> List</button> <button${attr_class(
      clsx(cn("inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors", "text-[#94A3B8] hover:text-[#F8FAFC]")),
      "svelte-ifasx"
    )} aria-label="Board view">`);
    Layout_grid($$renderer2, { class: "w-3.5 h-3.5" });
    $$renderer2.push(`<!----> Board</button></div></div> `);
    {
      $$renderer2.push("<!--[0-->");
      {
        $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<div class="space-y-3 svelte-ifasx"><!--[-->`);
        const each_array_4 = ensure_array_like(Array(8));
        for (let $$index_4 = 0, $$length = each_array_4.length; $$index_4 < $$length; $$index_4++) {
          each_array_4[$$index_4];
          $$renderer2.push(`<div class="h-[60px] animate-pulse rounded-xl bg-[#121218] border border-white/[0.08] svelte-ifasx"></div>`);
        }
        $$renderer2.push(`<!--]--></div>`);
      }
      $$renderer2.push(`<!--]-->`);
    }
    $$renderer2.push(`<!--]--></div>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
export {
  _page as default
};
