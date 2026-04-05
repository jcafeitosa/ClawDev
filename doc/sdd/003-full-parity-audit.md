# SDD-003: Full Parity Audit — Every Page, Every Element

## Contexto

O ClawDev é um fork do Paperclip com melhorias (SvelteKit, Elysia, glassmorphism, ECharts).
Precisamos garantir que **NENHUM elemento interativo ou visual** do Paperclip esteja faltando no ClawDev.

### Servidores
- **Paperclip** (referência): `http://localhost:3200` — React + Express
- **ClawDev** (fork): `http://localhost:3100` — SvelteKit + Elysia

### Abordagem
Para CADA página:
1. Abrir no Paperclip e no ClawDev side-by-side
2. Listar TODOS os elementos visíveis (textos, ícones, badges, botões, links, inputs, selects, tabs, cards)
3. Clicar em CADA elemento clicável e documentar o comportamento
4. Comparar e listar gaps
5. Implementar gaps no ClawDev (frontend + backend + DB se necessário)
6. Verificar que funciona com dados reais

### Páginas a auditar (30 total)

| # | Página | Rota Paperclip | Rota ClawDev |
|---|--------|---------------|-------------|
| 1 | Dashboard | /{prefix}/ | /{prefix}/dashboard |
| 2 | New Issue Dialog | (overlay) | (overlay ou /issues/new) |
| 3 | Issues List | /{prefix}/issues | /{prefix}/issues |
| 4 | Issue Detail | /{prefix}/issues/{id} | /{prefix}/issues/{id} |
| 5 | Inbox | /{prefix}/inbox | /{prefix}/inbox |
| 6 | Agents List | /{prefix}/agents | /{prefix}/agents |
| 7 | Agent Detail | /{prefix}/agents/{id} | /{prefix}/agents/{id} |
| 8 | New Agent | /{prefix}/agents/new | /{prefix}/agents/new |
| 9 | Runs List | (dentro de agent detail) | /{prefix}/runs |
| 10 | Run Detail | /{prefix}/agents/{id}/runs/{runId} | /{prefix}/runs/{runId} |
| 11 | Projects List | /{prefix}/projects | /{prefix}/projects |
| 12 | Project Detail | /{prefix}/projects/{id} | /{prefix}/projects/{id} |
| 13 | Goals List | /{prefix}/goals | /{prefix}/goals |
| 14 | Goal Detail | /{prefix}/goals/{id} | /{prefix}/goals/{id} |
| 15 | Routines List | /{prefix}/routines | /{prefix}/routines |
| 16 | Routine Detail | /{prefix}/routines/{id} | /{prefix}/routines/{id} |
| 17 | Approvals List | /{prefix}/approvals | /{prefix}/approvals |
| 18 | Approval Detail | /{prefix}/approvals/{id} | /{prefix}/approvals/{id} |
| 19 | Org Chart | /{prefix}/org | /{prefix}/org/chart |
| 20 | Skills | /{prefix}/skills | /{prefix}/skills |
| 21 | Costs | /{prefix}/costs | /{prefix}/costs |
| 22 | Activity | /{prefix}/activity | /{prefix}/activity |
| 23 | Settings (Company) | /{prefix}/settings | /{prefix}/settings |
| 24 | Settings (Instance) | /settings | /settings/* |
| 25 | Providers | (não existe) | /{prefix}/providers |
| 26 | Budgets | (dentro de costs) | /{prefix}/budgets |
| 27 | Documents | (dentro de issue) | /{prefix}/documents |
| 28 | Members | (dentro de settings) | /{prefix}/members |
| 29 | Secrets | (não existe) | /{prefix}/secrets |
| 30 | Onboarding | /onboarding | /onboarding |

---

## Prompt para Agente de Audit

```
Você é um QA specialist fazendo audit de paridade entre Paperclip (referência) e ClawDev (fork).

Para a página "{PAGE_NAME}" ({PAPERCLIP_ROUTE} vs {CLAWDEV_ROUTE}):

### Step 1: Inventário do Paperclip
Navegue para {PAPERCLIP_ROUTE} no Paperclip (porta 3200).
Liste TODOS os elementos visíveis:
- Textos (headings, labels, descriptions, placeholders)
- Botões (com texto e ação esperada)
- Links (com destino)
- Inputs (type, placeholder, value)
- Selects/dropdowns (options)
- Tabs (labels)
- Badges/status indicators (texto e cor)
- Ícones (tipo e posição)
- Cards/panels (conteúdo)
- Tabelas/listas (colunas e dados)
- Modals/dialogs (trigger e conteúdo)
- Empty states (mensagem e ícone)
- Loading states (skeleton pattern)
- Error states (mensagem)

### Step 2: Clicar em TUDO
Para cada elemento clicável no Paperclip:
1. Clique nele
2. Documente o que acontece (navegação, dialog, dropdown, toggle, API call)
3. Screenshot do resultado

### Step 3: Inventário do ClawDev
Repita Step 1 e Step 2 para o ClawDev (porta 3100).

### Step 4: Comparação
Crie uma tabela:
| Elemento | Paperclip | ClawDev | Status |
|----------|-----------|---------|--------|
| [nome] | [descrição] | [descrição ou "FALTA"] | ✅/❌/⚠️ |

### Step 5: Implementação
Para cada elemento com status ❌ (falta no ClawDev):
1. Identifique o arquivo Svelte que precisa ser editado
2. Implemente o elemento faltante
3. Se precisar de dados da API, verifique se o endpoint existe
4. Se o endpoint não existir, implemente no backend (server/src/routes/)
5. Verifique se o schema do DB suporta os dados necessários

### Step 6: Validação
1. Build: pnpm --filter @clawdev/svelte-ui build
2. Navegue para a página e verifique visualmente
3. Clique em cada elemento implementado
4. Confirme que funciona com dados reais

### Regras
- LEIA os arquivos antes de editar
- NÃO reescreva arquivos inteiros
- Faça edits cirúrgicos
- Mantenha lógica de negócio existente
- Use componentes shadcn-svelte existentes (Card, Badge, Alert, Button, etc)
- Use .glass-card para seções
- Use PageLayout para headers
- Todos os clickables devem ter cursor-pointer
- Todos os hovers devem ter transition-colors duration-150
```
