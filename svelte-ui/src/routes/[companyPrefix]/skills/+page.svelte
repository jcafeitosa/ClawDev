<script lang="ts">
  import { breadcrumbStore } from '$stores/breadcrumb.svelte.js';
  import { companyStore } from '$stores/company.svelte.js';
  import { api } from '$lib/api';
  import { onMount } from 'svelte';
  import StatusBadge from '$lib/components/status-badge.svelte';

  onMount(() => breadcrumbStore.set([{ label: 'Skills' }]));

  let skills = $state<any[]>([]);
  let loading = $state(true);
  let companyId = $derived(companyStore.current?.id);

  $effect(() => {
    if (!companyId) return;
    api(`/api/companies/${companyId}/skills`).then(r => r.json()).then(d => { skills = Array.isArray(d) ? d : d.skills ?? []; }).finally(() => { loading = false; });
  });

  async function toggle(skill: any) {
    await api(`/api/companies/${companyId}/skills/${skill.id}`, { method: 'PATCH', body: JSON.stringify({ enabled: !skill.enabled }) });
    skills = skills.map(s => s.id === skill.id ? { ...s, enabled: !s.enabled } : s);
  }
</script>

<div class="p-6 space-y-4">
  <h1 class="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Company Skills</h1>
  {#if loading}
    <div class="space-y-3">{#each Array(4) as _}<div class="h-16 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800"></div>{/each}</div>
  {:else if skills.length === 0}
    <p class="text-sm text-zinc-500 py-8 text-center">No skills configured.</p>
  {:else}
    <div class="space-y-2">
      {#each skills as skill (skill.id)}
        <div class="flex items-center justify-between rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <div>
            <p class="text-sm font-medium text-zinc-900 dark:text-zinc-100">{skill.name}</p>
            <p class="text-xs text-zinc-500">{skill.description ?? ''}</p>
          </div>
          <button onclick={() => toggle(skill)} class="relative h-6 w-11 rounded-full transition-colors {skill.enabled ? 'bg-green-600' : 'bg-zinc-300 dark:bg-zinc-700'}">
            <span class="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform {skill.enabled ? 'translate-x-5' : ''}"></span>
          </button>
        </div>
      {/each}
    </div>
  {/if}
</div>
