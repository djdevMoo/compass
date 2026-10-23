<script lang="ts">
  import { onMount } from 'svelte';
  import { boot, clock, settings } from './lib/store.svelte';
  import { toast, ui, visiblePages, type PageId } from './lib/ui.svelte';
  import { desktop, writes } from './lib/db';
  import Titlebar from './shell/Titlebar.svelte';
  import Sidebar from './shell/Sidebar.svelte';
  import CommandPalette from './shell/CommandPalette.svelte';
  import QuickAdd from './shell/QuickAdd.svelte';
  import Toasts from './lib/ui/Toasts.svelte';
  import Home from './pages/Home.svelte';
  import Money from './pages/money/Money.svelte';
  import Wishlist from './pages/Wishlist.svelte';
  import Goals from './pages/Goals.svelte';
  import Fitness from './pages/Fitness.svelte';
  import Diet from './pages/Diet.svelte';
  import SettingsPage from './pages/Settings.svelte';
  import Setup from './setup/Setup.svelte';
  import Installer from './setup/Installer.svelte';

  // What the window is showing: the installer, first-run setup, or the app itself.
  const mode = new URLSearchParams(location.search).get('mode') === 'install' ? 'install' : 'app';
  let phase = $state<'loading' | 'install' | 'setup' | 'app' | 'error'>(mode === 'install' ? 'install' : 'loading');
  const ready = $derived(phase === 'app');
  let failed = $state<string | null>(null);
  let width = $state(window.innerWidth);
  let systemDark = $state(window.matchMedia('(prefers-color-scheme: dark)').matches);

  const rail = $derived(width < 920 || settings.v.sidebarCollapsed);
  const theme = $derived(settings.v.theme === 'system' ? (systemDark ? 'dark' : 'light') : settings.v.theme);

  onMount(() => {
    let retry: ReturnType<typeof setTimeout> | null = null;
    writes.onError = (e) => {
      console.error(e);
      toast.show("Couldn't save your last change. Retrying…", { tone: 'error' });
      retry ??= setTimeout(() => {
        retry = null;
        void writes.flush();
      }, 2000);
    };
    desktop?.onFlushRequest(() => writes.flush());

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onScheme = () => (systemDark = mq.matches);
    mq.addEventListener('change', onScheme);

    if (mode !== 'install') {
      boot()
        .then((needsSetup) => {
          clock.start();
          if (needsSetup) phase = 'setup';
          else openApp();
        })
        .catch((e) => {
          console.error(e);
          failed = e instanceof Error ? e.message : String(e);
          phase = 'error';
        });
    }

    return () => mq.removeEventListener('change', onScheme);
  });

  function openApp() {
    const last = settings.v.lastPage as PageId;
    ui.page = visiblePages().some((p) => p.id === last) ? last : 'home';
    phase = 'app';
  }

  $effect(() => {
    document.documentElement.dataset.theme = theme;
    void desktop?.setTheme(settings.v.theme, theme);
  });

  $effect(() => {
    document.documentElement.style.setProperty('--ui-scale', String(settings.v.uiScale));
  });

  const clampScale = (s: number) => Math.round(Math.min(1.4, Math.max(0.8, s)) * 100) / 100;

  function onkeydown(e: KeyboardEvent) {
    if (!ready) return;
    const mod = e.ctrlKey || e.metaKey;
    const modalOpen = !!document.querySelector('dialog[open]');
    if (!mod || e.altKey) return;
    const k = e.key.toLowerCase();

    if (k === 'k' || (k === 'f' && !modalOpen)) {
      e.preventDefault();
      ui.palette = !ui.palette;
      return;
    }
    if (k === '=' || k === '+') {
      e.preventDefault();
      settings.set({ uiScale: clampScale(settings.v.uiScale + 0.05) });
      return;
    }
    if (k === '-') {
      e.preventDefault();
      settings.set({ uiScale: clampScale(settings.v.uiScale - 0.05) });
      return;
    }
    if (k === '0') {
      e.preventDefault();
      settings.set({ uiScale: 1 });
      return;
    }
    if (modalOpen || ui.palette) return;
    const nav = visiblePages().filter((p) => p.id !== 'settings');
    if (/^[1-9]$/.test(k) && Number(k) <= nav.length) {
      e.preventDefault();
      ui.go(nav[Number(k) - 1].id);
    } else if (k === ',') {
      e.preventDefault();
      ui.go('settings');
    } else if (k === 'b') {
      e.preventDefault();
      settings.set({ sidebarCollapsed: !settings.v.sidebarCollapsed });
    } else if (k === 'e') {
      e.preventDefault();
      ui.open('spend');
    } else if (k === 'p' || k === 'u' || k === 'r' || k === 's') {
      // Swallow browser shortcuts (print, view source, reload, save) that make no sense here.
      e.preventDefault();
    }
  }

</script>

<svelte:window bind:innerWidth={width} {onkeydown} />

<div class="shell" class:rail>
  <Titlebar minimal={!ready} />
  {#if phase === 'install'}
    <Installer />
  {:else if phase === 'setup'}
    <Setup ondone={openApp} />
  {:else if ready}
    <Sidebar {rail} forced={width < 920} />
    <main>
      {#key `${ui.page}:${settings.v.currency}`}
        <div class="page-wrap">
          {#if ui.page === 'home'}<Home />
          {:else if ui.page === 'money'}<Money />
          {:else if ui.page === 'wishlist'}<Wishlist />
          {:else if ui.page === 'goals'}<Goals />
          {:else if ui.page === 'fitness'}<Fitness />
          {:else if ui.page === 'diet'}<Diet />
          {:else if ui.page === 'settings'}<SettingsPage />
          {/if}
        </div>
      {/key}
    </main>
    <CommandPalette />
    <QuickAdd />
  {:else if failed}
    <div class="boot-error">
      <h2>Compass couldn't open its data</h2>
      <p class="muted">{failed}</p>
      <button class="btn" onclick={() => location.reload()}>Try again</button>
    </div>
  {/if}
</div>
<Toasts />

<style>
  .shell {
    display: grid;
    grid-template-columns: var(--sidebar-w) minmax(0, 1fr);
    grid-template-rows: var(--titlebar-h) minmax(0, 1fr);
    height: 100vh;
    background: var(--bg-sidebar);
    transition: grid-template-columns 200ms var(--ease);
  }
  .shell.rail {
    grid-template-columns: var(--rail-w) minmax(0, 1fr);
  }
  main {
    overflow-y: auto;
    overflow-x: hidden;
    background: var(--bg);
    border-top-left-radius: var(--radius-lg);
    border-top: 1px solid var(--border);
    border-left: 1px solid var(--border);
    scrollbar-gutter: stable;
  }
  .page-wrap {
    animation: enter 220ms var(--ease);
  }
  @keyframes enter {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
  }
  .boot-error {
    grid-column: 1 / -1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    text-align: center;
    padding: 2rem;
  }
</style>
