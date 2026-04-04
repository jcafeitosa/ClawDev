# Prompt: Fork Parity Audit — ClawDev vs Paperclip

## Contexto

Você é um agente de QA realizando um audit de paridade entre dois projetos:

- **Paperclip** (`/tmp/paperclip`): a versão upstream, funcional e correta. Roda na porta **3200**. Stack: React 19 + Express 5 + Drizzle ORM + embedded PostgreSQL.
- **ClawDev** (`/Users/juliocezaraquinofeitosa/Development/clawdev`): o fork que **não está funcionando corretamente**. Roda na porta **3100** (UI dev na **5174**). Stack: SvelteKit + Elysia.js (Bun) + Drizzle ORM + embedded PostgreSQL.

O ClawDev é um fork com melhorias (5 schemas extras, adapters adicionais, SvelteKit UI), mas o fluxo principal está quebrado.

## Instrução

### Fase 1 — Clean Slate
1. Pare qualquer processo nas portas 3100, 3200, 5174
2. Delete os diretórios de dados para resetar o DB:
   - `rm -rf ~/.paperclip/instances/default/db`
   - `rm -rf ~/.clawdev/instances/default/db`
3. Em cada projeto, execute `pnpm build` para garantir build limpo
4. Inicie ambos os projetos usando preview_start (configurações em `.claude/launch.json`)

### Fase 2 — Onboarding Side-by-Side
1. Abra `http://localhost:3200` (Paperclip) — complete o wizard de onboarding:
   - Step 1: Crie uma company chamada "Test Corp" com missão "Testing parity"
   - Step 2: Crie um agente chamado "Agent-01", selecione adapter "Claude Local"
   - Step 3: Crie uma task "First task" com descrição "Test task for parity audit"
   - Step 4: Confirme o launch
   - **Documente**: cada campo, cada request, cada resposta, cada erro
2. Abra `http://localhost:3100` (ClawDev) — repita o mesmo fluxo:
   - Mesmos dados: "Test Corp", "Agent-01", "Claude Local", "First task"
   - **Documente**: cada diferença em relação ao Paperclip
   - **Capture**: erros de console, network failures, UI glitches

### Fase 3 — Comparação Técnica
1. **APIs**: Compare as rotas em `server/src/routes/` (Paperclip) vs `server/src/routes/` (ClawDev)
   - Liste endpoints que existem em um mas não no outro
   - Compare request/response shapes dos endpoints compartilhados
2. **Schemas**: Compare `packages/db/src/schema/` de ambos
   - Liste tabelas extras no ClawDev
   - Identifique colunas diferentes nas tabelas compartilhadas
3. **UI**: Compare pages e componentes
   - Liste páginas que existem em um mas não no outro
   - Compare o fluxo de navegação
4. **Adapters**: Compare adapters disponíveis
   - Liste adapters extras no ClawDev

### Fase 4 — Relatório
Gere um relatório com estas seções:

```markdown
## 🔴 Bugs no ClawDev (o que não funciona)
- [BUG-001] Descrição do bug
  - Onde: rota/componente afetado
  - Comportamento esperado (Paperclip)
  - Comportamento atual (ClawDev)
  - Causa provável

## 🟢 Melhorias no ClawDev (o que foi adicionado)
- [IMP-001] Descrição da melhoria
  - Onde: arquivo/componente
  - O que faz de diferente do Paperclip

## 🟡 Regressões (funcionava no Paperclip, quebrou no fork)
- [REG-001] Descrição
  - Funcionalidade original no Paperclip
  - Estado atual no ClawDev

## 📋 Diff de Schemas
| Tabela | Paperclip | ClawDev | Diferença |
|--------|-----------|---------|-----------|

## 📋 Diff de Rotas
| Endpoint | Paperclip | ClawDev | Diferença |
|----------|-----------|---------|-----------|

## 📋 Diff de UI Pages
| Page | Paperclip | ClawDev | Diferença |
|------|-----------|---------|-----------|

## Próximos passos
1. Fix prioritário para cada bug
2. Backport de features que faltam
3. Roadmap de estabilização
```

## Regras
- Use `preview_start` para iniciar os servers, não bash
- Use `preview_snapshot` e `preview_console_logs` para inspecionar
- Use `preview_screenshot` para evidência visual
- Não modifique código — este é um audit read-only
- Documente TUDO: cada clique, cada resposta, cada erro
- Se um step falhar no ClawDev, continue com os próximos steps e documente o erro
- Compare usando dados idênticos em ambos os projetos
