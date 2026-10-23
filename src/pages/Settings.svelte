<script lang="ts">
  import { onMount } from 'svelte';
  import PageHeader from '../lib/ui/PageHeader.svelte';
  import Segmented from '../lib/ui/Segmented.svelte';
  import MoneyInput from '../lib/ui/MoneyInput.svelte';
  import Modal from '../lib/ui/Modal.svelte';
  import { ALL_MODULES, settings } from '../lib/store.svelte';
  import { CURRENCIES } from '../lib/money';
  import { finance } from '../lib/finance.svelte';
  import { PAGES, toast } from '../lib/ui.svelte';
  import { desktop, writes } from '../lib/db';
  import { fmt } from '../lib/dates';
  import { version } from '../../package.json';
  import { Download, Upload, HardDrive, FolderOpen, Keyboard, RotateCcw, LayoutGrid } from '../lib/icons';
  import type { ModuleId, PayFrequency, Settings, Theme } from '../lib/types';

  let dataDir = $state('');
  onMount(async () => {
    if (desktop) dataDir = await desktop.dataDir();
  });

  /** Commit a whole-number setting, clamped to a sensible range. */
  function setInt(key: keyof Settings, raw: string, min: number, max: number) {
    const n = Math.round(Number(raw));
    if (!Number.isFinite(n)) return;
    settings.set({ [key]: Math.min(max, Math.max(min, n)) } as Partial<Settings>);
  }

  async function exportData() {
    try {
      await writes.flush();
      const p = await desktop!.exportData();
      if (p) toast.show(`Exported to ${p}`);
    } catch (e) {
      toast.show(`Export failed: ${e instanceof Error ? e.message : e}`, { tone: 'error' });
    }
  }

  async function importData() {
    try {
      await writes.flush();
      const ok = await desktop!.importData();
      if (ok) location.reload();
    } catch (e) {
      toast.show(`Import failed: ${e instanceof Error ? e.message : e}`, { tone: 'error' });
    }
  }

  async function backup() {
    try {
      await writes.flush();
      await desktop!.backupNow();
      toast.show('Backup saved');
    } catch (e) {
      toast.show(`Backup failed: ${e instanceof Error ? e.message : e}`, { tone: 'error' });
    }
  }

  function toggleModule(m: ModuleId, on: boolean) {
    const next = on ? ALL_MODULES.filter((x) => x === m || settings.has(x)) : settings.v.modules.filter((x) => x !== m);
    if (next.length === 0) return toast.show('Keep at least one tab switched on', { tone: 'info' });
    settings.set({ modules: next });
  }

  let confirmReset = $state(false);
  async function startOver() {
    try {
      await writes.flush();
      if (desktop) await desktop.resetData();
      else localStorage.removeItem('compass:db:v1');
      location.reload();
    } catch (e) {
      toast.show(`Couldn't start over: ${e instanceof Error ? e.message : e}`, { tone: 'error' });
    }
  }

  const SHORTCUTS: [string, string][] = [
    ['Ctrl K', 'Search and commands'],
    ['Ctrl 1 – 6', 'Go to a page'],
    ['Ctrl E', 'Log a spend'],
    ['Ctrl B', 'Collapse the sidebar'],
    ['Ctrl + / Ctrl −', 'Make everything bigger or smaller'],
    ['Ctrl 0', 'Reset size'],
    ['Ctrl ,', 'Settings'],
    ['Esc', 'Close a dialog'],
  ];
</script>

