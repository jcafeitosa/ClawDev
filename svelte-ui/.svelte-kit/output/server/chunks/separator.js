import { d as attr_class, o as stringify, e as escape_html, m as derived, q as attributes, f as clsx, p as bind_props, b as spread_props } from "./index.js";
import { c as cn } from "./cn.js";
import { u as useRefById, g as getDataOrientation, s as getAriaHidden, i as getAriaOrientation, m as useId, d as box, n as mergeProps } from "./use-id.js";
import "clsx";
function Status_badge($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { status, class: className = "" } = $$props;
    const colorMap = {
      // Issue / task statuses
      open: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
      "in_progress": "bg-amber-500/15 text-amber-700 dark:text-amber-400",
      in_review: "bg-purple-500/15 text-purple-700 dark:text-purple-400",
      done: "bg-green-500/15 text-green-700 dark:text-green-400",
      closed: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400",
      blocked: "bg-red-500/15 text-red-700 dark:text-red-400",
      // Agent statuses
      active: "bg-green-500/15 text-green-700 dark:text-green-400",
      idle: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400",
      paused: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
      terminated: "bg-red-500/15 text-red-700 dark:text-red-400",
      // Run statuses
      queued: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400",
      running: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
      completed: "bg-green-500/15 text-green-700 dark:text-green-400",
      failed: "bg-red-500/15 text-red-700 dark:text-red-400",
      cancelled: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400",
      // Approval statuses
      pending: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
      approved: "bg-green-500/15 text-green-700 dark:text-green-400",
      rejected: "bg-red-500/15 text-red-700 dark:text-red-400",
      // Routine statuses
      enabled: "bg-green-500/15 text-green-700 dark:text-green-400",
      disabled: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400"
    };
    let colors = derived(() => colorMap[status] ?? "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400");
    let label = derived(() => status.replace(/_/g, " "));
    $$renderer2.push(`<span${attr_class(`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium capitalize ${stringify(colors())} ${stringify(className)}`)}>${escape_html(label())}</span>`);
  });
}
function Input($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { class: className, type = "text", $$slots, $$events, ...rest } = $$props;
    $$renderer2.push(`<input${attributes(
      {
        type,
        "data-slot": "input",
        class: clsx(cn("file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm", "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]", "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive", className)),
        ...rest
      },
      void 0,
      void 0,
      void 0,
      4
    )}/>`);
  });
}
const SEPARATOR_ROOT_ATTR = "data-separator-root";
class SeparatorRootState {
  opts;
  constructor(opts) {
    this.opts = opts;
    useRefById(opts);
  }
  #props = derived(() => ({
    id: this.opts.id.current,
    role: this.opts.decorative.current ? "none" : "separator",
    "aria-orientation": getAriaOrientation(this.opts.orientation.current),
    "aria-hidden": getAriaHidden(this.opts.decorative.current),
    "data-orientation": getDataOrientation(this.opts.orientation.current),
    [SEPARATOR_ROOT_ATTR]: ""
  }));
  get props() {
    return this.#props();
  }
  set props($$value) {
    return this.#props($$value);
  }
}
function useSeparatorRoot(props) {
  return new SeparatorRootState(props);
}
function Separator$1($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      id = useId(),
      ref = null,
      child,
      children,
      decorative = false,
      orientation = "horizontal",
      $$slots,
      $$events,
      ...restProps
    } = $$props;
    const rootState = useSeparatorRoot({
      ref: box.with(() => ref, (v) => ref = v),
      id: box.with(() => id),
      decorative: box.with(() => decorative),
      orientation: box.with(() => orientation)
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
    bind_props($$props, { ref });
  });
}
function Separator($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      class: className,
      orientation = "horizontal",
      decorative = true,
      $$slots,
      $$events,
      ...rest
    } = $$props;
    if (Separator$1) {
      $$renderer2.push("<!--[-->");
      Separator$1($$renderer2, spread_props([
        {
          "data-slot": "separator",
          decorative,
          orientation,
          class: cn("bg-border shrink-0 data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px", className)
        },
        rest
      ]));
      $$renderer2.push("<!--]-->");
    } else {
      $$renderer2.push("<!--[!-->");
      $$renderer2.push("<!--]-->");
    }
  });
}
export {
  Input as I,
  Separator as S,
  Status_badge as a
};
