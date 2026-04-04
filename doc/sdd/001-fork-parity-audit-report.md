# SDD-001: Fork Parity Audit Report

**Data:** 2026-04-04
**Paperclip:** /tmp/paperclip (porta 3200) — React 19 + Express 5
**ClawDev:** /Users/juliocezaraquinofeitosa/Development/clawdev (porta 3100) — SvelteKit + Elysia.js (Bun)

---

## Resultado do Onboarding Side-by-Side

Ambos completaram o onboarding com sucesso (4 steps). Dados idênticos: "Test Corp", "Agent-01", "Claude Local", "First task".

### Diferenças por Step

| Step | Aspecto | Paperclip | ClawDev |
|------|---------|-----------|---------|
| 1 Company | Layout | Simples | + ícones nos tabs, overlay "Welcome to ClawDev" com camera effect |
| 2 Agent | Adapter display | 2 recomendados + "More" botão | Todos 7 visíveis de uma vez |
| 2 Agent | Campo Model | Sim (dropdown "Default") | Ausente |
| 2 Agent | Adapter probe | Sim ("Test now" button) | Ausente |
| 2 Agent | Campo Role | Ausente | Sim (fixo "CEO") |
| 3 Task | Titulo | "Give it something to do" | "Create your first task" |
| 3 Task | Pre-fill | Sim (CEO hiring plan) | Nao |
| 3 Task | Skip button | Nao | Sim |
| 4 Launch | Resumo | Company + Agent + Adapter + Task | Company + Agent (sem task/adapter) |
| 4 Launch | Botao | "Create & Open Issue" | "Go to Dashboard" |
| 4 Launch | Destino | Issue detail page (Live run) | Dashboard |

---

## Bugs Encontrados no ClawDev (corrigidos neste audit)

### BUG-001: Run card no dashboard nao mostra issue linkada
- **Onde:** `/api/companies/:id/live-runs` e `/api/companies/:id/heartbeat-runs`
- **Esperado (Paperclip):** Card mostra "TES-1 - First task" com link
- **Atual (ClawDev antes do fix):** Card mostra apenas nome do agente e STDOUT, sem issue
- **Causa:** API nao fazia JOIN com tabela `issues` — campos `issueIdentifier` e `issueTitle` nao existiam na resposta
- **Fix aplicado:** LEFT JOIN com `issues` usando cast `::uuid` em `agents.ts` (rota) e `heartbeat.ts` (service)
- **Status:** CORRIGIDO

---

## Melhorias do ClawDev (ja implementadas)

### IMP-001: 5 schemas extras para model management
- `company_model_preferences` — routing config per company
- `model_catalog` — registry de modelos com pricing
- `provider_model_status` — health monitoring
- `model_routing_log` — audit log de decisoes
- `embeddings` — vector storage (pgvector 1536-dim)

### IMP-002: +7 rotas de API novas
- `budgets.ts` — gestao de budget dedicada
- `comments.ts` — gerenciamento standalone de comentarios
- `inbox.ts` — funcionalidade de inbox
- `models.ts` — model discovery, routing, providers
- `runs.ts` — gestao consolidada de runs
- `search.ts` — busca semantica/vetorial
- `access-utils.ts` — utilidades de acesso

### IMP-003: +11 services novos
- BullMQ job scheduler (Redis-based)
- Embedding service (vector search)
- Model router (intelligent model selection)
- Provider status (health monitoring)
- Cost aggregates (finance analytics)
- Redis service, Runtime config, System report, etc.

### IMP-004: +16 paginas de UI novas
- Runs list, Run detail, Budgets, Documents, Labels
- Secrets, Workspaces, Providers, Design Guide
- Company create page separada

### IMP-005: Sidebar melhorada
- Collapsible com 6 secoes (Paperclip: 4 fixas)
- Persistencia via localStorage
- Secao "MORE" para features menos usadas
- Theme toggle e versao no footer

### IMP-006: API endpoints enriquecidos
- `access.ts`: +16 endpoints (admin users, CLI auth, invites, join requests)
- `agents.ts`: +6 endpoints (heartbeat-runs, heartbeat-settings, skills sync, adapter test)
- `costs.ts`: +12 endpoints (by-agent-model, by-provider, daily, finance-*)
- `approvals.ts`: +1 endpoint (request-revision)
- `company-skills.ts`: +3 endpoints (files, install-update, scan-projects)

