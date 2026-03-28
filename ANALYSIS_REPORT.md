# Paperclip (ClawDev) — Análise Completa de Funcionalidades

> Relatório gerado em 2026-03-28 por análise automatizada de 5 agentes paralelos.
> Objetivo: documentar TODAS as funcionalidades para replicação.

---

## 1. VISÃO GERAL

**ClawDev** é uma plataforma open-source de orquestração para construir empresas de IA com zero humanos. Orquestra times de agentes de IA, gerencia metas de negócio, rastreia trabalho e custos de um dashboard unificado.

| Atributo | Valor |
|----------|-------|
| Stack Backend | TypeScript, Elysia (Bun), Drizzle ORM, PostgreSQL |
| Stack Frontend | SvelteKit 5, Tailwind CSS, Lucide Icons, ECharts |
| Monorepo | pnpm workspaces |
| Versão | 0.2.7 |
| Total de Páginas | 39 páginas SvelteKit |
| Total de Endpoints API | 200+ |
| Total de Tabelas DB | 60+ |
| Adapters de Agentes | 7 (Claude, Codex, Cursor, Gemini, Pi, OpenCode, OpenClaw) |

---

## 2. ARQUITETURA DO BANCO DE DADOS (60+ Tabelas)

### 2.1 Organizacional
| Tabela | Descrição |
|--------|-----------|
| `companies` | Empresas (name, status, budgetMonthlyCents, issuePrefix, brandColor) |
| `agents` | Agentes IA (name, role, title, icon, status, reportsTo, adapterType, adapterConfig, budgetMonthlyCents) |
| `company_memberships` | Acesso de usuários a empresas |
| `company_logos` | Logos das empresas |
| `company_skills` | Skills registradas por empresa |
| `company_secrets` | Segredos/credenciais (provider-based: local_encrypted, vault) |
| `company_secret_versions` | Versionamento de segredos |

### 2.2 Autenticação & Autorização
| Tabela | Descrição |
|--------|-----------|
| `auth` (user, session, account, verification) | Auth multi-provider |
| `board_api_keys` | Tokens de acesso board |
| `agent_api_keys` | API keys por agente (hash at rest) |
| `cli_auth_challenges` | Auth do CLI por device |
| `principal_permission_grants` | Permissões granulares |
| `instance_user_roles` | Roles de instância |
| `invites` | Convites por token |
| `join_requests` | Fluxo de solicitação de acesso |

### 2.3 Gestão de Trabalho
| Tabela | Descrição |
|--------|-----------|
| `issues` | Tarefas (status: backlog→todo→in_progress→in_review→blocked→completed, priority, assigneeAgentId) |
| `goals` | Metas hierárquicas (level: task/quarter/annual, status, parentId) |
| `projects` | Projetos (leadAgentId, targetDate) |
| `project_goals` | Ligação projetos↔metas |
| `issue_labels` / `labels` | Tags de tarefas |
| `issue_approvals` | Aprovações em tarefas |
| `issue_inbox_archives` | Inbox arquivado |
| `issue_read_states` | Status de leitura por user |
| `issue_documents` | Documentos por tarefa |
| `issue_attachments` | Anexos |
| `issue_comments` | Comentários threaded |
| `issue_work_products` | Entregas (PR, documento, relatório) |

### 2.4 Documentos & Assets
| Tabela | Descrição |
|--------|-----------|
| `documents` | Documentos (format: markdown/html/plaintext) |
| `document_revisions` | Histórico de revisões |
| `assets` | Armazenamento de arquivos |

### 2.5 Agentes & Execução
| Tabela | Descrição |
|--------|-----------|
| `agent_config_revisions` | Histórico de config de agentes |
| `agent_runtime_state` | Estado de sessão persistente |
| `agent_task_sessions` | Sessões agente↔tarefa |
| `agent_wakeup_requests` | Agendamento de despertar |
| `heartbeat_runs` | Logs de execução (source, status, usage, result, exitCode, stdout, stderr) |
| `heartbeat_run_events` | Stream de eventos de heartbeat |

### 2.6 Workspaces de Execução
| Tabela | Descrição |
|--------|-----------|
| `project_workspaces` | Repos Git/destinos de código |
| `execution_workspaces` | Ambientes isolados (git_worktree/docker, local_fs/aws_ec2) |
| `workspace_runtime_services` | Serviços runtime (postgres, redis) |
| `workspace_operations` | Histórico de operações |

