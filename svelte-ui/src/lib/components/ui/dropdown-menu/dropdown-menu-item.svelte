<script lang="ts">
  import { cn } from "$utils/index.js";
  import { DropdownMenu as Primitive } from "bits-ui";
  import type { Snippet } from "svelte";

  type Props = Primitive.ItemProps & {
    class?: string;
    inset?: boolean;
    variant?: "default" | "destructive";
    children?: Snippet;
  };

  let { class: className, inset, variant = "default", children, ...rest }: Props = $props();
</script>

<Primitive.Item
  data-slot="dropdown-menu-item"
  data-inset={inset}
  data-variant={variant}
  class={cn(
    "focus:bg-accent focus:text-accent-foreground data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 dark:data-[variant=destructive]:focus:bg-destructive/20 data-[variant=destructive]:focus:text-destructive [&_svg:not([class*='text-'])]:text-muted-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    className,
  )}
  {...rest}
>
  {#if children}{@render children()}{/if}
</Primitive.Item>
