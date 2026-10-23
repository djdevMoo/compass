<script lang="ts">
  import type { Component, Snippet } from 'svelte';

  let {
    icon: Icon,
    title,
    text = '',
    color = 'var(--text-2)',
    children,
  }: {
    icon?: Component<{ size?: number }>;
    title: string;
    text?: string;
    color?: string;
    children?: Snippet;
  } = $props();
</script>

<div class="empty" style:--tint={color}>
  {#if Icon}<div class="badge"><Icon size={20} /></div>{/if}
  <h3>{title}</h3>
  {#if text}<p class="muted small">{text}</p>{/if}
  {#if children}<div class="row wrap actions">{@render children()}</div>{/if}
</div>

<style>
  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 0.5rem;
    padding: 2rem 1rem;
  }
  .badge {
    width: 2.75rem;
    height: 2.75rem;
    border-radius: 0.875rem;
    display: grid;
    place-items: center;
    color: var(--tint);
    background: color-mix(in srgb, var(--tint) 14%, transparent);
    margin-bottom: 0.25rem;
  }
  p {
    max-width: 30rem;
  }
  .actions {
    margin-top: 0.5rem;
    justify-content: center;
  }
</style>