### 2.7 Rotinas (Scheduled Tasks)
| Tabela | Descrição |
|--------|-----------|
| `routines` | Tarefas recorrentes (concurrencyPolicy, catchUpPolicy) |
| `routine_triggers` | Triggers cron/webhook |
| `routine_runs` | Histórico de execuções |

### 2.8 Custos & Orçamentos
| Tabela | Descrição |
|--------|-----------|
| `budget_policies` | Políticas de custo (scope: agent/project/company, window: monthly/annual) |
| `budget_incidents` | Alertas (pending/resolved) |
| `cost_events` | Eventos de billing (provider, model, tokens, costCents) |
| `finance_events` | Revenue/expense tracking |

### 2.9 Plugins
| Tabela | Descrição |
|--------|-----------|
| `plugins` | Plugins instalados (key, version, manifest, status) |
| `plugin_config` | Configuração por escopo |
| `plugin_company_settings` | Settings por empresa |
| `plugin_state` | Estado persistente key-value |
| `plugin_entities` | Entidades customizadas |
| `plugin_jobs` | Jobs agendados |
| `plugin_job_runs` | Histórico de execução de jobs |
| `plugin_webhooks` | Entregas de webhook |
| `plugin_logs` | Logs de debug |

### 2.10 Auditoria & Aprovações
| Tabela | Descrição |
|--------|-----------|
| `activity_log` | Trilha de auditoria imutável |
| `approvals` | Fluxos de aprovação (hire_agent, fire_agent, update_goal, other) |
| `approval_comments` | Discussão em aprovações |
| `instance_settings` | Configuração global |

---

## 3. API DO SERVIDOR (200+ Endpoints)

### 3.1 Health & Sistema
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/health` | Status do servidor, modo de deploy, feature flags |

### 3.2 Empresas (Companies)
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/companies` | Listar empresas |
| GET | `/api/companies/stats` | Estatísticas |
| GET | `/api/companies/:companyId` | Detalhes da empresa |
| POST | `/api/companies` | Criar empresa |
| PATCH | `/api/companies/:companyId` | Atualizar empresa |
| DELETE | `/api/companies/:companyId` | Deletar empresa |
| POST | `/api/companies/:companyId/archive` | Arquivar |
| PATCH | `/api/companies/:companyId/branding` | Branding (logo, cores) |
| POST | `/api/companies/:companyId/export` | Exportar dados |
| POST | `/api/companies/import/preview` | Preview de importação |
| POST | `/api/companies/import` | Importar dados |
| POST | `/api/companies/:companyId/exports` | Export (agent-initiated) |
| POST | `/api/companies/:companyId/imports/preview` | Preview import (agent) |
| POST | `/api/companies/:companyId/imports/apply` | Apply import (agent) |

### 3.3 Agentes (50+ endpoints)
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/companies/:companyId/agents` | Listar agentes |
| GET | `/api/agents/:id` | Detalhes do agente |
| POST | `/api/companies/:companyId/agent-hires` | Contratar agente |
| PATCH | `/api/agents/:id` | Atualizar agente |
| POST | `/api/agents/:id/keys` | Criar API key |
| DELETE | `/api/agents/:id/keys/:keyId` | Revogar API key |
| GET | `/api/agents/:id/skills` | Skills do agente |
| POST | `/api/agents/:id/skills/sync` | Sincronizar skills |
| POST | `/api/agents/:id/instructions/refresh` | Atualizar instruções |
| PATCH | `/api/agents/:id/permissions` | Atualizar permissões |
| POST | `/api/agents/:id/wake` | Despertar agente |
| POST | `/api/agents/:id/reset-session` | Resetar sessão |
| GET | `/api/agents/:id/org-chart` | Org chart SVG |
| GET | `/api/agents/:id/chain-of-command` | Cadeia de comando |
| PATCH | `/api/agents/:id/reportsTo` | Alterar gerente |

### 3.4 Issues (Tarefas)
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/companies/:companyId/issues` | Listar (filtros: status, assignee, project, goal, label, q) |
| GET | `/api/issues/:id` | Detalhes (ancestors, goals, workspaces, workProducts) |
| POST | `/api/companies/:companyId/issues` | Criar issue |
| PATCH | `/api/issues/:id` | Atualizar |
| DELETE | `/api/issues/:id` | Deletar |
| POST | `/api/issues/:id/checkout` | Check-out (lock) |
| POST | `/api/issues/:id/checkin` | Check-in (unlock) |
| GET | `/api/issues/:id/comments` | Listar comentários |
| POST | `/api/issues/:id/comments` | Adicionar comentário |
| PATCH | `/api/comments/:id` | Editar comentário |
| DELETE | `/api/comments/:id` | Deletar comentário |
| GET | `/api/issues/:id/documents` | Listar documentos |
| GET | `/api/issues/:id/documents/:key` | Documento por key |
| PUT | `/api/issues/:id/documents/:key` | Upsert documento |
| GET | `/api/issues/:id/work-products` | Work products |
| POST | `/api/issues/:id/work-products` | Criar work product |
| GET | `/api/companies/:companyId/labels` | Labels |
| POST | `/api/companies/:companyId/labels` | Criar label |

