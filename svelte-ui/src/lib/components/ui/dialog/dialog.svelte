<script lang="ts">
  import { Dialog as DialogPrimitive } from "bits-ui";

  type Props = DialogPrimitive.RootProps;

  let { children, ...rest }: Props = $props();
</script>

<DialogPrimitive.Root {...rest}>
  {#if children}{@render children()}{/if}
</DialogPrimitive.Root>
