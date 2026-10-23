<!-- The window's top strip. It is a drag handle for moving the window; Windows draws the
     minimise / maximise / close buttons on the right (Electron title bar overlay). -->
<script lang="ts">
  import { ui, PAGES } from '../lib/ui.svelte';
  import { Search } from '../lib/icons';
  import logo from '../assets/compass.svg';

  /** During install and setup there is nothing to search yet. */
  let { minimal = false }: { minimal?: boolean } = $props();

  const current = $derived(PAGES.find((p) => p.id === ui.page));
</script>

<header class="titlebar">
  <div class="brand">
    <img src={logo} alt="" width="18" height="18" />
    <span>Compass</span>
    {#if !minimal && current && current.id !== 'home'}
      <span class="sep">/</span><span class="crumb">{current.label}</span>
    {/if}
  </div>
  {#if minimal}
    <span></span>
  {:else}
    <button class="search" onclick={() => (ui.palette = true)} aria-label="Search and commands (Ctrl+K)">
      <Search size={14} />
      <span class="ph">Search or jump to…</span>
      <span class="kbd">Ctrl K</span>
    </button>
  {/if}
  <div class="controls-space"></div>
</header>

<style>
  .titlebar {
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: 1fr minmax(10rem, 26rem) 1fr;
    align-items: center;
    gap: 1rem;
    height: var(--titlebar-h);
    padding-left: 1rem;
    /* Leave room for the native window buttons. */
    padding-right: max(140px, calc(100vw - env(titlebar-area-x, 0px) - env(titlebar-area-width, 100vw)));
    -webkit-app-region: drag;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: var(--fs-sm);
    font-weight: 640;
    color: var(--text);
    min-width: 0;
    white-space: nowrap;
  }
  .brand img {
    border-radius: 4px;
  }
  .sep {
    color: var(--text-3);
    font-weight: 400;
  }
  .crumb {
    color: var(--text-2);
    font-weight: 520;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .search {
    -webkit-app-region: no-drag;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    height: 1.75rem;
    padding: 0 0.375rem 0 0.625rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text-3);
    font-size: var(--fs-sm);
    min-width: 0;
    transition: border-color var(--dur) var(--ease), color var(--dur) var(--ease);
  }
  .search:hover {
    border-color: var(--border-strong);
    color: var(--text-2);
  }
  .ph {
    flex: 1;
    text-align: left;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  @media (max-width: 640px) {
    .titlebar {
      grid-template-columns: auto 1fr 0;
    }
    .crumb,
    .sep {
      display: none;
    }
    .kbd {
      display: none;
    }
  }
</style>