<div class="page">
  <PageHeader title="Settings" subtitle="Everything is saved on this PC as you change it." color="var(--text-2)" />

  <div class="masonry">
    <section class="card">
      <div class="card-head"><h2>You</h2></div>
      <label class="field">
        <span>Your first name</span>
        <input
          class="input"
          value={settings.v.name}
          placeholder="Used in the greeting on Home"
          maxlength="40"
          onchange={(e) => settings.set({ name: (e.currentTarget as HTMLInputElement).value.trim() })}
        />
      </label>
    </section>

    <section class="card">
      <div class="card-head"><h2>Appearance</h2></div>
      <div class="field">
        <span class="label">Theme</span>
        <Segmented
          bind:value={() => settings.v.theme, (v: Theme) => settings.set({ theme: v })}
          label="Theme"
          options={[
            { value: 'dark', label: 'Dark' },
            { value: 'light', label: 'Light' },
            { value: 'system', label: 'Match Windows' },
          ]}
        />
      </div>
      <label class="field">
        <span>Size of everything: <b class="num">{Math.round(settings.v.uiScale * 100)}%</b></span>
        <div class="row">
          <input
            class="range"
            type="range"
            min="0.8"
            max="1.4"
            step="0.05"
            value={settings.v.uiScale}
            oninput={(e) => settings.set({ uiScale: Number((e.currentTarget as HTMLInputElement).value) })}
          />
          <button class="btn sm" disabled={settings.v.uiScale === 1} onclick={() => settings.set({ uiScale: 1 })}>Reset</button>
        </div>
        <span class="hint">Ctrl + and Ctrl − do the same from anywhere.</span>
      </label>
      <label class="check">
        <input type="checkbox" checked={settings.v.sidebarCollapsed} onchange={(e) => settings.set({ sidebarCollapsed: (e.currentTarget as HTMLInputElement).checked })} />
        Compact sidebar (icons only)
      </label>
    </section>

    <section class="card">
      <div class="card-head"><LayoutGrid size={16} /><h2>Tabs</h2></div>
      <p class="small muted">Switch off what you don't use. Nothing is deleted; switch it back on any time.</p>
      <div class="list">
        {#each PAGES.filter((p) => p.id !== 'home' && p.id !== 'settings') as p (p.id)}
          <label class="list-row tab-row">
            <span class="tab-ico" style:color={p.color}><p.icon size={17} /></span>
            <span class="grow"><b>{p.label}</b><span class="xs faint block">{p.blurb}</span></span>
            <input
              type="checkbox"
              class="switch"
              checked={settings.has(p.id as ModuleId)}
              onchange={(e) => {
                const el = e.currentTarget as HTMLInputElement;
                toggleModule(p.id as ModuleId, el.checked);
                el.checked = settings.has(p.id as ModuleId);
              }}
            />
          </label>
        {/each}
      </div>
    </section>

    <section class="card">
      <div class="card-head"><h2>Pay</h2></div>
      <label class="field">
        <span>Currency</span>
        <select class="select" value={settings.v.currency} onchange={(e) => settings.set({ currency: (e.currentTarget as HTMLSelectElement).value })}>
          {#each CURRENCIES as c (c.code)}<option value={c.code}>{c.label}</option>{/each}
        </select>
        <span class="hint">Only changes how amounts are shown; numbers aren't converted.</span>
      </label>
      <div class="fields">
        <label class="field">
          <span>Paycheck (after tax)</span>
          <MoneyInput bind:value={() => settings.v.payAmount, (v) => v !== null && settings.set({ payAmount: v })} />
        </label>
        <label class="field">
          <span>Paid</span>
          <select
            class="select"
            value={settings.v.payFrequency}
            onchange={(e) => settings.set({ payFrequency: (e.currentTarget as HTMLSelectElement).value as PayFrequency })}
          >
            <option value="weekly">Every week</option>
            <option value="biweekly">Every 2 weeks</option>
            <option value="monthly">Every month</option>
          </select>
        </label>
      </div>
      <label class="field">
        <span>A payday (your last one or next one)</span>
        <input
          class="input"
          type="date"
          value={settings.v.payAnchor ?? ''}
          onchange={(e) => settings.set({ payAnchor: (e.currentTarget as HTMLInputElement).value || null })}
        />
        <span class="hint">
          {#if settings.v.payAnchor}
            This pay period: {fmt.short(finance.period.start)} – {fmt.short(finance.period.next)}. Next payday {fmt.relative(finance.period.next)}.
          {:else}
            Not set yet. Until it is, pay periods start today.
          {/if}
        </span>
      </label>
    </section>

    <section class="card">
      <div class="card-head"><h2>Savings goal</h2></div>
      <label class="field">
        <span>Name</span>
        <input
          class="input"
          value={settings.v.goalName}
          maxlength="40"
          onchange={(e) => settings.set({ goalName: (e.currentTarget as HTMLInputElement).value.trim() || 'Savings goal' })}
        />
      </label>
      <div class="fields">
        <label class="field">
          <span>Target</span>
          <MoneyInput bind:value={() => settings.v.goalTarget, (v) => v !== null && v > 0 && settings.set({ goalTarget: v })} />
        </label>
        <label class="field">
          <span>Emergency buffer</span>
          <MoneyInput bind:value={() => settings.v.emergencyBuffer, (v) => v !== null && settings.set({ emergencyBuffer: v })} />
        </label>
      </div>
      <p class="hint xs faint">How much you save each payday is set by the Savings line in Money › Paycheck plan.</p>
    </section>

    <section class="card">
      <div class="card-head"><h2>Targets and rules</h2></div>
      <div class="fields">
        <label class="field">
          <span>Calories a day</span>
          <input class="input num" type="number" min="800" max="8000" step="50" value={settings.v.kcalTarget} onchange={(e) => setInt('kcalTarget', (e.currentTarget as HTMLInputElement).value, 800, 8000)} />
        </label>
        <label class="field">
          <span>Protein a day (g)</span>
          <input class="input num" type="number" min="0" max="500" step="5" value={settings.v.proteinTarget} onchange={(e) => setInt('proteinTarget', (e.currentTarget as HTMLInputElement).value, 0, 500)} />
        </label>
        <label class="field">
          <span>Glasses of water</span>
          <input class="input num" type="number" min="1" max="20" value={settings.v.waterTarget} onchange={(e) => setInt('waterTarget', (e.currentTarget as HTMLInputElement).value, 1, 20)} />
        </label>
        <label class="field">
          <span>Workouts a week</span>
          <input class="input num" type="number" min="1" max="14" value={settings.v.workoutsPerWeek} onchange={(e) => setInt('workoutsPerWeek', (e.currentTarget as HTMLInputElement).value, 1, 14)} />
        </label>
        <label class="field">
          <span>Takeouts per paycheck</span>
          <input class="input num" type="number" min="0" max="20" value={settings.v.takeoutCap} onchange={(e) => setInt('takeoutCap', (e.currentTarget as HTMLInputElement).value, 0, 20)} />
        </label>
        <label class="field">
          <span>Wishlist wait (hours)</span>
          <input class="input num" type="number" min="1" max="720" value={settings.v.wishCooldownHours} onchange={(e) => setInt('wishCooldownHours', (e.currentTarget as HTMLInputElement).value, 1, 720)} />
        </label>
      </div>
    </section>

    <section class="card">
      <div class="card-head"><HardDrive size={16} /><h2>Your data</h2></div>
      {#if desktop}
        <p class="small muted">
          Everything lives in one file on this PC. A backup is made automatically each day (the last 14 are kept).
        </p>
        {#if dataDir}<code class="path">{dataDir}</code>{/if}
        <div class="row wrap">
          <button class="btn" onclick={exportData}><Download size={15} /> Export</button>
          <button class="btn" onclick={importData}><Upload size={15} /> Import</button>
          <button class="btn" onclick={backup}><HardDrive size={15} /> Back up now</button>
          <button class="btn ghost" onclick={() => desktop?.openDataFolder()}><FolderOpen size={15} /> Open folder</button>
        </div>
      {:else}
        <p class="small muted">
          You're viewing Compass in a browser preview, so data is kept in this browser only. Run the desktop app for the real database, backups and export.
        </p>
      {/if}
      <hr class="divider" />
      <div class="spread">
        <span class="small muted">Wipe everything and run first-time setup again.</span>
        <button class="btn danger sm" onclick={() => (confirmReset = true)}><RotateCcw size={14} /> Start over</button>
      </div>
    </section>

    <section class="card">
      <div class="card-head"><Keyboard size={16} /><h2>Keyboard shortcuts</h2></div>
      <div class="list">
        {#each SHORTCUTS as [keys, what] (keys)}
          <div class="list-row small"><span class="grow muted">{what}</span><span class="kbd">{keys}</span></div>
        {/each}
      </div>
    </section>
  </div>

  <p class="xs faint about">
    Compass {version} · Svelte, Electron and SQLite · stored only on this PC
  </p>
</div>

<Modal bind:open={confirmReset} title="Start over?" subtitle="Everything in Compass is cleared and setup runs again.">
  <p class="small">
    {desktop ? 'A backup is saved first, so you can get it all back from the backups folder with Import.' : 'This browser preview has no backups.'}
  </p>
  <div class="form-actions">
    <button class="btn ghost" onclick={() => (confirmReset = false)}>Cancel</button>
    <button class="btn primary" onclick={startOver}>Start over</button>
  </div>
</Modal>

<style>
  .tab-row {
    cursor: pointer;
    gap: 0.75rem;
  }
  .tab-ico {
    width: 2rem;
    height: 2rem;
    display: grid;
    place-items: center;
    border-radius: var(--radius-sm);
    background: var(--surface-2);
    flex: none;
  }
  .block {
    display: block;
  }
  .switch {
    appearance: none;
    width: 2.25rem;
    height: 1.25rem;
    border-radius: 999px;
    background: var(--surface-3);
    position: relative;
    cursor: pointer;
    flex: none;
    transition: background var(--dur) var(--ease);
  }
  .switch::after {
    content: '';
    position: absolute;
    top: 0.1875rem;
    left: 0.1875rem;
    width: 0.875rem;
    height: 0.875rem;
    border-radius: 50%;
    background: var(--text-2);
    transition: transform var(--dur) var(--ease), background var(--dur) var(--ease);
  }
  .switch:checked {
    background: var(--accent);
  }
  .switch:checked::after {
    transform: translateX(1rem);
    background: var(--accent-ink);
  }
  .masonry {
    columns: 24rem 3;
    column-gap: 1rem;
  }
  .masonry > :global(.card) {
    break-inside: avoid;
    margin-bottom: 1rem;
  }
  .range {
    flex: 1;
    accent-color: var(--accent);
  }
  .path {
    font-size: var(--fs-xs);
    padding: 0.375rem 0.5rem;
    border-radius: var(--radius-xs);
    background: var(--surface-2);
    color: var(--text-2);
    user-select: text;
    overflow-wrap: anywhere;
  }
  .about {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }
</style>
