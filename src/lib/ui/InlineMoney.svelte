<!-- A money amount you can click and edit in place. Enter or click away saves; Esc cancels. -->
<script lang="ts">
  import { centsToInput, money, parseMoney } from '../money';

  let {
    value,
    onchange,
    label = 'Amount',
    allowNegative = false,
    strong = false,
  }: {
    value: number;
    onchange: (cents: number) => void;
    label?: string;
    allowNegative?: boolean;
    strong?: boolean;
  } = $props();

  let editing = $state(false);
  let text = $state('');
  let input = $state<HTMLInputElement>();

  function begin() {
    text = centsToInput(value);
    editing = true;
    requestAnimationFrame(() => input?.select());
  }

  function commit() {
    if (!editing) return;
    editing = false;
    const c = parseMoney(text);
    if (c !== null && (allowNegative || c >= 0) && c !== value) onchange(c);
  }
</script>

{#if editing}
  <input
    bind:this={input}
    bind:value={text}
    class="edit num"
    inputmode="decimal"
    aria-label={label}
    onblur={commit}
    onkeydown={(e) => {
      if (e.key === 'Enter') commit();
      if (e.key === 'Escape') {
        editing = false;
        e.stopPropagation();
      }
    }}
  />
{:else}
  <button class="show num" class:strong title="Click to edit" aria-label="{label}: {money(value)}. Click to edit" onclick={begin}>
    {money(value)}
  </button>
{/if}

<style>
  .show,
  .edit {
    height: 2rem;
    min-width: 5.5rem;
    max-width: 9rem;
    padding: 0 0.5rem;
    border-radius: var(--radius-xs);
    text-align: right;
    font: inherit;
    font-variant-numeric: tabular-nums;
  }
  .show {
    border: 1px solid transparent;
    background: transparent;
    color: inherit;
  }
  .show.strong {
    font-weight: 640;
  }
  .show:hover {
    background: var(--hover);
    border-color: var(--border);
  }
  .edit {
    width: 7.5rem;
    border: 1px solid var(--accent);
    background: var(--surface-2);
    color: var(--text);
    outline: none;
    box-shadow: 0 0 0 3px var(--accent-soft);
  }
</style>
