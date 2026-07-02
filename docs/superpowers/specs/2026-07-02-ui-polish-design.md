# UI Polish — PILETERO Design Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the PILETERO UI across 6 areas, keeping the sky/cyan brand identity and all emojis, making the app feel more refined and professional without changing functionality.

**Architecture:** Pure frontend changes — Tailwind class updates and component restructuring. No backend changes, no new dependencies, no new routes. All changes are isolated to existing JSX files.

**Tech Stack:** React 18, Tailwind CSS v3, Vite, PWA (mobile-first)

---

## Design Decisions

### Direction: "Pulido"
Same sky/cyan gradient palette, same emoji icons. Improvements focus on:
- Shadow system (depth instead of left borders)
- Consistent border-radius (12px for cards, 8px for inputs/badges)
- Typography refinements (tighter letter-spacing on headings, better hierarchy)
- Active state improvements (pill background on nav tabs)
- Color accent strips on dashboard stat cards
- Integrated card footers with contextual actions

### What does NOT change
- Color palette (sky-600/700, cyan-600 gradients)
- Emoji icons in navigation and throughout the app
- Route structure, component API, data flow
- Backend, API, or database

---

## Files Modified

| File | Change |
|------|--------|
| `frontend/src/index.css` | Add shadow utility classes |
| `frontend/src/components/Navigation.jsx` | Active pill state for bottom tab bar |
| `frontend/src/components/ClientCard.jsx` | Shadow system, no left border, card footer |
| `frontend/src/pages/AgendaPage.jsx` | Header: thicker progress bar + counter + connection badge |
| `frontend/src/pages/DashboardPage.jsx` | Stat cards with color accent strips |
| `frontend/src/pages/VisitFormPage.jsx` | Section headers with dividers |
| `frontend/src/components/DosisCalculadora.jsx` | Section header with sky accent (same pattern) |

---

## Area 1 — Global CSS tokens (`index.css`)

Add two reusable shadow utilities to avoid repeating the same shadow string in every card:

```css
/* Subtle card shadow — replaces shadow-sm on most cards */
.shadow-card {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(0, 0, 0, 0.04);
}

/* Slightly stronger — for modals and panels */
.shadow-panel {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.05);
}
```

---

## Area 2 — Navigation bottom tab bar (`Navigation.jsx`)

**Current behavior:** Active tab shows a thin top-bar indicator (`w-8 h-0.5 bg-sky-500`) above the emoji.

**Proposed:** Active tab wraps the emoji in a pill background (`bg-sky-100 rounded-xl px-3 py-1`), bolder label.

### Mobile nav tab — before
```jsx
<button className={`flex-1 flex flex-col items-center pt-1.5 pb-3 relative transition-colors ${
  active ? 'text-sky-600' : 'text-gray-400'
}`}>
  {active && (
    <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-sky-500 rounded-full" />
  )}
  <span className="text-2xl leading-tight">{icon}</span>
  <span className={`text-[10px] font-semibold mt-0.5 ${active ? 'text-sky-600' : 'text-gray-400'}`}>
    {label}
  </span>
</button>
```

### Mobile nav tab — after
```jsx
<button className={`flex-1 flex flex-col items-center pt-2 pb-3 transition-colors`}>
  <span className={`text-2xl leading-tight px-3 py-1 rounded-xl transition-colors ${
    active ? 'bg-sky-100' : ''
  }`}>
    {icon}
  </span>
  <span className={`text-[10px] mt-0.5 ${
    active ? 'font-bold text-sky-600' : 'font-semibold text-gray-400'
  }`}>
    {label}
  </span>
</button>
```

Also add `backdrop-blur-sm bg-white/95` to the nav container for the frosted glass effect:
```jsx
// Before:
<nav className="fixed bottom-0 left-0 right-0 bg-white shadow-[0_-2px_12px_rgba(0,0,0,0.08)] flex">

// After:
<nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm shadow-[0_-2px_8px_rgba(0,0,0,0.06)] flex border-t border-gray-100">
```

