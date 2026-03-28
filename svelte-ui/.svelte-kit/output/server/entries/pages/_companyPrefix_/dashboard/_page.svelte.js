import { a as sanitize_props, b as spread_props, c as slot, i as ensure_array_like, e as escape_html, j as attr, o as stringify, m as derived, k as store_get, l as unsubscribe_stores } from "../../../../chunks/index.js";
import { p as page } from "../../../../chunks/stores.js";
import { c as companyStore } from "../../../../chunks/company.svelte.js";
import "../../../../chunks/client.js";
import { LineChart, PieChart, BarChart } from "echarts/charts";
import { GridComponent, TooltipComponent, LegendComponent, TitleComponent } from "echarts/components";
import * as echarts from "echarts/core";
import "clsx";
import { o as onDestroy } from "../../../../chunks/index-server.js";
import "../../../../chunks/badge.js";
import { S as Skeleton } from "../../../../chunks/skeleton.js";
import { L as List_todo } from "../../../../chunks/list-todo.js";
import { B as Bot } from "../../../../chunks/bot.js";
import { I as Icon } from "../../../../chunks/Icon.js";
import { T as Trending_up } from "../../../../chunks/trending-up.js";
import { S as Shield_check } from "../../../../chunks/shield-check.js";
import { T as Triangle_alert } from "../../../../chunks/triangle-alert.js";
import { P as Plus } from "../../../../chunks/plus.js";
import { A as Arrow_right } from "../../../../chunks/arrow-right.js";
import { A as Activity } from "../../../../chunks/activity.js";
function Wallet($$renderer, $$props) {
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
        "d": "M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"
      }
    ],
    ["path", { "d": "M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" }]
  ];
  Icon($$renderer, spread_props([
    { name: "wallet" },
    $$sanitized_props,
    {
      /**
       * @component @name Wallet
       * @description Lucide SVG icon component, renders SVG Element with children.
       *
       * @preview ![img](data:image/svg+xml;base64,PHN2ZyAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogIHdpZHRoPSIyNCIKICBoZWlnaHQ9IjI0IgogIHZpZXdCb3g9IjAgMCAyNCAyNCIKICBmaWxsPSJub25lIgogIHN0cm9rZT0iIzAwMCIgc3R5bGU9ImJhY2tncm91bmQtY29sb3I6ICNmZmY7IGJvcmRlci1yYWRpdXM6IDJweCIKICBzdHJva2Utd2lkdGg9IjIiCiAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogIHN0cm9rZS1saW5lam9pbj0icm91bmQiCj4KICA8cGF0aCBkPSJNMTkgN1Y0YTEgMSAwIDAgMC0xLTFINWEyIDIgMCAwIDAgMCA0aDE1YTEgMSAwIDAgMSAxIDF2NGgtM2EyIDIgMCAwIDAgMCA0aDNhMSAxIDAgMCAwIDEtMXYtMmExIDEgMCAwIDAtMS0xIiAvPgogIDxwYXRoIGQ9Ik0zIDV2MTRhMiAyIDAgMCAwIDIgMmgxNWExIDEgMCAwIDAgMS0xdi00IiAvPgo8L3N2Zz4K) - https://lucide.dev/icons/wallet
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
function Active_agents_panel($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    onDestroy(() => {
    });
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
  });
}
function Activity_charts($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    echarts.use([
      LineChart,
      PieChart,
      BarChart,
      GridComponent,
      TooltipComponent,
      LegendComponent,
      TitleComponent
    ]);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="grid grid-cols-1 gap-4 md:grid-cols-2"><!--[-->`);
      const each_array = ensure_array_like(Array(4));
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        each_array[$$index];
        $$renderer2.push(`<div class="rounded-xl border border-white/[0.08] bg-[#121218] p-4"><div class="mb-3 h-4 w-28 animate-pulse rounded bg-white/[0.06]"></div> <div class="h-[200px] animate-pulse rounded-lg bg-white/[0.03]"></div></div>`);
      }
      $$renderer2.push(`<!--]--></div>`);
    }
    $$renderer2.push(`<!--]-->`);
  });
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let budgetIncidents = [];
    let companyId = derived(() => companyStore.selectedCompany?.id);
    let companyName = derived(() => companyStore.selectedCompany?.name ?? "Company");
    let pendingIncidents = derived(() => budgetIncidents.filter((inc) => inc.status === "pending"));
    let badgeCounts = {};
    const prefix = derived(() => store_get($$store_subs ??= {}, "$page", page).params.companyPrefix);
    $$renderer2.push(`<div class="dashboard-root min-h-screen space-y-6 p-6 svelte-xc9lkb"><div class="flex items-end justify-between"><div><h1 class="text-xs font-semibold uppercase tracking-widest text-[--dash-muted]">Dashboard</h1> <p class="mt-1 text-lg font-bold text-[--dash-text]">${escape_html(companyName())}</p></div></div> `);
    if (companyId()) {
      $$renderer2.push("<!--[0-->");
      Active_agents_panel($$renderer2, { companyId: companyId() ?? "", prefix: prefix() });
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4"><div class="dash-card group svelte-xc9lkb"><div class="flex items-center justify-between"><div class="flex items-center gap-2"><div class="flex h-7 w-7 items-center justify-center rounded-lg bg-[--dash-primary]/10">`);
    List_todo($$renderer2, { size: 14, color: "var(--dash-primary)" });
    $$renderer2.push(`<!----></div> <h3 class="text-xs font-semibold uppercase tracking-wider text-[--dash-muted]">Tasks In Progress</h3></div> <a${attr("href", `/${stringify(prefix())}/issues`)} class="opacity-0 transition-opacity group-hover:opacity-60 text-xs text-[--dash-muted] hover:text-[--dash-text]">View all</a></div> `);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="mt-4 space-y-3">`);
      Skeleton($$renderer2, { class: "h-8 w-16 bg-white/5" });
      $$renderer2.push(`<!----> `);
      Skeleton($$renderer2, { class: "h-3 w-full bg-white/5" });
      $$renderer2.push(`<!----> <div class="flex gap-4">`);
      Skeleton($$renderer2, { class: "h-3 w-20 bg-white/5" });
      $$renderer2.push(`<!----> `);
      Skeleton($$renderer2, { class: "h-3 w-20 bg-white/5" });
      $$renderer2.push(`<!----></div></div>`);
    }
    $$renderer2.push(`<!--]--></div> <div class="dash-card group svelte-xc9lkb"><div class="flex items-center justify-between"><div class="flex items-center gap-2"><div class="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10">`);
    Bot($$renderer2, { size: 14, color: "#10b981" });
    $$renderer2.push(`<!----></div> <h3 class="text-xs font-semibold uppercase tracking-wider text-[--dash-muted]">Agents Enabled</h3></div> <a${attr("href", `/${stringify(prefix())}/agents`)} class="opacity-0 transition-opacity group-hover:opacity-60 text-xs text-[--dash-muted] hover:text-[--dash-text]">View all</a></div> `);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="mt-4 space-y-3">`);
      Skeleton($$renderer2, { class: "h-8 w-16 bg-white/5" });
      $$renderer2.push(`<!----> `);
      Skeleton($$renderer2, { class: "h-3 w-24 bg-white/5" });
      $$renderer2.push(`<!----> <div class="flex gap-2"><!--[-->`);
      const each_array_2 = ensure_array_like(Array(4));
      for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
        each_array_2[$$index_2];
        Skeleton($$renderer2, { class: "h-3 w-3 rounded-full bg-white/5" });
      }
      $$renderer2.push(`<!--]--></div></div>`);
    }
    $$renderer2.push(`<!--]--></div> <div class="dash-card group svelte-xc9lkb"><div class="flex items-center justify-between"><div class="flex items-center gap-2"><div class="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10">`);
    Wallet($$renderer2, { size: 14, color: "#f59e0b" });
    $$renderer2.push(`<!----></div> <h3 class="text-xs font-semibold uppercase tracking-wider text-[--dash-muted]">Month Spend</h3></div> <button class="opacity-0 transition-opacity group-hover:opacity-60">`);
    Trending_up($$renderer2, { size: 12, color: "var(--dash-muted)" });
    $$renderer2.push(`<!----></button></div> `);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="mt-4 space-y-3">`);
      Skeleton($$renderer2, { class: "h-8 w-24 bg-white/5" });
      $$renderer2.push(`<!----> `);
      Skeleton($$renderer2, { class: "h-2.5 w-full bg-white/5" });
      $$renderer2.push(`<!----> `);
      Skeleton($$renderer2, { class: "h-3 w-32 bg-white/5" });
      $$renderer2.push(`<!----></div>`);
    }
    $$renderer2.push(`<!--]--></div> <div class="dash-card group svelte-xc9lkb"><div class="flex items-center justify-between"><div class="flex items-center gap-2"><div class="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/10">`);
    Shield_check($$renderer2, { size: 14, color: "#8b5cf6" });
    $$renderer2.push(`<!----></div> <h3 class="text-xs font-semibold uppercase tracking-wider text-[--dash-muted]">Pending Approvals</h3></div> <a${attr("href", `/${stringify(prefix())}/approvals`)} class="opacity-0 transition-opacity group-hover:opacity-60 text-xs text-[--dash-muted] hover:text-[--dash-text]">View all</a></div> `);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="mt-4 space-y-3">`);
      Skeleton($$renderer2, { class: "h-8 w-16 bg-white/5" });
      $$renderer2.push(`<!----> `);
      Skeleton($$renderer2, { class: "h-3 w-24 bg-white/5" });
      $$renderer2.push(`<!----></div>`);
    }
    $$renderer2.push(`<!--]--></div></div> `);
    if (pendingIncidents().length > 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="relative overflow-hidden rounded-xl border border-red-500/30 bg-red-500/[0.08] px-5 py-4"><div class="flex items-start gap-4"><div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-500/20">`);
      Triangle_alert($$renderer2, { size: 20, color: "#ef4444" });
      $$renderer2.push(`<!----></div> <div class="min-w-0 flex-1"><div class="flex items-center gap-2"><h3 class="text-sm font-semibold text-red-400">Budget Hard Stop Active</h3> `);
      if (pendingIncidents().length > 1) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<span class="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">${escape_html(pendingIncidents().length)}</span>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div> `);
      if (pendingIncidents().length === 1) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<p class="mt-0.5 text-sm text-red-300/80">Agent <span class="font-medium text-red-300">${escape_html(pendingIncidents()[0].agentName ?? pendingIncidents()[0].agent?.name ?? "Unknown")}</span> has been paused — monthly budget exceeded.</p>`);
      } else {
        $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<p class="mt-0.5 text-sm text-red-300/80">${escape_html(pendingIncidents().length)} agents have been paused — monthly budgets exceeded.</p>`);
      }
      $$renderer2.push(`<!--]--></div> <a${attr("href", `/${stringify(prefix())}/budgets`)} class="shrink-0 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/20">Resolve</a></div></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="grid grid-cols-1 gap-3 sm:grid-cols-3"><a${attr("href", `/${stringify(prefix())}/issues?new=true`)} class="dash-card group/qa flex items-center gap-3 !py-3.5 transition-all hover:border-blue-500/30 svelte-xc9lkb"><div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[--dash-primary]/10">`);
    Plus($$renderer2, { size: 16, color: "var(--dash-primary)" });
    $$renderer2.push(`<!----></div> <div class="min-w-0 flex-1"><p class="text-sm font-medium text-[--dash-text]">New Issue</p> <p class="text-xs text-[--dash-muted]">Create a task or bug report</p></div> `);
    Arrow_right($$renderer2, {
      size: 14,
      class: "text-[--dash-muted] opacity-0 transition-opacity group-hover/qa:opacity-100"
    });
    $$renderer2.push(`<!----></a> <a${attr("href", `/${stringify(prefix())}/agents/new`)} class="dash-card group/qa flex items-center gap-3 !py-3.5 transition-all hover:border-emerald-500/30 svelte-xc9lkb"><div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">`);
    Bot($$renderer2, { size: 16, color: "#10b981" });
    $$renderer2.push(`<!----></div> <div class="min-w-0 flex-1"><p class="text-sm font-medium text-[--dash-text]">New Agent</p> <p class="text-xs text-[--dash-muted]">Register an AI agent</p></div> `);
    Arrow_right($$renderer2, {
      size: 14,
      class: "text-[--dash-muted] opacity-0 transition-opacity group-hover/qa:opacity-100"
    });
    $$renderer2.push(`<!----></a> <a${attr("href", `/${stringify(prefix())}/activity`)} class="dash-card group/qa flex items-center gap-3 !py-3.5 transition-all hover:border-amber-500/30 svelte-xc9lkb"><div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">`);
    Activity($$renderer2, { size: 16, color: "#f59e0b" });
    $$renderer2.push(`<!----></div> <div class="min-w-0 flex-1"><p class="text-sm font-medium text-[--dash-text]">View Activity</p> <p class="text-xs text-[--dash-muted]">`);
    if (badgeCounts.activity) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`${escape_html(badgeCounts.activity)} new events`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`Recent team activity`);
    }
    $$renderer2.push(`<!--]--></p></div> `);
    Arrow_right($$renderer2, {
      size: 14,
      class: "text-[--dash-muted] opacity-0 transition-opacity group-hover/qa:opacity-100"
    });
    $$renderer2.push(`<!----></a></div> `);
    if (companyId()) {
      $$renderer2.push("<!--[0-->");
      Activity_charts($$renderer2, { companyId: companyId() });
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="grid grid-cols-1 gap-4 lg:grid-cols-2"><div class="dash-card !p-0 svelte-xc9lkb"><div class="flex items-center justify-between border-b px-5 py-4" style="border-color: rgba(255,255,255,0.08);"><div class="flex items-center gap-2">`);
    Activity($$renderer2, { size: 14, color: "var(--dash-primary)" });
    $$renderer2.push(`<!----> <h3 class="text-xs font-semibold uppercase tracking-wider text-[--dash-muted]">Recent Activity</h3></div> <a${attr("href", `/${stringify(prefix())}/activity`)} class="text-[11px] font-medium text-[--dash-primary] hover:underline">View all</a></div> <div class="px-5 py-3">`);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="space-y-3 py-2"><!--[-->`);
      const each_array_4 = ensure_array_like(Array(5));
      for (let $$index_4 = 0, $$length = each_array_4.length; $$index_4 < $$length; $$index_4++) {
        each_array_4[$$index_4];
        $$renderer2.push(`<div class="flex items-center gap-3">`);
        Skeleton($$renderer2, { class: "h-7 w-7 shrink-0 rounded-full bg-white/5" });
        $$renderer2.push(`<!----> <div class="flex-1 space-y-1.5">`);
        Skeleton($$renderer2, { class: "h-3 w-3/4 bg-white/5" });
        $$renderer2.push(`<!----> `);
        Skeleton($$renderer2, { class: "h-2 w-1/4 bg-white/5" });
        $$renderer2.push(`<!----></div></div>`);
      }
      $$renderer2.push(`<!--]--></div>`);
    }
    $$renderer2.push(`<!--]--></div></div> <div class="dash-card !p-0 svelte-xc9lkb"><div class="flex items-center justify-between border-b px-5 py-4" style="border-color: rgba(255,255,255,0.08);"><div class="flex items-center gap-2">`);
    List_todo($$renderer2, { size: 14, color: "var(--dash-primary)" });
    $$renderer2.push(`<!----> <h3 class="text-xs font-semibold uppercase tracking-wider text-[--dash-muted]">Recent Tasks</h3></div> <a${attr("href", `/${stringify(prefix())}/issues`)} class="text-[11px] font-medium text-[--dash-primary] hover:underline">View all</a></div> <div class="px-5 py-3">`);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="space-y-3 py-2"><!--[-->`);
      const each_array_6 = ensure_array_like(Array(5));
      for (let $$index_6 = 0, $$length = each_array_6.length; $$index_6 < $$length; $$index_6++) {
        each_array_6[$$index_6];
        $$renderer2.push(`<div class="flex items-center gap-3">`);
        Skeleton($$renderer2, { class: "h-2.5 w-2.5 shrink-0 rounded-full bg-white/5" });
        $$renderer2.push(`<!----> `);
        Skeleton($$renderer2, { class: "h-3 w-16 bg-white/5" });
        $$renderer2.push(`<!----> <div class="flex-1">`);
        Skeleton($$renderer2, { class: "h-3 w-3/4 bg-white/5" });
        $$renderer2.push(`<!----></div></div>`);
      }
      $$renderer2.push(`<!--]--></div>`);
    }
    $$renderer2.push(`<!--]--></div></div></div></div>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
export {
  _page as default
};
