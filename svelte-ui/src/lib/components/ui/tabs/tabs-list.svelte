<script lang="ts">
  import { cn } from "$utils/index.js";
  import { Tabs as TabsPrimitive } from "bits-ui";
  import type { Snippet } from "svelte";

  type Props = TabsPrimitive.ListProps & {
    class?: string;
    variant?: "default" | "line";
    children?: Snippet;
  };

  let { class: className, variant = "default", children, ...rest }: Props = $props();

  const variantClasses = {
    default: "bg-muted",
    line: "gap-1 bg-transparent",
  };
</script>

<TabsPrimitive.List
  data-slot="tabs-list"
  data-variant={variant}
  class={cn(
    "p-[3px] group-data-[orientation=horizontal]/tabs:h-9 group/tabs-list text-muted-foreground inline-flex w-fit items-center justify-center group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col",
    variantClasses[variant ?? "default"],
    className,
  )}
  {...rest}
>
  {#if children}{@render children()}{/if}
</TabsPrimitive.List>