Remove the `<span className={...online dot...} />` from the nav (it's redundant — the connection status is visible in the agenda header badge). The online/offline dot logic stays but moves to the header only.

---

## Area 3 — Agenda header (`AgendaPage.jsx`)

**Current:** Basic title + date + thin progress bar (h-1.5). Connection status is a separate pill in the header row.

**Proposed:** Title row integrates connection badge; progress bar is thicker (h-2) with "X/Y listas" label alongside; date is capitalized.

### Header JSX — after
```jsx
<div className="bg-gradient-to-br from-sky-700 to-cyan-600 sticky top-0 z-10">
  <div className="px-4 pt-5 pb-3">
    {/* Title row */}
    <div className="flex items-start justify-between mb-0.5">
      <h1 className="text-2xl font-black text-white tracking-tight">Agenda del día</h1>
      <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold mt-0.5 ${
        syncStatus === 'online'
          ? 'bg-white/20 text-white'
          : 'bg-amber-400/30 text-amber-100'
      }`}>
        <span className={`w-1.5 h-1.5 rounded-full ${syncStatus === 'online' ? 'bg-green-300' : 'bg-amber-300'}`} />
        {syncStatus === 'online' ? 'Conectado' : 'Sin conexión'}
      </span>
    </div>

    {/* Date */}
    <p className="text-sky-100 text-sm capitalize mb-3">{formatDateSpanish(fecha)}</p>

    {/* Progress bar — only if there are clients */}
    {clientesDeHoy.length > 0 && (
      <div className="flex items-center gap-3">
        <div className="flex-1 bg-white/20 rounded-full h-2">
          <div
            className="bg-white rounded-full h-2 transition-all duration-500"
            style={{ width: clientesDeHoy.length ? `${(getCompletedCount() / clientesDeHoy.length) * 100}%` : '0%' }}
          />
        </div>
        <p className="text-white text-xs font-bold whitespace-nowrap">
          {getCompletedCount()}/{clientesDeHoy.length} listas
        </p>
      </div>
    )}
  </div>
  {/* ...sync button row stays the same... */}
</div>
```

---

## Area 4 — Client cards (`ClientCard.jsx`)

**Current:** Left border accent (4px colored), `shadow-sm`, badge top-right.

**Proposed:**
- Remove `border-l-4` colored border
- Replace with `shadow-card` (defined in index.css)
- Add card footer row: shows visit time (if completed) or "Sin visita aún" (if pending) + WhatsApp action button (passed as prop)
- Status: small colored dot + text label instead of badge pill

### Component — after
```jsx
const STATUS = {
  completado:    { dot: 'bg-green-500', text: 'text-green-600', label: 'Listo' },
  'en progreso': { dot: 'bg-amber-400', text: 'text-amber-600', label: 'En curso' },
  pendiente:     { dot: 'bg-gray-300',  text: 'text-gray-400',  label: 'Pendiente' },
};

