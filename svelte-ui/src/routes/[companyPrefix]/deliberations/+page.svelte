<script lang="ts">
  import { page } from '$app/stores';
  import { breadcrumbStore } from '$stores/breadcrumb.svelte.js';
  import { companyStore, resolveCompanyIdFromPrefix } from '$stores/company.svelte.js';
  import { api } from '$lib/api';
  import { onMount } from 'svelte';
  import {
    MessageSquare, Plus, Vote, CheckCircle2, XCircle, Clock,
    ThumbsUp, ThumbsDown, Minus, Users, Bot
  } from 'lucide-svelte';
  import { Card, CardContent, Badge, Button, Input, Skeleton } from '$components/ui/index.js';
  import { PageLayout } from '$components/layout/index.js';

  onMount(() => breadcrumbStore.set([{ label: 'Deliberations' }]));

  let loading = $state(true);
  let deliberations = $state<any[]>([]);
  let showCreate = $state(false);
  let agents = $state<any[]>([]);

  // Create form
  let newTopic = $state('');
  let newDescription = $state('');
  let newDecisionType = $state('majority_vote');
  let selectedParticipants = $state<string[]>([]);
  let creating = $state(false);

  // Vote form
  let votingDelibId = $state<string | null>(null);
  let voteAgentId = $state('');
  let votePosition = $state('approve');
  let voteReasoning = $state('');

  // Detail
  let expandedId = $state<string | null>(null);
  let detailData = $state<any>(null);
  let detailLoading = $state(false);

  let companyId = $derived(resolveCompanyIdFromPrefix($page.params.companyPrefix));
  let prefix = $derived($page.params.companyPrefix);

  $effect(() => {
    if (!companyId) return;
    loading = true;
    api(`/api/companies/${companyId}/agent-deliberations`)
      .then((r) => r.json())
      .then((d) => { deliberations = Array.isArray(d) ? d : []; })
      .catch(console.error)
      .finally(() => (loading = false));
  });

  async function loadAgents() {
    if (!companyId || agents.length > 0) return;
    try {
      const res = await api(`/api/companies/${companyId}/agents`);
      const data = await res.json();
      agents = Array.isArray(data) ? data : data.agents ?? [];
    } catch (e) { console.error(e); }
  }

  async function createDeliberation() {
    if (!newTopic.trim() || !companyId || selectedParticipants.length === 0) return;
    creating = true;
    try {
      const res = await api(`/api/companies/${companyId}/agent-deliberations`, {
        method: 'POST',
        body: JSON.stringify({
          topic: newTopic.trim(),
          description: newDescription.trim() || undefined,
          decisionType: newDecisionType,
          participantAgentIds: selectedParticipants,
        }),
      });
      const d = await res.json();
      deliberations = [d, ...deliberations];
      newTopic = '';
      newDescription = '';
      selectedParticipants = [];
      showCreate = false;
    } catch (e) { console.error(e); }
    finally { creating = false; }
  }

  async function loadDetail(id: string) {
    if (expandedId === id) { expandedId = null; return; }
    expandedId = id;
    detailLoading = true;
    try {
      const res = await api(`/api/agent-deliberations/${id}`);
      detailData = await res.json();
    } catch (e) { console.error(e); }
    finally { detailLoading = false; }
  }

  async function castVote() {
    if (!votingDelibId || !voteAgentId || !voteReasoning.trim()) return;
    try {
      await api(`/api/agent-deliberations/${votingDelibId}/vote`, {
        method: 'POST',
        body: JSON.stringify({ agentId: voteAgentId, position: votePosition, reasoning: voteReasoning.trim() }),
      });
      votingDelibId = null;
      voteReasoning = '';
      if (expandedId) await loadDetail(expandedId);
    } catch (e) { console.error(e); }
  }

  async function resolveDeliberation(id: string) {
    try {
      const res = await api(`/api/agent-deliberations/${id}/resolve`, { method: 'POST' });
      const resolved = await res.json();
      deliberations = deliberations.map((d) => {
        const dl = d.deliberation ?? d;
        if (dl.id === id) return { ...d, deliberation: { ...dl, ...resolved } };
        return d;
      });
      if (expandedId === id) await loadDetail(id);
    } catch (e) { console.error(e); }
  }

  function toggleParticipant(agentId: string) {
    if (selectedParticipants.includes(agentId)) {
      selectedParticipants = selectedParticipants.filter((id) => id !== agentId);
    } else {
      selectedParticipants = [...selectedParticipants, agentId];
    }
  }

  const STATUS_BADGE_CLASSES: Record<string, string> = {
    open: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
    voting: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    decided: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    cancelled: 'bg-red-500/15 text-red-600 dark:text-red-400',
  };
  const POSITION_BADGE_CLASSES: Record<string, string> = {
    approve: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    reject: 'bg-red-500/15 text-red-600 dark:text-red-400',
    abstain: 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400',
    alternative: 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
  };
