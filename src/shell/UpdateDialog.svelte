<!-- "A new version is available" → download, verify, restart into it. -->
<script lang="ts">
  import Modal from '../lib/ui/Modal.svelte';
  import { updates } from '../lib/updates.svelte';
  import { desktop } from '../lib/db';
  import { ExternalLink, Download, CircleAlert, CircleCheck } from '../lib/icons';

  const info = $derived(updates.info);
  const busy = $derived(updates.status === 'downloading');
  const lines = $derived(
    (info?.notes ?? '')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean),
  );
  const mb = $derived(info?.size ? Math.round(info.size / 1024 / 1024) : 0);
</script>

<Modal
  bind:open={() => updates.open, (v) => {
    if (!busy) updates.open = v;
  }}
  title={info?.available ? `Compass ${info.version} is available` : 'Updates'}
  subtitle={info?.available ? `You have ${info.current}.` : ''}
>
  {#if busy}
    <div class="stack">
      <div class="bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(updates.progress * 100)}>
        <div style:width="{updates.progress * 100}%"></div>
      </div>
      <p class="small muted num">{updates.label} · {Math.round(updates.progress * 100)}%</p>
      <p class="xs faint">Compass closes and reopens by itself when the update is ready. Your data stays as it is.</p>
    </div>
  {:else if info?.available}
    {#if lines.length}
      <div class="notes">
        <span class="label xs">What's new</span>
        <ul>
          {#each lines as l, i (i)}
            {#if /^[-*]\s+/.test(l)}<li>{l.replace(/^[-*]\s+/, '')}</li>{:else}<li class="plain">{l.replace(/^#+\s*/, '')}</li>{/if}
          {/each}
        </ul>
      </div>
    {/if}
    {#if info.pageUrl}
      <button class="link small" onclick={() => desktop?.openExternal(info.pageUrl!)}><ExternalLink size={13} /> See the release on GitHub</button>
    {/if}
    {#if updates.status === 'error'}
      <div class="callout danger"><CircleAlert size={16} /> <span>{updates.error}</span></div>
    {/if}
    {#if !info.canInstall}
      <p class="callout">This is a development copy, so updates install only in the installed app.</p>
    {/if}
    <p class="xs faint">
      {mb ? `About ${mb} MB. ` : ''}Downloaded from GitHub and checked against its published checksum before installing.
    </p>
    <div class="form-actions">
      <button class="btn ghost" onclick={() => (updates.open = false)}>Later</button>
      <!-- svelte-ignore a11y_autofocus -->
      <button class="btn primary" autofocus disabled={!info.canInstall} onclick={() => updates.install()}><Download size={16} /> Update now</button>
    </div>
  {:else if updates.status === 'error'}
    <div class="callout danger"><CircleAlert size={16} /> <span>Couldn't check for updates: {updates.error}</span></div>
    <div class="form-actions"><button class="btn" onclick={() => updates.check(true)}>Try again</button></div>
  {:else}
    <div class="callout good"><CircleCheck size={16} /> <span>You're on the latest version{info ? ` (${info.current})` : ''}.</span></div>
    <div class="form-actions"><button class="btn" onclick={() => (updates.open = false)}>Close</button></div>
  {/if}
</Modal>

<style>
  .bar {
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
  .notes {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    padding: 0.75rem 0.875rem;
    border-radius: var(--radius-sm);
    background: var(--surface-2);
    max-height: 14rem;
    overflow-y: auto;
  }
  .notes .label {
    font-weight: 650;
    color: var(--text-2);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  ul {
    margin: 0;
    padding-left: 1.1rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: var(--fs-sm);
  }
  li.plain {
    list-style: none;
    margin-left: -1.1rem;
    color: var(--text-2);
  }
  .link {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    border: 0;
    background: none;
    padding: 0;
    color: var(--accent);
  }
  .link:hover {
    text-decoration: underline;
  }
</style>
