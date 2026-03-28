<script lang="ts" module>
  export { default as Avatar } from "./avatar.svelte";
  export { default as AvatarImage } from "./avatar-image.svelte";
  export { default as AvatarFallback } from "./avatar-fallback.svelte";
</script>

<script lang="ts">
  import { cn } from "$utils/index.js";
  import type { HTMLAttributes } from "svelte/elements";
  import type { Snippet } from "svelte";

  type Props = HTMLAttributes<HTMLSpanElement> & {
    class?: string;
    size?: "default" | "xs" | "sm" | "lg";
    children?: Snippet;
  };

  let { class: className, size = "default", children, ...rest }: Props = $props();
</script>

<span
  data-slot="avatar"
  data-size={size}
  class={cn(
    "group/avatar relative flex size-8 shrink-0 overflow-hidden rounded-full select-none data-[size=lg]:size-10 data-[size=sm]:size-6 data-[size=xs]:size-5",
    className,
  )}
  {...rest}
>
  {#if children}{@render children()}{/if}
</span>
