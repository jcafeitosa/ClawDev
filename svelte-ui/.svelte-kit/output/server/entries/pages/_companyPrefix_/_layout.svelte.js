import { a as sanitize_props, b as spread_props, c as slot, d as attr_class, f as clsx, h as attr_style, e as escape_html, i as ensure_array_like, j as attr, k as store_get, l as unsubscribe_stores, m as derived, o as stringify } from "../../../chunks/index.js";
import { p as page } from "../../../chunks/stores.js";
import "@sveltejs/kit/internal";
import "../../../chunks/exports.js";
import "../../../chunks/utils2.js";
import "@sveltejs/kit/internal/server";
import "../../../chunks/root.js";
import "../../../chunks/state.svelte.js";
import "clsx";
import { c as companyStore } from "../../../chunks/company.svelte.js";
import "../../../chunks/client.js";
import { c as cn } from "../../../chunks/cn.js";
import { L as Layout_dashboard, D as Dollar_sign } from "../../../chunks/layout-dashboard.js";
import { I as Icon } from "../../../chunks/Icon.js";
import { L as List_todo } from "../../../chunks/list-todo.js";
import { T as Target, S as Settings } from "../../../chunks/target.js";
import { S as Shield_check } from "../../../chunks/shield-check.js";
import { B as Building_2 } from "../../../chunks/building-2.js";
import { A as Activity } from "../../../chunks/activity.js";
import { C as Chevron_down } from "../../../chunks/chevron-down.js";
import { S as Search } from "../../../chunks/search.js";
import { X } from "../../../chunks/x.js";
import { P as Plus } from "../../../chunks/plus.js";
import { t as toastStore } from "../../../chunks/toast.svelte.js";
import { T as Terminal } from "../../../chunks/terminal.js";
import { B as Bot } from "../../../chunks/bot.js";
import { o as onDestroy } from "../../../chunks/index-server.js";
import "../../../chunks/badge.js";
const MOBILE_BREAKPOINT = 768;
function getIsMobile() {
  if (typeof window === "undefined") return false;
  return window.innerWidth < MOBILE_BREAKPOINT;
}
let open = !getIsMobile();
let isMobile = getIsMobile();
const sidebarStore = {
  get open() {
    return open;
  },
  get isMobile() {
    return isMobile;
  }
};
function Book_open($$renderer, $$props) {
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
    ["path", { "d": "M12 7v14" }],
    [
      "path",
      {
        "d": "M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"
      }
    ]
  ];
  Icon($$renderer, spread_props([
    { name: "book-open" },
    $$sanitized_props,
    {
      /**
       * @component @name BookOpen
       * @description Lucide SVG icon component, renders SVG Element with children.
       *
       * @preview ![img](data:image/svg+xml;base64,PHN2ZyAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogIHdpZHRoPSIyNCIKICBoZWlnaHQ9IjI0IgogIHZpZXdCb3g9IjAgMCAyNCAyNCIKICBmaWxsPSJub25lIgogIHN0cm9rZT0iIzAwMCIgc3R5bGU9ImJhY2tncm91bmQtY29sb3I6ICNmZmY7IGJvcmRlci1yYWRpdXM6IDJweCIKICBzdHJva2Utd2lkdGg9IjIiCiAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogIHN0cm9rZS1saW5lam9pbj0icm91bmQiCj4KICA8cGF0aCBkPSJNMTIgN3YxNCIgLz4KICA8cGF0aCBkPSJNMyAxOGExIDEgMCAwIDEtMS0xVjRhMSAxIDAgMCAxIDEtMWg1YTQgNCAwIDAgMSA0IDQgNCA0IDAgMCAxIDQtNGg1YTEgMSAwIDAgMSAxIDF2MTNhMSAxIDAgMCAxLTEgMWgtNmEzIDMgMCAwIDAtMyAzIDMgMyAwIDAgMC0zLTN6IiAvPgo8L3N2Zz4K) - https://lucide.dev/icons/book-open
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
function Box($$renderer, $$props) {
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
        "d": "M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"
      }
    ],
    ["path", { "d": "m3.3 7 8.7 5 8.7-5" }],
    ["path", { "d": "M12 22V12" }]
  ];
  Icon($$renderer, spread_props([
    { name: "box" },
    $$sanitized_props,
    {
      /**
       * @component @name Box
       * @description Lucide SVG icon component, renders SVG Element with children.
       *
       * @preview ![img](data:image/svg+xml;base64,PHN2ZyAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogIHdpZHRoPSIyNCIKICBoZWlnaHQ9IjI0IgogIHZpZXdCb3g9IjAgMCAyNCAyNCIKICBmaWxsPSJub25lIgogIHN0cm9rZT0iIzAwMCIgc3R5bGU9ImJhY2tncm91bmQtY29sb3I6ICNmZmY7IGJvcmRlci1yYWRpdXM6IDJweCIKICBzdHJva2Utd2lkdGg9IjIiCiAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogIHN0cm9rZS1saW5lam9pbj0icm91bmQiCj4KICA8cGF0aCBkPSJNMjEgOGEyIDIgMCAwIDAtMS0xLjczbC03LTRhMiAyIDAgMCAwLTIgMGwtNyA0QTIgMiAwIDAgMCAzIDh2OGEyIDIgMCAwIDAgMSAxLjczbDcgNGEyIDIgMCAwIDAgMiAwbDctNEEyIDIgMCAwIDAgMjEgMTZaIiAvPgogIDxwYXRoIGQ9Im0zLjMgNyA4LjcgNSA4LjctNSIgLz4KICA8cGF0aCBkPSJNMTIgMjJWMTIiIC8+Cjwvc3ZnPgo=) - https://lucide.dev/icons/box
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
function Chevron_right($$renderer, $$props) {
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
  const iconNode = [["path", { "d": "m9 18 6-6-6-6" }]];
  Icon($$renderer, spread_props([
    { name: "chevron-right" },
    $$sanitized_props,
    {
      /**
       * @component @name ChevronRight
       * @description Lucide SVG icon component, renders SVG Element with children.
       *
       * @preview ![img](data:image/svg+xml;base64,PHN2ZyAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogIHdpZHRoPSIyNCIKICBoZWlnaHQ9IjI0IgogIHZpZXdCb3g9IjAgMCAyNCAyNCIKICBmaWxsPSJub25lIgogIHN0cm9rZT0iIzAwMCIgc3R5bGU9ImJhY2tncm91bmQtY29sb3I6ICNmZmY7IGJvcmRlci1yYWRpdXM6IDJweCIKICBzdHJva2Utd2lkdGg9IjIiCiAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogIHN0cm9rZS1saW5lam9pbj0icm91bmQiCj4KICA8cGF0aCBkPSJtOSAxOCA2LTYtNi02IiAvPgo8L3N2Zz4K) - https://lucide.dev/icons/chevron-right
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
function Cog($$renderer, $$props) {
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
    ["path", { "d": "M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z" }],
    ["path", { "d": "M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" }],
    ["path", { "d": "M12 2v2" }],
    ["path", { "d": "M12 22v-2" }],
    ["path", { "d": "m17 20.66-1-1.73" }],
    ["path", { "d": "M11 10.27 7 3.34" }],
    ["path", { "d": "m20.66 17-1.73-1" }],
    ["path", { "d": "m3.34 7 1.73 1" }],
    ["path", { "d": "M14 12h8" }],
    ["path", { "d": "M2 12h2" }],
    ["path", { "d": "m20.66 7-1.73 1" }],
    ["path", { "d": "m3.34 17 1.73-1" }],
    ["path", { "d": "m17 3.34-1 1.73" }],
    ["path", { "d": "m11 13.73-4 6.93" }]
  ];
  Icon($$renderer, spread_props([
    { name: "cog" },
    $$sanitized_props,
    {
      /**
       * @component @name Cog
       * @description Lucide SVG icon component, renders SVG Element with children.
       *
       * @preview ![img](data:image/svg+xml;base64,PHN2ZyAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogIHdpZHRoPSIyNCIKICBoZWlnaHQ9IjI0IgogIHZpZXdCb3g9IjAgMCAyNCAyNCIKICBmaWxsPSJub25lIgogIHN0cm9rZT0iIzAwMCIgc3R5bGU9ImJhY2tncm91bmQtY29sb3I6ICNmZmY7IGJvcmRlci1yYWRpdXM6IDJweCIKICBzdHJva2Utd2lkdGg9IjIiCiAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogIHN0cm9rZS1saW5lam9pbj0icm91bmQiCj4KICA8cGF0aCBkPSJNMTIgMjBhOCA4IDAgMSAwIDAtMTYgOCA4IDAgMCAwIDAgMTZaIiAvPgogIDxwYXRoIGQ9Ik0xMiAxNGEyIDIgMCAxIDAgMC00IDIgMiAwIDAgMCAwIDRaIiAvPgogIDxwYXRoIGQ9Ik0xMiAydjIiIC8+CiAgPHBhdGggZD0iTTEyIDIydi0yIiAvPgogIDxwYXRoIGQ9Im0xNyAyMC42Ni0xLTEuNzMiIC8+CiAgPHBhdGggZD0iTTExIDEwLjI3IDcgMy4zNCIgLz4KICA8cGF0aCBkPSJtMjAuNjYgMTctMS43My0xIiAvPgogIDxwYXRoIGQ9Im0zLjM0IDcgMS43MyAxIiAvPgogIDxwYXRoIGQ9Ik0xNCAxMmg4IiAvPgogIDxwYXRoIGQ9Ik0yIDEyaDIiIC8+CiAgPHBhdGggZD0ibTIwLjY2IDctMS43MyAxIiAvPgogIDxwYXRoIGQ9Im0zLjM0IDE3IDEuNzMtMSIgLz4KICA8cGF0aCBkPSJtMTcgMy4zNC0xIDEuNzMiIC8+CiAgPHBhdGggZD0ibTExIDEzLjczLTQgNi45MyIgLz4KPC9zdmc+Cg==) - https://lucide.dev/icons/cog
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
function Git_fork($$renderer, $$props) {
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
    ["circle", { "cx": "12", "cy": "18", "r": "3" }],
    ["circle", { "cx": "6", "cy": "6", "r": "3" }],
    ["circle", { "cx": "18", "cy": "6", "r": "3" }],
    ["path", { "d": "M18 9v2c0 .6-.4 1-1 1H7c-.6 0-1-.4-1-1V9" }],
    ["path", { "d": "M12 12v3" }]
  ];
  Icon($$renderer, spread_props([
    { name: "git-fork" },
    $$sanitized_props,
    {
      /**
       * @component @name GitFork
       * @description Lucide SVG icon component, renders SVG Element with children.
       *
       * @preview ![img](data:image/svg+xml;base64,PHN2ZyAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogIHdpZHRoPSIyNCIKICBoZWlnaHQ9IjI0IgogIHZpZXdCb3g9IjAgMCAyNCAyNCIKICBmaWxsPSJub25lIgogIHN0cm9rZT0iIzAwMCIgc3R5bGU9ImJhY2tncm91bmQtY29sb3I6ICNmZmY7IGJvcmRlci1yYWRpdXM6IDJweCIKICBzdHJva2Utd2lkdGg9IjIiCiAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogIHN0cm9rZS1saW5lam9pbj0icm91bmQiCj4KICA8Y2lyY2xlIGN4PSIxMiIgY3k9IjE4IiByPSIzIiAvPgogIDxjaXJjbGUgY3g9IjYiIGN5PSI2IiByPSIzIiAvPgogIDxjaXJjbGUgY3g9IjE4IiBjeT0iNiIgcj0iMyIgLz4KICA8cGF0aCBkPSJNMTggOXYyYzAgLjYtLjQgMS0xIDFIN2MtLjYgMC0xLS40LTEtMVY5IiAvPgogIDxwYXRoIGQ9Ik0xMiAxMnYzIiAvPgo8L3N2Zz4K) - https://lucide.dev/icons/git-fork
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
function Inbox($$renderer, $$props) {
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
      "polyline",
      { "points": "22 12 16 12 14 15 10 15 8 12 2 12" }
    ],
    [
      "path",
      {
        "d": "M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"
      }
    ]
  ];
  Icon($$renderer, spread_props([
    { name: "inbox" },
    $$sanitized_props,
    {
      /**
       * @component @name Inbox
       * @description Lucide SVG icon component, renders SVG Element with children.
       *
       * @preview ![img](data:image/svg+xml;base64,PHN2ZyAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogIHdpZHRoPSIyNCIKICBoZWlnaHQ9IjI0IgogIHZpZXdCb3g9IjAgMCAyNCAyNCIKICBmaWxsPSJub25lIgogIHN0cm9rZT0iIzAwMCIgc3R5bGU9ImJhY2tncm91bmQtY29sb3I6ICNmZmY7IGJvcmRlci1yYWRpdXM6IDJweCIKICBzdHJva2Utd2lkdGg9IjIiCiAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogIHN0cm9rZS1saW5lam9pbj0icm91bmQiCj4KICA8cG9seWxpbmUgcG9pbnRzPSIyMiAxMiAxNiAxMiAxNCAxNSAxMCAxNSA4IDEyIDIgMTIiIC8+CiAgPHBhdGggZD0iTTUuNDUgNS4xMSAyIDEydjZhMiAyIDAgMCAwIDIgMmgxNmEyIDIgMCAwIDAgMi0ydi02bC0zLjQ1LTYuODlBMiAyIDAgMCAwIDE2Ljc2IDRINy4yNGEyIDIgMCAwIDAtMS43OSAxLjExeiIgLz4KPC9zdmc+Cg==) - https://lucide.dev/icons/inbox
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
function Menu($$renderer, $$props) {
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
    ["line", { "x1": "4", "x2": "20", "y1": "12", "y2": "12" }],
    ["line", { "x1": "4", "x2": "20", "y1": "6", "y2": "6" }],
    ["line", { "x1": "4", "x2": "20", "y1": "18", "y2": "18" }]
  ];
  Icon($$renderer, spread_props([
    { name: "menu" },
    $$sanitized_props,
    {
      /**
       * @component @name Menu
       * @description Lucide SVG icon component, renders SVG Element with children.
       *
       * @preview ![img](data:image/svg+xml;base64,PHN2ZyAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogIHdpZHRoPSIyNCIKICBoZWlnaHQ9IjI0IgogIHZpZXdCb3g9IjAgMCAyNCAyNCIKICBmaWxsPSJub25lIgogIHN0cm9rZT0iIzAwMCIgc3R5bGU9ImJhY2tncm91bmQtY29sb3I6ICNmZmY7IGJvcmRlci1yYWRpdXM6IDJweCIKICBzdHJva2Utd2lkdGg9IjIiCiAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogIHN0cm9rZS1saW5lam9pbj0icm91bmQiCj4KICA8bGluZSB4MT0iNCIgeDI9IjIwIiB5MT0iMTIiIHkyPSIxMiIgLz4KICA8bGluZSB4MT0iNCIgeDI9IjIwIiB5MT0iNiIgeTI9IjYiIC8+CiAgPGxpbmUgeDE9IjQiIHgyPSIyMCIgeTE9IjE4IiB5Mj0iMTgiIC8+Cjwvc3ZnPgo=) - https://lucide.dev/icons/menu
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
function Play($$renderer, $$props) {
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
  const iconNode = [["polygon", { "points": "6 3 20 12 6 21 6 3" }]];
  Icon($$renderer, spread_props([
    { name: "play" },
    $$sanitized_props,
    {
      /**
       * @component @name Play
       * @description Lucide SVG icon component, renders SVG Element with children.
       *
       * @preview ![img](data:image/svg+xml;base64,PHN2ZyAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogIHdpZHRoPSIyNCIKICBoZWlnaHQ9IjI0IgogIHZpZXdCb3g9IjAgMCAyNCAyNCIKICBmaWxsPSJub25lIgogIHN0cm9rZT0iIzAwMCIgc3R5bGU9ImJhY2tncm91bmQtY29sb3I6ICNmZmY7IGJvcmRlci1yYWRpdXM6IDJweCIKICBzdHJva2Utd2lkdGg9IjIiCiAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogIHN0cm9rZS1saW5lam9pbj0icm91bmQiCj4KICA8cG9seWdvbiBwb2ludHM9IjYgMyAyMCAxMiA2IDIxIDYgMyIgLz4KPC9zdmc+Cg==) - https://lucide.dev/icons/play
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
function Rotate_ccw($$renderer, $$props) {
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
      { "d": "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" }
    ],
    ["path", { "d": "M3 3v5h5" }]
  ];
  Icon($$renderer, spread_props([
    { name: "rotate-ccw" },
    $$sanitized_props,
    {
      /**
       * @component @name RotateCcw
       * @description Lucide SVG icon component, renders SVG Element with children.
       *
       * @preview ![img](data:image/svg+xml;base64,PHN2ZyAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogIHdpZHRoPSIyNCIKICBoZWlnaHQ9IjI0IgogIHZpZXdCb3g9IjAgMCAyNCAyNCIKICBmaWxsPSJub25lIgogIHN0cm9rZT0iIzAwMCIgc3R5bGU9ImJhY2tncm91bmQtY29sb3I6ICNmZmY7IGJvcmRlci1yYWRpdXM6IDJweCIKICBzdHJva2Utd2lkdGg9IjIiCiAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogIHN0cm9rZS1saW5lam9pbj0icm91bmQiCj4KICA8cGF0aCBkPSJNMyAxMmE5IDkgMCAxIDAgOS05IDkuNzUgOS43NSAwIDAgMC02Ljc0IDIuNzRMMyA4IiAvPgogIDxwYXRoIGQ9Ik0zIDN2NWg1IiAvPgo8L3N2Zz4K) - https://lucide.dev/icons/rotate-ccw
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
function Sun($$renderer, $$props) {
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
    ["circle", { "cx": "12", "cy": "12", "r": "4" }],
    ["path", { "d": "M12 2v2" }],
    ["path", { "d": "M12 20v2" }],
    ["path", { "d": "m4.93 4.93 1.41 1.41" }],
    ["path", { "d": "m17.66 17.66 1.41 1.41" }],
    ["path", { "d": "M2 12h2" }],
    ["path", { "d": "M20 12h2" }],
    ["path", { "d": "m6.34 17.66-1.41 1.41" }],
    ["path", { "d": "m19.07 4.93-1.41 1.41" }]
  ];
  Icon($$renderer, spread_props([
    { name: "sun" },
    $$sanitized_props,
    {
      /**
       * @component @name Sun
       * @description Lucide SVG icon component, renders SVG Element with children.
       *
       * @preview ![img](data:image/svg+xml;base64,PHN2ZyAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogIHdpZHRoPSIyNCIKICBoZWlnaHQ9IjI0IgogIHZpZXdCb3g9IjAgMCAyNCAyNCIKICBmaWxsPSJub25lIgogIHN0cm9rZT0iIzAwMCIgc3R5bGU9ImJhY2tncm91bmQtY29sb3I6ICNmZmY7IGJvcmRlci1yYWRpdXM6IDJweCIKICBzdHJva2Utd2lkdGg9IjIiCiAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogIHN0cm9rZS1saW5lam9pbj0icm91bmQiCj4KICA8Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSI0IiAvPgogIDxwYXRoIGQ9Ik0xMiAydjIiIC8+CiAgPHBhdGggZD0iTTEyIDIwdjIiIC8+CiAgPHBhdGggZD0ibTQuOTMgNC45MyAxLjQxIDEuNDEiIC8+CiAgPHBhdGggZD0ibTE3LjY2IDE3LjY2IDEuNDEgMS40MSIgLz4KICA8cGF0aCBkPSJNMiAxMmgyIiAvPgogIDxwYXRoIGQ9Ik0yMCAxMmgyIiAvPgogIDxwYXRoIGQ9Im02LjM0IDE3LjY2LTEuNDEgMS40MSIgLz4KICA8cGF0aCBkPSJtMTkuMDcgNC45My0xLjQxIDEuNDEiIC8+Cjwvc3ZnPgo=) - https://lucide.dev/icons/sun
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
function New_issue_dialog($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
  });
}
function Sidebar($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    const prefix = derived(() => companyStore.selectedCompany?.slug ?? companyStore.selectedCompanyId ?? "");
    const companyName = derived(() => companyStore.selectedCompany?.name ?? "ClawDev");
    const companyBrandColor = derived(() => companyStore.selectedCompany?.brandColor ?? "#3B82F6");
    const hasMultipleCompanies = derived(() => companyStore.companies.length > 1);
    let activeRunCount = null;
    let allProjects = [];
    const PROJECTS_COLLAPSED_LIMIT = 10;
    let visibleProjects = derived(() => allProjects.slice(0, PROJECTS_COLLAPSED_LIMIT));
    let hasMoreProjects = derived(() => allProjects.length > PROJECTS_COLLAPSED_LIMIT);
    let allAgents = [];
    const AGENTS_COLLAPSED_LIMIT = 10;
    let visibleAgents = derived(() => allAgents.slice(0, AGENTS_COLLAPSED_LIMIT));
    let hasMoreAgents = derived(() => allAgents.length > AGENTS_COLLAPSED_LIMIT);
    const avatarStatusColor = derived(() => (
      // red — errors present
      null
    ));
    const sections = [
      {
        key: "overview",
        label: "Overview",
        defaultOpen: true,
        items: [
          {
            label: "Dashboard",
            href: "dashboard",
            icon: Layout_dashboard,
            badge: () => null,
            badgeStyle: "live"
          },
          {
            label: "Inbox",
            href: "inbox",
            icon: Inbox,
            badge: () => null,
            badgeStyle: "count"
          }
        ]
      },
      {
        key: "work",
        label: "Work",
        defaultOpen: true,
        items: [
          { label: "Issues", href: "issues", icon: List_todo },
          { label: "Runs", href: "runs", icon: Play },
          {
            label: "Routines",
            href: "routines",
            icon: Rotate_ccw,
            betaBadge: true
          },
          { label: "Goals", href: "goals", icon: Target }
        ]
      }
    ];
    const moreSection = {
      key: "more",
      label: "More",
      defaultOpen: false,
      items: [
        { label: "Approvals", href: "approvals", icon: Shield_check },
        { label: "Workspaces", href: "workspaces", icon: Box },
        { label: "Org", href: "org", icon: Building_2 },
        { label: "Costs", href: "costs", icon: Dollar_sign },
        { label: "Activity", href: "activity", icon: Activity },
        { label: "Settings", href: "settings", icon: Settings }
      ]
    };
    const allSections = [...sections, moreSection];
    const SECTION_STORAGE_KEY = "clawdev.sidebar.sections";
    const ALL_SECTION_KEYS = [...allSections.map((s) => s.key), "projects", "agents"];
    function loadSectionState() {
      const defaults = {};
      for (const s of allSections) defaults[s.key] = s.defaultOpen;
      defaults["projects"] = true;
      defaults["agents"] = true;
      if (typeof window === "undefined") return defaults;
      try {
        const stored = localStorage.getItem(SECTION_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          for (const key of ALL_SECTION_KEYS) {
            if (parsed[key] != null) defaults[key] = parsed[key];
          }
        }
      } catch {
      }
      return defaults;
    }
    let sectionOpen = loadSectionState();
    let companySwitcherOpen = false;
    function isActive(href) {
      return store_get($$store_subs ??= {}, "$page", page).url.pathname.includes(`/${prefix()}/${href}`);
    }
    function formatBadge(value) {
      const num = typeof value === "string" ? parseInt(value, 10) : value;
      if (isNaN(num)) return String(value);
      if (num >= 1e3) return `${(num / 1e3).toFixed(1)}k`;
      return String(num);
    }
    const PROJECT_COLORS = [
      "#ef4444",
      "#f97316",
      "#eab308",
      "#22c55e",
      "#06b6d4",
      "#3b82f6",
      "#8b5cf6",
      "#ec4899",
      "#14b8a6",
      "#f59e0b"
    ];
    function projectColor(proj) {
      if (proj.color) return proj.color;
      let hash = 0;
      for (let i = 0; i < proj.name.length; i++) hash = hash * 31 + proj.name.charCodeAt(i) | 0;
      return PROJECT_COLORS[Math.abs(hash) % PROJECT_COLORS.length];
    }
    function agentInitials(agent) {
      if (agent.icon) return agent.icon;
      return agent.name.slice(0, 2).toUpperCase();
    }
    const AGENT_STATUS_COLORS = {
      running: "#3b82f6",
      idle: "#22c55e",
      paused: "#eab308",
      error: "#ef4444",
      stopped: "#6b7280"
    };
    function agentStatusColor(agent) {
      if (!agent.status) return null;
      return AGENT_STATUS_COLORS[agent.status] ?? null;
    }
    $$renderer2.push(`<aside data-slot="sidebar"${attr_class(clsx(cn("flex h-full w-60 shrink-0 flex-col border-r", "bg-[var(--clawdev-bg-base)] text-[var(--clawdev-text-primary)] border-[var(--clawdev-bg-surface-border)]", sidebarStore.isMobile && "fixed inset-y-0 left-0 z-50 shadow-xl", sidebarStore.isMobile && !sidebarStore.open && "-translate-x-full", "transition-transform duration-200")))}><div class="flex h-14 items-center justify-between px-4 border-b border-[var(--clawdev-bg-surface-border)]"><div class="relative flex items-center gap-2.5 min-w-0 flex-1">`);
    if (hasMultipleCompanies()) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<button class="flex items-center gap-2.5 min-w-0 hover:opacity-80 transition-opacity" aria-label="Switch company"><div class="relative shrink-0"><div class="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white uppercase select-none"${attr_style("", { "background-color": companyBrandColor() })}>${escape_html(companyName().charAt(0))}</div> `);
      if (avatarStatusColor()) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<span${attr_class(clsx(cn("absolute -bottom-0.5 -right-0.5 block h-2.5 w-2.5 rounded-full border-2 border-[var(--clawdev-bg-base)]", activeRunCount != null)))}${attr_style("", { "background-color": avatarStatusColor() })}></span>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div> <span class="text-sm font-semibold truncate text-[var(--clawdev-text-primary)]">${escape_html(companyName())}</span> `);
      Chevron_down($$renderer2, {
        class: cn("size-3.5 shrink-0 text-[var(--clawdev-text-muted)] transition-transform duration-150", companySwitcherOpen)
      });
      $$renderer2.push(`<!----></button> `);
      {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]-->`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<div class="relative shrink-0"><div class="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white uppercase select-none"${attr_style("", { "background-color": companyBrandColor() })}>${escape_html(companyName().charAt(0))}</div> `);
      if (avatarStatusColor()) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<span${attr_class(clsx(cn("absolute -bottom-0.5 -right-0.5 block h-2.5 w-2.5 rounded-full border-2 border-[var(--clawdev-bg-base)]", activeRunCount != null)))}${attr_style("", { "background-color": avatarStatusColor() })}></span>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div> <span class="text-sm font-semibold truncate text-[var(--clawdev-text-primary)]">${escape_html(companyName())}</span>`);
    }
    $$renderer2.push(`<!--]--></div> <div class="flex items-center gap-1"><button class="flex h-7 w-7 items-center justify-center rounded-md text-[var(--clawdev-text-muted)] hover:text-[var(--clawdev-text-primary)] hover:bg-[rgba(255,255,255,0.06)] transition-colors" aria-label="Search (Ctrl+K)" title="Search (Ctrl+K)">`);
    Search($$renderer2, { class: "size-4" });
    $$renderer2.push(`<!----></button> `);
    if (sidebarStore.isMobile) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<button class="text-[var(--clawdev-text-muted)] hover:text-[var(--clawdev-text-primary)] p-1 rounded-md" aria-label="Close sidebar">`);
      X($$renderer2, { class: "size-4" });
      $$renderer2.push(`<!----></button>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div></div> <div class="px-3 pt-3 pb-1"><button class="flex h-8 w-full items-center justify-center gap-2 rounded-md bg-[var(--clawdev-primary)] px-3 text-sm font-medium text-white hover:bg-[var(--clawdev-primary-hover)] transition-colors">`);
    Plus($$renderer2, { class: "size-3.5" });
    $$renderer2.push(`<!----> New Issue</button></div> <nav class="flex-1 overflow-y-auto px-3 pt-2 pb-4"><!--[-->`);
    const each_array_1 = ensure_array_like(sections);
    for (let $$index_2 = 0, $$length = each_array_1.length; $$index_2 < $$length; $$index_2++) {
      let section = each_array_1[$$index_2];
      $$renderer2.push(`<div class="mt-3 first:mt-0"><button class="flex w-full items-center gap-1 px-1.5 py-1 text-[10px] font-semibold text-[var(--clawdev-text-muted)] uppercase tracking-widest hover:text-[var(--clawdev-text-primary)] transition-colors rounded-sm group"${attr("aria-expanded", sectionOpen[section.key])}>`);
      Chevron_right($$renderer2, {
        class: cn("size-3 shrink-0 transition-transform duration-150", sectionOpen[section.key] && "rotate-90")
      });
      $$renderer2.push(`<!----> <span class="select-none">${escape_html(section.label)}</span></button> `);
      if (sectionOpen[section.key]) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="mt-0.5 space-y-px"><!--[-->`);
        const each_array_2 = ensure_array_like(section.items);
        for (let $$index_1 = 0, $$length2 = each_array_2.length; $$index_1 < $$length2; $$index_1++) {
          let item = each_array_2[$$index_1];
          $$renderer2.push(`<a${attr("href", `/${prefix()}/${item.href}`)}${attr_class(clsx(cn("flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors", isActive(item.href) ? "bg-[rgba(255,255,255,0.08)] text-[var(--clawdev-text-primary)] font-medium" : "text-[var(--clawdev-text-muted)] hover:bg-[rgba(255,255,255,0.05)] hover:text-[var(--clawdev-text-primary)]")))}>`);
          if (item.icon) {
            $$renderer2.push("<!--[-->");
            item.icon($$renderer2, { class: "size-4 shrink-0" });
            $$renderer2.push("<!--]-->");
          } else {
            $$renderer2.push("<!--[!-->");
            $$renderer2.push("<!--]-->");
          }
          $$renderer2.push(` <span class="flex-1 truncate">${escape_html(item.label)}</span> `);
          if (item.betaBadge) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<span class="ml-0.5 inline-flex items-center rounded px-1 py-px text-[9px] font-semibold uppercase leading-tight bg-[rgba(245,158,11,0.15)] text-[#f59e0b]">Beta</span>`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]--> `);
          if (item.badge) {
            $$renderer2.push("<!--[0-->");
            const badgeValue = item.badge();
            if (badgeValue != null) {
              $$renderer2.push("<!--[0-->");
              if (item.badgeStyle === "live") {
                $$renderer2.push("<!--[0-->");
                $$renderer2.push(`<span class="ml-auto flex items-center gap-1 text-[11px] font-medium tabular-nums text-[#60a5fa]"><span class="inline-block h-1.5 w-1.5 rounded-full bg-[#3b82f6] animate-pulse"></span> ${escape_html(typeof badgeValue === "number" ? formatBadge(badgeValue) : badgeValue)}</span>`);
              } else if (item.badgeStyle === "count") {
                $$renderer2.push("<!--[1-->");
                $$renderer2.push(`<span class="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold tabular-nums bg-[#ef4444] text-white">${escape_html(typeof badgeValue === "number" ? formatBadge(badgeValue) : badgeValue)}</span>`);
              } else {
                $$renderer2.push("<!--[-1-->");
                $$renderer2.push(`<span class="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-medium tabular-nums bg-[rgba(255,255,255,0.08)] text-[var(--clawdev-text-muted)]">${escape_html(typeof badgeValue === "number" ? formatBadge(badgeValue) : badgeValue)}</span>`);
              }
              $$renderer2.push(`<!--]-->`);
            } else {
              $$renderer2.push("<!--[-1-->");
            }
            $$renderer2.push(`<!--]-->`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]--></a>`);
        }
        $$renderer2.push(`<!--]--></div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div>`);
    }
    $$renderer2.push(`<!--]-->  <div class="mt-3"><div class="flex items-center justify-between px-1.5 py-1"><button class="flex items-center gap-1 text-[10px] font-semibold text-[var(--clawdev-text-muted)] uppercase tracking-widest hover:text-[var(--clawdev-text-primary)] transition-colors rounded-sm"${attr("aria-expanded", sectionOpen["projects"])}>`);
    Chevron_right($$renderer2, {
      class: cn("size-3 shrink-0 transition-transform duration-150", sectionOpen["projects"] && "rotate-90")
    });
    $$renderer2.push(`<!----> <span class="select-none">Projects</span></button> <a${attr("href", `/${prefix()}/projects?new=true`)} class="flex h-5 w-5 items-center justify-center rounded text-[var(--clawdev-text-muted)] hover:text-[var(--clawdev-text-primary)] hover:bg-[rgba(255,255,255,0.06)] transition-colors" title="New project" aria-label="New project">`);
    Plus($$renderer2, { class: "size-3" });
    $$renderer2.push(`<!----></a></div> `);
    if (sectionOpen["projects"]) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="mt-0.5 space-y-px">`);
      if (allProjects.length === 0) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="px-2.5 py-1.5 text-xs text-[var(--clawdev-text-muted)]/60 italic">No projects yet</div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<!--[-->`);
        const each_array_3 = ensure_array_like(visibleProjects());
        for (let $$index_3 = 0, $$length = each_array_3.length; $$index_3 < $$length; $$index_3++) {
          let proj = each_array_3[$$index_3];
          $$renderer2.push(`<a${attr("href", `/${prefix()}/projects/${proj.slug ?? proj.id}/issues`)}${attr_class(clsx(cn("flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors", store_get($$store_subs ??= {}, "$page", page).url.pathname.includes(`/projects/${proj.slug ?? proj.id}`) ? "bg-[rgba(255,255,255,0.08)] text-[var(--clawdev-text-primary)] font-medium" : "text-[var(--clawdev-text-muted)] hover:bg-[rgba(255,255,255,0.05)] hover:text-[var(--clawdev-text-primary)]")))}><span class="h-2 w-2 rounded-full shrink-0"${attr_style("", { background: projectColor(proj) })}></span> <span class="flex-1 truncate">${escape_html(proj.name)}</span></a>`);
        }
        $$renderer2.push(`<!--]--> `);
        if (hasMoreProjects()) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<button class="flex items-center gap-2 px-2.5 py-1 text-xs text-[var(--clawdev-text-muted)]/60 hover:text-[var(--clawdev-text-muted)] transition-colors w-full">`);
          {
            $$renderer2.push("<!--[-1-->");
            $$renderer2.push(`Show ${escape_html(allProjects.length - PROJECTS_COLLAPSED_LIMIT)} more...`);
          }
          $$renderer2.push(`<!--]--></button>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]-->`);
      }
      $$renderer2.push(`<!--]--></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div>  <div class="mt-3"><div class="flex items-center justify-between px-1.5 py-1"><button class="flex items-center gap-1 text-[10px] font-semibold text-[var(--clawdev-text-muted)] uppercase tracking-widest hover:text-[var(--clawdev-text-primary)] transition-colors rounded-sm"${attr("aria-expanded", sectionOpen["agents"])}>`);
    Chevron_right($$renderer2, {
      class: cn("size-3 shrink-0 transition-transform duration-150", sectionOpen["agents"] && "rotate-90")
    });
    $$renderer2.push(`<!----> <span class="select-none">Agents</span></button> <a${attr("href", `/${prefix()}/agents/new`)} class="flex h-5 w-5 items-center justify-center rounded text-[var(--clawdev-text-muted)] hover:text-[var(--clawdev-text-primary)] hover:bg-[rgba(255,255,255,0.06)] transition-colors" title="New agent" aria-label="New agent">`);
    Plus($$renderer2, { class: "size-3" });
    $$renderer2.push(`<!----></a></div> `);
    if (sectionOpen["agents"]) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="mt-0.5 space-y-px">`);
      if (allAgents.length === 0) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="px-2.5 py-1.5 text-xs text-[var(--clawdev-text-muted)]/60 italic">No agents yet</div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<!--[-->`);
        const each_array_4 = ensure_array_like(visibleAgents());
        for (let $$index_4 = 0, $$length = each_array_4.length; $$index_4 < $$length; $$index_4++) {
          let agent = each_array_4[$$index_4];
          $$renderer2.push(`<a${attr("href", `/${prefix()}/agents/${agent.slug ?? agent.urlKey ?? agent.id}`)}${attr_class(clsx(cn("flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors", store_get($$store_subs ??= {}, "$page", page).url.pathname.includes(`/agents/${agent.slug ?? agent.urlKey ?? agent.id}`) ? "bg-[rgba(255,255,255,0.08)] text-[var(--clawdev-text-primary)] font-medium" : "text-[var(--clawdev-text-muted)] hover:bg-[rgba(255,255,255,0.05)] hover:text-[var(--clawdev-text-primary)]")))}><div class="relative shrink-0">`);
          if (agent.icon) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<span class="flex h-5 w-5 items-center justify-center text-sm"${attr("title", agent.name)}>${escape_html(agent.icon)}</span>`);
          } else {
            $$renderer2.push("<!--[-1-->");
            $$renderer2.push(`<span class="flex h-5 w-5 items-center justify-center rounded bg-[rgba(255,255,255,0.08)] text-[9px] font-bold text-[var(--clawdev-text-muted)] uppercase">${escape_html(agentInitials(agent))}</span>`);
          }
          $$renderer2.push(`<!--]--> `);
          if (agentStatusColor(agent)) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<span${attr_class(clsx(cn("absolute -bottom-px -right-px block h-2 w-2 rounded-full border border-[var(--clawdev-bg-base)]", agent.status === "running" && "animate-pulse")))}${attr_style("", { "background-color": agentStatusColor(agent) })}></span>`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]--></div> <span class="flex-1 truncate">${escape_html(agent.name)}</span></a>`);
        }
        $$renderer2.push(`<!--]--> `);
        if (hasMoreAgents()) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<button class="flex items-center gap-2 px-2.5 py-1 text-xs text-[var(--clawdev-text-muted)]/60 hover:text-[var(--clawdev-text-muted)] transition-colors w-full">`);
          {
            $$renderer2.push("<!--[-1-->");
            $$renderer2.push(`Show ${escape_html(allAgents.length - AGENTS_COLLAPSED_LIMIT)} more...`);
          }
          $$renderer2.push(`<!--]--></button>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]-->`);
      }
      $$renderer2.push(`<!--]--></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div>  <div class="mt-3"><button class="flex w-full items-center gap-1 px-1.5 py-1 text-[10px] font-semibold text-[var(--clawdev-text-muted)] uppercase tracking-widest hover:text-[var(--clawdev-text-primary)] transition-colors rounded-sm group"${attr("aria-expanded", sectionOpen[moreSection.key])}>`);
    Chevron_right($$renderer2, {
      class: cn("size-3 shrink-0 transition-transform duration-150", sectionOpen[moreSection.key] && "rotate-90")
    });
    $$renderer2.push(`<!----> <span class="select-none">${escape_html(moreSection.label)}</span></button> `);
    if (sectionOpen[moreSection.key]) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="mt-0.5 space-y-px"><!--[-->`);
      const each_array_5 = ensure_array_like(moreSection.items);
      for (let $$index_5 = 0, $$length = each_array_5.length; $$index_5 < $$length; $$index_5++) {
        let item = each_array_5[$$index_5];
        $$renderer2.push(`<a${attr("href", `/${prefix()}/${item.href}`)}${attr_class(clsx(cn("flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors", isActive(item.href) ? "bg-[rgba(255,255,255,0.08)] text-[var(--clawdev-text-primary)] font-medium" : "text-[var(--clawdev-text-muted)] hover:bg-[rgba(255,255,255,0.05)] hover:text-[var(--clawdev-text-primary)]")))}>`);
        if (item.icon) {
          $$renderer2.push("<!--[-->");
          item.icon($$renderer2, { class: "size-4 shrink-0" });
          $$renderer2.push("<!--]-->");
        } else {
          $$renderer2.push("<!--[!-->");
          $$renderer2.push("<!--]-->");
        }
        $$renderer2.push(` <span class="flex-1 truncate">${escape_html(item.label)}</span></a>`);
      }
      $$renderer2.push(`<!--]--></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div></nav> <div class="border-t border-[var(--clawdev-bg-surface-border)] px-4 py-3 space-y-1.5"><a href="/docs" target="_blank" rel="noopener noreferrer" class="flex items-center gap-2 text-xs text-[var(--clawdev-text-muted)] hover:text-[var(--clawdev-text-primary)] transition-colors">`);
    Book_open($$renderer2, { class: "size-3.5" });
    $$renderer2.push(`<!----> Documentation</a> <div class="flex items-center justify-between"><a href="/settings/general" class="flex items-center gap-2 text-xs text-[var(--clawdev-text-muted)] hover:text-[var(--clawdev-text-primary)] transition-colors">`);
    Cog($$renderer2, { class: "size-3.5" });
    $$renderer2.push(`<!----> Instance Settings</a> <button class="flex h-6 w-6 items-center justify-center rounded-md text-[var(--clawdev-text-muted)] hover:text-[var(--clawdev-text-primary)] hover:bg-[rgba(255,255,255,0.06)] transition-colors"${attr("aria-label", "Switch to light mode")}${attr("title", "Switch to light mode")}>`);
    {
      $$renderer2.push("<!--[0-->");
      Sun($$renderer2, { class: "size-3.5" });
    }
    $$renderer2.push(`<!--]--></button></div> <div class="text-[10px] text-[var(--clawdev-text-muted)]/50 select-none">ClawDev v0.3.1</div></div></aside> `);
    if (sidebarStore.isMobile && sidebarStore.open) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<button class="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" aria-label="Close sidebar"></button>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
let breadcrumbs = [];
const breadcrumbStore = {
  get items() {
    return breadcrumbs;
  }
};
function Breadcrumb_bar($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const crumbs = derived(() => breadcrumbStore.items);
    $$renderer2.push(`<header data-slot="breadcrumb-bar" class="flex h-14 shrink-0 items-center gap-3 border-b border-[var(--clawdev-bg-surface-border)] px-4 bg-[var(--clawdev-bg-base)]">`);
    if (sidebarStore.isMobile) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<button class="p-1 -ml-1 rounded-md text-[var(--clawdev-text-muted)] hover:text-[var(--clawdev-text-primary)] hover:bg-[rgba(255,255,255,0.1)]" aria-label="Toggle sidebar">`);
      Menu($$renderer2, { class: "size-5" });
      $$renderer2.push(`<!----></button>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (crumbs().length === 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div></div>`);
    } else if (crumbs().length === 1) {
      $$renderer2.push("<!--[1-->");
      $$renderer2.push(`<h1 class="text-sm font-semibold truncate text-[var(--clawdev-text-primary)]">${escape_html(crumbs()[0].label)}</h1>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<nav class="flex items-center gap-1.5 text-sm text-[var(--clawdev-text-muted)] truncate"><!--[-->`);
      const each_array = ensure_array_like(crumbs());
      for (let i = 0, $$length = each_array.length; i < $$length; i++) {
        let crumb = each_array[i];
        if (i > 0) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<span class="text-[var(--clawdev-text-muted)]/40">/</span>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--> `);
        if (i < crumbs().length - 1 && crumb.href) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<a${attr("href", crumb.href)} class="hover:text-[var(--clawdev-text-primary)] transition-colors truncate max-w-[120px]">${escape_html(crumb.label)}</a>`);
        } else {
          $$renderer2.push("<!--[-1-->");
          $$renderer2.push(`<span${attr_class(clsx(cn(i === crumbs().length - 1 && "text-[var(--clawdev-text-primary)] font-medium", "truncate max-w-[200px]")))}>${escape_html(crumb.label)}</span>`);
        }
        $$renderer2.push(`<!--]-->`);
      }
      $$renderer2.push(`<!--]--></nav>`);
    }
    $$renderer2.push(`<!--]--></header>`);
  });
}
function Toast_viewport($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const toasts = derived(() => toastStore.items);
    const toneStyles = {
      info: "border-border bg-card text-card-foreground",
      success: "border-green-500/30 bg-green-950/80 text-green-100",
      warn: "border-yellow-500/30 bg-yellow-950/80 text-yellow-100",
      error: "border-destructive/30 bg-red-950/80 text-red-100"
    };
    if (toasts().length > 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="fixed bottom-4 left-4 z-[120] flex flex-col gap-2 w-80" role="region" aria-live="polite" aria-label="Notifications"><!--[-->`);
      const each_array = ensure_array_like(toasts());
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        let toast = each_array[$$index];
        $$renderer2.push(`<div${attr_class(clsx(cn("flex items-start gap-3 rounded-md border px-4 py-3 shadow-lg animate-in slide-in-from-bottom-2 fade-in-0 duration-200", toneStyles[toast.tone])))}><div class="flex-1 min-w-0"><p class="text-sm font-medium truncate">${escape_html(toast.title)}</p> `);
        if (toast.body) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<p class="text-xs opacity-80 mt-0.5 line-clamp-2">${escape_html(toast.body)}</p>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--> `);
        if (toast.action) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<a${attr("href", toast.action.href)} class="text-xs font-medium underline underline-offset-2 mt-1 inline-block">${escape_html(toast.action.label)}</a>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--></div> <button class="shrink-0 opacity-60 hover:opacity-100 transition-opacity p-0.5" aria-label="Dismiss">`);
        X($$renderer2, { class: "size-3.5" });
        $$renderer2.push(`<!----></button></div>`);
      }
      $$renderer2.push(`<!--]--></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
  });
}
function Dev_banner($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let worktreePath = null;
    let loaded = false;
    let showDevBanner = derived(() => loaded);
    let showWorktreeBanner = derived(() => loaded);
    let showAny = derived(() => showDevBanner() || showWorktreeBanner());
    if (showAny()) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="dev-banner-strip relative z-[60] w-full shrink-0">`);
      if (showDevBanner()) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="flex items-center justify-center gap-2 bg-amber-500/15 border-b border-amber-500/20 px-4 py-1.5 text-xs text-amber-300">`);
        Terminal($$renderer2, { class: "size-3.5 shrink-0" });
        $$renderer2.push(`<!----> <span class="font-medium">Dev Mode</span> <span class="hidden sm:inline text-amber-300/70">— Auto-restart enabled</span> <button class="ml-auto rounded p-0.5 text-amber-400/60 hover:text-amber-300 hover:bg-amber-500/10 transition-colors" aria-label="Dismiss banner">`);
        X($$renderer2, { class: "size-3.5" });
        $$renderer2.push(`<!----></button></div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (showWorktreeBanner()) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="flex items-center justify-center gap-2 bg-blue-500/10 border-b border-blue-500/15 px-4 py-1.5 text-xs text-blue-300">`);
        Git_fork($$renderer2, { class: "size-3.5 shrink-0" });
        $$renderer2.push(`<!----> <span>Running in git worktree:</span> <code class="font-mono text-blue-200/80 truncate max-w-[300px]">${escape_html(worktreePath)}</code> `);
        if (!showDevBanner()) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<button class="ml-auto rounded p-0.5 text-blue-400/60 hover:text-blue-300 hover:bg-blue-500/10 transition-colors" aria-label="Dismiss banner">`);
          X($$renderer2, { class: "size-3.5" });
          $$renderer2.push(`<!----></button>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--></div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
  });
}
function Mobile_bottom_nav($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let { companyPrefix, unreadCount = 0 } = $$props;
    let navItems = derived(() => [
      {
        label: "Dashboard",
        href: `/${companyPrefix}/dashboard`,
        icon: Layout_dashboard,
        match: "/dashboard"
      },
      {
        label: "Issues",
        href: `/${companyPrefix}/issues`,
        icon: List_todo,
        match: "/issues"
      },
      {
        label: "Inbox",
        href: `/${companyPrefix}/inbox`,
        icon: Inbox,
        match: "/inbox"
      },
      {
        label: "Agents",
        href: `/${companyPrefix}/agents`,
        icon: Bot,
        match: "/agents"
      }
    ]);
    let currentPath = derived(() => store_get($$store_subs ??= {}, "$page", page).url.pathname);
    function isActive(match) {
      const base = `/${companyPrefix}${match}`;
      return currentPath() === base || currentPath().startsWith(base + "/");
    }
    $$renderer2.push(`<nav class="fixed bottom-0 inset-x-0 z-50 flex md:hidden items-center justify-around bg-[#0a0a0f] border-t border-white/[0.08] pb-[env(safe-area-inset-bottom,0px)]" aria-label="Mobile navigation"><!--[-->`);
    const each_array = ensure_array_like(navItems());
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let item = each_array[$$index];
      const active = isActive(item.match);
      $$renderer2.push(`<a${attr("href", item.href)}${attr_class(`flex flex-col items-center gap-0.5 py-2 px-3 min-w-0 relative transition-colors ${stringify(active ? "text-blue-400" : "text-zinc-500 hover:text-zinc-300")}`)}${attr("aria-current", active ? "page" : void 0)}>`);
      if (item.match === "/inbox" && unreadCount > 0) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<span class="relative">`);
        if (item.icon) {
          $$renderer2.push("<!--[-->");
          item.icon($$renderer2, { class: "size-5" });
          $$renderer2.push("<!--]-->");
        } else {
          $$renderer2.push("<!--[!-->");
          $$renderer2.push("<!--]-->");
        }
        $$renderer2.push(` <span class="absolute -top-1.5 -right-2 flex items-center justify-center min-w-[16px] h-4 rounded-full bg-red-500 text-white text-[10px] font-bold px-1 leading-none">${escape_html(unreadCount > 99 ? "99+" : unreadCount)}</span></span>`);
      } else {
        $$renderer2.push("<!--[-1-->");
        if (item.icon) {
          $$renderer2.push("<!--[-->");
          item.icon($$renderer2, { class: "size-5" });
          $$renderer2.push("<!--]-->");
        } else {
          $$renderer2.push("<!--[!-->");
          $$renderer2.push("<!--]-->");
        }
      }
      $$renderer2.push(`<!--]--> <span class="text-[10px] font-medium leading-tight">${escape_html(item.label)}</span></a>`);
    }
    $$renderer2.push(`<!--]--> <button class="flex flex-col items-center gap-0.5 py-2 px-3 min-w-0 transition-colors text-zinc-500 hover:text-zinc-300" aria-label="Toggle menu">`);
    Menu($$renderer2, { class: "size-5" });
    $$renderer2.push(`<!----> <span class="text-[10px] font-medium leading-tight">Menu</span></button></nav>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
const STORAGE_KEY = "paperclip.theme";
function resolveInitialTheme() {
  if (typeof window === "undefined") return "dark";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}
resolveInitialTheme();
function _layout($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let { children } = $$props;
    onDestroy(() => {
    });
    $$renderer2.push(`<div class="flex h-full flex-col overflow-hidden bg-[var(--clawdev-bg-base)]">`);
    Dev_banner($$renderer2);
    $$renderer2.push(`<!----> <div class="flex flex-1 overflow-hidden">`);
    if (sidebarStore.open || !sidebarStore.isMobile) {
      $$renderer2.push("<!--[0-->");
      Sidebar($$renderer2);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="flex flex-1 flex-col min-w-0 overflow-hidden">`);
    Breadcrumb_bar($$renderer2);
    $$renderer2.push(`<!----> <main class="flex-1 overflow-y-auto bg-[var(--clawdev-bg-base)] pb-16 md:pb-0">`);
    children($$renderer2);
    $$renderer2.push(`<!----></main></div></div></div> `);
    Mobile_bottom_nav($$renderer2, {
      companyPrefix: store_get($$store_subs ??= {}, "$page", page).params.companyPrefix
    });
    $$renderer2.push(`<!----> `);
    New_issue_dialog($$renderer2);
    $$renderer2.push(`<!----> `);
    Toast_viewport($$renderer2);
    $$renderer2.push(`<!---->`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
export {
  _layout as default
};
