# SDD-002: UI Redesign — UUPM.cc / Glassmorphism Style

## 1. Especificação / PRD (Fonte da verdade)

### Objetivo
Redesenhar TODAS as páginas do ClawDev seguindo o estilo visual do https://www.uupm.cc/ — glassmorphism, dark-first, profissional, limpo, minimalista.

### Design System (gerado pelo UI/UX Pro Max)
- **Style**: Glassmorphism — frosted glass, backdrop-blur, layered depth
- **Colors**: Primary #0F172A, Secondary #1E293B, CTA #22C55E, Background #020617, Text #F8FAFC
- **Typography**: Plus Jakarta Sans (heading + body)
- **Effects**: backdrop-blur(10-20px), border 1px solid rgba(255,255,255,0.1), shadow depth layers
- **Icons**: Lucide SVG only (no emojis)
- **Hover**: transform scale(1.02), shadow-lg, duration-200
- **Border radius**: rounded-2xl (16px) for cards, rounded-full for badges

### Componentes shadcn a mapear
| Componente | Onde aplicar |
|-----------|-------------|
| Card/CardHeader/CardContent | Metric cards, chart containers, form wrappers, list containers |
| Badge | Status (todo/running/done/error), priority (P1-P4), labels, roles |
| Alert/AlertTitle/AlertDescription | Warnings, errors, budget incidents, no-data states |
| Progress | Budget utilization, task completion, upload progress |
| Tabs/TabsList/TabsTrigger/TabsContent | Page view switching, filter presets, settings sections |
| Button | Actions (New Issue, Submit, Cancel, Export), icon buttons |
| Input/Label/Textarea | Search bars, forms, filters |
| Skeleton | Loading states em TODAS as páginas |
| Separator | Section dividers |
| Avatar/AvatarFallback | Agent/user identification |
| Tooltip/TooltipContent | Icon-only buttons, sidebar collapsed, truncated text |
| DropdownMenu | Sort, filter, bulk actions |
| Select | Status picker, assignee picker, priority picker |
| Dialog | Confirmations, new entity forms, detail overlays |
| ScrollArea | Long lists, sidebar overflow |
| Breadcrumb | Page navigation hierarchy |

### Charts ECharts a mapear
| Chart | Onde aplicar |
|-------|-------------|
| Stacked Bar (existente) | Run Activity, Issues by Priority/Status, Success Rate |
| Gauge | Budget utilization %, Success rate % |
| Pie/Doughnut | Agent status distribution, Issue breakdown |
| Line/Area | Cost trend, Run trend over time |

### Padrão de layout de página
Toda página segue:
```
<PageLayout title="..." description="...">
  {#snippet actions()} <Button>...</Button> {/snippet}
  {#snippet tabs()} <Tabs>...</Tabs> {/snippet}
  <!-- content -->
</PageLayout>
```

---

## 2. Architecture Plan

### Componente PageLayout (novo)
```
svelte-ui/src/lib/components/layout/page-layout.svelte
```
- Header: h1 title + p description + action buttons (right-aligned)
- Optional tabs bar below header
- Content area with gap-6 spacing
- max-w-7xl container
- Responsive: stack on mobile

### Glassmorphism Card Pattern
```css
.glass-card {
  @apply rounded-2xl border border-white/[0.08]
         bg-gradient-to-br from-white/[0.04] to-white/[0.01]
         backdrop-blur-sm shadow-sm;
}
.glass-card:hover {
  @apply border-white/[0.12] shadow-lg -translate-y-0.5;
  transition: all 0.2s ease;
}
```

### Metric Card Pattern
```svelte
<a href="..." class="group">
  <div class="glass-card p-5 transition-all duration-200 group-hover:...">
    <div class="flex items-start justify-between">
      <div>
        <p class="text-3xl font-bold tabular-nums">{value}</p>
        <p class="text-sm text-muted-foreground mt-1">{label}</p>
        <p class="text-xs text-muted-foreground/60 mt-1">{subtitle}</p>
      </div>
      <div class="h-9 w-9 rounded-xl bg-background/50 backdrop-blur flex items-center justify-center">
        <Icon class="h-4 w-4" />
      </div>
    </div>
  </div>
</a>
```

---

## 3. Task Breakdown

| # | Task | Depende de | Arquivos |
|---|------|-----------|----------|
| T1 | Criar PageLayout component | - | layout/page-layout.svelte, layout/index.ts |
| T2 | Adicionar Plus Jakarta Sans font | - | app.css ou app.html |
| T3 | Criar utility class .glass-card | - | app.css |
| T4 | Redesenhar dashboard completo | T1,T2,T3 | dashboard/+page.svelte |
| T5 | Aplicar PageLayout em Issues pages | T1 | issues/*.svelte |
| T6 | Aplicar PageLayout em Agents pages | T1 | agents/*.svelte |
| T7 | Aplicar PageLayout em Settings pages | T1 | settings/*.svelte |
| T8 | Aplicar PageLayout em remaining pages | T1 | 20+ arquivos |
| T9 | Build + verificação visual | T4-T8 | - |

---

## 4. Execução

### Equipe de agentes:
1. **infra-agent** — T1, T2, T3 (PageLayout, font, glass-card CSS)
2. **dashboard-agent** — T4 (dashboard completo)
3. **pages-team** (3 agentes paralelos) — T5, T6, T7, T8
4. **qa-agent** — T9 (build + screenshots + verificação)

### Ordem:
1. infra-agent executa primeiro (bloqueante)
2. dashboard-agent + pages-team executam em paralelo
3. qa-agent verifica tudo
