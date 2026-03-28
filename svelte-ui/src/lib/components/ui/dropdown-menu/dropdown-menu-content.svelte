<script lang="ts">
  import { cn } from "$utils/index.js";
  import { DropdownMenu as Primitive } from "bits-ui";
  import type { Snippet } from "svelte";

  type Props = Primitive.ContentProps & { class?: string; children?: Snippet };
  let { class: className, children, ...rest }: Props = $props();
</script>

<Primitive.Content
  data-slot="dropdown-menu-content"
  class={cn(
    "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 min-w-[8rem] overflow-x-hidden overflow-y-auto rounded-md border p-1 shadow-md",
    className,
  )}
  {...rest}
>
  {#if children}{@render children()}{/if}
</Primitive.Content>
