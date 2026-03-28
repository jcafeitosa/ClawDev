<script lang="ts">
  import { cn } from "$utils/index.js";
  import { Dialog as SheetPrimitive } from "bits-ui";

  type Props = SheetPrimitive.DescriptionProps & { class?: string };
  let { class: className, children, ...rest }: Props = $props();
</script>

<SheetPrimitive.Description data-slot="sheet-description" class={cn("text-muted-foreground text-sm", className)} {...rest}>
  {#if children}{@render children()}{/if}
</SheetPrimitive.Description>
