<script lang="ts">
  import { toastStore } from "$stores/toast.svelte.js";
  import { cn } from "$utils/index.js";
  import { X } from "lucide-svelte";

  const toasts = $derived(toastStore.items);

  const toneStyles: Record<string, string> = {
    info: "border-border bg-card text-card-foreground",
    success: "border-green-500/30 bg-green-950/80 text-green-100",
    warn: "border-yellow-500/30 bg-yellow-950/80 text-yellow-100",
    error: "border-destructive/30 bg-red-950/80 text-red-100",
  };
</script>

{#if toasts.length > 0}
  <div
    class="fixed bottom-4 left-4 z-[120] flex flex-col gap-2 w-80"
    role="region"
    aria-live="polite"
    aria-label="Notifications"
  >
    {#each toasts as toast (toast.id)}
      <div
        class={cn(
          "flex items-start gap-3 rounded-md border px-4 py-3 shadow-lg animate-in slide-in-from-bottom-2 fade-in-0 duration-200",
          toneStyles[toast.tone],
        )}
      >
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium truncate">{toast.title}</p>
          {#if toast.body}
            <p class="text-xs opacity-80 mt-0.5 line-clamp-2">{toast.body}</p>
          {/if}
          {#if toast.action}
            <a href={toast.action.href} class="text-xs font-medium underline underline-offset-2 mt-1 inline-block">{toast.action.label}</a>
          {/if}
        </div>
        <button class="shrink-0 opacity-60 hover:opacity-100 transition-opacity p-0.5" onclick={() => toastStore.dismiss(toast.id)} aria-label="Dismiss">
          <X class="size-3.5" />
        </button>
      </div>
    {/each}
  </div>
{/if}
