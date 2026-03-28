import { a as sanitize_props, b as spread_props, c as slot, j as attr, e as escape_html, h as attr_style, d as attr_class, m as derived, o as stringify } from "../../../../chunks/index.js";
import { c as companyStore } from "../../../../chunks/company.svelte.js";
import "../../../../chunks/client.js";
import { B as Building_2 } from "../../../../chunks/building-2.js";
import { I as Icon } from "../../../../chunks/Icon.js";
import { P as Palette, U as Users } from "../../../../chunks/users.js";
import { U as Upload } from "../../../../chunks/upload.js";
import { X } from "../../../../chunks/x.js";
import { C as Copy } from "../../../../chunks/copy.js";
import { T as Triangle_alert } from "../../../../chunks/triangle-alert.js";
function Archive($$renderer, $$props) {
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
      { "width": "20", "height": "5", "x": "2", "y": "3", "rx": "1" }
    ],
    ["path", { "d": "M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" }],
    ["path", { "d": "M10 12h4" }]
  ];
  Icon($$renderer, spread_props([
    { name: "archive" },
    $$sanitized_props,
    {
      /**
       * @component @name Archive
       * @description Lucide SVG icon component, renders SVG Element with children.
       *
       * @preview ![img](data:image/svg+xml;base64,PHN2ZyAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogIHdpZHRoPSIyNCIKICBoZWlnaHQ9IjI0IgogIHZpZXdCb3g9IjAgMCAyNCAyNCIKICBmaWxsPSJub25lIgogIHN0cm9rZT0iIzAwMCIgc3R5bGU9ImJhY2tncm91bmQtY29sb3I6ICNmZmY7IGJvcmRlci1yYWRpdXM6IDJweCIKICBzdHJva2Utd2lkdGg9IjIiCiAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogIHN0cm9rZS1saW5lam9pbj0icm91bmQiCj4KICA8cmVjdCB3aWR0aD0iMjAiIGhlaWdodD0iNSIgeD0iMiIgeT0iMyIgcng9IjEiIC8+CiAgPHBhdGggZD0iTTQgOHYxMWEyIDIgMCAwIDAgMiAyaDEyYTIgMiAwIDAgMCAyLTJWOCIgLz4KICA8cGF0aCBkPSJNMTAgMTJoNCIgLz4KPC9zdmc+Cg==) - https://lucide.dev/icons/archive
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
function Image($$renderer, $$props) {
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
      {
        "width": "18",
        "height": "18",
        "x": "3",
        "y": "3",
        "rx": "2",
        "ry": "2"
      }
    ],
    ["circle", { "cx": "9", "cy": "9", "r": "2" }],
    ["path", { "d": "m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" }]
  ];
  Icon($$renderer, spread_props([
    { name: "image" },
    $$sanitized_props,
    {
      /**
       * @component @name Image
       * @description Lucide SVG icon component, renders SVG Element with children.
       *
       * @preview ![img](data:image/svg+xml;base64,PHN2ZyAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogIHdpZHRoPSIyNCIKICBoZWlnaHQ9IjI0IgogIHZpZXdCb3g9IjAgMCAyNCAyNCIKICBmaWxsPSJub25lIgogIHN0cm9rZT0iIzAwMCIgc3R5bGU9ImJhY2tncm91bmQtY29sb3I6ICNmZmY7IGJvcmRlci1yYWRpdXM6IDJweCIKICBzdHJva2Utd2lkdGg9IjIiCiAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogIHN0cm9rZS1saW5lam9pbj0icm91bmQiCj4KICA8cmVjdCB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHg9IjMiIHk9IjMiIHJ4PSIyIiByeT0iMiIgLz4KICA8Y2lyY2xlIGN4PSI5IiBjeT0iOSIgcj0iMiIgLz4KICA8cGF0aCBkPSJtMjEgMTUtMy4wODYtMy4wODZhMiAyIDAgMCAwLTIuODI4IDBMNiAyMSIgLz4KPC9zdmc+Cg==) - https://lucide.dev/icons/image
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
function Save($$renderer, $$props) {
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
        "d": "M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"
      }
    ],
    ["path", { "d": "M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7" }],
    ["path", { "d": "M7 3v4a1 1 0 0 0 1 1h7" }]
  ];
  Icon($$renderer, spread_props([
    { name: "save" },
    $$sanitized_props,
    {
      /**
       * @component @name Save
       * @description Lucide SVG icon component, renders SVG Element with children.
       *
       * @preview ![img](data:image/svg+xml;base64,PHN2ZyAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogIHdpZHRoPSIyNCIKICBoZWlnaHQ9IjI0IgogIHZpZXdCb3g9IjAgMCAyNCAyNCIKICBmaWxsPSJub25lIgogIHN0cm9rZT0iIzAwMCIgc3R5bGU9ImJhY2tncm91bmQtY29sb3I6ICNmZmY7IGJvcmRlci1yYWRpdXM6IDJweCIKICBzdHJva2Utd2lkdGg9IjIiCiAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogIHN0cm9rZS1saW5lam9pbj0icm91bmQiCj4KICA8cGF0aCBkPSJNMTUuMiAzYTIgMiAwIDAgMSAxLjQuNmwzLjggMy44YTIgMiAwIDAgMSAuNiAxLjRWMTlhMiAyIDAgMCAxLTIgMkg1YTIgMiAwIDAgMS0yLTJWNWEyIDIgMCAwIDEgMi0yeiIgLz4KICA8cGF0aCBkPSJNMTcgMjF2LTdhMSAxIDAgMCAwLTEtMUg4YTEgMSAwIDAgMC0xIDF2NyIgLz4KICA8cGF0aCBkPSJNNyAzdjRhMSAxIDAgMCAwIDEgMWg3IiAvPgo8L3N2Zz4K) - https://lucide.dev/icons/save
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
function Trash_2($$renderer, $$props) {
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
    ["path", { "d": "M3 6h18" }],
    ["path", { "d": "M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" }],
    ["path", { "d": "M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" }],
    ["line", { "x1": "10", "x2": "10", "y1": "11", "y2": "17" }],
    ["line", { "x1": "14", "x2": "14", "y1": "11", "y2": "17" }]
  ];
  Icon($$renderer, spread_props([
    { name: "trash-2" },
    $$sanitized_props,
    {
      /**
       * @component @name Trash2
       * @description Lucide SVG icon component, renders SVG Element with children.
       *
       * @preview ![img](data:image/svg+xml;base64,PHN2ZyAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogIHdpZHRoPSIyNCIKICBoZWlnaHQ9IjI0IgogIHZpZXdCb3g9IjAgMCAyNCAyNCIKICBmaWxsPSJub25lIgogIHN0cm9rZT0iIzAwMCIgc3R5bGU9ImJhY2tncm91bmQtY29sb3I6ICNmZmY7IGJvcmRlci1yYWRpdXM6IDJweCIKICBzdHJva2Utd2lkdGg9IjIiCiAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogIHN0cm9rZS1saW5lam9pbj0icm91bmQiCj4KICA8cGF0aCBkPSJNMyA2aDE4IiAvPgogIDxwYXRoIGQ9Ik0xOSA2djE0YzAgMS0xIDItMiAySDdjLTEgMC0yLTEtMi0yVjYiIC8+CiAgPHBhdGggZD0iTTggNlY0YzAtMSAxLTIgMi0yaDRjMSAwIDIgMSAyIDJ2MiIgLz4KICA8bGluZSB4MT0iMTAiIHgyPSIxMCIgeTE9IjExIiB5Mj0iMTciIC8+CiAgPGxpbmUgeDE9IjE0IiB4Mj0iMTQiIHkxPSIxMSIgeTI9IjE3IiAvPgo8L3N2Zz4K) - https://lucide.dev/icons/trash-2
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
    let companyName = "";
    let companyDescription = "";
    let companyId = derived(() => companyStore.selectedCompany?.id);
    let logoUploading = false;
    let logoPreview = derived(() => companyStore.selectedCompany?.logoUrl);
    let brandColor = "#3B82F6";
    let savingBrandColor = false;
    let requireBoardApproval = false;
    let savingHiring = false;
    let inviteUrl = derived(() => companyId() ? `${typeof window !== "undefined" ? window.location.origin : ""}/invite?company=${companyId()}` : "");
    $$renderer2.push(`<div class="mx-auto max-w-3xl space-y-8 p-6"><div><h1 class="text-2xl font-bold text-[#F8FAFC]">Company Settings</h1> <p class="mt-1 text-sm text-[#94A3B8]">Manage your company configuration</p></div> <section class="rounded-xl border border-white/[0.08] bg-[#121218] overflow-hidden"><div class="flex items-center gap-3 px-5 py-4 border-b border-white/[0.05]"><div class="rounded-lg bg-blue-500/10 p-2">`);
    Building_2($$renderer2, { class: "h-4 w-4 text-blue-400" });
    $$renderer2.push(`<!----></div> <div><h2 class="text-sm font-semibold text-[#F8FAFC]">General</h2> <p class="text-xs text-[#94A3B8]">Basic company information</p></div></div> <div class="p-5 space-y-4"><div><label for="company-name" class="block text-sm font-medium text-[#F8FAFC] mb-1">Company Name</label> <input id="company-name"${attr("value", companyName)} class="w-full rounded-lg border border-white/[0.08] bg-white/[0.05] px-4 py-2 text-sm text-[#F8FAFC] placeholder-[#94A3B8] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"/></div> <div><label for="company-description" class="block text-sm font-medium text-[#F8FAFC] mb-1">Description</label> <textarea id="company-description" rows="3" placeholder="What does this company do?" class="w-full rounded-lg border border-white/[0.08] bg-white/[0.05] px-4 py-2 text-sm text-[#F8FAFC] placeholder-[#94A3B8] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y">`);
    const $$body = escape_html(companyDescription);
    if ($$body) {
      $$renderer2.push(`${$$body}`);
    }
    $$renderer2.push(`</textarea></div> `);
    if (companyId()) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div><span class="block text-sm font-medium text-[#F8FAFC] mb-1">Company ID</span> <div class="rounded-lg border border-white/[0.08] bg-white/[0.02] px-4 py-2 text-sm text-[#94A3B8] font-mono select-all">${escape_html(companyId())}</div></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="flex items-center gap-3 pt-2"><button${attr("disabled", !companyName.trim(), true)} class="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50">`);
    Save($$renderer2, { class: "h-4 w-4" });
    $$renderer2.push(`<!----> ${escape_html("Save Changes")}</button> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div></div></section> <section class="rounded-xl border border-white/[0.08] bg-[#121218] overflow-hidden"><div class="flex items-center gap-3 px-5 py-4 border-b border-white/[0.05]"><div class="rounded-lg bg-purple-500/10 p-2">`);
    Palette($$renderer2, { class: "h-4 w-4 text-purple-400" });
    $$renderer2.push(`<!----></div> <div><h2 class="text-sm font-semibold text-[#F8FAFC]">Appearance</h2> <p class="text-xs text-[#94A3B8]">Customize how your workspace looks</p></div></div> <div class="p-5 space-y-6"><div class="flex items-center justify-between"><div><p class="text-sm font-medium text-[#F8FAFC]">Theme</p> <p class="text-xs text-[#94A3B8]">Switch between light and dark mode</p></div> <div class="flex items-center gap-1 rounded-lg border border-white/[0.08] p-0.5"><button class="rounded-md px-3 py-1.5 text-xs font-medium transition-colors bg-white/[0.1] text-[#F8FAFC]">Dark</button> <button class="rounded-md px-3 py-1.5 text-xs font-medium transition-colors text-[#94A3B8] hover:text-[#F8FAFC]">Light</button></div></div> <div class="space-y-3"><div><p class="text-sm font-medium text-[#F8FAFC]">Company Logo</p> <p class="text-xs text-[#94A3B8]">PNG, JPEG, WebP, or SVG. Max 2 MB.</p></div> <div class="flex items-center gap-4">`);
    if (logoPreview()) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="relative h-16 w-16 shrink-0 rounded-lg border border-white/[0.08] bg-white/[0.03] overflow-hidden"><img${attr("src", logoPreview())} alt="Company logo" class="h-full w-full object-contain"/></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<div class="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-dashed border-white/[0.12] bg-white/[0.02]">`);
      Image($$renderer2, { class: "h-6 w-6 text-[#94A3B8]" });
      $$renderer2.push(`<!----></div>`);
    }
    $$renderer2.push(`<!--]--> <div class="flex items-center gap-2"><input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" class="hidden" id="logo-upload"/> <button${attr("disabled", logoUploading, true)} class="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] px-3 py-2 text-sm font-medium text-[#F8FAFC] transition-colors hover:bg-white/[0.05] disabled:opacity-50">`);
    Upload($$renderer2, { class: "h-4 w-4" });
    $$renderer2.push(`<!----> ${escape_html("Upload Logo")}</button> `);
    if (logoPreview()) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<button${attr("disabled", logoUploading, true)} class="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] px-3 py-2 text-sm font-medium text-[#94A3B8] transition-colors hover:bg-white/[0.05] hover:text-red-400 disabled:opacity-50">`);
      X($$renderer2, { class: "h-4 w-4" });
      $$renderer2.push(`<!----> Clear</button>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div></div></div> <div class="space-y-3"><div><p class="text-sm font-medium text-[#F8FAFC]">Brand Color</p> <p class="text-xs text-[#94A3B8]">Used as the accent color across your workspace</p></div> <div class="flex items-center gap-3"><div class="h-10 w-10 shrink-0 rounded-lg border border-white/[0.12] cursor-pointer relative overflow-hidden"${attr_style(`background-color: ${stringify(brandColor)};`)}><input type="color"${attr("value", brandColor)} class="absolute inset-0 h-full w-full cursor-pointer opacity-0"/></div> <input type="text"${attr("value", brandColor)} maxlength="7" placeholder="#3B82F6" class="w-28 rounded-lg border border-white/[0.08] bg-white/[0.05] px-3 py-2 text-sm text-[#F8FAFC] font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"/> <button${attr("disabled", savingBrandColor, true)} class="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50">`);
    Save($$renderer2, { class: "h-4 w-4" });
    $$renderer2.push(`<!----> ${escape_html("Save")}</button> <button${attr("disabled", savingBrandColor, true)} class="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-3 py-2 text-sm text-[#94A3B8] transition-colors hover:bg-white/[0.05] disabled:opacity-50">`);
    X($$renderer2, { class: "h-3.5 w-3.5" });
    $$renderer2.push(`<!----> Reset</button></div></div></div></section> <section class="rounded-xl border border-white/[0.08] bg-[#121218] overflow-hidden"><div class="flex items-center gap-3 px-5 py-4 border-b border-white/[0.05]"><div class="rounded-lg bg-emerald-500/10 p-2">`);
    Users($$renderer2, { class: "h-4 w-4 text-emerald-400" });
    $$renderer2.push(`<!----></div> <div><h2 class="text-sm font-semibold text-[#F8FAFC]">Hiring &amp; Access</h2> <p class="text-xs text-[#94A3B8]">Control how agents join and access is managed</p></div></div> <div class="p-5 space-y-5"><div class="flex items-center justify-between"><div class="pr-4"><p class="text-sm font-medium text-[#F8FAFC]">Require board approval for new agent hires</p> <p class="text-xs text-[#94A3B8]">When enabled, new agents must be approved before they can operate</p></div> <button role="switch"${attr("aria-checked", requireBoardApproval)}${attr_class(`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-[#121218] ${stringify("bg-white/[0.1]")}`)}><span${attr_class(`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg transform transition-transform duration-200 ${stringify("translate-x-0")}`)}></span></button></div> <div class="flex items-center gap-3"><button${attr("disabled", savingHiring, true)} class="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50">`);
    Save($$renderer2, { class: "h-4 w-4" });
    $$renderer2.push(`<!----> ${escape_html("Save Hiring Settings")}</button></div> `);
    if (inviteUrl()) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="pt-2 border-t border-white/[0.05]"><p class="text-sm font-medium text-[#F8FAFC] mb-1">Company Invite URL</p> <p class="text-xs text-[#94A3B8] mb-2">Share this link to invite people to your company</p> <div class="flex items-center gap-2"><div class="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-xs text-[#94A3B8] font-mono truncate select-all">${escape_html(inviteUrl())}</div> <button class="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-3 py-2 text-sm text-[#94A3B8] transition-colors hover:bg-white/[0.05] hover:text-[#F8FAFC]">`);
      {
        $$renderer2.push("<!--[-1-->");
        Copy($$renderer2, { class: "h-4 w-4" });
        $$renderer2.push(`<!----> <span class="text-xs">Copy</span>`);
      }
      $$renderer2.push(`<!--]--></button></div></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div></section> <section class="rounded-xl border border-red-500/20 bg-[#121218] overflow-hidden"><div class="flex items-center gap-3 px-5 py-4 border-b border-red-500/10"><div class="rounded-lg bg-red-500/10 p-2">`);
    Triangle_alert($$renderer2, { class: "h-4 w-4 text-red-400" });
    $$renderer2.push(`<!----></div> <div><h2 class="text-sm font-semibold text-red-400">Danger Zone</h2> <p class="text-xs text-[#94A3B8]">Irreversible and destructive actions</p></div></div> <div class="p-5 space-y-4">`);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="flex items-center justify-between"><div><p class="text-sm font-medium text-[#F8FAFC]">Archive this company</p> <p class="text-xs text-[#94A3B8]">Deactivates the company and hides it from the dashboard. Data is preserved.</p></div> <button class="inline-flex items-center gap-2 rounded-lg border border-amber-500/30 px-4 py-2 text-sm font-medium text-amber-400 transition-colors hover:bg-amber-500/10">`);
      Archive($$renderer2, { class: "h-4 w-4" });
      $$renderer2.push(`<!----> Archive Company</button></div>`);
    }
    $$renderer2.push(`<!--]--> <div class="border-t border-red-500/10"></div> `);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="flex items-center justify-between"><div><p class="text-sm font-medium text-[#F8FAFC]">Delete this company</p> <p class="text-xs text-[#94A3B8]">Once deleted, all data will be permanently removed</p></div> <button class="inline-flex items-center gap-2 rounded-lg border border-red-500/30 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10">`);
      Trash_2($$renderer2, { class: "h-4 w-4" });
      $$renderer2.push(`<!----> Delete Company</button></div>`);
    }
    $$renderer2.push(`<!--]--></div></section></div>`);
  });
}
export {
  _page as default
};
