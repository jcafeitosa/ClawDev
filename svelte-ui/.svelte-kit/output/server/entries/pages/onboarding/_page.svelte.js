import { a as sanitize_props, b as spread_props, c as slot, d as attr_class, i as ensure_array_like, o as stringify, e as escape_html, j as attr, h as attr_style } from "../../../chunks/index.js";
import "@sveltejs/kit/internal";
import "../../../chunks/exports.js";
import "../../../chunks/utils2.js";
import "@sveltejs/kit/internal/server";
import "../../../chunks/root.js";
import "../../../chunks/state.svelte.js";
import "../../../chunks/client.js";
import "../../../chunks/company.svelte.js";
import { X } from "../../../chunks/x.js";
import { B as Building_2 } from "../../../chunks/building-2.js";
import { A as Arrow_right } from "../../../chunks/arrow-right.js";
import { I as Icon } from "../../../chunks/Icon.js";
import { B as Bot } from "../../../chunks/bot.js";
import { L as List_todo } from "../../../chunks/list-todo.js";
import { R as Rocket } from "../../../chunks/rocket.js";
function Sparkles($$renderer, $$props) {
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
        "d": "M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"
      }
    ],
    ["path", { "d": "M20 3v4" }],
    ["path", { "d": "M22 5h-4" }],
    ["path", { "d": "M4 17v2" }],
    ["path", { "d": "M5 18H3" }]
  ];
  Icon($$renderer, spread_props([
    { name: "sparkles" },
    $$sanitized_props,
    {
      /**
       * @component @name Sparkles
       * @description Lucide SVG icon component, renders SVG Element with children.
       *
       * @preview ![img](data:image/svg+xml;base64,PHN2ZyAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogIHdpZHRoPSIyNCIKICBoZWlnaHQ9IjI0IgogIHZpZXdCb3g9IjAgMCAyNCAyNCIKICBmaWxsPSJub25lIgogIHN0cm9rZT0iIzAwMCIgc3R5bGU9ImJhY2tncm91bmQtY29sb3I6ICNmZmY7IGJvcmRlci1yYWRpdXM6IDJweCIKICBzdHJva2Utd2lkdGg9IjIiCiAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogIHN0cm9rZS1saW5lam9pbj0icm91bmQiCj4KICA8cGF0aCBkPSJNOS45MzcgMTUuNUEyIDIgMCAwIDAgOC41IDE0LjA2M2wtNi4xMzUtMS41ODJhLjUuNSAwIDAgMSAwLS45NjJMOC41IDkuOTM2QTIgMiAwIDAgMCA5LjkzNyA4LjVsMS41ODItNi4xMzVhLjUuNSAwIDAgMSAuOTYzIDBMMTQuMDYzIDguNUEyIDIgMCAwIDAgMTUuNSA5LjkzN2w2LjEzNSAxLjU4MWEuNS41IDAgMCAxIDAgLjk2NEwxNS41IDE0LjA2M2EyIDIgMCAwIDAtMS40MzcgMS40MzdsLTEuNTgyIDYuMTM1YS41LjUgMCAwIDEtLjk2MyAweiIgLz4KICA8cGF0aCBkPSJNMjAgM3Y0IiAvPgogIDxwYXRoIGQ9Ik0yMiA1aC00IiAvPgogIDxwYXRoIGQ9Ik00IDE3djIiIC8+CiAgPHBhdGggZD0iTTUgMThIMyIgLz4KPC9zdmc+Cg==) - https://lucide.dev/icons/sparkles
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
    let step = 1;
    let loading = false;
    let companyName = "";
    let companyGoal = "";
    const stepTabs = [
      { step: 1, label: "Company", icon: Building_2 },
      { step: 2, label: "Agent", icon: Bot },
      { step: 3, label: "Task", icon: List_todo },
      { step: 4, label: "Launch", icon: Rocket }
    ];
    $$renderer2.push(`<div class="fixed inset-0 z-50 flex bg-white svelte-fpvdp2"><button class="absolute top-4 left-4 z-10 rounded-sm p-1.5 text-gray-400 hover:text-gray-900 transition-colors cursor-pointer svelte-fpvdp2">`);
    X($$renderer2, { class: "h-5 w-5" });
    $$renderer2.push(`<!----> <span class="sr-only svelte-fpvdp2">Close</span></button> <div${attr_class(`w-full flex flex-col overflow-y-auto transition-[width] duration-500 ease-in-out ${stringify("md:w-1/2")}`, "svelte-fpvdp2")}><div class="w-full max-w-md mx-auto my-auto px-8 py-12 shrink-0 svelte-fpvdp2"><div class="flex items-center gap-0 mb-8 border-b border-gray-200 svelte-fpvdp2"><!--[-->`);
    const each_array = ensure_array_like(stepTabs);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let tab = each_array[$$index];
      $$renderer2.push(`<button type="button"${attr_class(
        `flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors cursor-pointer ${stringify(tab.step === step ? "border-gray-900 text-gray-900" : "border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-300")}`,
        "svelte-fpvdp2"
      )}>`);
      if (tab.icon) {
        $$renderer2.push("<!--[-->");
        tab.icon($$renderer2, { class: "h-3.5 w-3.5" });
        $$renderer2.push("<!--]-->");
      } else {
        $$renderer2.push("<!--[!-->");
        $$renderer2.push("<!--]-->");
      }
      $$renderer2.push(` ${escape_html(tab.label)}</button>`);
    }
    $$renderer2.push(`<!--]--></div> `);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="space-y-5 svelte-fpvdp2"><div class="flex items-center gap-3 mb-1 svelte-fpvdp2"><div class="bg-gray-100 p-2 rounded svelte-fpvdp2">`);
      Building_2($$renderer2, { class: "h-5 w-5 text-gray-500" });
      $$renderer2.push(`<!----></div> <div class="svelte-fpvdp2"><h3 class="font-medium text-gray-900 svelte-fpvdp2">Name your company</h3> <p class="text-xs text-gray-500 svelte-fpvdp2">This is the organization your agents will work for.</p></div></div> <div class="mt-3 group svelte-fpvdp2"><label${attr_class(
        `text-xs mb-1 block transition-colors ${stringify(companyName.trim() ? "text-gray-900" : "text-gray-400 group-focus-within:text-gray-900")}`,
        "svelte-fpvdp2"
      )}>Company name</label> <input class="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gray-400 placeholder:text-gray-300 text-gray-900 svelte-fpvdp2" placeholder="Acme Corp"${attr("value", companyName)} autofocus=""/></div> <div class="group svelte-fpvdp2"><label${attr_class(
        `text-xs mb-1 block transition-colors ${stringify(companyGoal.trim() ? "text-gray-900" : "text-gray-400 group-focus-within:text-gray-900")}`,
        "svelte-fpvdp2"
      )}>Mission / goal (optional)</label> <textarea class="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gray-400 placeholder:text-gray-300 resize-none min-h-[60px] text-gray-900 svelte-fpvdp2" placeholder="What is this company trying to achieve?">`);
      const $$body = escape_html(companyGoal);
      if ($$body) {
        $$renderer2.push(`${$$body}`);
      }
      $$renderer2.push(`</textarea></div></div>`);
    }
    $$renderer2.push(`<!--]--> `);
    {
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
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="flex items-center justify-between mt-8 svelte-fpvdp2"><div class="svelte-fpvdp2">`);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> <div class="flex items-center gap-2 svelte-fpvdp2">`);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<button class="inline-flex items-center gap-1 px-4 py-1.5 text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer svelte-fpvdp2"${attr("disabled", !companyName.trim() || loading, true)}>`);
      {
        $$renderer2.push("<!--[-1-->");
        Arrow_right($$renderer2, { class: "h-3.5 w-3.5" });
        $$renderer2.push(`<!----> Next`);
      }
      $$renderer2.push(`<!--]--></button>`);
    }
    $$renderer2.push(`<!--]--> `);
    {
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
    $$renderer2.push(`<!--]--></div></div></div></div> <div${attr_class(`hidden md:flex overflow-hidden transition-[width,opacity] duration-500 ease-in-out items-center justify-center ${stringify("w-1/2 opacity-100")}`, "svelte-fpvdp2")} style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);"><div class="relative w-full h-full flex items-center justify-center overflow-hidden svelte-fpvdp2"><div class="absolute inset-0 opacity-20 svelte-fpvdp2" style="background-image: radial-gradient(circle, rgba(255,255,255,0.15) 1px, transparent 1px); background-size: 20px 20px;"></div> <div class="relative z-10 text-center px-8 svelte-fpvdp2"><div class="flex items-center justify-center mb-4 svelte-fpvdp2"><div class="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/10 svelte-fpvdp2">`);
    Sparkles($$renderer2, { class: "h-8 w-8 text-white/80" });
    $$renderer2.push(`<!----></div></div> <h2 class="text-2xl font-semibold text-white/90 mb-2 svelte-fpvdp2">Welcome to ClawDev</h2> <p class="text-sm text-white/50 max-w-xs mx-auto leading-relaxed svelte-fpvdp2">Set up your AI-powered engineering organization in under a minute. Create a company, assign
          an agent, and watch it work.</p> <div class="flex items-center justify-center gap-2 mt-8 svelte-fpvdp2"><!--[-->`);
    const each_array_6 = ensure_array_like(Array(4));
    for (let i = 0, $$length = each_array_6.length; i < $$length; i++) {
      each_array_6[i];
      $$renderer2.push(`<div class="w-2 h-2 rounded-full bg-white/30 svelte-fpvdp2"${attr_style(`animation: pulse 2s ease-in-out ${stringify(i * 0.3)}s infinite;`)}></div>`);
    }
    $$renderer2.push(`<!--]--></div></div></div></div></div> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
  });
}
export {
  _page as default
};
