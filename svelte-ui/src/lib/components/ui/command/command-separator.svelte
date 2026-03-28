<script lang="ts">
  import { cn } from "$utils/index.js";
  import type { HTMLAttributes } from "svelte/elements";

  type Props = HTMLAttributes<HTMLDivElement> & { class?: string };
  let { class: className, ...rest }: Props = $props();
</script>

<div data-slot="command-separator" class={cn("bg-border -mx-1 h-px", className)} {...rest}></div>
