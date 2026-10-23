<script lang="ts">
  import type { Snippet } from 'svelte';
  import { X } from '../icons';

  let {
    open = $bindable(false),
    title,
    subtitle = '',
    width = '30rem',
    children,
    footer,
    onclose,
  }: {
    open?: boolean;
    title: string;
    subtitle?: string;
    width?: string;
    children: Snippet;
    footer?: Snippet;
    onclose?: () => void;
  } = $props();

  let dlg: HTMLDialogElement;
  let downOnBackdrop = false;

  $effect(() => {
    if (open && !dlg.open) {
      dlg.showModal();
      // Focus the first field rather than the close button.
      requestAnimationFrame(() => {
        const first = dlg.querySelector<HTMLElement>('[autofocus], .body input, .body select, .body textarea, .body button');
        first?.focus();
      });
    } else if (!open && dlg.open) {
      dlg.close();
    }
  });
</script>

<dialog
  bind:this={dlg}
  style:--w={width}
  onclose={() => {
    open = false;
    onclose?.();
  }}
  onmousedown={(e) => (downOnBackdrop = e.target === dlg)}
  onclick={(e) => {
    if (e.target === dlg && downOnBackdrop) open = false;
  }}
>
  {#if open}
    <div class="modal">
      <header>
        <div class="titles">
          <h2>{title}</h2>
          {#if subtitle}<p class="muted small">{subtitle}</p>{/if}
        </div>
        <button class="btn ghost icon sm" aria-label="Close" onclick={() => (open = false)}><X size={16} /></button>
      </header>
      <div class="body">{@render children()}</div>
      {#if footer}<footer>{@render footer()}</footer>{/if}
    </div>
  {/if}
</dialog>

<style>
  dialog {
    padding: 0;
    border: 0;
    background: transparent;
    color: inherit;
    width: min(var(--w), calc(100vw - 2rem));
    max-height: calc(100vh - 4rem);
    overflow: visible;
  }
  dialog[open] {
    animation: pop 160ms var(--ease);
  }
  dialog::backdrop {
    background: var(--scrim);
    backdrop-filter: blur(2px);
    animation: fade 160ms var(--ease);
  }
  .modal {
    background: var(--surface);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-pop);
    display: flex;
    flex-direction: column;
    max-height: calc(100vh - 4rem);
  }
  header {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 1.125rem 1.25rem 0.25rem;
  }
  .titles {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }
  .body {
    padding: 0.875rem 1.25rem 1.25rem;
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
  }
  footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    padding: 0.875rem 1.25rem;
    border-top: 1px solid var(--border);
  }
  @keyframes pop {
    from {
      opacity: 0;
      transform: translateY(6px) scale(0.985);
    }
  }
  @keyframes fade {
    from {
      opacity: 0;
    }
  }
</style>
