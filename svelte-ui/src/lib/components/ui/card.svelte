<script lang="ts" module>
  export { default as Card } from "./card.svelte";
  export { default as CardHeader } from "./card-header.svelte";
  export { default as CardTitle } from "./card-title.svelte";
  export { default as CardDescription } from "./card-description.svelte";
  export { default as CardAction } from "./card-action.svelte";
  export { default as CardContent } from "./card-content.svelte";
  export { default as CardFooter } from "./card-footer.svelte";
</script>

<script lang="ts">
  import { cn } from "$utils/index.js";
  import type { HTMLAttributes } from "svelte/elements";
  import type { Snippet } from "svelte";

  type Props = HTMLAttributes<HTMLDivElement> & {
    class?: string;
    children?: Snippet;
  };

  let { class: className, children, ...rest }: Props = $props();
</script>

<div data-slot="card" class={cn("bg-card text-card-foreground flex flex-col gap-6 border py-6 shadow-sm", className)} {...rest}>
  {#if children}{@render children()}{/if}
</div>
