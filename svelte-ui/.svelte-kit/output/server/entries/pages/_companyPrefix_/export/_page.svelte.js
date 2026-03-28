import { a as sanitize_props, b as spread_props, c as slot, e as escape_html, i as ensure_array_like, d as attr_class, o as stringify, j as attr } from "../../../../chunks/index.js";
import "../../../../chunks/company.svelte.js";
import "../../../../chunks/client.js";
import { I as Icon } from "../../../../chunks/Icon.js";
import { E as Eye } from "../../../../chunks/eye.js";
import { D as Download } from "../../../../chunks/download.js";
function Package($$renderer, $$props) {
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
      "path",
      {
        "d": "M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"
      }
    ],
    ["path", { "d": "M12 22V12" }],
    ["polyline", { "points": "3.29 7 12 12 20.71 7" }],
    ["path", { "d": "m7.5 4.27 9 5.15" }]
  ];
  Icon($$renderer, spread_props([
    { name: "package" },
    $$sanitized_props,
    {
      /**
       * @component @name Package
       * @description Lucide SVG icon component, renders SVG Element with children.
       *
       * @preview ![img](data:image/svg+xml;base64,PHN2ZyAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogIHdpZHRoPSIyNCIKICBoZWlnaHQ9IjI0IgogIHZpZXdCb3g9IjAgMCAyNCAyNCIKICBmaWxsPSJub25lIgogIHN0cm9rZT0iIzAwMCIgc3R5bGU9ImJhY2tncm91bmQtY29sb3I6ICNmZmY7IGJvcmRlci1yYWRpdXM6IDJweCIKICBzdHJva2Utd2lkdGg9IjIiCiAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogIHN0cm9rZS1saW5lam9pbj0icm91bmQiCj4KICA8cGF0aCBkPSJNMTEgMjEuNzNhMiAyIDAgMCAwIDIgMGw3LTRBMiAyIDAgMCAwIDIxIDE2VjhhMiAyIDAgMCAwLTEtMS43M2wtNy00YTIgMiAwIDAgMC0yIDBsLTcgNEEyIDIgMCAwIDAgMyA4djhhMiAyIDAgMCAwIDEgMS43M3oiIC8+CiAgPHBhdGggZD0iTTEyIDIyVjEyIiAvPgogIDxwb2x5bGluZSBwb2ludHM9IjMuMjkgNyAxMiAxMiAyMC43MSA3Ii8+CiAgPHBhdGggZD0ibTcuNSA0LjI3IDkgNS4xNSIgLz4KPC9zdmc+Cg==) - https://lucide.dev/icons/package
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
    const sections = [
      "agents",
      "issues",
      "goals",
      "projects",
      "routines",
      "skills"
    ];
    let selected = new Set(sections);
    let previewing = false;
    $$renderer2.push(`<div class="mx-auto max-w-lg p-6 space-y-6"><div><h1 class="text-xl font-bold text-[#F8FAFC]">Export Company</h1> <p class="mt-1 text-sm text-[#94A3B8]">Select what to include in the export:</p></div> <button class="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors">${escape_html(selected.size === sections.length ? "Deselect all" : "Select all")}</button> <div class="space-y-2"><!--[-->`);
    const each_array = ensure_array_like(sections);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let s = each_array[$$index];
      $$renderer2.push(`<label${attr_class(`flex items-center gap-3 rounded-lg border border-white/[0.08] bg-[#121218] p-3 cursor-pointer transition-colors hover:bg-white/[0.03] ${stringify(selected.has(s) ? "border-blue-500/30" : "")}`)}><input type="checkbox"${attr("checked", selected.has(s), true)} class="rounded border-white/20 bg-white/[0.05] text-blue-500 focus:ring-blue-500/30"/> `);
      Package($$renderer2, { class: "h-4 w-4 text-[#94A3B8]" });
      $$renderer2.push(`<!----> <span class="text-sm capitalize text-[#F8FAFC]">${escape_html(s)}</span> `);
      {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></label>`);
    }
    $$renderer2.push(`<!--]--></div> `);
    if (selected.size > 0 && true) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<button${attr("disabled", previewing, true)} class="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-white/[0.08] bg-[#121218] px-4 py-2.5 text-sm font-medium text-[#F8FAFC] transition-colors hover:bg-white/[0.05] disabled:opacity-50">`);
      {
        $$renderer2.push("<!--[-1-->");
        Eye($$renderer2, { class: "h-4 w-4" });
        $$renderer2.push(`<!----> Preview Export`);
      }
      $$renderer2.push(`<!--]--></button>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <button${attr("disabled", selected.size === 0, true)} class="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50">`);
    {
      $$renderer2.push("<!--[-1-->");
      Download($$renderer2, { class: "h-4 w-4" });
      $$renderer2.push(`<!----> Export ZIP`);
    }
    $$renderer2.push(`<!--]--></button></div>`);
  });
}
export {
  _page as default
};
