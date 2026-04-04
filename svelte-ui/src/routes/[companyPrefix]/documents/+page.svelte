<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { breadcrumbStore } from "$stores/breadcrumb.svelte.js";
  import { companyStore, resolveCompanyIdFromPrefix } from "$stores/company.svelte.js";
  import { api } from "$lib/api";
  import { onMount } from "svelte";
  import { BookOpen, Clock3, ExternalLink, FileText, History, PencilLine, Plus, RefreshCcw, Save, Search, Download, Copy, Trash2, Check } from "lucide-svelte";
  import { EmptyState, PageSkeleton } from "$components/index.js";
  import { Card, CardHeader, CardTitle, CardContent, Badge, Button, Alert, AlertTitle, AlertDescription, Skeleton, Separator } from "$components/ui/index.js";

  type DocumentRow = {
    id: string;
    companyId: string;
    issueId?: string | null;
    issueIdentifier?: string | null;
    issueTitle?: string | null;
    title: string | null;
    format: string;
    body?: string;
    latestRevisionId: string | null;
    latestRevisionNumber: number;
    createdByAgentId: string | null;
    createdByUserId: string | null;
    updatedByAgentId: string | null;
    updatedByUserId: string | null;
    createdAt: string;
    updatedAt: string;
  };

  type RevisionRow = {
    id: string;
    companyId: string;
    documentId: string;
    revisionNumber: number;
    body: string;
    changeSummary: string | null;
    createdByAgentId: string | null;
    createdByUserId: string | null;
    createdAt: string;
  };

  onMount(() => breadcrumbStore.set([{ label: "Documents" }]));

  const routeCompanyId = $derived(resolveCompanyIdFromPrefix($page.params.companyPrefix));
  const companyId = $derived(routeCompanyId);
  const prefix = $derived($page.params.companyPrefix);
  const companyName = $derived(companyStore.companies.find((company) => company.id === companyId)?.name ?? "ClawDev");

  let documents = $state<DocumentRow[]>([]);
  let selectedDocumentId = $state<string | null>(null);
  let selectedDocument = $state<DocumentRow | null>(null);
  let selectedRevisionId = $state<string | null>(null);
  let revisions = $state<RevisionRow[]>([]);
  let loading = $state(true);
  let loadingDetail = $state(false);
  let listError = $state<string | null>(null);
  let detailError = $state<string | null>(null);
  const initialRouteQuery = $page.url.searchParams.get("q") ?? "";
  const initialRouteDocumentId = $page.url.searchParams.get("doc") ?? "";
  let query = $state(initialRouteQuery);
  let loadedCompanyId = $state<string | null>(null);
  let lastRouteQuery = initialRouteQuery;
  let lastRouteDocumentId = initialRouteDocumentId;

  let showCreate = $state(false);
  let creating = $state(false);
  let saving = $state(false);
  let deleting = $state(false);
  let showDeleteConfirm = $state(false);

  let createTitle = $state("");
  let createFormat = $state("markdown");
  let createBody = $state("");
  let createSummary = $state("Initial version");

  let editTitle = $state("");
  let editFormat = $state("markdown");
  let editBody = $state("");
  let editSummary = $state("");
  let copiedDocumentId = $state<string | null>(null);
  let copiedTimer: ReturnType<typeof setTimeout> | null = null;

  let filteredDocuments = $derived.by(() => {
    const q = query.trim().toLowerCase();
    if (!q) return documents;
    return documents.filter((doc) => {
      return (
        (doc.title ?? "").toLowerCase().includes(q) ||
        doc.id.toLowerCase().includes(q) ||
        doc.format.toLowerCase().includes(q)
      );
    });
  });

  let selectedRevision = $derived.by(() => revisions.find((revision) => revision.id === selectedRevisionId) ?? revisions[0] ?? null);

  function formatDate(value: string | null | undefined) {
    if (!value) return "—";
    return new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  }

  function normalizeDocument(row: DocumentRow): DocumentRow {
    return {
      ...row,
      title: row.title ?? "Untitled document",
    };
  }

  function downloadDocumentFile(doc: DocumentRow) {
    const body = doc.body ?? "";
    const blob = new Blob([body], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${doc.title ?? "document"}.md`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  async function copyDocumentBody(doc: DocumentRow) {
    try {
      await navigator.clipboard.writeText(doc.body ?? "");
      copiedDocumentId = doc.id;
      if (copiedTimer) clearTimeout(copiedTimer);
      copiedTimer = setTimeout(() => {
        copiedDocumentId = copiedDocumentId === doc.id ? null : copiedDocumentId;
      }, 1400);
    } catch {
      detailError = "Could not copy document";
    }
  }

  async function loadDocumentsForCompany(activeCompanyId: string) {
    loading = true;
    listError = null;
    try {
      const res = await api(`/api/companies/${activeCompanyId}/documents`);
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as DocumentRow[];
      documents = Array.isArray(data) ? data.map(normalizeDocument) : [];
      const routeMatch = lastRouteDocumentId ? documents.find((doc) => doc.id === lastRouteDocumentId) : null;
      if (routeMatch) {
        await selectDocument(routeMatch.id);
      } else if (!selectedDocumentId && documents.length > 0) {
        await selectDocument(documents[0].id);
      } else if (selectedDocumentId && documents.some((doc) => doc.id === selectedDocumentId)) {
        await selectDocument(selectedDocumentId);
      } else if (selectedDocumentId && !documents.some((doc) => doc.id === selectedDocumentId)) {
        const nextId = documents[0]?.id ?? null;
        if (nextId) {
          await selectDocument(nextId);
        } else {
          selectedDocumentId = null;
          selectedDocument = null;
          revisions = [];
          selectedRevisionId = null;
        }
      }
    } catch (error) {
      listError = error instanceof Error ? error.message : String(error);
      documents = [];
    } finally {
      loading = false;
    }
  }

  async function selectDocument(id: string) {
    selectedDocumentId = id;
    detailError = null;
    loadingDetail = true;
    try {
      const res = await api(`/api/documents/${id}`);
      if (!res.ok) throw new Error(await res.text());
      selectedDocument = normalizeDocument((await res.json()) as DocumentRow);

      editTitle = selectedDocument?.title ?? "";
      editFormat = selectedDocument?.format ?? "markdown";
      editBody = selectedDocument?.body ?? "";
      editSummary = "";

      const revisionsRes = await api(`/api/documents/${id}/revisions`);
      if (!revisionsRes.ok) throw new Error(await revisionsRes.text());
      revisions = (await revisionsRes.json()) as RevisionRow[];
      selectedRevisionId = revisions[0]?.id ?? null;
    } catch (error) {
      detailError = error instanceof Error ? error.message : String(error);
      selectedDocument = null;
      revisions = [];
      selectedRevisionId = null;
    } finally {
      loadingDetail = false;
    }
  }

  async function createDocument() {
    if (!companyId || !createBody.trim()) return;
    creating = true;
    try {
      const res = await api(`/api/companies/${companyId}/documents`, {
        method: "POST",
        body: JSON.stringify({
          title: createTitle.trim() || null,
          format: createFormat,
          body: createBody.trim(),
          changeSummary: createSummary.trim() || null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const created = normalizeDocument((await res.json()) as DocumentRow);
      documents = [created, ...documents.filter((doc) => doc.id !== created.id)];
      showCreate = false;
      createTitle = "";
      createFormat = "markdown";
      createBody = "";
      createSummary = "Initial version";
      await selectDocument(created.id);
    } catch (error) {
      detailError = error instanceof Error ? error.message : String(error);
    } finally {
      creating = false;
    }
  }

  async function saveSelectedDocument() {
    if (!selectedDocumentId || !companyId || !selectedDocument) return;
    saving = true;
    try {
      const res = await api(`/api/documents/${selectedDocumentId}`, {
        method: "PUT",
        body: JSON.stringify({
          title: editTitle.trim() || null,
          format: editFormat,
          body: editBody,
          changeSummary: editSummary.trim() || null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const updated = normalizeDocument((await res.json()) as DocumentRow);
      selectedDocument = updated;
      documents = documents.map((doc) => (doc.id === updated.id ? updated : doc));
      editSummary = "";
      await selectDocument(updated.id);
    } catch (error) {
      detailError = error instanceof Error ? error.message : String(error);
    } finally {
      saving = false;
    }
  }

  async function deleteSelectedDocument() {
    if (!selectedDocumentId) return;
    deleting = true;
    try {
      const res = await api(`/api/documents/${selectedDocumentId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(await res.text());
      const removedId = selectedDocumentId;
      documents = documents.filter((doc) => doc.id !== removedId);
      showDeleteConfirm = false;
      copiedDocumentId = copiedDocumentId === removedId ? null : copiedDocumentId;
      const nextId = documents[0]?.id ?? null;
      selectedDocumentId = null;
      selectedDocument = null;
      revisions = [];
      selectedRevisionId = null;
      if (nextId) {
        await selectDocument(nextId);
      }
    } catch (error) {
      detailError = error instanceof Error ? error.message : String(error);
    } finally {
      deleting = false;
    }
  }

  $effect(() => {
    const nextRouteQuery = $page.url.searchParams.get("q") ?? "";
    const nextRouteDocumentId = $page.url.searchParams.get("doc") ?? "";

    if (nextRouteQuery !== lastRouteQuery) {
      lastRouteQuery = nextRouteQuery;
      query = nextRouteQuery;
    }

    if (nextRouteDocumentId !== lastRouteDocumentId) {
      lastRouteDocumentId = nextRouteDocumentId;
      if (documents.length > 0) {
        const match = documents.find((doc) => doc.id === nextRouteDocumentId);
        if (match) void selectDocument(match.id);
      }
    }
  });

  $effect(() => {
    if (!companyId || loadedCompanyId === companyId) return;
    loadedCompanyId = companyId;
    void loadDocumentsForCompany(companyId);
  });

  function openDocumentLibrarySearch() {
    void goto(`/${prefix}/documents?q=${encodeURIComponent(query.trim())}`);
  }
</script>

<div class="space-y-6 p-6">
  <div class="flex flex-wrap items-start justify-between gap-4">
    <div>
      <p class="text-xs uppercase tracking-[0.24em] text-muted-foreground">Company documents</p>
      <h1 class="mt-1 text-3xl font-semibold text-foreground">Documents</h1>
      <p class="mt-2 max-w-2xl text-sm text-muted-foreground">
        Create and revise company documents, planning notes, and issue-linked work products from one place.
      </p>
    </div>
    <div class="flex items-center gap-2">
      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition hover:bg-accent/40"
        onclick={() => {
          if (companyId) void loadDocumentsForCompany(companyId);
        }}
      >
        <RefreshCcw class="h-4 w-4" />
        Refresh
      </button>
      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
        onclick={() => (showCreate = !showCreate)}
      >
        <Plus class="h-4 w-4" />
        New document
      </button>
      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition hover:bg-accent/40"
        onclick={openDocumentLibrarySearch}
      >
        <Search class="h-4 w-4" />
        Search in library
      </button>
    </div>
  </div>

  <div class="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
    <aside class="space-y-4">
      <Card>
        <CardContent class="pt-4">
          <label for="document-search" class="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
            <Search class="h-3.5 w-3.5" />
            Search
          </label>
        <input
          id="document-search"
          bind:value={query}
          placeholder={`Search ${companyName} documents`}
          class="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        </CardContent>
      </Card>

      {#if showCreate}
        <form
          class="rounded-2xl border border-border bg-card p-4"
          onsubmit={(event) => {
            event.preventDefault();
            void createDocument();
          }}
        >
          <div class="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
            <PencilLine class="h-4 w-4 text-blue-500" />
            Create document
          </div>
          <div class="space-y-3">
            <div>
              <label for="create-title" class="mb-1 block text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Title</label>
              <input
                id="create-title"
                bind:value={createTitle}
                placeholder="Architecture Notes"
                class="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label for="create-format" class="mb-1 block text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Format</label>
              <select
                id="create-format"
                bind:value={createFormat}
                class="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="markdown">Markdown</option>
                <option value="plain_text">Plain text</option>
                <option value="json">JSON</option>
              </select>
            </div>
            <div>
              <label for="create-body" class="mb-1 block text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Body</label>
              <textarea
                id="create-body"
                bind:value={createBody}
                rows="7"
                placeholder="Write the first revision..."
                class="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              ></textarea>
            </div>
            <div>
              <label for="create-summary" class="mb-1 block text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Change summary</label>
              <input
                id="create-summary"
                bind:value={createSummary}
                placeholder="Initial draft"
                class="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div class="flex items-center gap-2">
              <button
                type="submit"
                disabled={creating || !createBody.trim()}
                class="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save class="h-4 w-4" />
                {creating ? "Creating..." : "Create"}
              </button>
              <button
                type="button"
                class="rounded-xl border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-accent/40"
                onclick={() => (showCreate = false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      {/if}

      <Card>
        <CardHeader class="flex-row items-center justify-between">
          <div>
            <CardTitle class="text-sm">Documents</CardTitle>
            <p class="text-xs text-muted-foreground">{documents.length} total</p>
          </div>
          <Badge variant="outline">
            <BookOpen class="h-3.5 w-3.5" />
            {prefix || "company"}
          </Badge>
        </CardHeader>
        <CardContent>

        {#if loading}
          <div class="space-y-3">
            {#each Array(5) as _}
              <Skeleton class="h-16 rounded-xl" />
            {/each}
          </div>
        {:else if listError}
          <EmptyState title="Documents failed to load" description={listError} icon="⚠️" />
        {:else if filteredDocuments.length === 0}
          <EmptyState title="No documents" description="Create a company document or attach one from an issue." icon="📄">
            <button
              type="button"
              class="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
              onclick={() => (showCreate = true)}
            >
              <Plus class="h-4 w-4" />
              New document
            </button>
          </EmptyState>
        {:else}
          <div class="space-y-2">
            {#each filteredDocuments as doc (doc.id)}
              <button
                type="button"
                class={`w-full rounded-xl border p-3 text-left transition ${
                  doc.id === selectedDocumentId
                    ? "border-blue-500/60 bg-blue-500/10"
                    : "border-border bg-background hover:bg-accent/40"
                }`}
                onclick={() => void selectDocument(doc.id)}
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <h3 class="truncate text-sm font-medium text-foreground">
                      {doc.title ?? "Untitled document"}
                    </h3>
                    <p class="mt-1 text-xs text-muted-foreground">
                      {doc.format} · rev {doc.latestRevisionNumber} · updated {formatDate(doc.updatedAt)}
                    </p>
                    {#if doc.issueId}
                      <div class="mt-2 flex items-center gap-2">
                        <span class="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                          Linked issue
                        </span>
                        <a
                          href={`/${prefix}/issues/${doc.issueId}`}
                          class="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
                        >
                          {doc.issueIdentifier ?? "Open issue"}
                          <ExternalLink class="h-3 w-3" />
                        </a>
                      </div>
                    {/if}
                  </div>
                  <Badge variant="outline" class="text-[10px] uppercase tracking-[0.2em]">
                    {doc.format}
                  </Badge>
                </div>
              </button>
            {/each}
          </div>
        {/if}
        </CardContent>
      </Card>
    </aside>

    <main class="space-y-6">
      {#if loadingDetail}
        <PageSkeleton lines={7} />
      {:else if detailError}
        <EmptyState title="Document failed to load" description={detailError} icon="⚠️" />
      {:else if selectedDocument}
        <Card>
          <CardContent class="pt-5">
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div class="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-muted-foreground">
                  <FileText class="h-3.5 w-3.5" />
                  Document detail
                </div>
              <h2 class="mt-2 text-2xl font-semibold text-foreground">
                {selectedDocument.title ?? "Untitled document"}
              </h2>
              <p class="mt-2 text-sm text-muted-foreground">
                Rev {selectedDocument.latestRevisionNumber} · Updated {formatDate(selectedDocument.updatedAt)} · {selectedDocument.format}
              </p>
              {#if selectedDocument.issueId}
                  <div class="mt-3 flex items-center gap-2">
                    <span class="rounded-full border border-border px-2 py-1 text-xs font-medium text-muted-foreground">
                      Linked to issue
                    </span>
                    <a
                      href={`/${prefix}/issues/${selectedDocument.issueId}`}
                      class="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 transition hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300"
                    >
                      {selectedDocument.issueIdentifier ?? "Open issue"}
                      <ExternalLink class="h-3 w-3" />
                    </a>
                  </div>
                  {#if selectedDocument.issueTitle}
                    <p class="mt-2 text-xs text-muted-foreground">
                      {selectedDocument.issueTitle}
                    </p>
                  {/if}
                {/if}
            </div>
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-accent/40"
                onclick={() => {
                  if (selectedDocumentId) void selectDocument(selectedDocumentId);
                }}
              >
                <RefreshCcw class="h-4 w-4" />
                Reload
              </button>
              <button
                type="button"
                class="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
                onclick={() => (showCreate = true)}
              >
                <Plus class="h-4 w-4" />
                New document
              </button>
              <button
                type="button"
                class="inline-flex items-center gap-2 rounded-xl border border-red-300 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/30"
                disabled={!selectedDocumentId}
                onclick={() => (showDeleteConfirm = true)}
              >
                <Trash2 class="h-4 w-4" />
                Delete
              </button>
            </div>
          </div>

          <div class="mt-5 grid gap-4 md:grid-cols-3">
            <label class="space-y-2">
              <span class="block text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Title</span>
              <input
                bind:value={editTitle}
                class="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </label>
            <label class="space-y-2">
              <span class="block text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Format</span>
              <select
                bind:value={editFormat}
                class="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="markdown">Markdown</option>
                <option value="plain_text">Plain text</option>
                <option value="json">JSON</option>
              </select>
            </label>
            <label class="space-y-2">
              <span class="block text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Change summary</span>
              <input
                bind:value={editSummary}
                placeholder="Describe this revision"
                class="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </label>
          </div>

          <div class="mt-4">
            <label for="doc-body" class="mb-2 block text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Body</label>
            <textarea
              id="doc-body"
              bind:value={editBody}
              rows="14"
              class="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm leading-6 text-foreground focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            ></textarea>
          </div>

          <div class="mt-4 flex items-center gap-2">
            <button
              type="button"
              disabled={saving || !editBody.trim()}
              class="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              onclick={() => void saveSelectedDocument()}
            >
              <Save class="h-4 w-4" />
              {saving ? "Saving..." : "Save revision"}
            </button>
            <p class="text-xs text-muted-foreground">
              Every save creates a new revision.
            </p>
          </div>

          {#if showDeleteConfirm}
            <div class="mt-4 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900 dark:bg-red-950/20">
              <p class="text-sm font-medium text-red-700 dark:text-red-300">
                Delete this document? This will remove all revisions and issue links.
              </p>
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  class="rounded-xl border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-accent/40"
                  onclick={() => (showDeleteConfirm = false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  class="inline-flex items-center gap-2 rounded-xl bg-red-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                  onclick={() => void deleteSelectedDocument()}
                >
                  {deleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          {/if}
          </CardContent>
        </Card>

        <div class="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader>
              <CardTitle class="text-sm flex items-center gap-2">
                <History class="h-4 w-4 text-blue-500" />
                Revisions
              </CardTitle>
            </CardHeader>
            <CardContent>
            {#if revisions.length === 0}
              <EmptyState title="No revisions" description="This document has not been revised yet." icon="📝" />
            {:else}
              <div class="space-y-2">
                {#each revisions as revision (revision.id)}
                  <button
                    type="button"
                    class={`w-full rounded-xl border p-3 text-left transition ${
                      revision.id === selectedRevisionId
                        ? "border-blue-500/60 bg-blue-500/10"
                        : "border-border bg-background hover:bg-accent/40"
                    }`}
                    onclick={() => (selectedRevisionId = revision.id)}
                  >
                    <div class="flex items-start justify-between gap-4">
                      <div>
                        <p class="text-sm font-medium text-foreground">Revision {revision.revisionNumber}</p>
                        <p class="mt-1 text-xs text-muted-foreground">
                          {revision.changeSummary ?? "No summary"} · {formatDate(revision.createdAt)}
                        </p>
                      </div>
                      <Badge variant="outline" class="text-[10px] uppercase tracking-[0.2em]">
                        {revision.id.slice(0, 8)}
                      </Badge>
                    </div>
                  </button>
                {/each}
              </div>
            {/if}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle class="text-sm flex items-center gap-2">
                <Clock3 class="h-4 w-4 text-blue-500" />
                Revision preview
              </CardTitle>
            </CardHeader>
            <CardContent>
            {#if selectedRevision}
              <div class="space-y-3">
                <div class="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Revision {selectedRevision.revisionNumber}</span>
                  <span>{formatDate(selectedRevision.createdAt)}</span>
                </div>
                {#if selectedDocument.issueId}
                  <div class="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Issue attachment context:</span>
                    <a href={`/${prefix}/issues/${selectedDocument.issueId}`} class="font-medium text-blue-600 hover:text-blue-700">
                      {selectedDocument.issueId}
                    </a>
                  </div>
                {/if}
                <div class="rounded-xl border border-border bg-background p-4">
                  <pre class="whitespace-pre-wrap text-sm leading-6 text-foreground">{selectedRevision.body}</pre>
                </div>
                <p class="text-sm text-muted-foreground">
                  {selectedRevision.changeSummary ?? "No summary provided."}
                </p>
                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    class="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-accent/40"
                    onclick={() => void copyDocumentBody({ ...selectedDocument, body: selectedRevision.body } as DocumentRow)}
                  >
                    {#if copiedDocumentId === selectedDocument?.id}
                      <Check class="h-4 w-4" />
                    {:else}
                      <Copy class="h-4 w-4" />
                    {/if}
                    Copy body
                  </button>
                  <button
                    type="button"
                    class="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-accent/40"
                    onclick={() => downloadDocumentFile({ ...selectedDocument, body: selectedRevision.body } as DocumentRow)}
                  >
                    <Download class="h-4 w-4" />
                    Download body
                  </button>
                </div>
              </div>
            {:else}
              <EmptyState title="Select a revision" description="Pick a revision on the left to inspect the full body." icon="📄" />
            {/if}
            </CardContent>
          </Card>
        </div>
      {:else}
        <EmptyState title="No document selected" description="Choose a document from the list or create a new one." icon="📄">
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
            onclick={() => (showCreate = true)}
          >
            <Plus class="h-4 w-4" />
            New document
          </button>
        </EmptyState>
      {/if}
    </main>
  </div>
</div>
