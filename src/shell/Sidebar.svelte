<script lang="ts">
  import { PAGES, ui, visiblePages, type QuickKind } from '../lib/ui.svelte';
  import type { ModuleId } from '../lib/types';
  import { clock, db, settings } from '../lib/store.svelte';
  import { PanelLeft, Plus, Receipt, PiggyBank, Gift, Dumbbell, Utensils, Scale, Mountain } from '../lib/icons';

  let { rail, forced = false }: { rail: boolean; forced?: boolean } = $props();

  let menuOpen = $state(false);
  let menuEl = $state<HTMLElement>();

  const main = $derived(visiblePages().filter((p) => p.id !== 'settings'));
  const settingsPage = PAGES.find((p) => p.id === 'settings')!;

  const wishReady = $derived(
    db.wishes.items.filter(
      (w) => w.status === 'waiting' && clock.now - Date.parse(w.addedAt) >= settings.v.wishCooldownHours * 3_600_000,
    ).length,
  );

  const ALL_QUICK: { kind: QuickKind; label: string; icon: typeof Plus; module: ModuleId; key?: string }[] = [
    { kind: 'spend', label: 'Log a spend', icon: Receipt, module: 'money', key: 'Ctrl E' },
    { kind: 'payday', label: 'Log payday', icon: PiggyBank, module: 'money' },
    { kind: 'meal', label: 'Log a meal', icon: Utensils, module: 'diet' },
    { kind: 'workout', label: 'Log a workout', icon: Dumbbell, module: 'fitness' },
    { kind: 'weight', label: 'Log weight', icon: Scale, module: 'fitness' },
    { kind: 'wish', label: 'Add to wishlist', icon: Gift, module: 'wishlist' },
    { kind: 'goal', label: 'New aspiration', icon: Mountain, module: 'goals' },
  ];
  const QUICK = $derived(ALL_QUICK.filter((q) => settings.has(q.module)));

  function onWindowPointer(e: PointerEvent) {
    if (menuOpen && menuEl && !menuEl.contains(e.target as Node)) menuOpen = false;
  }
</script>

<svelte:window onpointerdown={onWindowPointer} />

