<script lang="ts">
  import { cn } from "$utils/index.js";
  import { Dialog as SheetPrimitive } from "bits-ui";

  type Props = SheetPrimitive.TitleProps & { class?: string };
  let { class: className, children, ...rest }: Props = $props();
</script>

<SheetPrimitive.Title data-slot="sheet-title" class={cn("text-foreground font-semibold", className)} {...rest}>
  {#if children}{@render children()}{/if}
</SheetPrimitive.Title>