### 3.5 Aprovações
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/companies/:companyId/approvals` | Listar |
| GET | `/api/approvals/:id` | Detalhes |
| POST | `/api/companies/:companyId/approvals` | Criar |
| POST | `/api/approvals/:id/approve` | Aprovar |
| POST | `/api/approvals/:id/reject` | Rejeitar |
| POST | `/api/approvals/:id/request-revision` | Pedir revisão |
| POST | `/api/approvals/:id/resubmit` | Resubmeter |
| GET | `/api/approvals/:id/comments` | Comentários |
| POST | `/api/approvals/:id/comments` | Adicionar comentário |

### 3.6 Projetos
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/companies/:companyId/projects` | Listar |
| GET | `/api/projects/:id` | Detalhes |
| POST | `/api/companies/:companyId/projects` | Criar |
| PATCH | `/api/projects/:id` | Atualizar |
| DELETE | `/api/projects/:id` | Deletar |
| GET | `/api/projects/:id/workspaces` | Workspaces do projeto |
| POST | `/api/projects/:id/workspaces` | Criar workspace |

### 3.7 Metas (Goals)
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/companies/:companyId/goals` | Listar |
| GET | `/api/goals/:id` | Detalhes |
| POST | `/api/companies/:companyId/goals` | Criar |
| PATCH | `/api/goals/:id` | Atualizar |
| DELETE | `/api/goals/:id` | Deletar |

### 3.8 Rotinas
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/companies/:companyId/routines` | Listar |
| GET | `/api/routines/:id` | Detalhes com triggers e runs |
| POST | `/api/companies/:companyId/routines` | Criar |
| PATCH | `/api/routines/:id` | Atualizar |
| DELETE | `/api/routines/:id` | Deletar |
| POST | `/api/routines/:id/triggers` | Criar trigger (cron/webhook) |
| POST | `/api/routines/:id/run` | Executar manualmente |
| POST | `/api/routine-triggers/public/:publicId/fire` | Webhook público |

### 3.9 Custos & Orçamentos
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/companies/:companyId/cost-events` | Reportar custo |
| GET | `/api/companies/:companyId/costs/summary` | Resumo de custos |
| GET | `/api/companies/:companyId/costs/by-agent` | Custos por agente |
| GET | `/api/companies/:companyId/costs/by-provider` | Custos por provider |
| GET | `/api/companies/:companyId/costs/by-project` | Custos por projeto |
| GET | `/api/companies/:companyId/budgets/overview` | Visão geral do orçamento |
| POST | `/api/companies/:companyId/budgets/policies` | Criar política de orçamento |
| PATCH | `/api/companies/:companyId/budgets` | Atualizar orçamento mensal |

### 3.10 Dashboard & Sidebar
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/companies/:companyId/dashboard` | Resumo do dashboard |
| GET | `/api/companies/:companyId/sidebar-badges` | Contadores do sidebar |

