<script lang="ts">
  import { cn } from "$utils/index.js";
  import type { HTMLAttributes } from "svelte/elements";
  import type { Snippet } from "svelte";

  type Props = HTMLAttributes<HTMLSpanElement> & { class?: string; children?: Snippet };
  let { class: className, children, ...rest }: Props = $props();
</script>

<span data-slot="command-shortcut" class={cn("text-muted-foreground ml-auto text-xs tracking-widest", className)} {...rest}>
  {#if children}{@render children()}{/if}
</span>
