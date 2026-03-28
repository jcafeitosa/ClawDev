<script lang="ts">
  import { cn } from "$utils/index.js";
  import type { HTMLAttributes } from "svelte/elements";
  import type { Snippet } from "svelte";

  type Props = HTMLAttributes<HTMLSpanElement> & { class?: string; children?: Snippet };
  let { class: className, children, ...rest }: Props = $props();
</script>

<span
  data-slot="avatar-fallback"
  class={cn(
    "bg-muted text-muted-foreground flex size-full items-center justify-center rounded-full text-sm group-data-[size=sm]/avatar:text-xs group-data-[size=xs]/avatar:text-[10px]",
    className,
  )}
  {...rest}
>
  {#if children}{@render children()}{/if}
</span>
