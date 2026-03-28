<script lang="ts">
  import { cn } from "$utils/index.js";
  import { Tabs as TabsPrimitive } from "bits-ui";
  import type { Snippet } from "svelte";

  type Props = TabsPrimitive.ContentProps & {
    class?: string;
    children?: Snippet;
  };

  let { class: className, children, ...rest }: Props = $props();
</script>

<TabsPrimitive.Content data-slot="tabs-content" class={cn("flex-1 outline-none", className)} {...rest}>
  {#if children}{@render children()}{/if}
</TabsPrimitive.Content>
