<script lang="ts">
  import { page } from "$app/stores";
  import { api, unwrap } from "$lib/api";
  import { breadcrumbStore } from "$stores/breadcrumb.svelte.js";
  import { companyStore } from "$stores/company.svelte.js";
  import { toastStore } from "$stores/toast.svelte.js";
  import { PageSkeleton, PropertiesPanel, PropertyRow, StatusBadge, TimeAgo, EmptyState } from "$components/index.js";
  import { Button, Badge, Card, CardHeader, CardTitle, CardContent, Separator, Tabs, TabsList, TabsTrigger, TabsContent } from "$components/ui/index.js";
  import { onMount } from "svelte";

  // ---------------------------------------------------------------------------
  // Types
  // ---------------------------------------------------------------------------
  interface Agent {
    id: string;
    name: string;
    slug?: string;
    urlKey?: string;
    status: string;
    role: string;
    adapterType: string;
    model?: string | null;
    description?: string | null;
    companyId: string;
    reportsTo?: string | null;
    adapterConfig?: Record<string, unknown> | null;
    permissions?: Record<string, unknown> | null;
    configuration?: Record<string, unknown> | null;
    createdAt?: string;
    updatedAt?: string;
    lastHeartbeatAt?: string | null;
    chainOfCommand?: Array<{ id: string; name: string; role: string }>;
    access?: { canAssignTasks: boolean; taskAssignSource: string };
    [key: string]: unknown;
  }

  interface HeartbeatRun {
    id: string;
    agentId: string;
    status: string;
    source?: string;
    reason?: string | null;
    startedAt?: string;
    finishedAt?: string | null;
    durationMs?: number | null;
    [key: string]: unknown;
  }

  interface Skill {
    key: string;
    name?: string;
    description?: string;
    status?: string;
    [key: string]: unknown;
  }

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  let agent = $state<Agent | null>(null);
  let heartbeats = $state<HeartbeatRun[]>([]);
  let skills = $state<Skill[]>([]);
  let loading = $state(true);
  let notFound = $state(false);
  let activeTab = $state("overview");

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------
  let agentId = $derived($page.params.agentId);
  let companyId = $derived(companyStore.selectedCompanyId);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------
  async function loadAgent() {
    if (!agentId) return;
    loading = true;
    notFound = false;
    try {
      const result = await (api as any).api.agents({ id: agentId }).get();
      agent = unwrap(result) as Agent;
      breadcrumbStore.set([
        { label: "Agents", href: `/${$page.params.companyPrefix}/agents` },
        { label: agent.name },
      ]);
    } catch (err: any) {
      if (err?.message?.includes("not found") || err?.status === 404) {
        notFound = true;
      } else {
        toastStore.push({ title: "Failed to load agent", body: err?.message, tone: "error" });
      }
    } finally {
      loading = false;
    }
  }

  async function loadHeartbeats() {
    if (!agentId || !companyId) return;
    try {
      const result = await (api as any).api.agents({ id: agentId })["heartbeat-runs"].get({ query: { limit: "20" } });
      heartbeats = (unwrap(result) as HeartbeatRun[]) ?? [];
    } catch {
      heartbeats = [];
    }
  }

  async function loadSkills() {
    if (!companyId) return;
    try {
      const result = await (api as any).api.companies({ companyId })["skills"].get();
      skills = (unwrap(result) as Skill[]) ?? [];
    } catch {
      skills = [];
    }
  }

  onMount(() => {
    loadAgent();
    loadHeartbeats();
    loadSkills();
  });

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function adapterLabel(type: string): string {
    const map: Record<string, string> = {
      "claude-local": "Claude (Local)",
      "codex-local": "Codex (Local)",
      "cursor-local": "Cursor (Local)",
      "gemini-local": "Gemini (Local)",
      "opencode-local": "OpenCode (Local)",
      "pi-local": "Pi (Local)",
      "openclaw-gateway": "OpenClaw Gateway",
    };
    return map[type] ?? type;
  }
</script>

