<script lang="ts">
  import { cn } from "$utils/index.js";
  import { Tabs as TabsPrimitive } from "bits-ui";
  import type { Snippet } from "svelte";

  type Props = TabsPrimitive.RootProps & {
    class?: string;
    orientation?: "horizontal" | "vertical";
    children?: Snippet;
    value?: string;
  };

  let { class: className, orientation = "horizontal", children, value = $bindable(), ...rest }: Props = $props();
</script>

<TabsPrimitive.Root
  data-slot="tabs"
  data-orientation={orientation}
  {orientation}
  bind:value
  class={cn("group/tabs flex gap-2 data-[orientation=horizontal]:flex-col", className)}
  {...rest}
>
  {#if children}{@render children()}{/if}
</TabsPrimitive.Root>