export default function ClientCard({ cliente, hora, estado, onStart, onWhatsApp }) {
  const s = STATUS[estado] || STATUS.pendiente;
  const completado = estado === 'completado';

  return (
    <button
      onClick={() => onStart(cliente.id)}
      className="w-full text-left bg-white rounded-2xl shadow-card px-4 pt-4 pb-3 active:scale-[0.98] transition-all"
    >
      {/* Top row: name + status */}
      <div className="flex items-center justify-between gap-3 mb-0.5">
        <h3 className="text-base font-bold text-gray-900 truncate">{cliente.nombre}</h3>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className={`w-2 h-2 rounded-full ${s.dot}`} />
          <span className={`text-xs font-bold ${s.text}`}>{s.label}</span>
        </div>
      </div>

      {/* Address */}
      {cliente.direccion && (
        <p className="text-sm text-gray-400 truncate mb-3">{cliente.direccion}</p>
      )}

      {/* Footer row */}
      <div className="flex items-center justify-between pt-2.5 border-t border-gray-50">
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${
          completado
            ? 'bg-green-50 text-green-700'
            : 'bg-gray-50 text-gray-400'
        }`}>
          {completado && hora ? `✓ ${hora}` : 'Sin visita aún'}
        </span>
        {onWhatsApp && (
          <button
            onClick={e => { e.stopPropagation(); onWhatsApp(); }}
            className={`text-xs font-bold px-3 py-1 rounded-lg transition-colors ${
              completado
                ? 'bg-green-50 text-green-700 active:bg-green-100'
                : 'bg-sky-50 text-sky-700 active:bg-sky-100'
            }`}
          >
            💬 WhatsApp
          </button>
        )}
      </div>
    </button>
  );
}
```

**AgendaPage.jsx change:** Pass `onWhatsApp` prop to ClientCard, and remove the floating `💬` button that's currently rendered as `absolute top-2 right-2`. The WhatsApp menu dropdown logic stays the same, just triggered from inside the card now.

---

## Area 5 — Dashboard stat cards (`DashboardPage.jsx`)

**Current:** White card with colored border (`border-blue-200`, `border-green-200`, etc.) and emoji.

**Proposed:** White card with `shadow-card`, no border, colored accent strip on top (3px, `rounded-t-xl`), colored number text.

### Stat card — after (inline with data)
Replace the current stat card divs with a reusable pattern:

```jsx
{[
  { emoji: '👥', value: clientes.length,        label: 'Clientes activos',   color: 'bg-sky-500',    num: 'text-gray-900' },
  { emoji: '✅', value: visitasMes.length,       label: `Visitas en ${mesNombre}`, color: 'bg-violet-500', num: 'text-violet-700' },
  { emoji: '💰', value: formatCurrency(cobradoMes), label: `Cobrado ${mesNombre}`, color: 'bg-green-500', num: 'text-green-700' },
  {
    emoji: pendienteMes > 0 ? '⏳' : '🎉',
    value: formatCurrency(pendienteMes),
    label: 'Pendiente cobro',
    color: pendienteMes > 0 ? 'bg-red-500' : 'bg-gray-300',
    num: pendienteMes > 0 ? 'text-red-600' : 'text-gray-400',
  },
].map(({ emoji, value, label, color, num }) => (
  <div key={label} className="bg-white rounded-xl shadow-card overflow-hidden">
    <div className={`h-1 ${color}`} />
    <div className="p-5">
      <p className="text-2xl mb-2">{emoji}</p>
      <p className={`text-3xl font-black ${num}`}>{value}</p>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
    </div>
  </div>
))}
```

---

## Area 6 — Visit form section headers (`VisitFormPage.jsx`)

**Current:** Plain `<h2 className="text-lg font-bold text-gray-900 mb-4">` for each section.

**Proposed:** Each section header gets a thin sky-colored left accent and slightly bolder styling.

### Section header utility — add to index.css
```css
/* Used for form section headings */
.section-heading {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.section-heading::before {
  content: '';
  width: 3px;
  height: 20px;
  background: #0284c7; /* sky-600 */
  border-radius: 99px;
  flex-shrink: 0;
}
```

### Usage in VisitFormPage
Replace all section `<h2>` tags:
```jsx
// Before:
<h2 className="text-lg font-bold text-gray-900 mb-4">Tareas</h2>

// After:
<h2 className="section-heading text-lg font-bold text-gray-900">Tareas</h2>
```

Sections to update: "Medición de agua", "🧪 Dosis Sugeridas" (in DosisCalculadora), "Lo que usaste", "Fotos", "Observaciones".

---

## Acceptance Criteria

- [ ] Navigation pill active state renders correctly, no regression on desktop sidebar
- [ ] ClientCard `onWhatsApp` prop is optional — if not passed, the footer button doesn't render (backward compat)
- [ ] AgendaPage floating `absolute top-2 right-2` WhatsApp button removed — WhatsApp menu now opens from card footer
- [ ] `shadow-card` and `shadow-panel` utility classes added to `index.css`
- [ ] Section headers in VisitFormPage all have the sky accent left bar
- [ ] Dashboard stat cards use the new color strip pattern
- [ ] All changes tested on mobile viewport (375px) — no overflow, no layout breaks
- [ ] Desktop sidebar nav unchanged (polish only affects the mobile bottom bar)