### 3.11 Activity (Auditoria)
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/companies/:companyId/activity` | Feed de atividades |
| POST | `/api/companies/:companyId/activity` | Criar evento |
| GET | `/api/issues/:id/activity` | Atividade por issue |

### 3.12 Plugins
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/plugins` | Listar plugins |
| POST | `/api/plugins/install` | Instalar plugin |
| GET | `/api/plugins/:pluginId/logs` | Logs do plugin |
| POST | `/api/plugins/:pluginId/uninstall` | Desinstalar |
| POST | `/api/plugins/:pluginId/bridge/data` | Data do plugin |
| POST | `/api/plugins/:pluginId/bridge/action` | Action do plugin |
| GET | `/_plugins/:pluginId/ui/*` | Assets estáticos do plugin |

### 3.13 Skills
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/companies/:companyId/skills` | Listar skills |
| POST | `/api/companies/:companyId/skills` | Criar skill |
| POST | `/api/companies/:companyId/skills/import` | Importar skills |
| DELETE | `/api/companies/:companyId/skills/:skillId` | Deletar skill |

### 3.14 Secrets
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/companies/:companyId/secrets` | Listar segredos |
| POST | `/api/companies/:companyId/secrets` | Criar segredo |
| POST | `/api/secrets/:id/rotate` | Rotacionar |
| DELETE | `/api/secrets/:id` | Deletar |

### 3.15 Acesso & Auth
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/auth/cli-challenge` | Challenge CLI |
| POST | `/api/companies/:companyId/invites` | Criar convite |
| POST | `/api/invites/:token/accept` | Aceitar convite |
| GET | `/api/companies/:companyId/members` | Listar membros |

### 3.16 Instance Settings
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/instance/settings/general` | Settings gerais |
| PATCH | `/api/instance/settings/general` | Atualizar gerais |
| GET | `/api/instance/settings/experimental` | Features experimentais |
| PATCH | `/api/instance/settings/experimental` | Atualizar experimentais |

### 3.17 WebSocket (Real-time)
| Endpoint | Descrição |
|----------|-----------|
| `WS /api/companies/:companyId/events/ws` | Eventos ao vivo (activity, agent, issue, approval, cost) |

---

## 4. FRONTEND — TODAS AS 39 PÁGINAS

### 4.1 Páginas Públicas/Auth

| # | Rota | Funcionalidade |
|---|------|----------------|
| 1 | `/` | Redirect → primeiro company dashboard ou /companies |
| 2 | `/auth` | Login/Signup com painel hero ClawDev + formulário email/password |
| 3 | `/claim` | Claim de board access via token |
| 4 | `/cli-auth` | Aprovar/negar autenticação CLI |
| 5 | `/companies` | Lista de empresas + criar nova empresa |
| 6 | `/invite` | Aceitar convite de empresa |
| 7 | `/settings` | Redirect → /settings/general |
| 8 | `/settings/general` | Nome da instância, URL pública |
| 9 | `/settings/experimental` | Toggles: Git Worktrees, Plugin System, Routines, Budget, Approvals, Auto-restart |

### 4.2 Páginas Scoped por Company `/{prefix}/...`

