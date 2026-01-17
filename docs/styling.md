# Styling Guide

This guide documents the styling conventions used throughout the application to maintain visual consistency. Follow these patterns when building new pages and components.

## Design Principles

1. **Soft, not harsh**: Avoid hard borders and stark contrasts. Use subtle background colors for separation instead of explicit borders.
2. **Consistent spacing**: Use the same padding and margin patterns across similar components.
3. **Visual hierarchy**: Use typography and subtle color differences, not heavy borders, to establish hierarchy.

## Color Variables

Use CSS variables for all colors. Never hardcode color values.

### Primary Colors

| Variable | Usage |
|----------|-------|
| `--color-primary` | Primary actions, active states, links |
| `--color-primary-hover` | Hover state for primary elements |
| `--color-secondary` | Secondary accent color |

### Background Colors

| Variable | Usage |
|----------|-------|
| `--color-background` | Main page background |
| `--color-background-secondary` | Cards, sections, elevated surfaces |
| `--color-sidebar` | Sidebar background |

### Text Colors

| Variable | Usage |
|----------|-------|
| `--color-text-primary` | Main text, headings |
| `--color-text-secondary` | Body text, descriptions |
| `--color-text-muted` | Helper text, timestamps, placeholders |

### Input Colors

| Variable | Usage |
|----------|-------|
| `--color-input-background` | Input field backgrounds |
| `--color-input-border` | Input field borders (subtle) |

### Status Colors

| Variable | Usage |
|----------|-------|
| `--color-success` | Success messages, positive states |
| `--color-warning` | Warning messages, caution states |
| `--color-error` | Error messages, destructive actions |

## Section Styling

### Cards and Sections

**DO**: Use background colors for visual separation

```tsx
// Good - Soft, borderless card
<div className="rounded-lg bg-[var(--color-background-secondary)] p-6">
  <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
    Section Title
  </h2>
  {/* content */}
</div>
```

**DON'T**: Use explicit borders for main sections

```tsx
// Bad - Harsh border
<div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background-secondary)] p-6">
```

### List Items with Dividers

When items need visual separation, use the background color as a subtle divider:

```tsx
// Good - Subtle dividers using background color
<div className="divide-y divide-[var(--color-background)]">
  {items.map(item => (
    <div key={item.id} className="px-4 py-3">
      {/* item content */}
    </div>
  ))}
</div>
```

### Table-like Lists

Use grid layouts with background-based headers instead of traditional bordered tables:

```tsx
// Header
<div className="px-4 py-3 bg-[var(--color-background)]">
  <div className="grid grid-cols-12 gap-4 text-sm font-medium text-[var(--color-text-muted)]">
    <div className="col-span-3">Name</div>
    <div className="col-span-2">Status</div>
    {/* ... */}
  </div>
</div>

// Body
<div className="divide-y divide-[var(--color-background)]">
  {items.map(item => (
    <div key={item.id} className="px-4 py-3 hover:bg-[var(--color-background)]/50">
      <div className="grid grid-cols-12 gap-4 items-center">
        {/* item content */}
      </div>
    </div>
  ))}
</div>
```

## Button Styling

### Primary Buttons

```tsx
<button className="rounded-lg bg-[var(--color-primary)] px-4 py-2 font-medium text-white hover:bg-[var(--color-primary-hover)]">
  Save
</button>
```

### Secondary Buttons (Soft)

```tsx
// Good - Background-based, no border
<button className="rounded-lg bg-[var(--color-background-secondary)] px-4 py-2 text-[var(--color-text-primary)] hover:bg-[var(--color-background-secondary)]/80">
  Cancel
</button>
```

```tsx
// Avoid - Bordered button
<button className="rounded-lg border border-[var(--color-border)] px-4 py-2">
```

### Text/Link Buttons

```tsx
<button className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
  Back to chat
</button>
```

### Destructive Buttons

```tsx
<button className="rounded-lg bg-[var(--color-error)] px-4 py-2 font-medium text-white hover:bg-[var(--color-error)]/90">
  Delete
</button>
```

## Form Inputs

Inputs should have subtle borders using the input-specific variables:

