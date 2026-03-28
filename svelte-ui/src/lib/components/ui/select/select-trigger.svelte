<script lang="ts">
  import { cn } from "$utils/index.js";
  import { Select as Primitive } from "bits-ui";
  import { ChevronDown } from "lucide-svelte";
  import type { Snippet } from "svelte";

  type Props = Primitive.TriggerProps & {
    class?: string;
    size?: "sm" | "default";
    children?: Snippet;
  };

  let { class: className, size = "default", children, ...rest }: Props = $props();
</script>

<Primitive.Trigger
  data-slot="select-trigger"
  data-size={size}
  class={cn(
    "border-input data-[placeholder]:text-muted-foreground [&_svg:not([class*='text-'])]:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 dark:hover:bg-input/50 flex w-fit items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-9 data-[size=sm]:h-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    className,
  )}
  {...rest}
>
  {#if children}{@render children()}{/if}
  <ChevronDown class="size-4 opacity-50" />
</Primitive.Trigger>
