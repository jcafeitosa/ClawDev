import { a as sanitize_props, b as spread_props, c as slot, j as attr, o as stringify, k as store_get, i as ensure_array_like, d as attr_class, e as escape_html, l as unsubscribe_stores, m as derived } from "../../../../chunks/index.js";
import { p as page } from "../../../../chunks/stores.js";
import "../../../../chunks/company.svelte.js";
import "../../../../chunks/client.js";
import { P as Plus } from "../../../../chunks/plus.js";
import { L as List } from "../../../../chunks/list.js";
import { I as Icon } from "../../../../chunks/Icon.js";
import { S as Search } from "../../../../chunks/search.js";
function Network($$renderer, $$props) {
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
      { "x": "16", "y": "16", "width": "6", "height": "6", "rx": "1" }
    ],
    [
      "rect",
      { "x": "2", "y": "16", "width": "6", "height": "6", "rx": "1" }
    ],
    [
      "rect",
      { "x": "9", "y": "2", "width": "6", "height": "6", "rx": "1" }
    ],
    ["path", { "d": "M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3" }],
    ["path", { "d": "M12 12V8" }]
  ];
  Icon($$renderer, spread_props([
    { name: "network" },
    $$sanitized_props,
    {
      /**
       * @component @name Network
       * @description Lucide SVG icon component, renders SVG Element with children.
       *
       * @preview ![img](data:image/svg+xml;base64,PHN2ZyAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogIHdpZHRoPSIyNCIKICBoZWlnaHQ9IjI0IgogIHZpZXdCb3g9IjAgMCAyNCAyNCIKICBmaWxsPSJub25lIgogIHN0cm9rZT0iIzAwMCIgc3R5bGU9ImJhY2tncm91bmQtY29sb3I6ICNmZmY7IGJvcmRlci1yYWRpdXM6IDJweCIKICBzdHJva2Utd2lkdGg9IjIiCiAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogIHN0cm9rZS1saW5lam9pbj0icm91bmQiCj4KICA8cmVjdCB4PSIxNiIgeT0iMTYiIHdpZHRoPSI2IiBoZWlnaHQ9IjYiIHJ4PSIxIiAvPgogIDxyZWN0IHg9IjIiIHk9IjE2IiB3aWR0aD0iNiIgaGVpZ2h0PSI2IiByeD0iMSIgLz4KICA8cmVjdCB4PSI5IiB5PSIyIiB3aWR0aD0iNiIgaGVpZ2h0PSI2IiByeD0iMSIgLz4KICA8cGF0aCBkPSJNNSAxNnYtM2ExIDEgMCAwIDEgMS0xaDEyYTEgMSAwIDAgMSAxIDF2MyIgLz4KICA8cGF0aCBkPSJNMTIgMTJWOCIgLz4KPC9zdmc+Cg==) - https://lucide.dev/icons/network
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
function Sliders_horizontal($$renderer, $$props) {
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
    ["line", { "x1": "21", "x2": "14", "y1": "4", "y2": "4" }],
    ["line", { "x1": "10", "x2": "3", "y1": "4", "y2": "4" }],
    ["line", { "x1": "21", "x2": "12", "y1": "12", "y2": "12" }],
    ["line", { "x1": "8", "x2": "3", "y1": "12", "y2": "12" }],
    ["line", { "x1": "21", "x2": "16", "y1": "20", "y2": "20" }],
    ["line", { "x1": "12", "x2": "3", "y1": "20", "y2": "20" }],
    ["line", { "x1": "14", "x2": "14", "y1": "2", "y2": "6" }],
    ["line", { "x1": "8", "x2": "8", "y1": "10", "y2": "14" }],
    ["line", { "x1": "16", "x2": "16", "y1": "18", "y2": "22" }]
  ];
  Icon($$renderer, spread_props([
    { name: "sliders-horizontal" },
    $$sanitized_props,
    {
      /**
       * @component @name SlidersHorizontal
       * @description Lucide SVG icon component, renders SVG Element with children.
       *
       * @preview ![img](data:image/svg+xml;base64,PHN2ZyAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogIHdpZHRoPSIyNCIKICBoZWlnaHQ9IjI0IgogIHZpZXdCb3g9IjAgMCAyNCAyNCIKICBmaWxsPSJub25lIgogIHN0cm9rZT0iIzAwMCIgc3R5bGU9ImJhY2tncm91bmQtY29sb3I6ICNmZmY7IGJvcmRlci1yYWRpdXM6IDJweCIKICBzdHJva2Utd2lkdGg9IjIiCiAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogIHN0cm9rZS1saW5lam9pbj0icm91bmQiCj4KICA8bGluZSB4MT0iMjEiIHgyPSIxNCIgeTE9IjQiIHkyPSI0IiAvPgogIDxsaW5lIHgxPSIxMCIgeDI9IjMiIHkxPSI0IiB5Mj0iNCIgLz4KICA8bGluZSB4MT0iMjEiIHgyPSIxMiIgeTE9IjEyIiB5Mj0iMTIiIC8+CiAgPGxpbmUgeDE9IjgiIHgyPSIzIiB5MT0iMTIiIHkyPSIxMiIgLz4KICA8bGluZSB4MT0iMjEiIHgyPSIxNiIgeTE9IjIwIiB5Mj0iMjAiIC8+CiAgPGxpbmUgeDE9IjEyIiB4Mj0iMyIgeTE9IjIwIiB5Mj0iMjAiIC8+CiAgPGxpbmUgeDE9IjE0IiB4Mj0iMTQiIHkxPSIyIiB5Mj0iNiIgLz4KICA8bGluZSB4MT0iOCIgeDI9IjgiIHkxPSIxMCIgeTI9IjE0IiAvPgogIDxsaW5lIHgxPSIxNiIgeDI9IjE2IiB5MT0iMTgiIHkyPSIyMiIgLz4KPC9zdmc+Cg==) - https://lucide.dev/icons/sliders-horizontal
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
    let agents = [];
    let activeFilter = "all";
    let searchQuery = "";
    const BASE_STATUS_FILTERS = ["all", "idle", "running", "paused", "error"];
    let STATUS_FILTERS = derived(() => BASE_STATUS_FILTERS);
    function statusLabel(s) {
      const labels = {
        all: "All",
        idle: "Active",
        running: "Running",
        paused: "Paused",
        error: "Error",
        terminated: "Terminated"
      };
      return labels[s] ?? s;
    }
    function countByStatus(status) {
      if (status === "all") return;
      baseFilteredAgents().length;
      if (status === "idle") return baseFilteredAgents().filter((a) => a.status === "idle" || a.status === "pending_approval").length;
      return baseFilteredAgents().filter((a) => a.status === status).length;
    }
    let baseFilteredAgents = derived(() => {
      return agents.filter((a) => a.status !== "terminated");
    });
    $$renderer2.push(`<div class="p-6 space-y-5"><div class="flex items-center justify-between"><div class="flex items-center gap-3"><h1 class="text-xl font-semibold text-[#F8FAFC]">Agents</h1></div> <a${attr("href", `/${stringify(store_get($$store_subs ??= {}, "$page", page).params.companyPrefix)}/agents/new`)} class="inline-flex items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-medium text-white shadow-sm shadow-blue-500/20 transition hover:bg-[#1d4ed8] active:scale-[0.98]">`);
    Plus($$renderer2, { class: "w-4 h-4" });
    $$renderer2.push(`<!----> New Agent</a></div> <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div class="flex items-center gap-1.5 flex-wrap"><!--[-->`);
    const each_array_1 = ensure_array_like(STATUS_FILTERS());
    for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
      let status = each_array_1[$$index_1];
      $$renderer2.push(`<button${attr_class(`rounded-lg px-3 py-1.5 text-sm font-medium transition ${stringify(activeFilter === status ? "bg-[#2563EB] text-white" : "bg-white/[0.05] text-[#94A3B8] hover:bg-white/[0.08] hover:text-[#F8FAFC]")}`)}>${escape_html(statusLabel(status))} <span class="ml-1 text-xs opacity-70">(${escape_html(countByStatus(status))})</span></button>`);
    }
    $$renderer2.push(`<!--]--></div> <div class="flex items-center gap-2"><div class="flex items-center rounded-lg border border-white/[0.08] bg-[#121218] overflow-hidden"><button${attr_class(`p-2 transition ${stringify(
      "bg-white/[0.1] text-[#F8FAFC]"
    )}`)} title="List view">`);
    List($$renderer2, { class: "w-4 h-4" });
    $$renderer2.push(`<!----></button> <button${attr_class(`p-2 transition ${stringify("text-[#64748B] hover:text-[#94A3B8]")}`)} title="Org tree view">`);
    Network($$renderer2, { class: "w-4 h-4" });
    $$renderer2.push(`<!----></button></div> <button${attr_class(`inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-[#121218] px-3 py-2 text-sm transition ${stringify("text-[#64748B] hover:text-[#94A3B8]")}`)}>`);
    Sliders_horizontal($$renderer2, { class: "w-3.5 h-3.5" });
    $$renderer2.push(`<!----> Filters</button> <div class="relative">`);
    Search($$renderer2, {
      class: "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]"
    });
    $$renderer2.push(`<!----> <input type="text" placeholder="Search agents..."${attr("value", searchQuery)} class="w-full sm:w-56 rounded-lg border border-white/[0.08] bg-[#121218] pl-9 pr-3 py-2 text-sm text-[#F8FAFC] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#2563EB] transition"/></div></div></div> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="space-y-3"><!--[-->`);
      const each_array_2 = ensure_array_like(Array(6));
      for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
        each_array_2[$$index_2];
        $$renderer2.push(`<div class="h-[64px] animate-pulse rounded-xl bg-[#121218] border border-white/[0.08]"></div>`);
      }
      $$renderer2.push(`<!--]--></div>`);
    }
    $$renderer2.push(`<!--]--></div>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
export {
  _page as default
};
