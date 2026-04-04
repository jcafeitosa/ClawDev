# SDD-001: Fork Parity Audit — ClawDev vs Paperclip

## Especificação / PRD (Fonte da verdade)

### Objetivo
Comparar funcionalmente o fork ClawDev (`localhost:3100`) com o upstream Paperclip (`/tmp/paperclip`, `localhost:3200`) para identificar o que está quebrado no ClawDev e o que já foi melhorado.

### Contexto
| | Paperclip (upstream) | ClawDev (fork) |
|---|---|---|
| UI | React 19 + Vite | SvelteKit + Vite |
| Server | Express 5 (Node) | Elysia.js (Bun) |
| DB | Drizzle + embedded PG | Drizzle + embedded PG |
| Port | 3200 | 3100 |
| Schemas | 61 files, migration 0045 | 66 files, 50+ migrations |
| Onboarding | `OnboardingWizard.tsx` | `/setup/+page.svelte` |

### Critérios de aceitação
1. Ambos os apps iniciam sem erro após DB limpo
2. O fluxo de onboarding completo funciona em ambos (4 steps)
3. Mapa de paridade funcional documentado
4. Lista de bugs do ClawDev identificados
5. Lista de melhorias do ClawDev já implementadas

---

## Architecture Plan (Documentado pela IA)

### Estratégia de comparação

```
Phase 1: Clean Slate
├── Parar qualquer instância rodando
├── Limpar DB do Paperclip (~/.paperclip/instances/default/db)
├── Limpar DB do ClawDev (~/.clawdev/instances/default/db)
├── Rebuild ambos (pnpm build)
└── Iniciar ambos via preview

Phase 2: Onboarding Side-by-Side
├── Paperclip (3200): completar wizard completo
│   ├── Step 1: Company creation
│   ├── Step 2: Agent hiring (adapter selection)
│   ├── Step 3: Task/Goal creation
│   └── Step 4: Launch
├── ClawDev (3100): completar wizard completo
│   ├── Step 1: Company setup
│   ├── Step 2: Agent creation
│   ├── Step 3: Task creation
│   └── Step 4: Launch
└── Documentar cada diferença

Phase 3: Feature Comparison
├── API endpoints (routes)
├── Schema differences (5 extra tables no ClawDev)
├── Adapter support
├── UI pages e navegação
├── WebSocket/realtime
└── Plugin system

Phase 4: Report
├── Bugs no ClawDev (o que não funciona)
├── Melhorias no ClawDev (o que foi adicionado)
├── Regressões (o que funcionava no Paperclip e quebrou)
└── Roadmap de fix
```

### Portas e URLs
- Paperclip: `http://localhost:3200`
- ClawDev: `http://localhost:3100`
- ClawDev UI (Vite HMR): `http://localhost:5174`

---

## Task Breakdown (com dependências)

| # | Task | Depende de | Status |
|---|---|---|---|
| T1 | Kill processos nas portas 3100, 3200 | - | pending |
| T2 | Limpar DB Paperclip | T1 | pending |
| T3 | Limpar DB ClawDev | T1 | pending |
| T4 | Build Paperclip (`pnpm build`) | T2 | pending |
| T5 | Build ClawDev (`pnpm build`) | T3 | pending |
| T6 | Start Paperclip preview (3200) | T4 | pending |
| T7 | Start ClawDev preview (3100) | T5 | pending |
| T8 | Onboarding Paperclip: preencher wizard completo | T6 | pending |
| T9 | Onboarding ClawDev: preencher wizard completo | T7 | pending |
| T10 | Comparar APIs: diff de rotas | T6, T7 | pending |
| T11 | Comparar schemas: diff de tabelas | - | pending |
| T12 | Comparar UI: pages e componentes | T8, T9 | pending |
| T13 | Documentar bugs ClawDev | T8, T9 | pending |
| T14 | Documentar melhorias ClawDev | T10, T11, T12 | pending |
| T15 | Gerar relatório final | T13, T14 | pending |

---

## Execução (Prompt para o Agente)

> Ver arquivo separado: `001-fork-parity-audit-prompt.md`
