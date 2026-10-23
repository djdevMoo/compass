<!-- Shown when Compass.exe runs from a download folder: installs Compass for this Windows user. -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { desktop, type InstallInfo } from '../lib/db';
  import { ArrowRight, Check, CircleAlert, FolderOpen } from '../lib/icons';
  import logo from '../assets/compass.svg';

  let info = $state<InstallInfo | null>(null);
  let phase = $state<'ready' | 'installing' | 'done' | 'error'>('ready');
  let progress = $state(0);
  let label = $state('');
  let error = $state('');
  let desktopShortcut = $state(true);

  onMount(async () => {
    info = desktop
      ? await desktop.installInfo()
      : { mode: 'install', version: '0.0.0-preview', installedVersion: null, installDir: 'C:\\Users\\you\\AppData\\Local\\Programs\\Compass' };
    desktop?.onInstallProgress((p, l) => {
      progress = p;
      label = l;
    });
  });

  const updating = $derived(!!info?.installedVersion);
  const title = $derived(
    !info ? '' : !updating ? 'Install Compass' : info.installedVersion === info.version ? 'Reinstall Compass' : 'Update Compass',
  );

  async function run() {
    phase = 'installing';
    progress = 0;
    error = '';
    try {
      if (desktop) await desktop.install({ desktopShortcut });
      else for (let i = 1; i <= 20; i++) await new Promise((r) => setTimeout(r, 60)).then(() => ((progress = i / 20), (label = 'Copying files')));
      progress = 1;
      phase = 'done';
    } catch (e) {
      error = e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : String(e);
      phase = 'error';
    }
  }
</script>

<div class="wrap">
  <div class="panel">
    <img class="logo" src={logo} alt="" width="72" height="72" />

    {#if !info}
      <p class="muted">Getting ready…</p>
    {:else if phase === 'ready' || phase === 'error'}
      <h1>{title}</h1>
      <p class="muted lead">
        {#if !updating}
          Your money, food, fitness and goals in one place. Compass installs just for you, with no admin rights needed, and keeps everything on this PC.
        {:else if info.installedVersion === info.version}
          Version {info.version} is already installed. Reinstalling keeps all your data.
        {:else}
          Version {info.installedVersion} is installed. This updates it to {info.version} and keeps all your data.
        {/if}
      </p>

      <div class="details">
        <div class="row small muted"><FolderOpen size={15} /> <span class="truncate" title={info.installDir}>{info.installDir}</span></div>
        <label class="check"><input type="checkbox" bind:checked={desktopShortcut} /> Add a shortcut to the Desktop</label>
        <p class="xs faint">It always goes in the Start menu, and shows up in Settings › Apps so you can uninstall it like any other app.</p>
      </div>

      {#if phase === 'error'}
        <div class="callout danger"><CircleAlert size={16} /> <span>{error}</span></div>
      {/if}

      <button class="btn primary big" onclick={run}>
        {updating ? (info.installedVersion === info.version ? 'Reinstall' : 'Update') : 'Install'}
        <ArrowRight size={17} />
      </button>
      <p class="xs faint">Version {info.version}</p>
    {:else if phase === 'installing'}
      <h1>{updating ? 'Updating…' : 'Installing…'}</h1>
      <div class="bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
        <div style:width="{progress * 100}%"></div>
      </div>
      <p class="small muted num">{label} · {Math.round(progress * 100)}%</p>
    {:else}
      <div class="done-badge"><Check size={28} strokeWidth={3} /></div>
      <h1>{updating ? 'Compass is up to date' : 'Compass is installed'}</h1>
      <p class="muted lead">
        {updating ? 'Everything you had is still there.' : 'Next, a few quick questions so Compass can set itself up around you.'}
        You’ll find it in the Start menu{desktopShortcut ? ' and on your Desktop' : ''}.
      </p>
      <button class="btn primary big" onclick={() => desktop?.launchInstalled()}>Open Compass <ArrowRight size={17} /></button>
      <p class="xs faint">You can delete the downloaded folder now.</p>
    {/if}
  </div>
</div>

<style>
  .wrap {
    grid-column: 1 / -1;
    grid-row: 2;
    display: grid;
    place-items: center;
    padding: 1.5rem 1rem 2rem;
    overflow-y: auto;
    background:
      radial-gradient(50rem 26rem at 50% 0%, color-mix(in srgb, var(--accent) 10%, transparent), transparent 70%),
      var(--bg);
  }
  .panel {
    width: min(30rem, 100%);
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 1rem;
  }
  .logo {
    filter: drop-shadow(0 12px 28px rgb(0 0 0 / 0.45));
    margin-bottom: 0.25rem;
  }
  h1 {
    font-size: clamp(1.6rem, 1.2rem + 1.4vw, 2.1rem);
  }
  .lead {
    font-size: var(--fs-lg);
    line-height: 1.5;
  }
  .details {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    align-items: flex-start;
    text-align: left;
    padding: 1rem;
    border-radius: var(--radius);
    background: var(--surface);
    border: 1px solid var(--border);
  }
  .details .row {
    max-width: 100%;
  }
  .callout {
    width: 100%;
    text-align: left;
  }
  .big {
    height: 2.875rem;
    padding: 0 1.75rem;
    font-size: var(--fs-lg);
    min-width: 12rem;
  }
  .bar {
    width: 100%;
    height: 0.5rem;
    border-radius: 999px;
    background: var(--track);
    overflow: hidden;
  }
  .bar div {
    height: 100%;
    border-radius: 999px;
    background: var(--accent);
    transition: width 120ms linear;
  }
  .done-badge {
    width: 3.5rem;
    height: 3.5rem;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--accent);
    color: var(--accent-ink);
    animation: pop 300ms var(--ease);
  }
  @keyframes pop {
    from {
      transform: scale(0.6);
      opacity: 0;
    }
  }
</style>
