<script lang="ts">
  import { toast } from '../ui.svelte';
  import { CircleCheck, CircleAlert, Info, X } from '../icons';
  import { fly } from 'svelte/transition';
</script>

<div class="toasts" aria-live="polite">
  {#each toast.list as t (t.id)}
    <div class="toast {t.tone}" in:fly={{ y: 12, duration: 180 }} out:fly={{ y: 8, duration: 140 }}>
      {#if t.tone === 'error'}<CircleAlert size={16} />{:else if t.tone === 'info'}<Info size={16} />{:else}<CircleCheck size={16} />{/if}
      <span class="msg">{t.message}</span>
      {#if t.action}
        <button
          class="act"
          onclick={() => {
            t.action?.run();
            toast.dismiss(t.id);
          }}>{t.action.label}</button>
      {/if}
      <button class="close" aria-label="Dismiss" onclick={() => toast.dismiss(t.id)}><X size={14} /></button>
    </div>
  {/each}
</div>

<style>
  .toasts {
    position: fixed;
    bottom: 1.25rem;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    z-index: 1000;
    pointer-events: none;
    width: max-content;
    max-width: calc(100vw - 2rem);
  }
  .toast {
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.5rem 0.5rem 0.5rem 0.875rem;
    border-radius: var(--radius);
    background: var(--surface-3);
    color: var(--text);
    box-shadow: var(--shadow-pop);
    font-size: var(--fs-md);
    font-weight: 520;
  }
  .toast.ok :global(svg:first-child) {
    color: var(--ok);
  }
  .toast.error :global(svg:first-child) {
    color: var(--danger);
  }
  .toast.info :global(svg:first-child) {
    color: var(--text-2);
  }
  .msg {
    min-width: 0;
  }
  .act {
    border: 0;
    background: transparent;
    color: var(--accent);
    font-weight: 650;
    padding: 0.25rem 0.5rem;
    border-radius: var(--radius-xs);
  }
  .act:hover {
    background: var(--hover);
  }
  .close {
    border: 0;
    background: transparent;
    color: var(--text-3);
    display: grid;
    place-items: center;
    width: 1.75rem;
    height: 1.75rem;
    border-radius: var(--radius-xs);
  }
  .close:hover {
    color: var(--text);
    background: var(--hover);
  }
</style>