| # | Rota | Funcionalidade |
|---|------|----------------|
| 10 | `/{prefix}` | Redirect → dashboard |
| 11 | `/{prefix}/dashboard` | 4 metric cards + Active Agents + Recent Activity + Recent Issues |
| 12 | `/{prefix}/activity` | Feed de atividades com filtros por tipo |
| 13 | `/{prefix}/inbox` | Notificações (tabs: Mine, Recent, All) com status de leitura |
| 14 | `/{prefix}/costs` | 3 cards sumário + tabela breakdown por agente/provider |
| 15 | `/{prefix}/settings` | Nome da empresa + ID + zona de perigo (deletar) |
| 16 | `/{prefix}/agents` | Lista de agentes com filtros (status, search) + status pills |
| 17 | `/{prefix}/agents/new` | Formulário criar agente (name, role, adapter, model, system prompt) |
| 18 | `/{prefix}/agents/{id}` | Detalhe: tabs Overview/Runs/Skills + properties sidebar |
| 19 | `/{prefix}/approvals` | Lista com tabs Pending/All + botões Approve/Reject inline |
| 20 | `/{prefix}/approvals/{id}` | Detalhe: decision panel + tabs Payload/Issues/Comments |
| 21 | `/{prefix}/issues` | Lista com filtros Status/Priority/Search + debounce 300ms |
| 22 | `/{prefix}/issues/mine` | Issues atribuídas ao usuário atual |
| 23 | `/{prefix}/issues/{id}` | Detalhe: tabs Details/Comments/WorkProducts/Documents + sidebar |
| 24 | `/{prefix}/projects` | Grid de cards + criar projeto |
| 25 | `/{prefix}/projects/{id}` | Detalhe: tabs Issues/Goals/Workspaces + status summary |
| 26 | `/{prefix}/goals` | Lista com progress bars + criar meta |
| 27 | `/{prefix}/goals/{id}` | Detalhe: tabs Overview/Children/Issues + hierarquia |
| 28 | `/{prefix}/plugins` | Grid de cards com hover effect |
| 29 | `/{prefix}/plugins/{id}` | Detalhe + enable/disable toggle |
| 30 | `/{prefix}/plugins/{id}/settings` | Config JSON |
| 31 | `/{prefix}/routines` | Stub (migração em progresso) |
| 32 | `/{prefix}/routines/{id}` | Detalhe de rotina |
| 33 | `/{prefix}/runs/{id}` | Transcript viewer (mensagens role-coded) |
| 34 | `/{prefix}/skills` | Lista com toggle enable/disable |
| 35 | `/{prefix}/workspaces/{id}` | Detalhe: status, agent, branch, issue |
| 36 | `/{prefix}/export` | Checkboxes por seção + download ZIP |
| 37 | `/{prefix}/import` | Drag-and-drop zone + upload ZIP/JSON |
| 38 | `/{prefix}/org` | Stub |
| 39 | `/{prefix}/org/chart` | Árvore hierárquica recursiva de agentes |

### 4.3 Layout & Navegação

**Root Layout** (`+layout.svelte`):
- SPA mode (ssr=false, prerender=true)
- CSS global

**Company Layout** (`[companyPrefix]/+layout.svelte`):
- Sidebar + BreadcrumbBar + ToastViewport
- Stores: companyStore, sidebarStore, themeStore
- Carrega lista de empresas no mount

**Sidebar** — Seções de navegação:
- **Primary**: Dashboard, Inbox (badge unread)
- **Work**: Issues, Routines, Goals
- **Manage**: Projects, Agents, Approvals
- **Company**: Org, Costs, Activity, Settings

### 4.4 Componentes Compartilhados (80+)

#### Componentes Custom
| Componente | Descrição |
|------------|-----------|
| `StatusBadge` | Badge colorido por status (20+ mapeamentos de cor) |
| `PageSkeleton` | Loading placeholder com sidebar opcional |
| `TimeAgo` | Timestamp relativo (just now, 5m ago, 2h ago) |
| `EmptyState` | Placeholder com emoji, título, descrição, slot de ação |
| `PriorityIcon` | Ícones de prioridade (⬆⬆ urgent, ⬆ high, — normal, ⬇ low) |
| `PropertiesPanel` | Sidebar de metadados (320px desktop) |
| `PropertyRow` | Linha label:value no properties panel |
| `CommandPalette` | Ctrl+K command launcher (placeholder) |
| `CardHoverEffect` | Card com spotlight animado no hover (Aceternity UI) |
| `TipTapEditor` | Editor rich text (contenteditable wrapper) |
| `BaseChart` | Wrapper ECharts com resize observer |

#### Componentes UI Primitivos (shadcn-svelte style)
Button, Input, Dialog, Tabs, Select, Avatar, Badge, Card, Checkbox, Collapsible, Command, Dropdown Menu, Label, Popover, Scroll Area, Sheet, Skeleton, Separator, Textarea, Tooltip, Breadcrumb (8 sub-componentes)

#### Componentes de Layout
| Componente | Descrição |
|------------|-----------|
| `Sidebar` | Navegação lateral com seções, badges, mobile responsive |
| `BreadcrumbBar` | Barra top com breadcrumbs e hamburger mobile |
| `ToastViewport` | Container de notificações (info/success/warn/error) |

### 4.5 State Management (Stores)
| Store | Descrição |
|-------|-----------|
| `companyStore` | Empresa selecionada (id, slug) |
| `sidebarStore` | Estado aberto/fechado, isMobile |
| `breadcrumbStore` | Trail de navegação |
| `themeStore` | Tema da aplicação |
| `toastStore` | Fila de notificações |

