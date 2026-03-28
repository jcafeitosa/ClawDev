import { a as sanitize_props, b as spread_props, c as slot, j as attr, i as ensure_array_like, d as attr_class, o as stringify, e as escape_html, m as derived } from "../../../../chunks/index.js";
import "@sveltejs/kit/internal";
import "../../../../chunks/exports.js";
import "../../../../chunks/utils2.js";
import "@sveltejs/kit/internal/server";
import "../../../../chunks/root.js";
import "../../../../chunks/state.svelte.js";
import "../../../../chunks/client.js";
import { I as Icon } from "../../../../chunks/Icon.js";
function Check_check($$renderer, $$props) {
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
    ["path", { "d": "M18 6 7 17l-5-5" }],
    ["path", { "d": "m22 10-7.5 7.5L13 16" }]
  ];
  Icon($$renderer, spread_props([
    { name: "check-check" },
    $$sanitized_props,
    {
      /**
       * @component @name CheckCheck
       * @description Lucide SVG icon component, renders SVG Element with children.
       *
       * @preview ![img](data:image/svg+xml;base64,PHN2ZyAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogIHdpZHRoPSIyNCIKICBoZWlnaHQ9IjI0IgogIHZpZXdCb3g9IjAgMCAyNCAyNCIKICBmaWxsPSJub25lIgogIHN0cm9rZT0iIzAwMCIgc3R5bGU9ImJhY2tncm91bmQtY29sb3I6ICNmZmY7IGJvcmRlci1yYWRpdXM6IDJweCIKICBzdHJva2Utd2lkdGg9IjIiCiAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogIHN0cm9rZS1saW5lam9pbj0icm91bmQiCj4KICA8cGF0aCBkPSJNMTggNiA3IDE3bC01LTUiIC8+CiAgPHBhdGggZD0ibTIyIDEwLTcuNSA3LjVMMTMgMTYiIC8+Cjwvc3ZnPgo=) - https://lucide.dev/icons/check-check
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
    let markingAllRead = false;
    let items = [];
    let activeTab = "mine";
    let tabUnreadCounts = { mine: 0, recent: 0, unread: 0, all: 0 };
    const tabs = [
      { key: "mine", label: "Mine" },
      { key: "recent", label: "Recent" },
      { key: "unread", label: "Unread" },
      { key: "all", label: "All" }
    ];
    let unreadCount = derived(() => items.filter((it) => it.unread !== false && it.read !== true).length);
    $$renderer2.push(`<div class="space-y-6 p-6"><div class="flex items-center justify-between"><div><h1 class="text-2xl font-bold text-[#F8FAFC]">Inbox</h1> <p class="mt-1 text-sm text-[#94A3B8]">Notifications and updates for you</p></div> `);
    if (unreadCount() > 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<button${attr("disabled", markingAllRead, true)} class="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-[#121218] px-3 py-2 text-sm font-medium text-[#F8FAFC] transition-colors hover:bg-white/[0.05] disabled:opacity-50">`);
      {
        $$renderer2.push("<!--[-1-->");
        Check_check($$renderer2, { class: "h-4 w-4" });
      }
      $$renderer2.push(`<!--]--> Mark all read</button>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> <div class="flex items-center gap-1 border-b border-white/[0.08]"><!--[-->`);
    const each_array = ensure_array_like(tabs);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let tab = each_array[$$index];
      $$renderer2.push(`<button${attr_class(`relative inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${stringify(activeTab === tab.key ? "text-[#F8FAFC]" : "text-[#94A3B8] hover:text-[#F8FAFC]")}`)}>${escape_html(tab.label)} `);
      if ((tabUnreadCounts[tab.key] ?? 0) > 0) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<span class="inline-flex items-center justify-center rounded-full bg-blue-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white min-w-[18px]">${escape_html(tabUnreadCounts[tab.key])}</span>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (activeTab === tab.key) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<span class="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full"></span>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></button>`);
    }
    $$renderer2.push(`<!--]--></div> `);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="space-y-1"><!--[-->`);
      const each_array_1 = ensure_array_like(Array(6));
      for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
        each_array_1[$$index_1];
        $$renderer2.push(`<div class="flex items-center gap-4 px-4 py-3"><div class="h-9 w-9 animate-pulse rounded-lg bg-white/[0.05]"></div> <div class="flex-1 space-y-2"><div class="h-4 w-2/3 animate-pulse rounded bg-white/[0.05]"></div> <div class="h-3 w-1/3 animate-pulse rounded bg-white/[0.05]"></div></div></div>`);
      }
      $$renderer2.push(`<!--]--></div>`);
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
export {
  _page as default
};
