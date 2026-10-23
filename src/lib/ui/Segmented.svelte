<script lang="ts" generics="T extends string">
  let {
    value = $bindable(),
    options,
    label = '',
    size = 'md',
  }: {
    value: T;
    options: { value: T; label: string; count?: number }[];
    label?: string;
    size?: 'sm' | 'md';
  } = $props();
</script>

<div class="seg {size}" role="tablist" aria-label={label}>
  {#each options as o (o.value)}
    <button
      type="button"
      role="tab"
      aria-selected={value === o.value}
      class:on={value === o.value}
      onclick={() => (value = o.value)}
    >
      {o.label}
      {#if o.count !== undefined}<span class="count num">{o.count}</span>{/if}
    </button>
  {/each}
</div>

<style>
  .seg {
    display: inline-flex;
    gap: 0.125rem;
    padding: 0.1875rem;
    border-radius: calc(var(--radius-sm) + 0.1875rem);
    background: var(--surface-2);
    border: 1px solid var(--border);
    max-width: 100%;
    overflow-x: auto;
    scrollbar-width: none;
  }
  button {
    border: 0;
    background: transparent;
    color: var(--text-2);
    height: 2rem;
    padding: 0 0.875rem;
    border-radius: var(--radius-sm);
    font-size: var(--fs-md);
    font-weight: 560;
    white-space: nowrap;
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    transition: background var(--dur) var(--ease), color var(--dur) var(--ease);
  }
  .sm button {
    height: 1.625rem;
    padding: 0 0.625rem;
    font-size: var(--fs-sm);
  }
  button:hover {
    color: var(--text);
  }
  button.on {
    background: var(--surface);
    color: var(--text);
    box-shadow: 0 1px 2px rgb(0 0 0 / 0.25), 0 0 0 1px var(--border-strong);
  }
  .count {
    font-size: var(--fs-2xs);
    color: var(--text-3);
    font-weight: 650;
  }
  .on .count {
    color: var(--text-2);
  }
</style>