<nav class="sidebar" class:rail aria-label="Main">
  {#if QUICK.length}
  <div class="quick-wrap" bind:this={menuEl}>
    <button
      class="btn primary quick"
      aria-haspopup="menu"
      aria-expanded={menuOpen}
      title={rail ? 'Quick add' : undefined}
      onclick={() => (menuOpen = !menuOpen)}
    >
      <Plus size={17} strokeWidth={2.4} />
      {#if !rail}<span>Quick add</span>{/if}
    </button>
    {#if menuOpen}
      <div
        class="menu"
        role="menu"
        tabindex="-1"
        onkeydown={(e) => {
          if (e.key === 'Escape') menuOpen = false;
        }}
      >
        {#each QUICK as q (q.kind)}
          <button
            role="menuitem"
            onclick={() => {
              menuOpen = false;
              ui.open(q.kind);
            }}
          >
            <q.icon size={16} />
            <span>{q.label}</span>
            {#if q.key}<span class="kbd">{q.key}</span>{/if}
          </button>
        {/each}
      </div>
    {/if}
  </div>
  {/if}

  <ul>
    {#each main as p, i (p.id)}
      <li>
        <button
          class="item"
          class:on={ui.page === p.id}
          style:--c={p.color}
          aria-current={ui.page === p.id ? 'page' : undefined}
          title={rail ? `${p.label}  (Ctrl ${i + 1})` : `Ctrl ${i + 1}`}
          onclick={() => ui.go(p.id)}
        >
          <span class="ico"><p.icon size={18} /></span>
          {#if !rail}<span class="label">{p.label}</span>{/if}
          {#if p.id === 'wishlist' && wishReady > 0}
            <span class="badge num" title="{wishReady} ready to decide">{wishReady}</span>
          {/if}
        </button>
      </li>
    {/each}
  </ul>

  <div class="bottom">
    <button
      class="item"
      class:on={ui.page === 'settings'}
      style:--c={settingsPage.color}
      title={rail ? 'Settings  (Ctrl ,)' : 'Ctrl ,'}
      onclick={() => ui.go('settings')}
    >
      <span class="ico"><settingsPage.icon size={18} /></span>
      {#if !rail}<span class="label">Settings</span>{/if}
    </button>
    {#if !forced}
      <button
        class="item collapse"
        title={settings.v.sidebarCollapsed ? 'Expand sidebar (Ctrl B)' : 'Collapse sidebar (Ctrl B)'}
        onclick={() => settings.set({ sidebarCollapsed: !settings.v.sidebarCollapsed })}
      >
        <span class="ico"><PanelLeft size={18} /></span>
        {#if !rail}<span class="label">Collapse</span>{/if}
      </button>
    {/if}
  </div>
</nav>

<style>
  .sidebar {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 0.5rem 0.75rem 0.75rem;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
  }
  .rail {
    padding-left: 0.625rem;
    padding-right: 0.625rem;
    align-items: center;
  }
  .quick-wrap {
    position: relative;
    width: 100%;
  }
  .quick {
    width: 100%;
    height: 2.375rem;
  }
  .rail .quick {
    width: 2.75rem;
    padding: 0;
  }
  .menu {
    position: absolute;
    top: calc(100% + 0.375rem);
    left: 0;
    z-index: 50;
    width: 15rem;
    padding: 0.375rem;
    border-radius: var(--radius);
    background: var(--surface-2);
    box-shadow: var(--shadow-pop);
    display: flex;
    flex-direction: column;
    animation: drop 140ms var(--ease);
  }
  .menu button {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    height: 2.25rem;
    padding: 0 0.625rem;
    border: 0;
    border-radius: var(--radius-sm);
    background: transparent;
    text-align: left;
    color: var(--text);
    font-size: var(--fs-md);
  }
  .menu button span:first-of-type {
    flex: 1;
  }
  .menu button:hover,
  .menu button:focus-visible {
    background: var(--hover);
    outline: none;
  }
  .menu :global(svg) {
    color: var(--text-2);
  }
  @keyframes drop {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    width: 100%;
  }
  .item {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    height: 2.375rem;
    padding: 0 0.625rem;
    border: 0;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-2);
    font-size: var(--fs-md);
    font-weight: 540;
    text-align: left;
    transition: background var(--dur) var(--ease), color var(--dur) var(--ease);
  }
  .rail .item {
    width: 2.75rem;
    justify-content: center;
    padding: 0;
  }
  .item:hover {
    background: var(--hover);
    color: var(--text);
  }
  .item.on {
    background: var(--active);
    color: var(--text);
  }
  .item.on::before {
    content: '';
    position: absolute;
    left: -0.75rem;
    top: 0.5rem;
    bottom: 0.5rem;
    width: 3px;
    border-radius: 0 3px 3px 0;
    background: var(--c);
  }
  .rail .item.on::before {
    left: -0.625rem;
  }
  .ico {
    display: grid;
    place-items: center;
    flex: none;
  }
  .item.on .ico {
    color: var(--c);
  }
  .label {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .badge {
    min-width: 1.25rem;
    height: 1.25rem;
    padding: 0 0.35rem;
    border-radius: 999px;
    background: var(--c-wish);
    color: #1a0610;
    font-size: var(--fs-2xs);
    font-weight: 750;
    display: grid;
    place-items: center;
  }
  .rail .badge {
    position: absolute;
    top: 0.125rem;
    right: 0.125rem;
    min-width: 1rem;
    height: 1rem;
    padding: 0 0.25rem;
  }
  .bottom {
    margin-top: auto;
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    width: 100%;
    align-items: inherit;
  }
  .collapse {
    color: var(--text-3);
  }
</style>
