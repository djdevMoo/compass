<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    title,
    subtitle = '',
    color = '',
    actions,
  }: { title: string; subtitle?: string; color?: string; actions?: Snippet } = $props();
</script>

<header class="ph">
  <div class="titles">
    <h1>{#if color}<span class="dot" style:background={color}></span>{/if}{title}</h1>
    {#if subtitle}<p class="muted">{subtitle}</p>{/if}
  </div>
  {#if actions}<div class="actions">{@render actions()}</div>{/if}
</header>

<style>
  .ph {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }
  .titles {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    min-width: 0;
  }
  h1 {
    display: flex;
    align-items: center;
    gap: 0.625rem;
  }
  .dot {
    width: 0.625rem;
    height: 0.625rem;
    border-radius: 3px;
    flex: none;
  }
  .actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
</style>