### IMP-007: Referential integrity no agents.reportsTo
- `onDelete: "set null"` adicionado (Paperclip nao tem cascade behavior)

---

## Regressoes / Funcionalidades Faltantes no ClawDev

### REG-001: Adapter probe ausente no onboarding
- Paperclip: botao "Test now" que verifica se o CLI do adapter responde
- ClawDev: nao existe — usuario nao sabe se adapter funciona antes de criar

### REG-002: Model selector ausente no onboarding
- Paperclip: dropdown de modelo (Default, etc.)
- ClawDev: usa sempre default sem opcao de escolher

### REG-003: Launch step nao mostra task no resumo
- Paperclip: mostra Company + Agent + Adapter + Task
- ClawDev: mostra apenas Company + Agent

### REG-004: Launch redireciona para dashboard ao inves de issue
- Paperclip: "Create & Open Issue" → abre a issue com live run
- ClawDev: "Go to Dashboard" → dashboard generico

### REG-005: Paginas de workspace ausentes
- ExecutionWorkspaceDetail e ProjectWorkspaceDetail existem no Paperclip mas nao no ClawDev

### REG-006: Adapter UI simplificada
- Paperclip: adapter registry modular com config-fields.tsx per adapter (10 tipos)
- ClawDev: mapeamento simples de labels em constants (8 tipos), sem UI per-adapter

---

## Diff de Schemas

| Tabela | Paperclip | ClawDev | Diferenca |
|--------|-----------|---------|-----------|
| company_model_preferences | - | Sim | Nova no ClawDev |
| model_catalog | - | Sim | Nova no ClawDev |
| provider_model_status | - | Sim | Nova no ClawDev |
| model_routing_log | - | Sim | Nova no ClawDev |
| embeddings | - | Sim | Nova no ClawDev |
| agents.reportsTo | sem cascade | onDelete: "set null" | ClawDev mais seguro |
| Demais 59 tabelas | Identicas | Identicas | Paridade total |

**Migrations:** Paperclip 86 (ate 0045), ClawDev 88 (ate 0046)

---

## Diff de Rotas

| Endpoint | Paperclip | ClawDev | Notas |
|----------|-----------|---------|-------|
| authz.ts | Sim | - | Paperclip only |
| budgets.ts | - | Sim | ClawDev only |
| comments.ts | - | Sim | ClawDev only |
| inbox.ts | - | Sim | ClawDev only |
| models.ts | - | Sim | ClawDev only |
| runs.ts | - | Sim | ClawDev only |
| search.ts | - | Sim | ClawDev only |
| **Total** | **25** | **32** | **+7 no ClawDev** |

---

## Diff de UI Pages

| Page | Paperclip | ClawDev | Notas |
|------|-----------|---------|-------|
| ExecutionWorkspaceDetail | Sim | - | Missing |
| ProjectWorkspaceDetail | Sim | - | Missing |
| Runs list | - | Sim | Nova |
| Run detail | - | Sim | Nova |
| Budgets | - | Sim | Nova |
| Providers | - | Sim | Nova |
| Documents | - | Sim | Nova |
| Labels | - | Sim | Nova |
| Design Guide | - | Sim | Nova |
| **Total pages** | **41** | **54** | **+13 no ClawDev** |

---

## Proximos Passos

### Prioridade Alta (bugs de paridade)
1. [x] ~~Fix run card: issue linkada no dashboard~~ (DONE)
2. [ ] Adicionar adapter probe ("Test now") no onboarding step 2
3. [ ] Adicionar model selector no onboarding step 2
4. [ ] Launch step: mostrar task e adapter no resumo + redirecionar para issue

### Prioridade Media (regressoes)
5. [ ] Implementar ExecutionWorkspaceDetail e ProjectWorkspaceDetail
6. [ ] Adapter config UI per-adapter (config-fields per adapter type)

### Prioridade Baixa (polish)
7. [ ] Pre-fill task data no onboarding step 3 (CEO hiring plan)
8. [ ] Remover overlay "Welcome to ClawDev" com camera effect (nao existe no Paperclip)