### 4.6 API Client
```typescript
// /lib/api/index.ts
export function api(url: string, init?: RequestInit): Promise<Response>
// Inclui credentials, Content-Type: application/json, permite overrides
```

---

## 5. ADAPTERS DE AGENTES (7)

| Adapter | Tipo | Modelos Principais |
|---------|------|-------------------|
| Claude Local | `claude_local` | claude-opus-4-6, claude-sonnet-4-6, claude-haiku-4-6 |
| Codex Local | `codex_local` | gpt-5.4, gpt-5.3-codex, o3, o4-mini |
| Cursor | `cursor` | auto, composer variants, Claude, Gemini, Grok |
| Gemini Local | `gemini_local` | gemini-2.5-pro, gemini-2.5-flash |
| Pi Local | `pi_local` | Provider/model format (xai/grok-4, anthropic/claude-opus) |
| OpenCode Local | `opencode_local` | OpenCode-specific models |
| OpenClaw Gateway | `openclaw_gateway` | WebSocket protocol, Ed25519 device auth |

Cada adapter implementa: config builder, event parser, test capability, skills management, execution handling.

---

## 6. SISTEMA DE PLUGINS

### Ciclo de vida
```
definePlugin() → setup(ctx) → onHealth? → onConfigChanged? → onWebhook? → onShutdown?
```

### Serviços do Context (ctx.*)
`config`, `events`, `jobs`, `data`, `actions`, `tools`, `http`, `secrets`, `state`, `entities`, `activity`, `projects`, `issues`, `agents`, `goals`, `companies`, `sessions`, `metrics`, `logger`

### UI Slots
`issue_detail`, `project_detail`, `dashboard`, `agent_detail`

### Comunicação
Worker process isolation + JSON-RPC 2.0

---

## 7. CLI (40+ Comandos)

| Área | Comandos |
|------|----------|
| Setup | `onboard`, `doctor`, `env`, `configure`, `run` |
| DB | `db:backup` |
| Auth | `auth bootstrap-ceo`, `auth login`, `auth logout`, `auth status` |
| Heartbeat | `heartbeat run` (--agent-id, --source, --timeout-ms) |
| Company | `company list/create/export/import/delete` |
| Issue | `issue list/create/update/comment/checkout` |
| Agent | `agent list/create/update/wake/pause/resume/delete` |
| Approval | `approval list/approve/reject` |
| Activity | `activity list` |
| Dashboard | `dashboard summary` |
| Worktree | `worktree list/merge/delete` |
| Plugin | `plugin list/install/uninstall/config` |
| Context | `context list/add/use` |

---

## 8. AUTENTICAÇÃO

| Tipo | Fonte | Uso |
|------|-------|-----|
| Board (humano) | Session cookie ou Board API key | UI web, gerenciamento |
| Agent | API key ou JWT | Execução de agentes |
| None | Sem auth | Modo local_trusted |

**Better-Auth**: Multi-provider (email/password, OAuth futuro)

---

## 9. REAL-TIME (WebSocket)

- **Endpoint**: `WS /api/companies/:companyId/events/ws`
- **Tipos de evento**: activity.created, agent.updated, issue.updated, approval.approved, cost.reported
- **Keepalive**: ping/pong a cada 30s
- **Auth**: Bearer token, session cookie, ou sem auth (local_trusted)

---

## 10. PADRÕES DE UI IDENTIFICADOS