{#if loading}
  <div class="p-6">
    <PageSkeleton lines={8} />
  </div>
{:else if notFound}
  <div class="p-6">
    <EmptyState title="Agent not found" description="The agent you're looking for doesn't exist or you don't have access." icon="🤖">
      <a href="/{$page.params.companyPrefix}/agents" class="text-sm text-primary hover:underline">Back to agents</a>
    </EmptyState>
  </div>
{:else if agent}
  <div class="p-6">
    <!-- Header -->
    <div class="flex items-start justify-between gap-4 mb-6">
      <div class="min-w-0">
        <div class="flex items-center gap-3 mb-1">
          <h1 class="text-xl font-semibold truncate">{agent.name}</h1>
          <StatusBadge status={agent.status} />
          {#if agent.role}
            <Badge variant="outline" class="capitalize">{agent.role}</Badge>
          {/if}
        </div>
        {#if agent.description}
          <p class="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{agent.description}</p>
        {/if}
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <Button variant="outline" size="sm" href="/{$page.params.companyPrefix}/agents">
          Back
        </Button>
      </div>
    </div>

    <!-- Main content + sidebar -->
    <div class="flex flex-col lg:flex-row gap-6">
      <!-- Main content area -->
      <div class="flex-1 min-w-0">
        <Tabs bind:value={activeTab}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="runs">Recent Runs</TabsTrigger>
            <TabsTrigger value="skills">Skills</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div class="space-y-6 mt-4">
              <!-- Configuration Card -->
              <Card>
                <CardHeader>
                  <CardTitle>Configuration</CardTitle>
                </CardHeader>
                <CardContent>
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span class="text-zinc-500 dark:text-zinc-400">Adapter</span>
                      <p class="font-medium mt-0.5">{adapterLabel(agent.adapterType)}</p>
                    </div>
                    {#if agent.model || agent.adapterConfig?.model}
                      <div>
                        <span class="text-zinc-500 dark:text-zinc-400">Model</span>
                        <p class="font-medium mt-0.5">{agent.model ?? agent.adapterConfig?.model ?? "—"}</p>
                      </div>
                    {/if}
                    {#if agent.urlKey || agent.slug}
                      <div>
                        <span class="text-zinc-500 dark:text-zinc-400">URL Key</span>
                        <p class="font-mono text-xs mt-0.5">{agent.urlKey ?? agent.slug}</p>
                      </div>
                    {/if}
                    {#if agent.reportsTo}
                      <div>
                        <span class="text-zinc-500 dark:text-zinc-400">Reports to</span>
                        <p class="font-medium mt-0.5">{agent.reportsTo}</p>
                      </div>
                    {/if}
                  </div>
                </CardContent>
              </Card>

              <!-- Chain of Command -->
              {#if agent.chainOfCommand && agent.chainOfCommand.length > 0}
                <Card>
                  <CardHeader>
                    <CardTitle>Chain of Command</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div class="flex items-center gap-2 flex-wrap">
                      {#each agent.chainOfCommand as manager, i}
                        <a href="/{$page.params.companyPrefix}/agents/{manager.id}" class="text-sm text-primary hover:underline">
                          {manager.name}
                        </a>
                        {#if i < agent.chainOfCommand.length - 1}
                          <span class="text-zinc-400">/</span>
                        {/if}
                      {/each}
                    </div>
                  </CardContent>
                </Card>
              {/if}

              <!-- Access Information -->
              {#if agent.access}
                <Card>
                  <CardHeader>
                    <CardTitle>Access & Permissions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div class="text-sm space-y-2">
                      <div class="flex items-center justify-between">
                        <span class="text-zinc-500 dark:text-zinc-400">Can assign tasks</span>
                        <Badge variant={agent.access.canAssignTasks ? "default" : "secondary"}>
                          {agent.access.canAssignTasks ? "Yes" : "No"}
                        </Badge>
                      </div>
                      {#if agent.access.taskAssignSource !== "none"}
                        <div class="flex items-center justify-between">
                          <span class="text-zinc-500 dark:text-zinc-400">Source</span>
                          <span class="text-zinc-700 dark:text-zinc-300 capitalize">{agent.access.taskAssignSource.replace(/_/g, " ")}</span>
                        </div>
                      {/if}
                    </div>
                  </CardContent>
                </Card>
              {/if}
            </div>
          </TabsContent>

          <TabsContent value="runs">
            <div class="mt-4">
              {#if heartbeats.length === 0}
                <EmptyState title="No recent runs" description="This agent hasn't had any heartbeat runs yet." icon="🏃" />
              {:else}
                <div class="border rounded-lg divide-y divide-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                  {#each heartbeats as run}
                    <div class="flex items-center justify-between p-3 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                      <div class="flex items-center gap-3 min-w-0">
                        <StatusBadge status={run.status} />
                        <span class="font-mono text-xs text-zinc-500 truncate">{run.id.slice(0, 8)}</span>
                        {#if run.reason}
                          <span class="text-zinc-600 dark:text-zinc-400 truncate">{run.reason}</span>
                        {/if}
                      </div>
                      <div class="flex items-center gap-3 shrink-0">
                        {#if run.durationMs}
                          <span class="text-xs text-zinc-500">{(run.durationMs / 1000).toFixed(1)}s</span>
                        {/if}
                        <TimeAgo date={run.startedAt} class="text-xs" />
                      </div>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          </TabsContent>

          <TabsContent value="skills">
            <div class="mt-4">
              {#if skills.length === 0}
                <EmptyState title="No skills configured" description="This company has no runtime skills configured yet." icon="🧩" />
              {:else}
                <div class="border rounded-lg divide-y divide-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                  {#each skills as skill}
                    <div class="flex items-center justify-between p-3 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                      <div class="min-w-0">
                        <p class="font-medium truncate">{skill.name ?? skill.key}</p>
                        {#if skill.description}
                          <p class="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5">{skill.description}</p>
                        {/if}
                      </div>
                      <Badge variant="outline" class="text-xs shrink-0">{skill.key}</Badge>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <!-- Sidebar properties -->
      <PropertiesPanel>
        <PropertyRow label="Status">
          <StatusBadge status={agent.status} />
        </PropertyRow>
        <Separator />
        <PropertyRow label="Role">
          <span class="capitalize">{agent.role}</span>
        </PropertyRow>
        <Separator />
        <PropertyRow label="Adapter">
          {adapterLabel(agent.adapterType)}
        </PropertyRow>
        {#if agent.model || agent.adapterConfig?.model}
          <Separator />
          <PropertyRow label="Model">
            {agent.model ?? agent.adapterConfig?.model ?? "—"}
          </PropertyRow>
        {/if}
        <Separator />
        <PropertyRow label="Last heartbeat">
          <TimeAgo date={agent.lastHeartbeatAt} class="text-xs" />
        </PropertyRow>
        <Separator />
        <PropertyRow label="Created">
          <TimeAgo date={agent.createdAt} class="text-xs" />
        </PropertyRow>
        <Separator />
        <PropertyRow label="Updated">
          <TimeAgo date={agent.updatedAt} class="text-xs" />
        </PropertyRow>
        <Separator />
        <PropertyRow label="ID">
          <span class="font-mono text-xs break-all">{agent.id}</span>
        </PropertyRow>
      </PropertiesPanel>
    </div>
  </div>
{/if}
