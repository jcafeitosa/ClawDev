import { ap as is_array, aq as get_prototype_of, ar as object_prototype, a as sanitize_props, b as spread_props, c as slot, q as attributes, f as clsx, m as derived, p as bind_props, i as ensure_array_like, e as escape_html, d as attr_class, o as stringify, h as attr_style } from "../../../chunks/index.js";
import { B as Button, a as Badge } from "../../../chunks/badge.js";
import { S as Separator, a as Status_badge, I as Input } from "../../../chunks/separator.js";
import { c as cn } from "../../../chunks/cn.js";
import { S as Skeleton } from "../../../chunks/skeleton.js";
import { C as Context, u as useRefById, w as watch, f as ENTER, e as SPACE, h as getDataDisabled, t as getAriaRequired, v as getAriaChecked, n as mergeProps, x as srOnlyStylesString, m as useId, d as box } from "../../../chunks/use-id.js";
import "clsx";
import { I as Icon } from "../../../chunks/Icon.js";
import "@sveltejs/kit/internal";
import "../../../chunks/exports.js";
import "../../../chunks/utils2.js";
import "@sveltejs/kit/internal/server";
import "../../../chunks/root.js";
import "../../../chunks/state.svelte.js";
import "../../../chunks/company.svelte.js";
import "../../../chunks/client.js";
import { t as toastStore } from "../../../chunks/toast.svelte.js";
import { Z as Zap } from "../../../chunks/zap.js";
import { C as Copy } from "../../../chunks/copy.js";
import { C as Circle_x } from "../../../chunks/circle-x.js";
import { I as Info } from "../../../chunks/info.js";
import { T as Triangle_alert } from "../../../chunks/triangle-alert.js";
const empty = [];
function snapshot(value, skip_warning = false, no_tojson = false) {
  return clone(value, /* @__PURE__ */ new Map(), "", empty, null, no_tojson);
}
function clone(value, cloned, path, paths, original = null, no_tojson = false) {
  if (typeof value === "object" && value !== null) {
    var unwrapped = cloned.get(value);
    if (unwrapped !== void 0) return unwrapped;
    if (value instanceof Map) return (
      /** @type {Snapshot<T>} */
      new Map(value)
    );
    if (value instanceof Set) return (
      /** @type {Snapshot<T>} */
      new Set(value)
    );
    if (is_array(value)) {
      var copy = (
        /** @type {Snapshot<any>} */
        Array(value.length)
      );
      cloned.set(value, copy);
      if (original !== null) {
        cloned.set(original, copy);
      }
      for (var i = 0; i < value.length; i += 1) {
        var element = value[i];
        if (i in value) {
          copy[i] = clone(element, cloned, path, paths, null, no_tojson);
        }
      }
      return copy;
    }
    if (get_prototype_of(value) === object_prototype) {
      copy = {};
      cloned.set(value, copy);
      if (original !== null) {
        cloned.set(original, copy);
      }
      for (var key of Object.keys(value)) {
        copy[key] = clone(
          // @ts-expect-error
          value[key],
          cloned,
          path,
          paths,
          null,
          no_tojson
        );
      }
      return copy;
    }
    if (value instanceof Date) {
      return (
        /** @type {Snapshot<T>} */
        structuredClone(value)
      );
    }
    if (typeof /** @type {T & { toJSON?: any } } */
    value.toJSON === "function" && !no_tojson) {
      return clone(
        /** @type {T & { toJSON(): any } } */
        value.toJSON(),
        cloned,
        path,
        paths,
        // Associate the instance with the toJSON clone
        value
      );
    }
  }
  if (value instanceof EventTarget) {
    return (
      /** @type {Snapshot<T>} */
      value
    );
  }
  try {
    return (
      /** @type {Snapshot<T>} */
      structuredClone(value)
    );
  } catch (e) {
    return (
      /** @type {Snapshot<T>} */
      value
    );
  }
}
function Check($$renderer, $$props) {
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
  const iconNode = [["path", { "d": "M20 6 9 17l-5-5" }]];
  Icon($$renderer, spread_props([
    { name: "check" },
    $$sanitized_props,
    {
      /**
       * @component @name Check
       * @description Lucide SVG icon component, renders SVG Element with children.
       *
       * @preview ![img](data:image/svg+xml;base64,PHN2ZyAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogIHdpZHRoPSIyNCIKICBoZWlnaHQ9IjI0IgogIHZpZXdCb3g9IjAgMCAyNCAyNCIKICBmaWxsPSJub25lIgogIHN0cm9rZT0iIzAwMCIgc3R5bGU9ImJhY2tncm91bmQtY29sb3I6ICNmZmY7IGJvcmRlci1yYWRpdXM6IDJweCIKICBzdHJva2Utd2lkdGg9IjIiCiAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogIHN0cm9rZS1saW5lam9pbj0icm91bmQiCj4KICA8cGF0aCBkPSJNMjAgNiA5IDE3bC01LTUiIC8+Cjwvc3ZnPgo=) - https://lucide.dev/icons/check
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
function Textarea($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { class: className, $$slots, $$events, ...rest } = $$props;
    $$renderer2.push(`<textarea${attributes({
      "data-slot": "textarea",
      class: clsx(cn("border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex field-sizing-content min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm", className)),
      ...rest
    })}></textarea>`);
  });
}
function Label($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { class: className, children, $$slots, $$events, ...rest } = $$props;
    $$renderer2.push(`<label${attributes({
      "data-slot": "label",
      class: clsx(cn("flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50", className)),
      ...rest
    })}>`);
    if (children) {
      $$renderer2.push("<!--[0-->");
      children($$renderer2);
      $$renderer2.push(`<!---->`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></label>`);
  });
}
const CHECKBOX_ROOT_ATTR = "data-checkbox-root";
class CheckboxRootState {
  opts;
  group;
  #trueName = derived(() => {
    if (this.group && this.group.opts.name.current) {
      return this.group.opts.name.current;
    } else {
      return this.opts.name.current;
    }
  });
  get trueName() {
    return this.#trueName();
  }
  set trueName($$value) {
    return this.#trueName($$value);
  }
  #trueRequired = derived(() => {
    if (this.group && this.group.opts.required.current) {
      return true;
    }
    return this.opts.required.current;
  });
  get trueRequired() {
    return this.#trueRequired();
  }
  set trueRequired($$value) {
    return this.#trueRequired($$value);
  }
  #trueDisabled = derived(() => {
    if (this.group && this.group.opts.disabled.current) {
      return true;
    }
    return this.opts.disabled.current;
  });
  get trueDisabled() {
    return this.#trueDisabled();
  }
  set trueDisabled($$value) {
    return this.#trueDisabled($$value);
  }
  constructor(opts, group = null) {
    this.opts = opts;
    this.group = group;
    this.onkeydown = this.onkeydown.bind(this);
    this.onclick = this.onclick.bind(this);
    useRefById(opts);
    watch.pre(
      [
        () => snapshot(this.group?.opts.value.current),
        () => this.opts.value.current
      ],
      ([groupValue, value]) => {
        if (!groupValue || !value) return;
        this.opts.checked.current = groupValue.includes(value);
      }
    );
    watch.pre(() => this.opts.checked.current, (checked) => {
      if (!this.group) return;
      if (checked) {
        this.group?.addValue(this.opts.value.current);
      } else {
        this.group?.removeValue(this.opts.value.current);
      }
    });
  }
  onkeydown(e) {
    if (this.opts.disabled.current) return;
    if (e.key === ENTER) e.preventDefault();
    if (e.key === SPACE) {
      e.preventDefault();
      this.#toggle();
    }
  }
  #toggle() {
    if (this.opts.indeterminate.current) {
      this.opts.indeterminate.current = false;
      this.opts.checked.current = true;
    } else {
      this.opts.checked.current = !this.opts.checked.current;
    }
  }
  onclick(_) {
    if (this.opts.disabled.current) return;
    this.#toggle();
  }
  #snippetProps = derived(() => ({
    checked: this.opts.checked.current,
    indeterminate: this.opts.indeterminate.current
  }));
  get snippetProps() {
    return this.#snippetProps();
  }
  set snippetProps($$value) {
    return this.#snippetProps($$value);
  }
  #props = derived(() => ({
    id: this.opts.id.current,
    role: "checkbox",
    type: this.opts.type.current,
    disabled: this.trueDisabled,
    "aria-checked": getAriaChecked(this.opts.checked.current, this.opts.indeterminate.current),
    "aria-required": getAriaRequired(this.trueRequired),
    "data-disabled": getDataDisabled(this.trueDisabled),
    "data-state": getCheckboxDataState(this.opts.checked.current, this.opts.indeterminate.current),
    [CHECKBOX_ROOT_ATTR]: "",
    onclick: this.onclick,
    onkeydown: this.onkeydown
  }));
  get props() {
    return this.#props();
  }
  set props($$value) {
    return this.#props($$value);
  }
}
class CheckboxInputState {
  root;
  #trueChecked = derived(() => {
    if (this.root.group) {
      if (this.root.opts.value.current !== void 0 && this.root.group.opts.value.current.includes(this.root.opts.value.current)) {
        return true;
      }
      return false;
    }
    return this.root.opts.checked.current;
  });
  get trueChecked() {
    return this.#trueChecked();
  }
  set trueChecked($$value) {
    return this.#trueChecked($$value);
  }
  #shouldRender = derived(() => Boolean(this.root.trueName));
  get shouldRender() {
    return this.#shouldRender();
  }
  set shouldRender($$value) {
    return this.#shouldRender($$value);
  }
  constructor(root) {
    this.root = root;
  }
  #props = derived(() => ({
    type: "checkbox",
    checked: this.root.opts.checked.current === true,
    disabled: this.root.trueDisabled,
    required: this.root.trueRequired,
    name: this.root.trueName,
    value: this.root.opts.value.current
  }));
  get props() {
    return this.#props();
  }
  set props($$value) {
    return this.#props($$value);
  }
}
function getCheckboxDataState(checked, indeterminate) {
  if (indeterminate) return "indeterminate";
  return checked ? "checked" : "unchecked";
}
const CheckboxGroupContext = new Context("Checkbox.Group");
const CheckboxRootContext = new Context("Checkbox.Root");
function useCheckboxRoot(props, group) {
  return CheckboxRootContext.set(new CheckboxRootState(props, group));
}
function useCheckboxInput() {
  return new CheckboxInputState(CheckboxRootContext.get());
}
function Hidden_input($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { value = void 0, $$slots, $$events, ...restProps } = $$props;
    const mergedProps = derived(() => mergeProps(restProps, {
      "aria-hidden": "true",
      tabindex: -1,
      style: srOnlyStylesString
    }));
    if (mergedProps().type === "checkbox") {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<input${attributes({ ...mergedProps(), value }, void 0, void 0, void 0, 4)}/>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<input${attributes({ value, ...mergedProps() }, void 0, void 0, void 0, 4)}/>`);
    }
    $$renderer2.push(`<!--]-->`);
    bind_props($$props, { value });
  });
}
function Checkbox_input($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const inputState = useCheckboxInput();
    if (inputState.shouldRender) {
      $$renderer2.push("<!--[0-->");
      Hidden_input($$renderer2, spread_props([inputState.props]));
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
  });
}
function Checkbox$1($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      checked = false,
      ref = null,
      onCheckedChange,
      children,
      disabled = false,
      required = false,
      name = void 0,
      value = "on",
      id = useId(),
      indeterminate = false,
      onIndeterminateChange,
      child,
      type = "button",
      $$slots,
      $$events,
      ...restProps
    } = $$props;
    const group = CheckboxGroupContext.getOr(null);
    if (group && value) {
      if (group.opts.value.current.includes(value)) {
        checked = true;
      } else {
        checked = false;
      }
    }
    watch.pre(() => value, () => {
      if (group && value) {
        if (group.opts.value.current.includes(value)) {
          checked = true;
        } else {
          checked = false;
        }
      }
    });
    const rootState = useCheckboxRoot(
      {
        checked: box.with(() => checked, (v) => {
          checked = v;
          onCheckedChange?.(v);
        }),
        disabled: box.with(() => disabled ?? false),
        required: box.with(() => required),
        name: box.with(() => name),
        value: box.with(() => value),
        id: box.with(() => id),
        ref: box.with(() => ref, (v) => ref = v),
        indeterminate: box.with(() => indeterminate, (v) => {
          indeterminate = v;
          onIndeterminateChange?.(v);
        }),
        type: box.with(() => type)
      },
      group
    );
    const mergedProps = derived(() => mergeProps({ ...restProps }, rootState.props));
    if (child) {
      $$renderer2.push("<!--[0-->");
      child($$renderer2, { props: mergedProps(), ...rootState.snippetProps });
      $$renderer2.push(`<!---->`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<button${attributes({ ...mergedProps() })}>`);
      children?.($$renderer2, rootState.snippetProps);
      $$renderer2.push(`<!----></button>`);
    }
    $$renderer2.push(`<!--]--> `);
    Checkbox_input($$renderer2);
    $$renderer2.push(`<!---->`);
    bind_props($$props, { checked, ref, indeterminate });
  });
}
function Checkbox($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { class: className, $$slots, $$events, ...rest } = $$props;
    {
      let children = function($$renderer3, { checked }) {
        $$renderer3.push(`<div class="grid place-content-center text-current">`);
        if (checked) {
          $$renderer3.push("<!--[0-->");
          Check($$renderer3, { class: "size-3.5" });
        } else {
          $$renderer3.push("<!--[-1-->");
        }
        $$renderer3.push(`<!--]--></div>`);
      };
      if (Checkbox$1) {
        $$renderer2.push("<!--[-->");
        Checkbox$1($$renderer2, spread_props([
          {
            "data-slot": "checkbox",
            class: cn("peer border-input dark:bg-input/30 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground dark:data-[state=checked]:bg-primary data-[state=checked]:border-primary focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive size-4 shrink-0 rounded-[4px] border shadow-xs transition-shadow outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50", className)
          },
          rest,
          { children, $$slots: { default: true } }
        ]));
        $$renderer2.push("<!--]-->");
      } else {
        $$renderer2.push("<!--[!-->");
        $$renderer2.push("<!--]-->");
      }
    }
  });
}
function Card_header($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { class: className, children, $$slots, $$events, ...rest } = $$props;
    $$renderer2.push(`<div${attributes({
      "data-slot": "card-header",
      class: clsx(cn("@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6", className)),
      ...rest
    })}>`);
    if (children) {
      $$renderer2.push("<!--[0-->");
      children($$renderer2);
      $$renderer2.push(`<!---->`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
function Card_title($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { class: className, children, $$slots, $$events, ...rest } = $$props;
    $$renderer2.push(`<div${attributes({
      "data-slot": "card-title",
      class: clsx(cn("leading-none font-semibold", className)),
      ...rest
    })}>`);
    if (children) {
      $$renderer2.push("<!--[0-->");
      children($$renderer2);
      $$renderer2.push(`<!---->`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
function Card_description($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { class: className, children, $$slots, $$events, ...rest } = $$props;
    $$renderer2.push(`<div${attributes({
      "data-slot": "card-description",
      class: clsx(cn("text-muted-foreground text-sm", className)),
      ...rest
    })}>`);
    if (children) {
      $$renderer2.push("<!--[0-->");
      children($$renderer2);
      $$renderer2.push(`<!---->`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
function Card_content($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { class: className, children, $$slots, $$events, ...rest } = $$props;
    $$renderer2.push(`<div${attributes({
      "data-slot": "card-content",
      class: clsx(cn("px-6", className)),
      ...rest
    })}>`);
    if (children) {
      $$renderer2.push("<!--[0-->");
      children($$renderer2);
      $$renderer2.push(`<!---->`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
function Card_footer($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { class: className, children, $$slots, $$events, ...rest } = $$props;
    $$renderer2.push(`<div${attributes({
      "data-slot": "card-footer",
      class: clsx(cn("flex items-center px-6 [.border-t]:pt-6", className)),
      ...rest
    })}>`);
    if (children) {
      $$renderer2.push("<!--[0-->");
      children($$renderer2);
      $$renderer2.push(`<!---->`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
function Card($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { class: className, children, $$slots, $$events, ...rest } = $$props;
    $$renderer2.push(`<div${attributes({
      "data-slot": "card",
      class: clsx(cn("bg-card text-card-foreground flex flex-col gap-6 border py-6 shadow-sm", className)),
      ...rest
    })}>`);
    if (children) {
      $$renderer2.push("<!--[0-->");
      children($$renderer2);
      $$renderer2.push(`<!---->`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let checkboxChecked = false;
    let inputValue = "";
    let textareaValue = "";
    let clickCount = 0;
    function showToast(tone, title) {
      toastStore.push({ title, body: `Triggered from the design guide.`, tone });
    }
    const buttonVariants = [
      { variant: "default", label: "Default" },
      { variant: "destructive", label: "Destructive" },
      { variant: "outline", label: "Outline" },
      { variant: "secondary", label: "Secondary" },
      { variant: "ghost", label: "Ghost" }
    ];
    const buttonSizes = [
      { size: "xs", label: "XS" },
      { size: "sm", label: "SM" },
      { size: "default", label: "Default" },
      { size: "lg", label: "LG" }
    ];
    const badgeVariants = [
      { variant: "default", label: "Default" },
      { variant: "secondary", label: "Secondary" },
      { variant: "destructive", label: "Destructive" },
      { variant: "outline", label: "Outline" }
    ];
    const statusValues = [
      "active",
      "idle",
      "running",
      "paused",
      "failed",
      "completed",
      "pending",
      "approved",
      "rejected",
      "blocked"
    ];
    const colors = [
      { name: "Primary", hex: "#2563EB", class: "bg-[#2563EB]" },
      { name: "Success", hex: "#10B981", class: "bg-emerald-500" },
      { name: "Warning", hex: "#F59E0B", class: "bg-amber-500" },
      { name: "Error", hex: "#EF4444", class: "bg-red-500" },
      { name: "Muted", hex: "#94A3B8", class: "bg-[#94A3B8]" }
    ];
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      $$renderer3.push(`<div class="design-guide svelte-606cw4"><header class="dg-header svelte-606cw4"><div class="dg-header-inner svelte-606cw4"><div class="flex items-center gap-3"><div class="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2563EB]/15">`);
      Zap($$renderer3, { class: "size-5 text-[#60a5fa]" });
      $$renderer3.push(`<!----></div> <div><h1 class="text-2xl font-bold text-[#F8FAFC] tracking-tight">Design Guide</h1> <p class="text-sm text-[#64748b]">ClawDev UI Components</p></div></div></div></header> <main class="dg-main svelte-606cw4"><section class="dg-section svelte-606cw4"><h2 class="dg-section-title svelte-606cw4">Buttons</h2> <p class="dg-section-desc svelte-606cw4">All button variants and sizes. Click any button to increment the counter.</p> <div class="dg-subsection svelte-606cw4"><h3 class="dg-subsection-title svelte-606cw4">Variants</h3> <div class="flex flex-wrap gap-3 items-center"><!--[-->`);
      const each_array = ensure_array_like(buttonVariants);
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        let { variant, label } = each_array[$$index];
        Button($$renderer3, {
          variant,
          onclick: () => {
            clickCount++;
            showToast("info", `${label} button clicked (${clickCount})`);
          },
          children: ($$renderer4) => {
            $$renderer4.push(`<!---->${escape_html(label)}`);
          },
          $$slots: { default: true }
        });
      }
      $$renderer3.push(`<!--]--></div></div> <div class="dg-subsection svelte-606cw4"><h3 class="dg-subsection-title svelte-606cw4">Sizes</h3> <div class="flex flex-wrap gap-3 items-end"><!--[-->`);
      const each_array_1 = ensure_array_like(buttonSizes);
      for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
        let { size, label } = each_array_1[$$index_1];
        Button($$renderer3, {
          size,
          onclick: () => clickCount++,
          children: ($$renderer4) => {
            $$renderer4.push(`<!---->${escape_html(label)}`);
          },
          $$slots: { default: true }
        });
      }
      $$renderer3.push(`<!--]--> `);
      Button($$renderer3, {
        size: "icon",
        onclick: () => clickCount++,
        children: ($$renderer4) => {
          Zap($$renderer4, { class: "size-4" });
        },
        $$slots: { default: true }
      });
      $$renderer3.push(`<!----></div> <p class="dg-counter svelte-606cw4">Click count: <strong class="svelte-606cw4">${escape_html(clickCount)}</strong></p></div> <div class="dg-subsection svelte-606cw4"><h3 class="dg-subsection-title svelte-606cw4">With Icons</h3> <div class="flex flex-wrap gap-3 items-center">`);
      Button($$renderer3, {
        variant: "default",
        onclick: () => showToast("success", "Copied!"),
        children: ($$renderer4) => {
          Copy($$renderer4, { class: "size-4" });
          $$renderer4.push(`<!----> Copy`);
        },
        $$slots: { default: true }
      });
      $$renderer3.push(`<!----> `);
      Button($$renderer3, {
        variant: "outline",
        children: ($$renderer4) => {
          Check($$renderer4, { class: "size-4" });
          $$renderer4.push(`<!----> Confirm`);
        },
        $$slots: { default: true }
      });
      $$renderer3.push(`<!----> `);
      Button($$renderer3, {
        variant: "destructive",
        children: ($$renderer4) => {
          Circle_x($$renderer4, { class: "size-4" });
          $$renderer4.push(`<!----> Delete`);
        },
        $$slots: { default: true }
      });
      $$renderer3.push(`<!----></div></div></section> `);
      Separator($$renderer3, { class: "border-white/[0.06]" });
      $$renderer3.push(`<!----> <section class="dg-section svelte-606cw4"><h2 class="dg-section-title svelte-606cw4">Badges</h2> <p class="dg-section-desc svelte-606cw4">Badge component with multiple variants.</p> <div class="flex flex-wrap gap-3 items-center"><!--[-->`);
      const each_array_2 = ensure_array_like(badgeVariants);
      for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
        let { variant, label } = each_array_2[$$index_2];
        Badge($$renderer3, {
          variant,
          children: ($$renderer4) => {
            $$renderer4.push(`<!---->${escape_html(label)}`);
          },
          $$slots: { default: true }
        });
      }
      $$renderer3.push(`<!--]--></div> <div class="dg-subsection svelte-606cw4"><h3 class="dg-subsection-title svelte-606cw4">Colored Badges</h3> <div class="flex flex-wrap gap-3 items-center">`);
      Badge($$renderer3, {
        class: "bg-blue-500/15 text-blue-400 border-blue-500/20",
        children: ($$renderer4) => {
          $$renderer4.push(`<!---->Feature`);
        },
        $$slots: { default: true }
      });
      $$renderer3.push(`<!----> `);
      Badge($$renderer3, {
        class: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
        children: ($$renderer4) => {
          $$renderer4.push(`<!---->Shipped`);
        },
        $$slots: { default: true }
      });
      $$renderer3.push(`<!----> `);
      Badge($$renderer3, {
        class: "bg-amber-500/15 text-amber-400 border-amber-500/20",
        children: ($$renderer4) => {
          $$renderer4.push(`<!---->In Progress`);
        },
        $$slots: { default: true }
      });
      $$renderer3.push(`<!----> `);
      Badge($$renderer3, {
        class: "bg-red-500/15 text-red-400 border-red-500/20",
        children: ($$renderer4) => {
          $$renderer4.push(`<!---->Critical`);
        },
        $$slots: { default: true }
      });
      $$renderer3.push(`<!----> `);
      Badge($$renderer3, {
        class: "bg-purple-500/15 text-purple-400 border-purple-500/20",
        children: ($$renderer4) => {
          $$renderer4.push(`<!---->Plugin`);
        },
        $$slots: { default: true }
      });
      $$renderer3.push(`<!----> `);
      Badge($$renderer3, {
        class: "bg-cyan-500/15 text-cyan-400 border-cyan-500/20",
        children: ($$renderer4) => {
          $$renderer4.push(`<!---->Beta`);
        },
        $$slots: { default: true }
      });
      $$renderer3.push(`<!----></div></div></section> `);
      Separator($$renderer3, { class: "border-white/[0.06]" });
      $$renderer3.push(`<!----> <section class="dg-section svelte-606cw4"><h2 class="dg-section-title svelte-606cw4">Status Badges</h2> <p class="dg-section-desc svelte-606cw4">Contextual status indicators used across issues, agents, runs, and approvals.</p> <div class="flex flex-wrap gap-3 items-center"><!--[-->`);
      const each_array_3 = ensure_array_like(statusValues);
      for (let $$index_3 = 0, $$length = each_array_3.length; $$index_3 < $$length; $$index_3++) {
        let status = each_array_3[$$index_3];
        Status_badge($$renderer3, { status });
      }
      $$renderer3.push(`<!--]--></div></section> `);
      Separator($$renderer3, { class: "border-white/[0.06]" });
      $$renderer3.push(`<!----> <section class="dg-section svelte-606cw4"><h2 class="dg-section-title svelte-606cw4">Cards</h2> <p class="dg-section-desc svelte-606cw4">Card compound component with header, content, and footer slots.</p> <div class="grid grid-cols-1 md:grid-cols-2 gap-4">`);
      Card($$renderer3, {
        class: "rounded-xl border-white/[0.08] bg-[#0a0a0f]",
        children: ($$renderer4) => {
          Card_header($$renderer4, {
            children: ($$renderer5) => {
              Card_title($$renderer5, {
                class: "text-[#F8FAFC]",
                children: ($$renderer6) => {
                  $$renderer6.push(`<!---->Agent Performance`);
                },
                $$slots: { default: true }
              });
              $$renderer5.push(`<!----> `);
              Card_description($$renderer5, {
                class: "text-[#64748b]",
                children: ($$renderer6) => {
                  $$renderer6.push(`<!---->Overview of agent metrics for the past 7 days.`);
                },
                $$slots: { default: true }
              });
              $$renderer5.push(`<!---->`);
            },
            $$slots: { default: true }
          });
          $$renderer4.push(`<!----> `);
          Card_content($$renderer4, {
            children: ($$renderer5) => {
              $$renderer5.push(`<div class="flex items-baseline gap-2"><span class="text-3xl font-bold text-[#F8FAFC]">94.2%</span> <span class="text-sm text-emerald-400">+2.1%</span></div> <p class="text-sm text-[#94A3B8] mt-1">Success rate across all runs</p>`);
            },
            $$slots: { default: true }
          });
          $$renderer4.push(`<!----> `);
          Card_footer($$renderer4, {
            class: "text-xs text-[#64748b]",
            children: ($$renderer5) => {
              $$renderer5.push(`<!---->Last updated 3 minutes ago`);
            },
            $$slots: { default: true }
          });
          $$renderer4.push(`<!---->`);
        },
        $$slots: { default: true }
      });
      $$renderer3.push(`<!----> `);
      Card($$renderer3, {
        class: "rounded-xl border-white/[0.08] bg-[#0a0a0f]",
        children: ($$renderer4) => {
          Card_header($$renderer4, {
            children: ($$renderer5) => {
              Card_title($$renderer5, {
                class: "text-[#F8FAFC]",
                children: ($$renderer6) => {
                  $$renderer6.push(`<!---->Active Issues`);
                },
                $$slots: { default: true }
              });
              $$renderer5.push(`<!----> `);
              Card_description($$renderer5, {
                class: "text-[#64748b]",
                children: ($$renderer6) => {
                  $$renderer6.push(`<!---->Current open issues requiring attention.`);
                },
                $$slots: { default: true }
              });
              $$renderer5.push(`<!---->`);
            },
            $$slots: { default: true }
          });
          $$renderer4.push(`<!----> `);
          Card_content($$renderer4, {
            children: ($$renderer5) => {
              $$renderer5.push(`<div class="space-y-2"><!--[-->`);
              const each_array_4 = ensure_array_like([
                { title: "Fix auth timeout", status: "in_progress" },
                { title: "Update API docs", status: "pending" },
                { title: "Deploy v2.3", status: "approved" }
              ]);
              for (let $$index_4 = 0, $$length = each_array_4.length; $$index_4 < $$length; $$index_4++) {
                let issue = each_array_4[$$index_4];
                $$renderer5.push(`<div class="flex items-center justify-between py-1.5"><span class="text-sm text-[#cbd5e1]">${escape_html(issue.title)}</span> `);
                Status_badge($$renderer5, { status: issue.status });
                $$renderer5.push(`<!----></div>`);
              }
              $$renderer5.push(`<!--]--></div>`);
            },
            $$slots: { default: true }
          });
          $$renderer4.push(`<!----> `);
          Card_footer($$renderer4, {
            children: ($$renderer5) => {
              Button($$renderer5, {
                variant: "outline",
                size: "sm",
                class: "border-white/[0.08] text-[#94A3B8]",
                children: ($$renderer6) => {
                  $$renderer6.push(`<!---->View All`);
                },
                $$slots: { default: true }
              });
            },
            $$slots: { default: true }
          });
          $$renderer4.push(`<!---->`);
        },
        $$slots: { default: true }
      });
      $$renderer3.push(`<!----></div></section> `);
      Separator($$renderer3, { class: "border-white/[0.06]" });
      $$renderer3.push(`<!----> <section class="dg-section svelte-606cw4"><h2 class="dg-section-title svelte-606cw4">Form Elements</h2> <p class="dg-section-desc svelte-606cw4">Input, Textarea, Checkbox, and Select form controls.</p> <div class="grid grid-cols-1 md:grid-cols-2 gap-6"><div class="space-y-4"><div class="space-y-2">`);
      Label($$renderer3, {
        class: "text-[#cbd5e1]",
        children: ($$renderer4) => {
          $$renderer4.push(`<!---->Text Input`);
        },
        $$slots: { default: true }
      });
      $$renderer3.push(`<!----> `);
      Input($$renderer3, {
        placeholder: "Type something...",
        class: "border-white/[0.08] bg-[#121218] text-[#F8FAFC] placeholder:text-[#475569]",
        get value() {
          return inputValue;
        },
        set value($$value) {
          inputValue = $$value;
          $$settled = false;
        }
      });
      $$renderer3.push(`<!----> `);
      if (inputValue) {
        $$renderer3.push("<!--[0-->");
        $$renderer3.push(`<p class="text-xs text-[#94A3B8]">Value: "${escape_html(inputValue)}"</p>`);
      } else {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--></div> <div class="space-y-2">`);
      Label($$renderer3, {
        class: "text-[#cbd5e1]",
        children: ($$renderer4) => {
          $$renderer4.push(`<!---->Disabled Input`);
        },
        $$slots: { default: true }
      });
      $$renderer3.push(`<!----> `);
      Input($$renderer3, {
        value: "Cannot edit this",
        disabled: true,
        class: "border-white/[0.08] bg-[#121218] text-[#F8FAFC]"
      });
      $$renderer3.push(`<!----></div> <div class="space-y-2">`);
      Label($$renderer3, {
        class: "text-[#cbd5e1]",
        children: ($$renderer4) => {
          $$renderer4.push(`<!---->Select`);
        },
        $$slots: { default: true }
      });
      $$renderer3.push(`<!----> <select class="dg-select svelte-606cw4">`);
      $$renderer3.option({ value: "" }, ($$renderer4) => {
        $$renderer4.push(`Choose an option...`);
      });
      $$renderer3.option({ value: "agent" }, ($$renderer4) => {
        $$renderer4.push(`Agent`);
      });
      $$renderer3.option({ value: "project" }, ($$renderer4) => {
        $$renderer4.push(`Project`);
      });
      $$renderer3.option({ value: "routine" }, ($$renderer4) => {
        $$renderer4.push(`Routine`);
      });
      $$renderer3.push(`</select></div></div> <div class="space-y-4"><div class="space-y-2">`);
      Label($$renderer3, {
        class: "text-[#cbd5e1]",
        children: ($$renderer4) => {
          $$renderer4.push(`<!---->Textarea`);
        },
        $$slots: { default: true }
      });
      $$renderer3.push(`<!----> `);
      Textarea($$renderer3, {
        placeholder: "Write a description...",
        rows: 4,
        class: "border-white/[0.08] bg-[#121218] text-[#F8FAFC] placeholder:text-[#475569] resize-y",
        get value() {
          return textareaValue;
        },
        set value($$value) {
          textareaValue = $$value;
          $$settled = false;
        }
      });
      $$renderer3.push(`<!----></div> <div class="flex items-center gap-3">`);
      Checkbox($$renderer3, {
        checked: checkboxChecked,
        onCheckedChange: (v) => {
          checkboxChecked = !!v;
        }
      });
      $$renderer3.push(`<!----> `);
      Label($$renderer3, {
        class: "text-[#cbd5e1] cursor-pointer",
        onclick: () => {
          checkboxChecked = !checkboxChecked;
        },
        children: ($$renderer4) => {
          $$renderer4.push(`<!---->${escape_html(checkboxChecked ? "Checked" : "Unchecked")} — click to toggle`);
        },
        $$slots: { default: true }
      });
      $$renderer3.push(`<!----></div></div></div></section> `);
      Separator($$renderer3, { class: "border-white/[0.06]" });
      $$renderer3.push(`<!----> <section class="dg-section svelte-606cw4"><h2 class="dg-section-title svelte-606cw4">Typography</h2> <p class="dg-section-desc svelte-606cw4">Heading levels, body text, and code formatting.</p> <div class="space-y-4"><h1 class="text-4xl font-bold text-[#F8FAFC] tracking-tight">Heading 1 — The Quick Brown Fox</h1> <h2 class="text-3xl font-semibold text-[#F8FAFC] tracking-tight">Heading 2 — Agent Orchestration</h2> <h3 class="text-2xl font-semibold text-[#e2e8f0]">Heading 3 — Run Management</h3> <h4 class="text-xl font-medium text-[#cbd5e1]">Heading 4 — Configuration Details</h4> `);
      Separator($$renderer3, { class: "border-white/[0.06]" });
      $$renderer3.push(`<!----> <p class="text-base text-[#94A3B8] leading-relaxed max-w-2xl">Body text renders in the muted color for comfortable reading on dark backgrounds.
          ClawDev uses a carefully tuned palette that balances contrast and visual hierarchy
          across all interface elements.</p> <p class="text-sm text-[#64748b]">Secondary text is dimmer, used for descriptions, timestamps, and meta information.</p> <div class="space-y-2"><p class="text-sm text-[#cbd5e1]">Inline code: <code class="dg-code svelte-606cw4">const agent = new Agent({ model: 'claude-4' })</code></p> <pre class="dg-pre svelte-606cw4"><code>async function runAgent(agentId: string) {
  const result = await api.runs.create({
    agentId,
    input: "Analyze the latest metrics",
    timeout: 30_000,
  });
  return result;
}</code></pre></div></div></section> `);
      Separator($$renderer3, { class: "border-white/[0.06]" });
      $$renderer3.push(`<!----> <section class="dg-section svelte-606cw4"><h2 class="dg-section-title svelte-606cw4">Colors</h2> <p class="dg-section-desc svelte-606cw4">Core color palette used throughout ClawDev.</p> <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4"><!--[-->`);
      const each_array_5 = ensure_array_like(colors);
      for (let $$index_5 = 0, $$length = each_array_5.length; $$index_5 < $$length; $$index_5++) {
        let color = each_array_5[$$index_5];
        $$renderer3.push(`<button class="dg-color-card group svelte-606cw4"><div${attr_class(`dg-color-swatch ${stringify(color.class)}`, "svelte-606cw4")}></div> <div class="px-3 py-2.5"><p class="text-sm font-medium text-[#F8FAFC]">${escape_html(color.name)}</p> <p class="text-xs text-[#64748b] font-mono group-hover:text-[#94A3B8] transition-colors">${escape_html(color.hex)}</p></div></button>`);
      }
      $$renderer3.push(`<!--]--></div> <div class="dg-subsection svelte-606cw4"><h3 class="dg-subsection-title svelte-606cw4">Surface Colors</h3> <div class="grid grid-cols-2 sm:grid-cols-4 gap-3"><!--[-->`);
      const each_array_6 = ensure_array_like([
        { name: "Base", bg: "#050508" },
        { name: "Surface", bg: "#0a0a0f" },
        { name: "Elevated", bg: "#121218" },
        { name: "Border", bg: "rgba(255,255,255,0.08)" }
      ]);
      for (let $$index_6 = 0, $$length = each_array_6.length; $$index_6 < $$length; $$index_6++) {
        let surface = each_array_6[$$index_6];
        $$renderer3.push(`<div class="rounded-lg border border-white/[0.08] overflow-hidden"><div class="h-12"${attr_style("", { background: surface.bg })}></div> <div class="px-3 py-2 bg-[#0a0a0f]"><p class="text-xs font-medium text-[#cbd5e1]">${escape_html(surface.name)}</p> <p class="text-[10px] text-[#64748b] font-mono">${escape_html(surface.bg)}</p></div></div>`);
      }
      $$renderer3.push(`<!--]--></div></div></section> `);
      Separator($$renderer3, { class: "border-white/[0.06]" });
      $$renderer3.push(`<!----> <section class="dg-section svelte-606cw4"><h2 class="dg-section-title svelte-606cw4">Toasts</h2> <p class="dg-section-desc svelte-606cw4">Trigger notification toasts with different tones.</p> <div class="flex flex-wrap gap-3">`);
      Button($$renderer3, {
        variant: "outline",
        class: "border-blue-500/30 text-blue-400 hover:bg-blue-500/10",
        onclick: () => showToast("info", "Info notification"),
        children: ($$renderer4) => {
          Info($$renderer4, { class: "size-4" });
          $$renderer4.push(`<!----> Info Toast`);
        },
        $$slots: { default: true }
      });
      $$renderer3.push(`<!----> `);
      Button($$renderer3, {
        variant: "outline",
        class: "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10",
        onclick: () => showToast("success", "Success notification"),
        children: ($$renderer4) => {
          Check($$renderer4, { class: "size-4" });
          $$renderer4.push(`<!----> Success Toast`);
        },
        $$slots: { default: true }
      });
      $$renderer3.push(`<!----> `);
      Button($$renderer3, {
        variant: "outline",
        class: "border-amber-500/30 text-amber-400 hover:bg-amber-500/10",
        onclick: () => showToast("warn", "Warning notification"),
        children: ($$renderer4) => {
          Triangle_alert($$renderer4, { class: "size-4" });
          $$renderer4.push(`<!----> Warning Toast`);
        },
        $$slots: { default: true }
      });
      $$renderer3.push(`<!----> `);
      Button($$renderer3, {
        variant: "outline",
        class: "border-red-500/30 text-red-400 hover:bg-red-500/10",
        onclick: () => showToast("error", "Error notification"),
        children: ($$renderer4) => {
          Circle_x($$renderer4, { class: "size-4" });
          $$renderer4.push(`<!----> Error Toast`);
        },
        $$slots: { default: true }
      });
      $$renderer3.push(`<!----></div></section> `);
      Separator($$renderer3, { class: "border-white/[0.06]" });
      $$renderer3.push(`<!----> <section class="dg-section svelte-606cw4"><h2 class="dg-section-title svelte-606cw4">Skeleton</h2> <p class="dg-section-desc svelte-606cw4">Loading placeholders for content that is being fetched.</p> <div class="flex items-center gap-4">`);
      Skeleton($$renderer3, { class: "h-12 w-12 rounded-full" });
      $$renderer3.push(`<!----> <div class="space-y-2 flex-1">`);
      Skeleton($$renderer3, { class: "h-4 w-3/4" });
      $$renderer3.push(`<!----> `);
      Skeleton($$renderer3, { class: "h-3 w-1/2" });
      $$renderer3.push(`<!----></div></div></section> <div class="h-16"></div></main></div>`);
    }
    do {
      $$settled = true;
      $$inner_renderer = $$renderer2.copy();
      $$render_inner($$inner_renderer);
    } while (!$$settled);
    $$renderer2.subsume($$inner_renderer);
  });
}
export {
  _page as default
};
