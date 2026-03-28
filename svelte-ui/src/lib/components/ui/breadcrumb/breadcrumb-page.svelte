<script lang="ts">
  import { cn } from "$utils/index.js";
  import type { HTMLAttributes } from "svelte/elements";
  import type { Snippet } from "svelte";

  type Props = HTMLAttributes<HTMLSpanElement> & { class?: string; children?: Snippet };
  let { class: className, children, ...rest }: Props = $props();
</script>

<span data-slot="breadcrumb-page" role="link" aria-disabled="true" aria-current="page" class={cn("text-foreground font-normal", className)} {...rest}>
  {#if children}{@render children()}{/if}
</span>
