<script lang="ts">
  import { cn } from "$utils/index.js";
  import type { HTMLAttributes } from "svelte/elements";
  import type { Snippet } from "svelte";

  type Props = HTMLAttributes<HTMLDivElement> & { class?: string; heading?: string; children?: Snippet };
  let { class: className, heading, children, ...rest }: Props = $props();
</script>

<div data-slot="command-group" class={cn("text-foreground overflow-hidden p-1", className)} role="group" {...rest}>
  {#if heading}
    <div class="text-muted-foreground px-2 py-1.5 text-xs font-medium">{heading}</div>
  {/if}
  {#if children}{@render children()}{/if}
</div>