```tsx
<input
  type="text"
  className="w-full rounded-lg border border-[var(--color-input-border)] bg-[var(--color-input-background)] px-4 py-2 text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:outline-none"
/>
```

For selects in compact contexts (like inline dropdowns):

```tsx
<select className="rounded border border-[var(--color-input-border)] bg-[var(--color-input-background)] px-2 py-1 text-sm text-[var(--color-text-primary)]">
```

## Pills and Badges

Use background colors with no borders:

```tsx
// Status badge
<span className="rounded-full bg-[var(--color-primary)]/10 px-2 py-0.5 text-xs font-medium text-[var(--color-primary)]">
  Active
</span>

// Clickable pill
<Link className="inline-flex items-center rounded-full bg-[var(--color-background)] px-2 py-0.5 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-primary)]/10 hover:text-[var(--color-primary)]">
  Team Name
</Link>
```

## Avatar Placeholders

When showing initials instead of an image, use the primary color:

```tsx
<div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-sm font-medium">
  {name[0].toUpperCase()}
</div>
```

Note: Use Tailwind's `bg-primary` class rather than `bg-[var(--color-primary)]` for avatars, as it's more reliable in some contexts.

## Page Layout

### Standard Admin/Settings Page

```tsx
<div className="min-h-screen bg-[var(--color-background)] p-8">
  <div className="mx-auto max-w-6xl">
    {/* Header */}
    <div className="flex items-center justify-between mb-8">
      <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
        Page Title
      </h1>
      <div className="flex gap-4">
        {/* Navigation buttons */}
      </div>
    </div>

    {/* Error/Success messages */}
    {error && (
      <div className="mb-6 rounded-lg bg-[var(--color-error)]/10 p-4 text-sm text-[var(--color-error)]">
        {error}
      </div>
    )}

    {/* Content sections */}
    <div className="rounded-lg bg-[var(--color-background-secondary)] p-6 mb-6">
      {/* Section content */}
    </div>
  </div>
</div>
```

## Hover States

Use subtle background changes for hover states:

```tsx
// List item hover
className="hover:bg-[var(--color-background)]/50"

// Card hover (when clickable)
className="hover:bg-[var(--color-background-secondary)]/80"
```

## Spacing Constants

| Use Case | Padding | Margin |
|----------|---------|--------|
| Page padding | `p-8` | - |
| Card/Section padding | `p-6` | `mb-6` or `mb-8` |
| List item padding | `px-4 py-3` | - |
| Compact item padding | `px-2 py-1` | - |
| Button padding | `px-4 py-2` | - |
| Badge padding | `px-2 py-0.5` | - |

## Reference Components

When building new UI, refer to these existing components for styling patterns:

| Component | Location | Good For |
|-----------|----------|----------|
| Settings Modal | `components/SettingsModal.tsx` | Modal dialogs, form layouts |
| Team Settings | `pages/TeamSettingsPage.tsx` | Full-page settings, member lists |
| Admin Dashboard | `pages/AdminDashboardPage.tsx` | Stats cards, charts, data display |
| Admin Users | `pages/AdminUsersPage.tsx` | Data tables, search, pagination |
| Sidebar | `components/Sidebar.tsx` | Navigation, lists, collapsible sections |

## Anti-Patterns to Avoid

1. **Explicit borders on cards**: Use `bg-background-secondary` instead of `border border-[var(--color-border)]`

2. **Dark/harsh dividers**: Use `divide-[var(--color-background)]` instead of `divide-[var(--color-border)]`

3. **Bordered buttons**: Use background colors for secondary buttons

4. **CSS variable syntax for avatars**: Use Tailwind classes like `bg-primary` for avatar backgrounds

5. **Inconsistent spacing**: Follow the spacing constants above

6. **Hardcoded colors**: Always use CSS variables

## Tailwind vs CSS Variables

- **Use Tailwind classes** (`bg-primary`, `text-text-primary`) when available and working correctly
- **Use CSS variables** (`bg-[var(--color-primary)]`) when Tailwind classes don't resolve properly or for complex color manipulation
- **For avatars specifically**, prefer Tailwind classes as they're more reliable
