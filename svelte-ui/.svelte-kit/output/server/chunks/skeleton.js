import { q as attributes, f as clsx } from "./index.js";
import { c as cn } from "./cn.js";
function Skeleton($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { class: className, $$slots, $$events, ...rest } = $$props;
    $$renderer2.push(`<div${attributes({
      "data-slot": "skeleton",
      class: clsx(cn("bg-accent/75 animate-pulse rounded-md", className)),
      ...rest
    })}></div>`);
  });
}
export {
  Skeleton as S
};
