<script lang="ts">
  import { cn } from "$utils/index.js";
  import type { HTMLAnchorAttributes } from "svelte/elements";
  import type { Snippet } from "svelte";

  type Props = HTMLAnchorAttributes & { class?: string; children?: Snippet };
  let { class: className, children, ...rest }: Props = $props();
</script>

<a data-slot="breadcrumb-link" class={cn("hover:text-foreground transition-colors", className)} {...rest}>
  {#if children}{@render children()}{/if}
</a>
