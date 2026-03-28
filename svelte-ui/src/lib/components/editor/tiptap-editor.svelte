<script lang="ts">
  /**
   * TipTap (ProseMirror) rich text editor — placeholder component.
   *
   * Replaces Lexical from the React UI.
   * Full implementation requires:
   *   pnpm add @tiptap/core @tiptap/pm @tiptap/starter-kit @tiptap/extension-placeholder
   *         @tiptap/extension-link @tiptap/extension-mention svelte-tiptap
   *
   * This placeholder provides the same outer API shape so pages can integrate it
   * and we can incrementally build out the editor functionality.
   */
  import { cn } from "$utils/index.js";

  type Props = {
    content?: string;
    placeholder?: string;
    editable?: boolean;
    class?: string;
    onchange?: (html: string) => void;
  };

  let { content = "", placeholder = "Write something...", editable = true, class: className, onchange }: Props = $props();

  let internalContent = $state("");

  function handleInput(e: Event) {
    const target = e.target as HTMLDivElement;
    internalContent = target.innerHTML;
    onchange?.(internalContent);
  }
</script>

<div
  data-slot="tiptap-editor"
  class={cn(
    "border-input rounded-md border bg-transparent text-sm transition-[color,box-shadow] outline-none",
    "focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]",
    !editable && "pointer-events-none opacity-60",
    className,
  )}
>
  <!-- Toolbar placeholder -->
  <div class="flex items-center gap-1 border-b px-2 py-1.5 text-muted-foreground">
    <span class="text-xs">TipTap Editor — toolbar will be added</span>
  </div>

  <!-- Editable area -->
  <div
    contenteditable={editable}
    role="textbox"
    class="min-h-[6rem] px-3 py-2 outline-none prose prose-sm dark:prose-invert max-w-none"
    data-placeholder={placeholder}
    oninput={handleInput}
  >
    {#if !internalContent}
      <p class="text-muted-foreground">{placeholder}</p>
    {/if}
  </div>
</div>
