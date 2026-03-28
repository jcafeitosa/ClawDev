<script lang="ts">
  import { cn } from "$utils/index.js";
  import { Select as Primitive } from "bits-ui";
  import type { Snippet } from "svelte";

  type Props = Primitive.ItemProps & { class?: string; children?: Snippet };
  let { class: className, children, ...rest }: Props = $props();
</script>

<Primitive.Item
  data-slot="select-item"
  class={cn(
    "focus:bg-accent focus:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    className,
  )}
  {...rest}
>
  {#if children}{@render children()}{/if}
</Primitive.Item>