</script>

<PageLayout title="Deliberations" description="Agent debates and consensus decisions">
  {#snippet actions()}
    <Button variant="outline" size="sm" onclick={() => { showCreate = !showCreate; if (showCreate) loadAgents(); }}>
      <Plus class="h-4 w-4" />
      New Deliberation
    </Button>
  {/snippet}

  {#if showCreate}
    <Card>
      <CardContent class="pt-5">
        <form onsubmit={(e) => { e.preventDefault(); createDeliberation(); }} class="space-y-4">
          <div>
            <label for="delib-topic" class="block text-xs font-medium text-foreground mb-1">Topic</label>
            <Input id="delib-topic" bind:value={newTopic} placeholder="What should be debated?" />
          </div>
          <div>
            <label for="delib-desc" class="block text-xs font-medium text-foreground mb-1">Description</label>
            <textarea id="delib-desc" bind:value={newDescription} rows="2" placeholder="Context and details..." class="w-full selection:bg-primary selection:text-primary-foreground border-input dark:bg-input/30 rounded-md px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none resize-none"></textarea>
          </div>
          <div>
            <label for="delib-type" class="block text-xs font-medium text-foreground mb-1">Decision Type</label>
            <select id="delib-type" bind:value={newDecisionType} class="w-full selection:bg-primary selection:text-primary-foreground border-input dark:bg-input/30 rounded-md px-3 py-2 text-sm text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none">
              <option value="majority_vote">Majority Vote</option>
              <option value="unanimous">Unanimous</option>
              <option value="weighted">Weighted Vote</option>
              <option value="lead_decides">Lead Decides</option>
            </select>
          </div>
          <div>
            <p class="block text-xs font-medium text-foreground mb-2">Participants</p>
            <div class="flex flex-wrap gap-2">
              {#each agents as a}
                <button
                  type="button"
                  class="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors {selectedParticipants.includes(a.id) ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'border-border/50 bg-accent/30 text-muted-foreground'}"
                  onclick={() => toggleParticipant(a.id)}
                >
                  <Bot class="h-3 w-3" />
                  {a.name}
                </button>
              {/each}
            </div>
            {#if selectedParticipants.length > 0}
              <p class="text-xs text-muted-foreground/60 mt-1">{selectedParticipants.length} selected</p>
            {/if}
          </div>
          <div class="flex items-center gap-3">
            <Button type="submit" disabled={creating || !newTopic.trim() || selectedParticipants.length === 0}>
              {creating ? 'Creating...' : 'Create Deliberation'}
            </Button>
            <Button variant="outline" type="button" onclick={() => (showCreate = false)}>Cancel</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  {/if}

  {#if loading}
    <div class="space-y-3">
      {#each Array(3) as _}<Skeleton class="h-20 rounded-xl" />{/each}
    </div>
  {:else if deliberations.length === 0}
    <Card>
      <CardContent class="p-12 text-center">
        <div class="flex flex-col items-center gap-3">
          <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/30">
            <Vote class="h-5 w-5 text-muted-foreground/40" />
          </div>
          <p class="text-sm font-medium text-muted-foreground">No deliberations yet</p>
          <p class="text-xs text-muted-foreground/60">Start a debate for agents to reach consensus.</p>
          <Button variant="outline" class="mt-2" onclick={() => { showCreate = true; loadAgents(); }}>
            <Plus class="h-4 w-4" />
            New Deliberation
          </Button>
        </div>
      </CardContent>
    </Card>
  {:else}
    <div class="space-y-3">
      {#each deliberations as d ((d.deliberation ?? d).id)}
        {@const dl = d.deliberation ?? d}
        {@const statusClasses = STATUS_BADGE_CLASSES[dl.status] ?? 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400'}
        <div class="glass-card overflow-hidden font-card">
          <button class="w-full flex items-center gap-3 px-4 py-3 text-left" onclick={() => loadDetail(dl.id)}>
            <div class="rounded-lg p-1.5 bg-indigo-500/10">
              <Vote class="h-4 w-4 text-indigo-500" />
            </div>
            <div class="min-w-0 flex-1">
              <span class="font-medium text-foreground block">{dl.topic}</span>
              {#if dl.description}
                <span class="text-xs text-muted-foreground/60 truncate block">{dl.description}</span>
              {/if}
            </div>
            <span class="inline-flex items-center gap-1 font-bold uppercase text-[10px] px-2 py-0.5 rounded-full {statusClasses}">
              {dl.status}
            </span>
            <Badge variant="outline" class="text-[10px]">{dl.decisionType?.replace('_', ' ')}</Badge>
            <span class="text-xs text-muted-foreground tabular-nums">{d.voteCount ?? 0} votes</span>
          </button>

          {#if expandedId === dl.id}
            <div class="border-t border-border/30 px-4 py-3 bg-accent/20 space-y-3">
              {#if detailLoading}
                <p class="text-xs text-muted-foreground/60">Loading...</p>
              {:else if detailData}
                {#if dl.decision}
                  <div class="rounded-lg bg-green-500/10 border border-green-500/20 px-3 py-2">
                    <p class="text-xs font-medium text-green-400">Decision: {dl.decision}</p>
                  </div>
                {/if}

                <div>
                  <p class="text-xs font-medium text-muted-foreground mb-2">Votes ({detailData.votes?.length ?? 0})</p>
                  {#if (detailData.votes?.length ?? 0) === 0}
                    <p class="text-xs text-muted-foreground/60">No votes yet.</p>
                  {:else}
                    <div class="space-y-1">
                      {#each detailData.votes as v}
                        {@const posClasses = POSITION_BADGE_CLASSES[v.position ?? v.vote?.position] ?? 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400'}
                        <div class="flex items-center gap-2 rounded-lg bg-accent/30 px-3 py-2 text-xs">
                          <span class="inline-flex items-center gap-1 font-bold uppercase text-[10px] px-2 py-0.5 rounded-full {posClasses}">
                            {v.position ?? v.vote?.position}
                          </span>
                          <span class="font-medium text-foreground">{v.agentName ?? 'Agent'}</span>
                          <span class="text-muted-foreground/60 flex-1 truncate">{v.reasoning ?? v.vote?.reasoning}</span>
                          {#if (v.weight ?? v.vote?.weight ?? 1) > 1}
                            <Badge variant="outline" class="text-[10px]">×{v.weight ?? v.vote?.weight}</Badge>
                          {/if}
                        </div>
                      {/each}
                    </div>
                  {/if}
                </div>

                {#if dl.status === 'open' || dl.status === 'voting'}
                  <div class="flex items-center gap-2">
                    <Button size="sm" variant="outline" onclick={() => { votingDelibId = dl.id; loadAgents(); }}>
                      <ThumbsUp class="h-3 w-3" /> Cast Vote
                    </Button>
                    <Button size="sm" variant="outline" onclick={() => resolveDeliberation(dl.id)}>
                      <CheckCircle2 class="h-3 w-3" /> Resolve
                    </Button>
                  </div>
                {/if}

                {#if votingDelibId === dl.id}
                  <div class="rounded-lg border border-border/50 bg-accent/40 p-3 space-y-2">
                    <div class="flex gap-2">
                      <select bind:value={voteAgentId} class="flex-1 selection:bg-primary selection:text-primary-foreground border-input dark:bg-input/30 rounded-md px-2 py-1.5 text-xs text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none">
                        <option value="">Agent...</option>
                        {#each agents as a}<option value={a.id}>{a.name}</option>{/each}
                      </select>
                      <select bind:value={votePosition} class="selection:bg-primary selection:text-primary-foreground border-input dark:bg-input/30 rounded-md px-2 py-1.5 text-xs text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none">
                        <option value="approve">Approve</option>
                        <option value="reject">Reject</option>
                        <option value="abstain">Abstain</option>
                        <option value="alternative">Alternative</option>
                      </select>
                    </div>
                    <textarea bind:value={voteReasoning} rows="2" placeholder="Reasoning..." class="w-full selection:bg-primary selection:text-primary-foreground border-input dark:bg-input/30 rounded-md px-2 py-1.5 text-xs text-foreground placeholder-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none resize-none"></textarea>
                    <div class="flex gap-2">
                      <Button size="sm" onclick={castVote} disabled={!voteAgentId || !voteReasoning.trim()}>Submit Vote</Button>
                      <Button size="sm" variant="outline" onclick={() => (votingDelibId = null)}>Cancel</Button>
                    </div>
                  </div>
                {/if}
              {/if}
            </div>
          {/if}
        </div>
      {/each}
    </div>
    <p class="mt-2 text-right text-xs text-muted-foreground/60">{deliberations.length} deliberation{deliberations.length === 1 ? '' : 's'}</p>
  {/if}
</PageLayout>
