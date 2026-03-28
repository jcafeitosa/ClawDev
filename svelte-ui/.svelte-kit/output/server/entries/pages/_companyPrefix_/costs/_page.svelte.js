import { a as sanitize_props, b as spread_props, c as slot, m as derived, q as attributes, p as bind_props, i as ensure_array_like, e as escape_html, d as attr_class, o as stringify, h as attr_style, j as attr } from "../../../../chunks/index.js";
import "../../../../chunks/company.svelte.js";
import "../../../../chunks/client.js";
import "../../../../chunks/badge.js";
import "clsx";
import { c as cn } from "../../../../chunks/cn.js";
import { A as ARROW_UP, a as ARROW_RIGHT, b as ARROW_LEFT, c as ARROW_DOWN, d as box, E as END, H as HOME, C as Context, S as SvelteMap, u as useRefById, w as watch, e as SPACE, f as ENTER, g as getDataOrientation, h as getDataDisabled, i as getAriaOrientation, j as getDisabled, k as getAriaSelected, l as getHidden, m as useId, n as mergeProps } from "../../../../chunks/use-id.js";
import { i as isBrowser, n as noop } from "../../../../chunks/noop.js";
import { D as Dollar_sign, L as Layout_dashboard } from "../../../../chunks/layout-dashboard.js";
import { Z as Zap } from "../../../../chunks/zap.js";
import { I as Icon } from "../../../../chunks/Icon.js";
import { A as Activity } from "../../../../chunks/activity.js";
import { S as Shield } from "../../../../chunks/shield.js";
import { S as Server } from "../../../../chunks/server.js";
import { B as Bot } from "../../../../chunks/bot.js";
import { T as Trending_up } from "../../../../chunks/trending-up.js";
function Arrow_down_right($$renderer, $$props) {
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
    ["path", { "d": "m7 7 10 10" }],
    ["path", { "d": "M17 7v10H7" }]
  ];
  Icon($$renderer, spread_props([
    { name: "arrow-down-right" },
    $$sanitized_props,
    {
      /**
       * @component @name ArrowDownRight
       * @description Lucide SVG icon component, renders SVG Element with children.
       *
       * @preview ![img](data:image/svg+xml;base64,PHN2ZyAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogIHdpZHRoPSIyNCIKICBoZWlnaHQ9IjI0IgogIHZpZXdCb3g9IjAgMCAyNCAyNCIKICBmaWxsPSJub25lIgogIHN0cm9rZT0iIzAwMCIgc3R5bGU9ImJhY2tncm91bmQtY29sb3I6ICNmZmY7IGJvcmRlci1yYWRpdXM6IDJweCIKICBzdHJva2Utd2lkdGg9IjIiCiAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogIHN0cm9rZS1saW5lam9pbj0icm91bmQiCj4KICA8cGF0aCBkPSJtNyA3IDEwIDEwIiAvPgogIDxwYXRoIGQ9Ik0xNyA3djEwSDciIC8+Cjwvc3ZnPgo=) - https://lucide.dev/icons/arrow-down-right
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
function Arrow_up_right($$renderer, $$props) {
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
    ["path", { "d": "M7 7h10v10" }],
    ["path", { "d": "M7 17 17 7" }]
  ];
  Icon($$renderer, spread_props([
    { name: "arrow-up-right" },
    $$sanitized_props,
    {
      /**
       * @component @name ArrowUpRight
       * @description Lucide SVG icon component, renders SVG Element with children.
       *
       * @preview ![img](data:image/svg+xml;base64,PHN2ZyAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogIHdpZHRoPSIyNCIKICBoZWlnaHQ9IjI0IgogIHZpZXdCb3g9IjAgMCAyNCAyNCIKICBmaWxsPSJub25lIgogIHN0cm9rZT0iIzAwMCIgc3R5bGU9ImJhY2tncm91bmQtY29sb3I6ICNmZmY7IGJvcmRlci1yYWRpdXM6IDJweCIKICBzdHJva2Utd2lkdGg9IjIiCiAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogIHN0cm9rZS1saW5lam9pbj0icm91bmQiCj4KICA8cGF0aCBkPSJNNyA3aDEwdjEwIiAvPgogIDxwYXRoIGQ9Ik03IDE3IDE3IDciIC8+Cjwvc3ZnPgo=) - https://lucide.dev/icons/arrow-up-right
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
function Calendar($$renderer, $$props) {
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
    ["path", { "d": "M8 2v4" }],
    ["path", { "d": "M16 2v4" }],
    [
      "rect",
      { "width": "18", "height": "18", "x": "3", "y": "4", "rx": "2" }
    ],
    ["path", { "d": "M3 10h18" }]
  ];
  Icon($$renderer, spread_props([
    { name: "calendar" },
    $$sanitized_props,
    {
      /**
       * @component @name Calendar
       * @description Lucide SVG icon component, renders SVG Element with children.
       *
       * @preview ![img](data:image/svg+xml;base64,PHN2ZyAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogIHdpZHRoPSIyNCIKICBoZWlnaHQ9IjI0IgogIHZpZXdCb3g9IjAgMCAyNCAyNCIKICBmaWxsPSJub25lIgogIHN0cm9rZT0iIzAwMCIgc3R5bGU9ImJhY2tncm91bmQtY29sb3I6ICNmZmY7IGJvcmRlci1yYWRpdXM6IDJweCIKICBzdHJva2Utd2lkdGg9IjIiCiAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogIHN0cm9rZS1saW5lam9pbj0icm91bmQiCj4KICA8cGF0aCBkPSJNOCAydjQiIC8+CiAgPHBhdGggZD0iTTE2IDJ2NCIgLz4KICA8cmVjdCB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHg9IjMiIHk9IjQiIHJ4PSIyIiAvPgogIDxwYXRoIGQ9Ik0zIDEwaDE4IiAvPgo8L3N2Zz4K) - https://lucide.dev/icons/calendar
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
function Credit_card($$renderer, $$props) {
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
      { "width": "20", "height": "14", "x": "2", "y": "5", "rx": "2" }
    ],
    ["line", { "x1": "2", "x2": "22", "y1": "10", "y2": "10" }]
  ];
  Icon($$renderer, spread_props([
    { name: "credit-card" },
    $$sanitized_props,
    {
      /**
       * @component @name CreditCard
       * @description Lucide SVG icon component, renders SVG Element with children.
       *
       * @preview ![img](data:image/svg+xml;base64,PHN2ZyAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogIHdpZHRoPSIyNCIKICBoZWlnaHQ9IjI0IgogIHZpZXdCb3g9IjAgMCAyNCAyNCIKICBmaWxsPSJub25lIgogIHN0cm9rZT0iIzAwMCIgc3R5bGU9ImJhY2tncm91bmQtY29sb3I6ICNmZmY7IGJvcmRlci1yYWRpdXM6IDJweCIKICBzdHJva2Utd2lkdGg9IjIiCiAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogIHN0cm9rZS1saW5lam9pbj0icm91bmQiCj4KICA8cmVjdCB3aWR0aD0iMjAiIGhlaWdodD0iMTQiIHg9IjIiIHk9IjUiIHJ4PSIyIiAvPgogIDxsaW5lIHgxPSIyIiB4Mj0iMjIiIHkxPSIxMCIgeTI9IjEwIiAvPgo8L3N2Zz4K) - https://lucide.dev/icons/credit-card
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
function Folder_kanban($$renderer, $$props) {
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
        "d": "M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"
      }
    ],
    ["path", { "d": "M8 10v4" }],
    ["path", { "d": "M12 10v2" }],
    ["path", { "d": "M16 10v6" }]
  ];
  Icon($$renderer, spread_props([
    { name: "folder-kanban" },
    $$sanitized_props,
    {
      /**
       * @component @name FolderKanban
       * @description Lucide SVG icon component, renders SVG Element with children.
       *
       * @preview ![img](data:image/svg+xml;base64,PHN2ZyAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogIHdpZHRoPSIyNCIKICBoZWlnaHQ9IjI0IgogIHZpZXdCb3g9IjAgMCAyNCAyNCIKICBmaWxsPSJub25lIgogIHN0cm9rZT0iIzAwMCIgc3R5bGU9ImJhY2tncm91bmQtY29sb3I6ICNmZmY7IGJvcmRlci1yYWRpdXM6IDJweCIKICBzdHJva2Utd2lkdGg9IjIiCiAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogIHN0cm9rZS1saW5lam9pbj0icm91bmQiCj4KICA8cGF0aCBkPSJNNCAyMGgxNmEyIDIgMCAwIDAgMi0yVjhhMiAyIDAgMCAwLTItMmgtNy45M2EyIDIgMCAwIDEtMS42Ni0uOWwtLjgyLTEuMkEyIDIgMCAwIDAgNy45MyAzSDRhMiAyIDAgMCAwLTIgMnYxM2MwIDEuMS45IDIgMiAyWiIgLz4KICA8cGF0aCBkPSJNOCAxMHY0IiAvPgogIDxwYXRoIGQ9Ik0xMiAxMHYyIiAvPgogIDxwYXRoIGQ9Ik0xNiAxMHY2IiAvPgo8L3N2Zz4K) - https://lucide.dev/icons/folder-kanban
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
function Gauge($$renderer, $$props) {
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
    ["path", { "d": "m12 14 4-4" }],
    ["path", { "d": "M3.34 19a10 10 0 1 1 17.32 0" }]
  ];
  Icon($$renderer, spread_props([
    { name: "gauge" },
    $$sanitized_props,
    {
      /**
       * @component @name Gauge
       * @description Lucide SVG icon component, renders SVG Element with children.
       *
       * @preview ![img](data:image/svg+xml;base64,PHN2ZyAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogIHdpZHRoPSIyNCIKICBoZWlnaHQ9IjI0IgogIHZpZXdCb3g9IjAgMCAyNCAyNCIKICBmaWxsPSJub25lIgogIHN0cm9rZT0iIzAwMCIgc3R5bGU9ImJhY2tncm91bmQtY29sb3I6ICNmZmY7IGJvcmRlci1yYWRpdXM6IDJweCIKICBzdHJva2Utd2lkdGg9IjIiCiAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogIHN0cm9rZS1saW5lam9pbj0icm91bmQiCj4KICA8cGF0aCBkPSJtMTIgMTQgNC00IiAvPgogIDxwYXRoIGQ9Ik0zLjM0IDE5YTEwIDEwIDAgMSAxIDE3LjMyIDAiIC8+Cjwvc3ZnPgo=) - https://lucide.dev/icons/gauge
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
function Receipt($$renderer, $$props) {
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
        "d": "M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"
      }
    ],
    ["path", { "d": "M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" }],
    ["path", { "d": "M12 17.5v-11" }]
  ];
  Icon($$renderer, spread_props([
    { name: "receipt" },
    $$sanitized_props,
    {
      /**
       * @component @name Receipt
       * @description Lucide SVG icon component, renders SVG Element with children.
       *
       * @preview ![img](data:image/svg+xml;base64,PHN2ZyAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogIHdpZHRoPSIyNCIKICBoZWlnaHQ9IjI0IgogIHZpZXdCb3g9IjAgMCAyNCAyNCIKICBmaWxsPSJub25lIgogIHN0cm9rZT0iIzAwMCIgc3R5bGU9ImJhY2tncm91bmQtY29sb3I6ICNmZmY7IGJvcmRlci1yYWRpdXM6IDJweCIKICBzdHJva2Utd2lkdGg9IjIiCiAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogIHN0cm9rZS1saW5lam9pbj0icm91bmQiCj4KICA8cGF0aCBkPSJNNCAydjIwbDItMSAyIDEgMi0xIDIgMSAyLTEgMiAxIDItMSAyIDFWMmwtMiAxLTItMS0yIDEtMi0xLTIgMS0yLTEtMiAxWiIgLz4KICA8cGF0aCBkPSJNMTYgOGgtNmEyIDIgMCAxIDAgMCA0aDRhMiAyIDAgMSAxIDAgNEg4IiAvPgogIDxwYXRoIGQ9Ik0xMiAxNy41di0xMSIgLz4KPC9zdmc+Cg==) - https://lucide.dev/icons/receipt
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
function Trending_down($$renderer, $$props) {
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
    ["polyline", { "points": "22 17 13.5 8.5 8.5 13.5 2 7" }],
    ["polyline", { "points": "16 17 22 17 22 11" }]
  ];
  Icon($$renderer, spread_props([
    { name: "trending-down" },
    $$sanitized_props,
    {
      /**
       * @component @name TrendingDown
       * @description Lucide SVG icon component, renders SVG Element with children.
       *
       * @preview ![img](data:image/svg+xml;base64,PHN2ZyAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogIHdpZHRoPSIyNCIKICBoZWlnaHQ9IjI0IgogIHZpZXdCb3g9IjAgMCAyNCAyNCIKICBmaWxsPSJub25lIgogIHN0cm9rZT0iIzAwMCIgc3R5bGU9ImJhY2tncm91bmQtY29sb3I6ICNmZmY7IGJvcmRlci1yYWRpdXM6IDJweCIKICBzdHJva2Utd2lkdGg9IjIiCiAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogIHN0cm9rZS1saW5lam9pbj0icm91bmQiCj4KICA8cG9seWxpbmUgcG9pbnRzPSIyMiAxNyAxMy41IDguNSA4LjUgMTMuNSAyIDciIC8+CiAgPHBvbHlsaW5lIHBvaW50cz0iMTYgMTcgMjIgMTcgMjIgMTEiIC8+Cjwvc3ZnPgo=) - https://lucide.dev/icons/trending-down
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
function getElemDirection(elem) {
  const style = window.getComputedStyle(elem);
  const direction = style.getPropertyValue("direction");
  return direction;
}
function getNextKey(dir = "ltr", orientation = "horizontal") {
  return {
    horizontal: dir === "rtl" ? ARROW_LEFT : ARROW_RIGHT,
    vertical: ARROW_DOWN
  }[orientation];
}
function getPrevKey(dir = "ltr", orientation = "horizontal") {
  return {
    horizontal: dir === "rtl" ? ARROW_RIGHT : ARROW_LEFT,
    vertical: ARROW_UP
  }[orientation];
}
function getDirectionalKeys(dir = "ltr", orientation = "horizontal") {
  if (!["ltr", "rtl"].includes(dir))
    dir = "ltr";
  if (!["horizontal", "vertical"].includes(orientation))
    orientation = "horizontal";
  return {
    nextKey: getNextKey(dir, orientation),
    prevKey: getPrevKey(dir, orientation)
  };
}
function useRovingFocus(props) {
  const currentTabStopId = box(null);
  function getCandidateNodes() {
    if (!isBrowser) return [];
    const node = document.getElementById(props.rootNodeId.current);
    if (!node) return [];
    if (props.candidateSelector) {
      const candidates = Array.from(node.querySelectorAll(props.candidateSelector));
      return candidates;
    } else if (props.candidateAttr) {
      const candidates = Array.from(node.querySelectorAll(`[${props.candidateAttr}]:not([data-disabled])`));
      return candidates;
    }
    return [];
  }
  function focusFirstCandidate() {
    const items = getCandidateNodes();
    if (!items.length) return;
    items[0]?.focus();
  }
  function handleKeydown(node, e, both = false) {
    const rootNode = document.getElementById(props.rootNodeId.current);
    if (!rootNode || !node) return;
    const items = getCandidateNodes();
    if (!items.length) return;
    const currentIndex = items.indexOf(node);
    const dir = getElemDirection(rootNode);
    const { nextKey, prevKey } = getDirectionalKeys(dir, props.orientation.current);
    const loop = props.loop.current;
    const keyToIndex = {
      [nextKey]: currentIndex + 1,
      [prevKey]: currentIndex - 1,
      [HOME]: 0,
      [END]: items.length - 1
    };
    if (both) {
      const altNextKey = nextKey === ARROW_DOWN ? ARROW_RIGHT : ARROW_DOWN;
      const altPrevKey = prevKey === ARROW_UP ? ARROW_LEFT : ARROW_UP;
      keyToIndex[altNextKey] = currentIndex + 1;
      keyToIndex[altPrevKey] = currentIndex - 1;
    }
    let itemIndex = keyToIndex[e.key];
    if (itemIndex === void 0) return;
    e.preventDefault();
    if (itemIndex < 0 && loop) {
      itemIndex = items.length - 1;
    } else if (itemIndex === items.length && loop) {
      itemIndex = 0;
    }
    const itemToFocus = items[itemIndex];
    if (!itemToFocus) return;
    itemToFocus.focus();
    currentTabStopId.current = itemToFocus.id;
    props.onCandidateFocus?.(itemToFocus);
    return itemToFocus;
  }
  function getTabIndex(node) {
    const items = getCandidateNodes();
    const anyActive = currentTabStopId.current !== null;
    if (node && !anyActive && items[0] === node) {
      currentTabStopId.current = node.id;
      return 0;
    } else if (node?.id === currentTabStopId.current) {
      return 0;
    }
    return -1;
  }
  return {
    setCurrentTabStopId(id) {
      currentTabStopId.current = id;
    },
    getTabIndex,
    handleKeydown,
    focusFirstCandidate,
    currentTabStopId
  };
}
const TABS_ROOT_ATTR = "data-tabs-root";
const TABS_LIST_ATTR = "data-tabs-list";
const TABS_TRIGGER_ATTR = "data-tabs-trigger";
const TABS_CONTENT_ATTR = "data-tabs-content";
class TabsRootState {
  opts;
  rovingFocusGroup;
  triggerIds = [];
  // holds the trigger ID for each value to associate it with the content
  valueToTriggerId = new SvelteMap();
  // holds the content ID for each value to associate it with the trigger
  valueToContentId = new SvelteMap();
  constructor(opts) {
    this.opts = opts;
    useRefById(opts);
    this.rovingFocusGroup = useRovingFocus({
      candidateAttr: TABS_TRIGGER_ATTR,
      rootNodeId: this.opts.id,
      loop: this.opts.loop,
      orientation: this.opts.orientation
    });
  }
  registerTrigger(id, value) {
    this.triggerIds.push(id);
    this.valueToTriggerId.set(value, id);
    return () => {
      this.triggerIds = this.triggerIds.filter((triggerId) => triggerId !== id);
      this.valueToTriggerId.delete(value);
    };
  }
  registerContent(id, value) {
    this.valueToContentId.set(value, id);
    return () => {
      this.valueToContentId.delete(value);
    };
  }
  setValue(v) {
    this.opts.value.current = v;
  }
  #props = derived(() => ({
    id: this.opts.id.current,
    "data-orientation": getDataOrientation(this.opts.orientation.current),
    [TABS_ROOT_ATTR]: ""
  }));
  get props() {
    return this.#props();
  }
  set props($$value) {
    return this.#props($$value);
  }
}
class TabsListState {
  opts;
  root;
  #isDisabled = derived(() => this.root.opts.disabled.current);
  constructor(opts, root) {
    this.opts = opts;
    this.root = root;
    useRefById(opts);
  }
  #props = derived(() => ({
    id: this.opts.id.current,
    role: "tablist",
    "aria-orientation": getAriaOrientation(this.root.opts.orientation.current),
    "data-orientation": getDataOrientation(this.root.opts.orientation.current),
    [TABS_LIST_ATTR]: "",
    "data-disabled": getDataDisabled(this.#isDisabled())
  }));
  get props() {
    return this.#props();
  }
  set props($$value) {
    return this.#props($$value);
  }
}
class TabsTriggerState {
  opts;
  root;
  #isActive = derived(() => this.root.opts.value.current === this.opts.value.current);
  #isDisabled = derived(() => this.opts.disabled.current || this.root.opts.disabled.current);
  #tabIndex = 0;
  #ariaControls = derived(() => this.root.valueToContentId.get(this.opts.value.current));
  constructor(opts, root) {
    this.opts = opts;
    this.root = root;
    useRefById(opts);
    watch([() => this.opts.id.current, () => this.opts.value.current], ([id, value]) => {
      return this.root.registerTrigger(id, value);
    });
    this.onfocus = this.onfocus.bind(this);
    this.onclick = this.onclick.bind(this);
    this.onkeydown = this.onkeydown.bind(this);
  }
  #activate() {
    if (this.root.opts.value.current === this.opts.value.current) return;
    this.root.setValue(this.opts.value.current);
  }
  onfocus(_) {
    if (this.root.opts.activationMode.current !== "automatic" || this.#isDisabled()) return;
    this.#activate();
  }
  onclick(_) {
    if (this.#isDisabled()) return;
    this.#activate();
  }
  onkeydown(e) {
    if (this.#isDisabled()) return;
    if (e.key === SPACE || e.key === ENTER) {
      e.preventDefault();
      this.#activate();
      return;
    }
    this.root.rovingFocusGroup.handleKeydown(this.opts.ref.current, e);
  }
  #props = derived(() => ({
    id: this.opts.id.current,
    role: "tab",
    "data-state": getTabDataState(this.#isActive()),
    "data-value": this.opts.value.current,
    "data-orientation": getDataOrientation(this.root.opts.orientation.current),
    "data-disabled": getDataDisabled(this.#isDisabled()),
    "aria-selected": getAriaSelected(this.#isActive()),
    "aria-controls": this.#ariaControls(),
    [TABS_TRIGGER_ATTR]: "",
    disabled: getDisabled(this.#isDisabled()),
    tabindex: this.#tabIndex,
    //
    onclick: this.onclick,
    onfocus: this.onfocus,
    onkeydown: this.onkeydown
  }));
  get props() {
    return this.#props();
  }
  set props($$value) {
    return this.#props($$value);
  }
}
class TabsContentState {
  opts;
  root;
  #isActive = derived(() => this.root.opts.value.current === this.opts.value.current);
  #ariaLabelledBy = derived(() => this.root.valueToTriggerId.get(this.opts.value.current));
  constructor(opts, root) {
    this.opts = opts;
    this.root = root;
    useRefById(opts);
    watch([() => this.opts.id.current, () => this.opts.value.current], ([id, value]) => {
      return this.root.registerContent(id, value);
    });
  }
  #props = derived(() => ({
    id: this.opts.id.current,
    role: "tabpanel",
    hidden: getHidden(!this.#isActive()),
    tabindex: 0,
    "data-value": this.opts.value.current,
    "data-state": getTabDataState(this.#isActive()),
    "aria-labelledby": this.#ariaLabelledBy(),
    [TABS_CONTENT_ATTR]: ""
  }));
  get props() {
    return this.#props();
  }
  set props($$value) {
    return this.#props($$value);
  }
}
const TabsRootContext = new Context("Tabs.Root");
function useTabsRoot(props) {
  return TabsRootContext.set(new TabsRootState(props));
}
function useTabsTrigger(props) {
  return new TabsTriggerState(props, TabsRootContext.get());
}
function useTabsList(props) {
  return new TabsListState(props, TabsRootContext.get());
}
function useTabsContent(props) {
  return new TabsContentState(props, TabsRootContext.get());
}
function getTabDataState(condition) {
  return condition ? "active" : "inactive";
}
function Tabs$1($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      id = useId(),
      ref = null,
      value = "",
      onValueChange = noop,
      orientation = "horizontal",
      loop = true,
      activationMode = "automatic",
      disabled = false,
      children,
      child,
      $$slots,
      $$events,
      ...restProps
    } = $$props;
    const rootState = useTabsRoot({
      id: box.with(() => id),
      value: box.with(() => value, (v) => {
        value = v;
        onValueChange(v);
      }),
      orientation: box.with(() => orientation),
      loop: box.with(() => loop),
      activationMode: box.with(() => activationMode),
      disabled: box.with(() => disabled),
      ref: box.with(() => ref, (v) => ref = v)
    });
    const mergedProps = derived(() => mergeProps(restProps, rootState.props));
    if (child) {
      $$renderer2.push("<!--[0-->");
      child($$renderer2, { props: mergedProps() });
      $$renderer2.push(`<!---->`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<div${attributes({ ...mergedProps() })}>`);
      children?.($$renderer2);
      $$renderer2.push(`<!----></div>`);
    }
    $$renderer2.push(`<!--]-->`);
    bind_props($$props, { ref, value });
  });
}
function Tabs_content$1($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      children,
      child,
      id = useId(),
      ref = null,
      value,
      $$slots,
      $$events,
      ...restProps
    } = $$props;
    const contentState = useTabsContent({
      value: box.with(() => value),
      id: box.with(() => id),
      ref: box.with(() => ref, (v) => ref = v)
    });
    const mergedProps = derived(() => mergeProps(restProps, contentState.props));
    if (child) {
      $$renderer2.push("<!--[0-->");
      child($$renderer2, { props: mergedProps() });
      $$renderer2.push(`<!---->`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<div${attributes({ ...mergedProps() })}>`);
      children?.($$renderer2);
      $$renderer2.push(`<!----></div>`);
    }
    $$renderer2.push(`<!--]-->`);
    bind_props($$props, { ref });
  });
}
function Tabs_list$1($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      child,
      children,
      id = useId(),
      ref = null,
      $$slots,
      $$events,
      ...restProps
    } = $$props;
    const listState = useTabsList({
      id: box.with(() => id),
      ref: box.with(() => ref, (v) => ref = v)
    });
    const mergedProps = derived(() => mergeProps(restProps, listState.props));
    if (child) {
      $$renderer2.push("<!--[0-->");
      child($$renderer2, { props: mergedProps() });
      $$renderer2.push(`<!---->`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<div${attributes({ ...mergedProps() })}>`);
      children?.($$renderer2);
      $$renderer2.push(`<!----></div>`);
    }
    $$renderer2.push(`<!--]-->`);
    bind_props($$props, { ref });
  });
}
function Tabs_trigger$1($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      child,
      children,
      disabled = false,
      id = useId(),
      type = "button",
      value,
      ref = null,
      $$slots,
      $$events,
      ...restProps
    } = $$props;
    const triggerState = useTabsTrigger({
      id: box.with(() => id),
      disabled: box.with(() => disabled ?? false),
      value: box.with(() => value),
      ref: box.with(() => ref, (v) => ref = v)
    });
    const mergedProps = derived(() => mergeProps(restProps, triggerState.props, { type }));
    if (child) {
      $$renderer2.push("<!--[0-->");
      child($$renderer2, { props: mergedProps() });
      $$renderer2.push(`<!---->`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<button${attributes({ ...mergedProps() })}>`);
      children?.($$renderer2);
      $$renderer2.push(`<!----></button>`);
    }
    $$renderer2.push(`<!--]-->`);
    bind_props($$props, { ref });
  });
}
function Tabs($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      class: className,
      orientation = "horizontal",
      children,
      $$slots,
      $$events,
      ...rest
    } = $$props;
    if (Tabs$1) {
      $$renderer2.push("<!--[-->");
      Tabs$1($$renderer2, spread_props([
        {
          "data-slot": "tabs",
          "data-orientation": orientation,
          orientation,
          class: cn("group/tabs flex gap-2 data-[orientation=horizontal]:flex-col", className)
        },
        rest,
        {
          children: ($$renderer3) => {
            if (children) {
              $$renderer3.push("<!--[0-->");
              children($$renderer3);
              $$renderer3.push(`<!---->`);
            } else {
              $$renderer3.push("<!--[-1-->");
            }
            $$renderer3.push(`<!--]-->`);
          },
          $$slots: { default: true }
        }
      ]));
      $$renderer2.push("<!--]-->");
    } else {
      $$renderer2.push("<!--[!-->");
      $$renderer2.push("<!--]-->");
    }
  });
}
function Tabs_list($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      class: className,
      variant = "default",
      children,
      $$slots,
      $$events,
      ...rest
    } = $$props;
    const variantClasses = { default: "bg-muted", line: "gap-1 bg-transparent" };
    if (Tabs_list$1) {
      $$renderer2.push("<!--[-->");
      Tabs_list$1($$renderer2, spread_props([
        {
          "data-slot": "tabs-list",
          "data-variant": variant,
          class: cn("p-[3px] group-data-[orientation=horizontal]/tabs:h-9 group/tabs-list text-muted-foreground inline-flex w-fit items-center justify-center group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col", variantClasses[variant ?? "default"], className)
        },
        rest,
        {
          children: ($$renderer3) => {
            if (children) {
              $$renderer3.push("<!--[0-->");
              children($$renderer3);
              $$renderer3.push(`<!---->`);
            } else {
              $$renderer3.push("<!--[-1-->");
            }
            $$renderer3.push(`<!--]-->`);
          },
          $$slots: { default: true }
        }
      ]));
      $$renderer2.push("<!--]-->");
    } else {
      $$renderer2.push("<!--[!-->");
      $$renderer2.push("<!--]-->");
    }
  });
}
function Tabs_trigger($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { class: className, children, $$slots, $$events, ...rest } = $$props;
    if (Tabs_trigger$1) {
      $$renderer2.push("<!--[-->");
      Tabs_trigger$1($$renderer2, spread_props([
        {
          "data-slot": "tabs-trigger",
          class: cn("focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring text-foreground/60 hover:text-foreground dark:text-muted-foreground dark:hover:text-foreground relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap transition-[color,background-color,border-color,box-shadow] group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4", "data-[state=active]:bg-background dark:data-[state=active]:text-foreground dark:data-[state=active]:border-input dark:data-[state=active]:bg-input/30 data-[state=active]:text-foreground", className)
        },
        rest,
        {
          children: ($$renderer3) => {
            if (children) {
              $$renderer3.push("<!--[0-->");
              children($$renderer3);
              $$renderer3.push(`<!---->`);
            } else {
              $$renderer3.push("<!--[-1-->");
            }
            $$renderer3.push(`<!--]-->`);
          },
          $$slots: { default: true }
        }
      ]));
      $$renderer2.push("<!--]-->");
    } else {
      $$renderer2.push("<!--[!-->");
      $$renderer2.push("<!--]-->");
    }
  });
}
function Tabs_content($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { class: className, children, $$slots, $$events, ...rest } = $$props;
    if (Tabs_content$1) {
      $$renderer2.push("<!--[-->");
      Tabs_content$1($$renderer2, spread_props([
        {
          "data-slot": "tabs-content",
          class: cn("flex-1 outline-none", className)
        },
        rest,
        {
          children: ($$renderer3) => {
            if (children) {
              $$renderer3.push("<!--[0-->");
              children($$renderer3);
              $$renderer3.push(`<!---->`);
            } else {
              $$renderer3.push("<!--[-1-->");
            }
            $$renderer3.push(`<!--]-->`);
          },
          $$slots: { default: true }
        }
      ]));
      $$renderer2.push("<!--]-->");
    } else {
      $$renderer2.push("<!--[!-->");
      $$renderer2.push("<!--]-->");
    }
  });
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let byAgentData = [];
    let byProviderData = [];
    let byProjectData = [];
    let financeEvents = [];
    let billersData = [];
    let budgetsData = [];
    let activeTab = "overview";
    let datePreset = "mtd";
    let quotaWindows = [];
    let inferenceSpend = derived(() => 0);
    let totalTokens = derived(() => 0);
    let totalRequests = derived(() => 0);
    let financeNet = derived(() => 0 - 0);
    let financeDebits = derived(() => 0);
    let financeCredits = derived(() => 0);
    let financeEstimated = derived(() => 0);
    function formatCurrency(value) {
      if (value === void 0 || value === null) return "$0.00";
      return `$${value.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    function formatSmallCurrency(value) {
      if (value === void 0 || value === null) return "$0.0000";
      return `$${value.toLocaleString("en", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`;
    }
    function formatTokens(value) {
      if (value === void 0 || value === null || value === 0) return "0";
      if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
      if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
      if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
      return value.toString();
    }
    function formatDate(value) {
      if (!value) return "---";
      try {
        return new Date(value).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
      } catch {
        return value;
      }
    }
    function quotaBarColor(pct) {
      if (pct > 90) return "#ef4444";
      if (pct > 70) return "#f59e0b";
      return "#10b981";
    }
    const TABS = [
      { value: "overview", label: "Overview", icon: Layout_dashboard },
      { value: "budgets", label: "Budgets", icon: Shield },
      { value: "providers", label: "Providers", icon: Server },
      { value: "billers", label: "Billers", icon: Credit_card },
      { value: "finance", label: "Finance", icon: Receipt }
    ];
    const DATE_PRESETS = [
      { key: "mtd", label: "Month to Date" },
      { key: "7d", label: "Last 7 Days" },
      { key: "30d", label: "Last 30 Days" },
      { key: "ytd", label: "Year to Date" },
      { key: "all", label: "All Time" },
      { key: "custom", label: "Custom" }
    ];
    $$renderer2.push(`<div class="costs-root space-y-6 p-6"><div><h1 class="text-2xl font-bold text-foreground">Costs &amp; Budgets</h1> <p class="mt-1 text-sm text-muted-foreground">Track spending across agents and providers</p></div> `);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"><!--[-->`);
      const each_array = ensure_array_like(Array(4));
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        each_array[$$index];
        $$renderer2.push(`<div class="h-28 animate-pulse rounded-xl border border-border bg-card"></div>`);
      }
      $$renderer2.push(`<!--]--></div>`);
    }
    $$renderer2.push(`<!--]--> <div class="rounded-xl border border-border bg-card overflow-hidden">`);
    Tabs($$renderer2, {
      value: activeTab,
      onValueChange: (v) => {
        if (v) activeTab = v;
      },
      class: "w-full",
      children: ($$renderer3) => {
        $$renderer3.push(`<div class="border-b border-border px-5 pt-4 pb-0 overflow-x-auto">`);
        Tabs_list($$renderer3, {
          class: "bg-transparent p-0 h-auto gap-0",
          children: ($$renderer4) => {
            $$renderer4.push(`<!--[-->`);
            const each_array_1 = ensure_array_like(TABS);
            for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
              let tab = each_array_1[$$index_1];
              Tabs_trigger($$renderer4, {
                value: tab.value,
                class: "rounded-none border-b-2 border-transparent px-4 pb-3 pt-1 text-sm font-medium text-muted-foreground data-[state=active]:border-blue-500 data-[state=active]:text-foreground data-[state=active]:bg-transparent hover:text-foreground transition-colors",
                children: ($$renderer5) => {
                  if (tab.icon) {
                    $$renderer5.push("<!--[-->");
                    tab.icon($$renderer5, { size: 14, class: "mr-1.5" });
                    $$renderer5.push("<!--]-->");
                  } else {
                    $$renderer5.push("<!--[!-->");
                    $$renderer5.push("<!--]-->");
                  }
                  $$renderer5.push(` ${escape_html(tab.label)}`);
                },
                $$slots: { default: true }
              });
            }
            $$renderer4.push(`<!--]-->`);
          },
          $$slots: { default: true }
        });
        $$renderer3.push(`<!----></div> `);
        Tabs_content($$renderer3, {
          value: "overview",
          children: ($$renderer4) => {
            $$renderer4.push(`<div class="flex flex-wrap items-center gap-2 px-5 pt-4 pb-2"><!--[-->`);
            const each_array_2 = ensure_array_like(DATE_PRESETS);
            for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
              let preset = each_array_2[$$index_2];
              $$renderer4.push(`<button${attr_class(`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${stringify(datePreset === preset.key ? "bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30" : "bg-secondary text-muted-foreground border border-border hover:bg-accent hover:text-foreground")}`)}>${escape_html(preset.label)}</button>`);
            }
            $$renderer4.push(`<!--]--></div> <div class="px-5 pt-4 pb-2"><h3 class="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Inference Ledger</h3> <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-4"><div class="rounded-lg border border-border bg-secondary/50 p-4"><div class="flex items-center gap-2 mb-2">`);
            Dollar_sign($$renderer4, { class: "h-4 w-4 text-blue-500" });
            $$renderer4.push(`<!----> <span class="text-xs font-medium text-muted-foreground">Spend</span></div> <p class="text-xl font-bold text-foreground">${escape_html(formatCurrency(inferenceSpend()))}</p> `);
            {
              $$renderer4.push("<!--[-1-->");
            }
            $$renderer4.push(`<!--]--></div> <div class="rounded-lg border border-border bg-secondary/50 p-4"><div class="flex items-center gap-2 mb-2">`);
            Zap($$renderer4, { class: "h-4 w-4 text-amber-500" });
            $$renderer4.push(`<!----> <span class="text-xs font-medium text-muted-foreground">Usage</span></div> <p class="text-xl font-bold text-foreground">${escape_html(formatTokens(totalTokens()))}</p> <p class="mt-1 text-xs text-muted-foreground">${escape_html(totalRequests().toLocaleString("en"))} requests</p></div></div></div> `);
            {
              $$renderer4.push("<!--[0-->");
              $$renderer4.push(`<div class="p-5 space-y-3"><!--[-->`);
              const each_array_3 = ensure_array_like(Array(5));
              for (let $$index_3 = 0, $$length = each_array_3.length; $$index_3 < $$length; $$index_3++) {
                each_array_3[$$index_3];
                $$renderer4.push(`<div class="h-10 animate-pulse rounded bg-secondary"></div>`);
              }
              $$renderer4.push(`<!--]--></div>`);
            }
            $$renderer4.push(`<!--]--> <div class="px-5 pt-6 pb-5 border-t border-border"><h3 class="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Finance Ledger</h3> <div class="grid grid-cols-2 gap-3 sm:grid-cols-4"><div class="rounded-lg border border-red-500/20 bg-red-500/5 p-4"><div class="flex items-center gap-1.5 mb-1.5">`);
            Arrow_down_right($$renderer4, { class: "h-3.5 w-3.5 text-red-500" });
            $$renderer4.push(`<!----> <span class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Debits</span></div> <p class="text-lg font-bold text-red-600 dark:text-red-400">${escape_html(formatCurrency(financeDebits()))}</p></div> <div class="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4"><div class="flex items-center gap-1.5 mb-1.5">`);
            Arrow_up_right($$renderer4, { class: "h-3.5 w-3.5 text-emerald-500" });
            $$renderer4.push(`<!----> <span class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Credits</span></div> <p class="text-lg font-bold text-emerald-600 dark:text-emerald-400">${escape_html(formatCurrency(financeCredits()))}</p></div> <div class="rounded-lg border border-border bg-secondary/50 p-4"><div class="flex items-center gap-1.5 mb-1.5">`);
            Activity($$renderer4, { class: "h-3.5 w-3.5 text-violet-500" });
            $$renderer4.push(`<!----> <span class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Net</span></div> <p class="text-lg font-bold text-foreground">${escape_html(formatCurrency(financeNet()))}</p></div> <div class="rounded-lg border border-border bg-secondary/50 p-4"><div class="flex items-center gap-1.5 mb-1.5">`);
            Calendar($$renderer4, { class: "h-3.5 w-3.5 text-amber-500" });
            $$renderer4.push(`<!----> <span class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Estimated</span></div> <p class="text-lg font-bold text-foreground">${escape_html(formatCurrency(financeEstimated()))}</p></div></div></div>`);
          },
          $$slots: { default: true }
        });
        $$renderer3.push(`<!----> `);
        Tabs_content($$renderer3, {
          value: "budgets",
          children: ($$renderer4) => {
            if (budgetsData.length === 0) {
              $$renderer4.push("<!--[1-->");
              $$renderer4.push(`<div class="flex flex-col items-center justify-center py-12"><div class="rounded-full bg-secondary p-3 mb-3">`);
              Shield($$renderer4, { class: "h-8 w-8 text-muted-foreground" });
              $$renderer4.push(`<!----></div> <p class="text-sm text-muted-foreground">No budgets configured</p> <p class="mt-1 text-xs text-muted-foreground">Create a budget to set spending limits for agents and providers</p></div>`);
            } else {
              $$renderer4.push("<!--[-1-->");
              $$renderer4.push(`<div class="p-5 space-y-3"><!--[-->`);
              const each_array_6 = ensure_array_like(budgetsData);
              for (let i = 0, $$length = each_array_6.length; i < $$length; i++) {
                let budget = each_array_6[i];
                const used = budget.used ?? budget.currentSpend ?? 0;
                const limit = budget.limit ?? budget.monthlyLimit ?? budget.total ?? 0;
                const pct = limit > 0 ? Math.min(100, used / limit * 100) : 0;
                $$renderer4.push(`<div class="rounded-lg border border-border bg-secondary/30 p-4"><div class="flex items-center justify-between mb-2"><div class="flex items-center gap-2">`);
                Shield($$renderer4, { size: 14, class: "text-muted-foreground" });
                $$renderer4.push(`<!----> <span class="text-sm font-medium text-foreground">${escape_html(budget.name ?? budget.label ?? "Budget")}</span> `);
                if (budget.scope ?? budget.type) {
                  $$renderer4.push("<!--[0-->");
                  $$renderer4.push(`<span class="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">${escape_html(budget.scope ?? budget.type)}</span>`);
                } else {
                  $$renderer4.push("<!--[-1-->");
                }
                $$renderer4.push(`<!--]--></div> <span class="text-xs font-semibold"${attr_style(`color: ${stringify(quotaBarColor(pct))};`)}>${escape_html(pct.toFixed(0))}%</span></div> <div class="h-2 w-full overflow-hidden rounded-full bg-secondary"><div class="h-full rounded-full transition-all duration-500"${attr_style(`width: ${stringify(pct)}%; background-color: ${stringify(quotaBarColor(pct))};`)}></div></div> <div class="mt-1.5 flex items-center justify-between"><span class="text-[11px] text-muted-foreground">${escape_html(formatCurrency(used))} used</span> <span class="text-[11px] text-muted-foreground">${escape_html(limit > 0 ? `${formatCurrency(limit)} limit` : "No cap")}</span></div></div>`);
              }
              $$renderer4.push(`<!--]--></div>`);
            }
            $$renderer4.push(`<!--]-->`);
          },
          $$slots: { default: true }
        });
        $$renderer3.push(`<!----> `);
        Tabs_content($$renderer3, {
          value: "providers",
          children: ($$renderer4) => {
            {
              $$renderer4.push("<!--[-1-->");
              $$renderer4.push(`<div class="px-5 pt-4 pb-2"><h3 class="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">By Provider</h3></div> `);
              if (byProviderData.length === 0) {
                $$renderer4.push("<!--[0-->");
                $$renderer4.push(`<div class="flex flex-col items-center justify-center py-8"><div class="rounded-full bg-secondary p-3 mb-3">`);
                Server($$renderer4, { class: "h-8 w-8 text-muted-foreground" });
                $$renderer4.push(`<!----></div> <p class="text-sm text-muted-foreground">No provider cost data available</p></div>`);
              } else {
                $$renderer4.push("<!--[-1-->");
                $$renderer4.push(`<div class="border-t border-border"><div class="grid grid-cols-12 gap-4 px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground border-b border-border"><div class="col-span-4">Provider</div> <div class="col-span-2 text-right">Input Cost</div> <div class="col-span-2 text-right">Output Cost</div> <div class="col-span-2 text-right">Total</div> <div class="col-span-2 text-right">Requests</div></div> <!--[-->`);
                const each_array_8 = ensure_array_like(byProviderData);
                for (let i = 0, $$length = each_array_8.length; i < $$length; i++) {
                  let row = each_array_8[i];
                  $$renderer4.push(`<div class="grid grid-cols-12 gap-4 px-5 py-3 text-sm border-b border-border last:border-0 hover:bg-accent/50 transition-colors"><div class="col-span-4 flex items-center gap-3 min-w-0"><div class="shrink-0 rounded-lg bg-orange-500/10 p-1.5">`);
                  Server($$renderer4, { class: "h-3.5 w-3.5 text-orange-500" });
                  $$renderer4.push(`<!----></div> <p class="text-foreground truncate font-medium">${escape_html(row.provider ?? row.name ?? "---")}</p></div> <div class="col-span-2 text-right text-muted-foreground">${escape_html(formatSmallCurrency(row.inputCost))}</div> <div class="col-span-2 text-right text-muted-foreground">${escape_html(formatSmallCurrency(row.outputCost))}</div> <div class="col-span-2 text-right font-medium text-foreground">${escape_html(formatSmallCurrency(row.totalCost ?? row.total ?? row.cost))}</div> <div class="col-span-2 text-right text-muted-foreground">${escape_html(row.requestCount ?? row.requests ?? "---")}</div></div>`);
                }
                $$renderer4.push(`<!--]--></div>`);
              }
              $$renderer4.push(`<!--]--> <div class="px-5 pt-6 pb-2 border-t border-border"><h3 class="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">By Agent</h3></div> `);
              if (byAgentData.length === 0) {
                $$renderer4.push("<!--[0-->");
                $$renderer4.push(`<div class="flex flex-col items-center justify-center py-8"><div class="rounded-full bg-secondary p-3 mb-3">`);
                Bot($$renderer4, { class: "h-8 w-8 text-muted-foreground" });
                $$renderer4.push(`<!----></div> <p class="text-sm text-muted-foreground">No agent cost data available</p></div>`);
              } else {
                $$renderer4.push("<!--[-1-->");
                $$renderer4.push(`<div class="border-t border-border"><div class="grid grid-cols-12 gap-4 px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground border-b border-border"><div class="col-span-4">Agent Name</div> <div class="col-span-2 text-right">Input Cost</div> <div class="col-span-2 text-right">Output Cost</div> <div class="col-span-2 text-right">Total</div> <div class="col-span-2 text-right">Requests</div></div> <!--[-->`);
                const each_array_9 = ensure_array_like(byAgentData);
                for (let i = 0, $$length = each_array_9.length; i < $$length; i++) {
                  let row = each_array_9[i];
                  $$renderer4.push(`<div class="grid grid-cols-12 gap-4 px-5 py-3 text-sm border-b border-border last:border-0 hover:bg-accent/50 transition-colors"><div class="col-span-4 flex items-center gap-3 min-w-0"><div class="shrink-0 rounded-lg bg-blue-500/10 p-1.5">`);
                  Bot($$renderer4, { class: "h-3.5 w-3.5 text-blue-500" });
                  $$renderer4.push(`<!----></div> <p class="text-foreground truncate font-medium">${escape_html(row.agentName ?? row.name ?? row.agent ?? "---")}</p></div> <div class="col-span-2 text-right text-muted-foreground">${escape_html(formatSmallCurrency(row.inputCost))}</div> <div class="col-span-2 text-right text-muted-foreground">${escape_html(formatSmallCurrency(row.outputCost))}</div> <div class="col-span-2 text-right font-medium text-foreground">${escape_html(formatSmallCurrency(row.totalCost ?? row.total ?? row.cost))}</div> <div class="col-span-2 text-right text-muted-foreground">${escape_html(row.requestCount ?? row.requests ?? "---")}</div></div>`);
                }
                $$renderer4.push(`<!--]--></div>`);
              }
              $$renderer4.push(`<!--]-->`);
            }
            $$renderer4.push(`<!--]-->`);
          },
          $$slots: { default: true }
        });
        $$renderer3.push(`<!----> `);
        Tabs_content($$renderer3, {
          value: "billers",
          children: ($$renderer4) => {
            {
              $$renderer4.push("<!--[-1-->");
              $$renderer4.push(`<div class="px-5 pt-4 pb-2"><h3 class="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Billers</h3></div> `);
              if (billersData.length === 0) {
                $$renderer4.push("<!--[0-->");
                $$renderer4.push(`<div class="flex flex-col items-center justify-center py-8"><div class="rounded-full bg-secondary p-3 mb-3">`);
                Credit_card($$renderer4, { class: "h-8 w-8 text-muted-foreground" });
                $$renderer4.push(`<!----></div> <p class="text-sm text-muted-foreground">No biller data available</p></div>`);
              } else {
                $$renderer4.push("<!--[-1-->");
                $$renderer4.push(`<div class="border-t border-border"><div class="grid grid-cols-12 gap-4 px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground border-b border-border"><div class="col-span-4">Biller</div> <div class="col-span-2">Status</div> <div class="col-span-3 text-right">Total Billed</div> <div class="col-span-3 text-right">Events</div></div> <!--[-->`);
                const each_array_11 = ensure_array_like(billersData);
                for (let i = 0, $$length = each_array_11.length; i < $$length; i++) {
                  let biller = each_array_11[i];
                  $$renderer4.push(`<div class="grid grid-cols-12 gap-4 px-5 py-3 text-sm border-b border-border last:border-0 hover:bg-accent/50 transition-colors"><div class="col-span-4 flex items-center gap-3 min-w-0"><div class="shrink-0 rounded-lg bg-violet-500/10 p-1.5">`);
                  Credit_card($$renderer4, { class: "h-3.5 w-3.5 text-violet-500" });
                  $$renderer4.push(`<!----></div> <p class="text-foreground truncate font-medium">${escape_html(biller.name ?? biller.biller ?? "---")}</p></div> <div class="col-span-2"><span${attr_class(`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${stringify((biller.status ?? "active") === "active" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-secondary text-muted-foreground")}`)}>${escape_html(biller.status ?? "active")}</span></div> <div class="col-span-3 text-right font-medium text-foreground">${escape_html(formatCurrency(biller.totalBilled ?? biller.total ?? biller.amount ?? 0))}</div> <div class="col-span-3 text-right text-muted-foreground">${escape_html(biller.eventCount ?? biller.events ?? "---")}</div></div>`);
                }
                $$renderer4.push(`<!--]--></div>`);
              }
              $$renderer4.push(`<!--]--> <div class="px-5 pt-6 pb-2 border-t border-border"><h3 class="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">By Project</h3></div> `);
              if (byProjectData.length === 0) {
                $$renderer4.push("<!--[0-->");
                $$renderer4.push(`<div class="flex flex-col items-center justify-center py-8"><div class="rounded-full bg-secondary p-3 mb-3">`);
                Folder_kanban($$renderer4, { class: "h-8 w-8 text-muted-foreground" });
                $$renderer4.push(`<!----></div> <p class="text-sm text-muted-foreground">No project cost data available</p></div>`);
              } else {
                $$renderer4.push("<!--[-1-->");
                $$renderer4.push(`<div class="border-t border-border"><div class="grid grid-cols-12 gap-4 px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground border-b border-border"><div class="col-span-6">Project Name</div> <div class="col-span-3 text-right">Total Cost</div> <div class="col-span-3 text-right">Requests</div></div> <!--[-->`);
                const each_array_12 = ensure_array_like(byProjectData);
                for (let i = 0, $$length = each_array_12.length; i < $$length; i++) {
                  let row = each_array_12[i];
                  $$renderer4.push(`<div class="grid grid-cols-12 gap-4 px-5 py-3 text-sm border-b border-border last:border-0 hover:bg-accent/50 transition-colors"><div class="col-span-6 flex items-center gap-3 min-w-0"><div class="shrink-0 rounded-lg bg-violet-500/10 p-1.5">`);
                  Folder_kanban($$renderer4, { class: "h-3.5 w-3.5 text-violet-500" });
                  $$renderer4.push(`<!----></div> <p class="text-foreground truncate font-medium">${escape_html(row.projectName ?? row.name ?? row.project ?? "---")}</p></div> <div class="col-span-3 text-right font-medium text-foreground">${escape_html(formatCurrency(row.totalCost ?? row.total ?? row.cost))}</div> <div class="col-span-3 text-right text-muted-foreground">${escape_html(row.requestCount ?? row.requests ?? "---")}</div></div>`);
                }
                $$renderer4.push(`<!--]--></div>`);
              }
              $$renderer4.push(`<!--]-->`);
            }
            $$renderer4.push(`<!--]-->`);
          },
          $$slots: { default: true }
        });
        $$renderer3.push(`<!----> `);
        Tabs_content($$renderer3, {
          value: "finance",
          children: ($$renderer4) => {
            {
              $$renderer4.push("<!--[-1-->");
              $$renderer4.push(`<div class="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2"><div class="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-5"><div class="flex items-center justify-between mb-3"><div class="flex items-center gap-2"><div class="rounded-md bg-emerald-500/10 p-1.5">`);
              Trending_up($$renderer4, { class: "h-4 w-4 text-emerald-500" });
              $$renderer4.push(`<!----></div> <span class="text-sm font-medium text-muted-foreground">Revenue</span></div> `);
              {
                $$renderer4.push("<!--[-1-->");
              }
              $$renderer4.push(`<!--]--></div> <p class="text-3xl font-bold text-emerald-600 dark:text-emerald-400"${attr("title", `$${0 .toLocaleString("en", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`)}>${escape_html(formatCurrency(0))}</p> `);
              {
                $$renderer4.push("<!--[-1-->");
              }
              $$renderer4.push(`<!--]--></div> <div class="rounded-lg border border-red-500/20 bg-red-500/5 p-5"><div class="flex items-center justify-between mb-3"><div class="flex items-center gap-2"><div class="rounded-md bg-red-500/10 p-1.5">`);
              Trending_down($$renderer4, { class: "h-4 w-4 text-red-500" });
              $$renderer4.push(`<!----></div> <span class="text-sm font-medium text-muted-foreground">Expenses</span></div> `);
              {
                $$renderer4.push("<!--[-1-->");
              }
              $$renderer4.push(`<!--]--></div> <p class="text-3xl font-bold text-red-600 dark:text-red-400"${attr("title", `$${0 .toLocaleString("en", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`)}>${escape_html(formatCurrency(0))}</p> `);
              {
                $$renderer4.push("<!--[-1-->");
              }
              $$renderer4.push(`<!--]--></div></div> `);
              if (quotaWindows.length > 0) {
                $$renderer4.push("<!--[1-->");
                $$renderer4.push(`<div class="px-5 pb-5"><h4 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Provider Quotas</h4> <div class="space-y-3"><!--[-->`);
                const each_array_16 = ensure_array_like(quotaWindows);
                for (let $$index_17 = 0, $$length = each_array_16.length; $$index_17 < $$length; $$index_17++) {
                  let window2 = each_array_16[$$index_17];
                  const used = window2.used ?? window2.currentUsage ?? 0;
                  const limit = window2.limit ?? window2.quotaLimit ?? window2.total ?? 1;
                  const pct = limit > 0 ? Math.min(100, used / limit * 100) : 0;
                  $$renderer4.push(`<div class="rounded-lg border border-border bg-secondary/30 p-4"><div class="flex items-center justify-between mb-2"><div class="flex items-center gap-2">`);
                  Gauge($$renderer4, { size: 14, class: "text-muted-foreground" });
                  $$renderer4.push(`<!----> <span class="text-sm font-medium text-foreground">${escape_html(window2.provider ?? window2.name ?? "Provider")}</span> `);
                  if (window2.model) {
                    $$renderer4.push("<!--[0-->");
                    $$renderer4.push(`<span class="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">${escape_html(window2.model)}</span>`);
                  } else {
                    $$renderer4.push("<!--[-1-->");
                  }
                  $$renderer4.push(`<!--]--></div> <span class="text-xs font-semibold"${attr_style(`color: ${stringify(quotaBarColor(pct))};`)}>${escape_html(pct.toFixed(0))}%</span></div> <div class="h-2 w-full overflow-hidden rounded-full bg-secondary"><div class="h-full rounded-full transition-all duration-500"${attr_style(`width: ${stringify(pct)}%; background-color: ${stringify(quotaBarColor(pct))};`)}></div></div> <div class="mt-1.5 flex items-center justify-between"><span class="text-[11px] text-muted-foreground"${attr("title", `$${used.toLocaleString("en", { minimumFractionDigits: 4 })}`)}>${escape_html(formatCurrency(used))} used</span> <span class="text-[11px] text-muted-foreground"${attr("title", `$${limit.toLocaleString("en", { minimumFractionDigits: 4 })}`)}>${escape_html(formatCurrency(limit))} limit</span></div> `);
                  if (window2.models && window2.models.length > 0) {
                    $$renderer4.push("<!--[0-->");
                    $$renderer4.push(`<div class="mt-2 space-y-1 border-t border-border pt-2"><!--[-->`);
                    const each_array_17 = ensure_array_like(window2.models);
                    for (let $$index_16 = 0, $$length2 = each_array_17.length; $$index_16 < $$length2; $$index_16++) {
                      let mdl = each_array_17[$$index_16];
                      const mdlUsed = mdl.used ?? mdl.currentUsage ?? 0;
                      const mdlLimit = mdl.limit ?? mdl.quotaLimit ?? limit;
                      const mdlPct = mdlLimit > 0 ? Math.min(100, mdlUsed / mdlLimit * 100) : 0;
                      $$renderer4.push(`<div class="flex items-center gap-3"><span class="w-24 truncate text-[10px] font-mono text-muted-foreground">${escape_html(mdl.model ?? mdl.name)}</span> <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary"><div class="h-full rounded-full"${attr_style(`width: ${stringify(mdlPct)}%; background-color: ${stringify(quotaBarColor(mdlPct))};`)}></div></div> <span class="text-[10px] text-muted-foreground w-16 text-right">${escape_html(formatCurrency(mdlUsed))}</span></div>`);
                    }
                    $$renderer4.push(`<!--]--></div>`);
                  } else {
                    $$renderer4.push("<!--[-1-->");
                  }
                  $$renderer4.push(`<!--]--></div>`);
                }
                $$renderer4.push(`<!--]--></div></div>`);
              } else {
                $$renderer4.push("<!--[-1-->");
              }
              $$renderer4.push(`<!--]--> `);
              if (financeEvents.length === 0) {
                $$renderer4.push("<!--[0-->");
                $$renderer4.push(`<div class="flex flex-col items-center justify-center py-12"><div class="rounded-full bg-secondary p-3 mb-3">`);
                Receipt($$renderer4, { class: "h-8 w-8 text-muted-foreground" });
                $$renderer4.push(`<!----></div> <p class="text-sm text-muted-foreground">No finance events recorded</p></div>`);
              } else {
                $$renderer4.push("<!--[-1-->");
                $$renderer4.push(`<div class="border-t border-border"><div class="grid grid-cols-12 gap-4 px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground border-b border-border"><div class="col-span-2">Date</div> <div class="col-span-2">Kind</div> <div class="col-span-2 text-right">Amount</div> <div class="col-span-3">Biller</div> <div class="col-span-3">Description</div></div> <!--[-->`);
                const each_array_18 = ensure_array_like(financeEvents);
                for (let i = 0, $$length = each_array_18.length; i < $$length; i++) {
                  let event = each_array_18[i];
                  const isRevenue = (event.kind ?? event.type ?? "").toLowerCase() === "revenue";
                  $$renderer4.push(`<div class="grid grid-cols-12 gap-4 px-5 py-3 text-sm border-b border-border last:border-0 hover:bg-accent/50 transition-colors"><div class="col-span-2 text-muted-foreground">${escape_html(formatDate(event.date ?? event.createdAt))}</div> <div class="col-span-2"><span${attr_class(`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${stringify(isRevenue ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-red-500/10 text-red-600 dark:text-red-400")}`)}>${escape_html(event.kind ?? event.type ?? "---")}</span></div> <div${attr_class(`col-span-2 text-right font-medium ${stringify(isRevenue ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}`)}>${escape_html(isRevenue ? "+" : "-")}${escape_html(formatCurrency(event.amount ?? event.value ?? 0))}</div> <div class="col-span-3 text-foreground truncate">${escape_html(event.biller ?? event.vendor ?? event.source ?? "---")}</div> <div class="col-span-3 text-muted-foreground truncate">${escape_html(event.description ?? event.note ?? "---")}</div></div>`);
                }
                $$renderer4.push(`<!--]--></div>`);
              }
              $$renderer4.push(`<!--]-->`);
            }
            $$renderer4.push(`<!--]-->`);
          },
          $$slots: { default: true }
        });
        $$renderer3.push(`<!---->`);
      },
      $$slots: { default: true }
    });
    $$renderer2.push(`<!----></div></div>`);
  });
}
export {
  _page as default
};
