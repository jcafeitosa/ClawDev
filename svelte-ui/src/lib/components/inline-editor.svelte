<script lang="ts">
  /**
   * InlineEditor — click-to-edit component for titles and text fields.
   * Renders text in a configurable HTML tag; clicking switches to an input
   * for seamless inline editing with save/cancel/error handling.
   */
  import { Pencil, Loader2 } from 'lucide-svelte';
  import { toastStore } from '$lib/stores/toast.svelte';

  interface Props {
    value: string;
    onSave: (newValue: string) => Promise<void>;
    tag?: string;
    class?: string;
    placeholder?: string;
  }

  let {
    value,
    onSave,
    tag = 'h1',
    class: className = '',
    placeholder = 'Click to edit...',
  }: Props = $props();

  let editing = $state(false);
  let saving = $state(false);
  let editValue = $state('');
  let inputEl = $state<HTMLInputElement | null>(null);

  function startEdit() {
    if (saving) return;
    editValue = value;
    editing = true;
    // Focus the input after Svelte renders it
    requestAnimationFrame(() => {
      inputEl?.focus();
      inputEl?.select();
    });
  }

  function cancelEdit() {
    editing = false;
    editValue = value;
  }

  async function commitEdit() {
    const trimmed = editValue.trim();
    if (trimmed === value) {
      editing = false;
      return;
    }
    if (!trimmed) {
      cancelEdit();
      return;
    }

    saving = true;
    try {
      await onSave(trimmed);
      editing = false;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save';
      toastStore.push({ title: 'Save failed', body: message, tone: 'error' });
      editValue = value;
      editing = false;
    } finally {
      saving = false;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    }
  }
</script>

{#if editing}
  <div class="inline-editor-input group relative flex items-center gap-2 {className}">
    <input
      bind:this={inputEl}
      bind:value={editValue}
      onkeydown={handleKeydown}
      onblur={commitEdit}
      disabled={saving}
      {placeholder}
      class="w-full bg-transparent border-b-2 border-blue-500 outline-none text-[#F8FAFC] py-1
             disabled:opacity-50 {className}"
    />
    {#if saving}
      <span class="flex items-center gap-1 text-xs text-[#94A3B8] whitespace-nowrap">
        <Loader2 class="h-3.5 w-3.5 animate-spin" />
        Saving...
      </span>
    {/if}
  </div>
{:else}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="inline-editor-display group relative inline-flex items-center gap-2 cursor-pointer rounded-md
           hover:bg-white/[0.04] transition-colors -mx-1 px-1 {className}"
    onclick={startEdit}
    role="button"
    tabindex="0"
    onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startEdit(); } }}
  >
    {#if tag === 'h1'}
      <h1 class="text-[#F8FAFC] {!value ? 'text-[#94A3B8] italic' : ''}">{value || placeholder}</h1>
    {:else if tag === 'h2'}
      <h2 class="text-[#F8FAFC] {!value ? 'text-[#94A3B8] italic' : ''}">{value || placeholder}</h2>
    {:else if tag === 'h3'}
      <h3 class="text-[#F8FAFC] {!value ? 'text-[#94A3B8] italic' : ''}">{value || placeholder}</h3>
    {:else if tag === 'span'}
      <span class="text-[#F8FAFC] {!value ? 'text-[#94A3B8] italic' : ''}">{value || placeholder}</span>
    {:else}
      <p class="text-[#F8FAFC] {!value ? 'text-[#94A3B8] italic' : ''}">{value || placeholder}</p>
    {/if}
    <Pencil
      class="h-3.5 w-3.5 text-[#94A3B8] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
    />
  </div>
{/if}
