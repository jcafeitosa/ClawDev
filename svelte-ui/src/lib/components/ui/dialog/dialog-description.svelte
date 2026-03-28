<script lang="ts">
  import { cn } from "$utils/index.js";
  import { Dialog as DialogPrimitive } from "bits-ui";

  type Props = DialogPrimitive.DescriptionProps & { class?: string };
  let { class: className, children, ...rest }: Props = $props();
</script>

<DialogPrimitive.Description data-slot="dialog-description" class={cn("text-muted-foreground text-sm", className)} {...rest}>
  {#if children}{@render children()}{/if}
</DialogPrimitive.Description>
