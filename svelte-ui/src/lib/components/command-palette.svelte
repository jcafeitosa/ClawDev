<script lang="ts">
  /**
   * Command Palette — keyboard-driven command launcher.
   *
   * Placeholder for cmdk-sv integration.
   * Triggered by Ctrl+K / Cmd+K.
   * Full implementation in Tarefa 8.
   */
  import { cn } from "$utils/index.js";
  import { Search, X } from "lucide-svelte";

  let open = $state(false);
  let query = $state("");

  function handleKeydown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      open = !open;
      query = "";
    }
    if (e.key === "Escape" && open) {
      open = false;
    }
  }

  export function show() {
    open = true;
    query = "";
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
  <!-- Backdrop -->
  <button class="fixed inset-0 z-50 bg-black/50" onclick={() => (open = false)} aria-label="Close command palette"></button>

  <!-- Dialog -->
  <div class="fixed top-[20%] left-1/2 z-50 w-full max-w-lg -translate-x-1/2 rounded-lg border bg-popover shadow-2xl">
    <div class="flex items-center gap-2 border-b px-3">
      <Search class="size-4 shrink-0 text-muted-foreground" />
      <input
        bind:value={query}
        placeholder="Type a command or search..."
        class="flex h-12 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
      />
      <button class="text-muted-foreground hover:text-foreground" onclick={() => (open = false)}>
        <X class="size-4" />
      </button>
    </div>
    <div class="max-h-[300px] overflow-y-auto p-2">
      <p class="py-6 text-center text-sm text-muted-foreground">
        {query ? `No results for "${query}"` : "Start typing to search..."}
      </p>
    </div>
  </div>
{/if}
