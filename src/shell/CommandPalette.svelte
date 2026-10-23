<!-- Ctrl+K: type to jump anywhere or do anything. -->
<script lang="ts">
  import type { Component } from 'svelte';
  import { PAGES, ui, toast, visiblePages, type QuickKind } from '../lib/ui.svelte';
  import type { ModuleId } from '../lib/types';
  import { settings } from '../lib/store.svelte';
  import { desktop } from '../lib/db';
  import {
    ArrowRight, Receipt, PiggyBank, Gift, Dumbbell, Utensils, Scale, Mountain, Moon, PanelLeft, Download, Search,
  } from '../lib/icons';

  interface Cmd {
    id: string;
    label: string;
    hint: string;
    group: 'Go to' | 'Add' | 'App';
    icon: Component<{ size?: number }>;
    keys?: string;
    /** Only offered when this tab is switched on. */
    module?: ModuleId;
    run: () => void;
  }

  let query = $state('');
  let active = $state(0);
  let input = $state<HTMLInputElement>();
  let dlg: HTMLDialogElement;

  const quick = (kind: QuickKind) => () => ui.open(kind);
  const sub = (page: 'money', tab: string) => () => {
    ui.tabs[page] = tab;
    ui.go(page);
  };

  const commands: Cmd[] = [
    ...PAGES.map((p) => ({
      id: `go-${p.id}`,
      label: p.label,
      hint: p.blurb,
      group: 'Go to' as const,
      icon: p.icon,
      module: p.id === 'home' || p.id === 'settings' ? undefined : (p.id as ModuleId),
      run: () => ui.go(p.id),
    })),
    { id: 'go-money-spending', module: 'money', label: 'Money › Spending', hint: 'This pay period and every spend', group: 'Go to', icon: ArrowRight, run: sub('money', 'spending') },
    { id: 'go-money-plan', module: 'money', label: 'Money › Paycheck plan', hint: 'How each paycheck is split', group: 'Go to', icon: ArrowRight, run: sub('money', 'plan') },
    { id: 'go-money-bills', module: 'money', label: 'Money › Bills', hint: 'Monthly bills and subscriptions', group: 'Go to', icon: ArrowRight, run: sub('money', 'bills') },
    { id: 'go-money-playbook', module: 'money', label: 'Money › Playbook', hint: 'Your rules for weak spots', group: 'Go to', icon: ArrowRight, run: sub('money', 'playbook') },
    { id: 'add-spend', module: 'money', label: 'Log a spend', hint: 'Coffee, groceries, a game…', group: 'Add', icon: Receipt, keys: 'Ctrl E', run: quick('spend') },
    { id: 'add-payday', module: 'money', label: 'Log payday', hint: 'Move savings into your goal', group: 'Add', icon: PiggyBank, run: quick('payday') },
    { id: 'add-meal', module: 'diet', label: 'Log a meal', hint: 'Calories, protein, takeout', group: 'Add', icon: Utensils, run: quick('meal') },
    { id: 'add-workout', module: 'fitness', label: 'Log a workout', hint: 'Type, minutes, effort', group: 'Add', icon: Dumbbell, run: quick('workout') },
    { id: 'add-weight', module: 'fitness', label: 'Log weight', hint: 'Body weight in kg', group: 'Add', icon: Scale, run: quick('weight') },
    { id: 'add-wish', module: 'wishlist', label: 'Add to wishlist', hint: 'Starts the 72-hour wait', group: 'Add', icon: Gift, run: quick('wish') },
    { id: 'add-goal', module: 'goals', label: 'New aspiration', hint: 'A goal with steps', group: 'Add', icon: Mountain, run: quick('goal') },
    {
      id: 'app-theme',
      label: 'Switch light / dark',
      hint: 'Change the colour theme',
      group: 'App',
      icon: Moon,
      run: () => settings.set({ theme: document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark' }),
    },
    {
      id: 'app-sidebar',
      label: 'Collapse / expand sidebar',
      hint: 'More room for content',
      group: 'App',
      icon: PanelLeft,
      keys: 'Ctrl B',
      run: () => settings.set({ sidebarCollapsed: !settings.v.sidebarCollapsed }),
    },
    {
      id: 'app-export',
      label: 'Export all data',
      hint: 'Save a JSON copy of everything',
      group: 'App',
      icon: Download,
      run: async () => {
        if (!desktop) return toast.show('Export works in the desktop app', { tone: 'info' });
        const p = await desktop.exportData();
        if (p) toast.show('Exported your data');
      },
    },
  ];

  /** Subsequence match with a bonus for word starts. Returns -1 when it doesn't match. */
  function score(text: string, q: string): number {
    if (!q) return 0;
    const t = text.toLowerCase();
    let ti = 0;
    let s = 0;
    for (const ch of q.toLowerCase()) {
      const found = t.indexOf(ch, ti);
      if (found < 0) return -1;
      s += found === ti ? 3 : 1;
      if (found === 0 || /[\s›/-]/.test(t[found - 1])) s += 4;
      ti = found + 1;
    }
    return s - t.length * 0.02;
  }

  // Page shortcuts follow the order of the pages that are switched on.
  const keysFor = (id: string): string | undefined => {
    if (id === 'go-settings') return 'Ctrl ,';
    const nav = visiblePages().filter((p) => p.id !== 'settings');
    const i = nav.findIndex((p) => `go-${p.id}` === id);
    return i >= 0 && i < 9 ? `Ctrl ${i + 1}` : undefined;
  };

  const available = $derived(
    commands
      .filter((c) => !c.module || settings.has(c.module))
      .map((c) => (c.id.startsWith('go-') && !c.id.startsWith('go-money-') ? { ...c, keys: keysFor(c.id) } : c)),
  );

  const results = $derived.by(() => {
    const q = query.trim();
    if (!q) return available;
    return available
      .map((c) => ({ c, s: Math.max(score(c.label, q), score(c.hint, q) - 4) }))
      .filter((x) => x.s >= 0)
      .sort((a, b) => b.s - a.s)
      .map((x) => x.c);
  });

  $effect(() => {
    void results;
    active = 0;
  });

  $effect(() => {
    if (ui.palette && !dlg.open) {
      query = '';
      dlg.showModal();
      requestAnimationFrame(() => input?.focus());
    } else if (!ui.palette && dlg.open) {
      dlg.close();
    }
  });

  function run(c: Cmd | undefined) {
    if (!c) return;
    ui.palette = false;
    c.run();
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      active = (active + 1) % Math.max(1, results.length);
      scrollActive();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      active = (active - 1 + results.length) % Math.max(1, results.length);
      scrollActive();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      run(results[active]);
    }
  }

  function scrollActive() {
    requestAnimationFrame(() => dlg.querySelector('.on')?.scrollIntoView({ block: 'nearest' }));
  }
</script>

<dialog
  bind:this={dlg}
  class="palette"
  onclose={() => (ui.palette = false)}
  onclick={(e) => {
    if (e.target === dlg) ui.palette = false;
  }}
>
  <div class="box">
    <div class="search">
      <Search size={17} />
      <input
        bind:this={input}
        bind:value={query}
        {onkeydown}
        placeholder="Jump to a page or run a command…"
        aria-label="Command"
        role="combobox"
        aria-expanded="true"
        aria-controls="palette-list"
        spellcheck="false"
      />
      <span class="kbd">Esc</span>
    </div>
    <div class="list" id="palette-list" role="listbox">
      {#each results as c, i (c.id)}
        {#if i === 0 || (!query && results[i - 1].group !== c.group)}
          <div class="group">{query ? 'Results' : c.group}</div>
        {/if}
        <button
          role="option"
          aria-selected={i === active}
          class:on={i === active}
          onmousemove={() => (active = i)}
          onclick={() => run(c)}
        >
          <span class="ico"><c.icon size={16} /></span>
          <span class="text">
            <span class="label">{c.label}</span>
            <span class="hint">{c.hint}</span>
          </span>
          {#if c.keys}<span class="kbd">{c.keys}</span>{/if}
        </button>
      {:else}
        <p class="none muted small">Nothing matches “{query}”.</p>
      {/each}
    </div>
  </div>
</dialog>

<style>
  .palette {
    padding: 0;
    border: 0;
    background: transparent;
    width: min(38rem, calc(100vw - 2rem));
    margin-top: 12vh;
    color: inherit;
  }
  .palette[open] {
    animation: pop 140ms var(--ease);
  }
  .palette::backdrop {
    background: var(--scrim);
  }
  .box {
    background: var(--surface);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-pop);
    overflow: hidden;
  }
  .search {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0 1rem;
    border-bottom: 1px solid var(--border);
    color: var(--text-3);
  }
  input {
    flex: 1;
    height: 3.25rem;
    border: 0;
    background: transparent;
    color: var(--text);
    font: inherit;
    font-size: var(--fs-lg);
    outline: none;
  }
  input::placeholder {
    color: var(--text-3);
  }
  .list {
    max-height: min(26rem, 60vh);
    overflow-y: auto;
    padding: 0.375rem;
  }
  .group {
    padding: 0.625rem 0.625rem 0.25rem;
    font-size: var(--fs-2xs);
    font-weight: 650;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-3);
  }
  button {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    padding: 0.5rem 0.625rem;
    border: 0;
    border-radius: var(--radius-sm);
    background: transparent;
    text-align: left;
  }
  button.on {
    background: var(--active);
  }
  .ico {
    width: 2rem;
    height: 2rem;
    border-radius: var(--radius-sm);
    background: var(--surface-2);
    display: grid;
    place-items: center;
    color: var(--text-2);
    flex: none;
  }
  .on .ico {
    color: var(--accent);
  }
  .text {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .label {
    font-weight: 560;
  }
  .hint {
    font-size: var(--fs-xs);
    color: var(--text-3);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .none {
    padding: 1.5rem;
    text-align: center;
  }
  @keyframes pop {
    from {
      opacity: 0;
      transform: scale(0.985);
    }
  }
</style>
