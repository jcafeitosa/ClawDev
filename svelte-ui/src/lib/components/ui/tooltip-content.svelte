<script lang="ts">
  import { cn } from "$utils/index.js";
  import { Tooltip as TooltipPrimitive } from "bits-ui";
  import type { Snippet } from "svelte";

  type Props = TooltipPrimitive.ContentProps & {
    class?: string;
    children?: Snippet;
  };

  let { class: className, children, ...rest }: Props = $props();
</script>

<TooltipPrimitive.Content
  data-slot="tooltip-content"
  class={cn(
    "bg-foreground text-background animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-fit rounded-md px-3 py-1.5 text-xs text-balance",
    className,
  )}
  {...rest}
>
  {#if children}{@render children()}{/if}
</TooltipPrimitive.Content>
