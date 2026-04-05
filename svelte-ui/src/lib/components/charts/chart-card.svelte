<script lang="ts">
  interface Props {
    title: string;
    subtitle?: string;
    children?: import('svelte').Snippet;
  }

  let { title, subtitle, children }: Props = $props();
</script>

<div class="border border-border rounded-lg p-4 space-y-3">
  <div>
    <h3 class="text-xs font-medium text-muted-foreground">{title}</h3>
    {#if subtitle}
      <span class="text-[10px] text-muted-foreground/60">{subtitle}</span>
    {/if}
  </div>
  {#if children}
    {@render children()}
  {/if}
</div>
