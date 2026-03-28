<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";
  import type { Snippet } from "svelte";

  type Props = HTMLAttributes<HTMLDivElement> & { children?: Snippet };
  let { children, ...rest }: Props = $props();
</script>

<div data-slot="command-empty" class="py-6 text-center text-sm" {...rest}>
  {#if children}{@render children()}{/if}
</div>