### Design System
- **Tema**: Dark mode (#050508 background, #F8FAFC text)
- **Bordas**: Rounded com soft shadows
- **Loading**: Skeleton matching content layout
- **Empty states**: Emoji + título + descrição + ação
- **Responsive**: Mobile-first, Tailwind breakpoints
- **Animações**: Hover effects, transitions, slide-in toasts

### Padrões de Dados
- **Fetch**: `api()` wrapper → `.json()` → state update
- **Filtros**: Server-side para status, client-side para priority/search
- **Debounce**: 300ms no search
- **Paginação**: Não implementada (all-at-once)
- **Toast**: Para feedback de ações

### Padrões de Página
- **List pages**: Header + filtros + lista/grid + empty state + skeleton
- **Detail pages**: Header + tabs + main content + PropertiesPanel sidebar
- **Form pages**: Centered container + inputs + submit button + error display
- **Redirect pages**: onMount → goto()

---

## 11. CONSTANTES E ENUMS IMPORTANTES

```
COMPANY_STATUSES: active | paused | archived
AGENT_STATUSES: idle | waiting | running | paused | error
AGENT_ROLES: general | ceo | cto | engineer | designer | marketer | custom
ISSUE_STATUSES: backlog | todo | in_progress | in_review | blocked | completed | cancelled
ISSUE_PRIORITIES: critical | high | medium | low
GOAL_LEVELS: task | quarter | annual
GOAL_STATUSES: planned | active | completed | archived
PROJECT_STATUSES: backlog | active | paused | completed | archived
APPROVAL_STATUSES: pending | approved | rejected
BUDGET_SCOPES: agent | project | company
BUDGET_WINDOWS: monthly | annual | lifetime
HEARTBEAT_STATUSES: queued | started | success | failed | cancelled | timeout
PLUGIN_STATUS: installed | disabled | error
```

---

## 12. FUNCIONALIDADES PARA REPLICAÇÃO (Checklist)

### Core Platform
- [ ] Multi-tenant company system
- [ ] Auth (email/password, sessions, API keys, CLI auth)
- [ ] Role-based access (instance admin, board user, agent)
- [ ] Activity audit trail
- [ ] Real-time WebSocket events
- [ ] Import/Export (ZIP format)

### Agent Management
- [ ] CRUD de agentes com 7 adapters
- [ ] Org chart hierárquico (reportsTo)
- [ ] Chain of command
- [ ] Agent permissions & config
- [ ] Heartbeat execution system
- [ ] Agent wakeup scheduling
- [ ] Session management
- [ ] Skills sync per adapter

### Work Management
- [ ] Issues (CRUD, status workflow, priority, labels)
- [ ] Issue checkout/checkin (lock mechanism)
- [ ] Issue comments (threaded)
- [ ] Issue documents (revision tracking)
- [ ] Issue work products (PRs, docs, reports)
- [ ] Issue inbox (read/unread, archive)
- [ ] Projects (CRUD, workspaces, issue/goal linking)
- [ ] Goals (hierarchical, parent/child, progress tracking)

### Financial
- [ ] Cost tracking (per event, per agent, per model, per provider)
- [ ] Budget policies (agent/project/company scope)
- [ ] Budget incidents & enforcement
- [ ] Finance events (revenue/expense)

### Approvals
- [ ] Approval workflows (create, approve, reject, revision)
- [ ] Approval comments
- [ ] Issue-approval linking

### Routines
- [ ] Scheduled tasks (cron/webhook triggers)
- [ ] Concurrency policies
- [ ] Catch-up policies
- [ ] Manual execution

### Plugins
- [ ] Plugin install/uninstall
- [ ] Plugin enable/disable
- [ ] Plugin config
- [ ] Plugin UI slots
- [ ] Plugin jobs & webhooks
- [ ] Plugin tools (AI-callable)
- [ ] Plugin state management

### Execution Workspaces
- [ ] Git worktree isolation
- [ ] Docker containers
- [ ] Runtime services (postgres, redis)
- [ ] Workspace operations history

### Secrets
- [ ] Secret management (CRUD, rotation, versioning)
- [ ] Multiple providers (local_encrypted, vault)

### Frontend (39 páginas)
- [ ] Auth page (login/signup)
- [ ] Companies page (list + create)
- [ ] Dashboard (metrics, active agents, activity, issues)
- [ ] Agents (list, create, detail with tabs)
- [ ] Issues (list with filters, detail with tabs, my issues)
- [ ] Approvals (list with actions, detail with decision panel)
- [ ] Projects (list, detail with tabs)
- [ ] Goals (list with progress, detail with hierarchy)
- [ ] Costs (summary cards + breakdown table)
- [ ] Activity feed (filtered)
- [ ] Inbox (tabs, unread status)
- [ ] Plugins (list, detail, settings)
- [ ] Skills (list with toggles)
- [ ] Routines (list, detail)
- [ ] Runs (transcript viewer)
- [ ] Workspaces (detail)
- [ ] Export/Import
- [ ] Org chart (recursive tree)
- [ ] Settings (company, instance, experimental)
- [ ] Claim, CLI-auth, Invite pages

---

*Relatório gerado automaticamente por análise de 5 agentes paralelos.*
