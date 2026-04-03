<script lang="ts">
  /**
   * Lightweight rich text editor surface.
   *
   * The repo does not ship the full TipTap stack yet, so this component keeps
   * the expected outer API and provides a functional contenteditable editor
   * with a small formatting toolbar. It is intentionally dependency-free so it
   * can be used immediately across pages that need Markdown/HTML input.
   */
  import { cn } from "$utils/index.js";
  import { Bold, Italic, Link2, List, ListOrdered, Pilcrow, Redo2, Undo2 } from "lucide-svelte";

  type Props = {
    content?: string;
    placeholder?: string;
    editable?: boolean;
    class?: string;
    onchange?: (html: string) => void;
  };

  let { content = "", placeholder = "Write something...", editable = true, class: className, onchange }: Props = $props();

  let internalContent = $state("");
  let previousPropContent = "";
  let initialized = false;
  let editorEl = $state<HTMLDivElement | null>(null);

  $effect(() => {
    if (!initialized) {
      initialized = true;
      previousPropContent = content;
      internalContent = content;
    } else if (content !== previousPropContent) {
      previousPropContent = content;
      internalContent = content;
    }

    if (editorEl && editorEl.innerHTML !== internalContent) {
      editorEl.innerHTML = internalContent;
    }
  });

  function handleInput(e: Event) {
    const target = e.target as HTMLDivElement;
    internalContent = target.innerHTML;
    onchange?.(internalContent);
  }

  function exec(command: string, value?: string) {
    if (!editable || typeof document === "undefined") return;
    document.execCommand(command, false, value);
    if (editorEl) {
      internalContent = editorEl.innerHTML;
      onchange?.(internalContent);
    }
    editorEl?.focus();
  }

  function insertLink() {
    const url = window.prompt("Enter link URL");
    if (!url) return;
    exec("createLink", url);
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
  <div class="flex items-center gap-1 border-b px-2 py-1.5 text-muted-foreground">
    <button
      type="button"
      class="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
      title="Bold"
      disabled={!editable}
      onclick={() => exec("bold")}
    >
      <Bold class="h-4 w-4" />
    </button>
    <button
      type="button"
      class="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
      title="Italic"
      disabled={!editable}
      onclick={() => exec("italic")}
    >
      <Italic class="h-4 w-4" />
    </button>
    <button
      type="button"
      class="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
      title="Bullet list"
      disabled={!editable}
      onclick={() => exec("insertUnorderedList")}
    >
      <List class="h-4 w-4" />
    </button>
    <button
      type="button"
      class="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
      title="Numbered list"
      disabled={!editable}
      onclick={() => exec("insertOrderedList")}
    >
      <ListOrdered class="h-4 w-4" />
    </button>
    <button
      type="button"
      class="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
      title="Paragraph"
      disabled={!editable}
      onclick={() => exec("formatBlock", "p")}
    >
      <Pilcrow class="h-4 w-4" />
    </button>
    <button
      type="button"
      class="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
      title="Link"
      disabled={!editable}
      onclick={insertLink}
    >
      <Link2 class="h-4 w-4" />
    </button>
    <div class="mx-1 h-4 w-px bg-border"></div>
    <button
      type="button"
      class="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
      title="Undo"
      disabled={!editable}
      onclick={() => exec("undo")}
    >
      <Undo2 class="h-4 w-4" />
    </button>
    <button
      type="button"
      class="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
      title="Redo"
      disabled={!editable}
      onclick={() => exec("redo")}
    >
      <Redo2 class="h-4 w-4" />
    </button>
  </div>

  <div class="relative">
    {#if !internalContent}
      <p class="pointer-events-none absolute left-3 top-2 text-muted-foreground">
        {placeholder}
      </p>
    {/if}
    <div
      bind:this={editorEl}
      contenteditable={editable}
      role="textbox"
      class="min-h-[6rem] px-3 py-2 outline-none prose prose-sm dark:prose-invert max-w-none"
      data-placeholder={placeholder}
      oninput={handleInput}
    >
      {@html internalContent}
    </div>
  </div>
</div>
