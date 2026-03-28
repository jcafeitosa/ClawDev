<script lang="ts" module>
  import { Tooltip as _TooltipPrimitive } from "bits-ui";
  export const TooltipRoot = _TooltipPrimitive.Root;
  export const TooltipTrigger = _TooltipPrimitive.Trigger;
  export { default as TooltipContent } from "./tooltip-content.svelte";
</script>

<script lang="ts">
  import { Tooltip as TooltipPrimitive } from "bits-ui";
  import type { Snippet } from "svelte";

  type Props = TooltipPrimitive.RootProps & {
    children?: Snippet;
  };

  let { children, ...rest }: Props = $props();
</script>

<TooltipPrimitive.Root delayDuration={0} {...rest}>
  {#if children}{@render children()}{/if}
</TooltipPrimitive.Root>
