<script lang="ts">
  import { cn } from "$utils/index.js";
  import { Dialog as DialogPrimitive } from "bits-ui";

  type Props = DialogPrimitive.TitleProps & { class?: string };
  let { class: className, children, ...rest }: Props = $props();
</script>

<DialogPrimitive.Title data-slot="dialog-title" class={cn("text-lg leading-none font-semibold", className)} {...rest}>
  {#if children}{@render children()}{/if}
</DialogPrimitive.Title>
