<!-- Pick which part of the paycheck a spend comes out of. -->
<script lang="ts">
  import { finance } from '../lib/finance.svelte';
  import { money } from '../lib/money';

  let { value = $bindable() }: { value: string } = $props();
</script>

<div class="picks" role="radiogroup" aria-label="Comes out of">
  {#each finance.envelopes as e (e.line.id)}
    <button
      type="button"
      role="radio"
      aria-checked={value === e.line.id}
      class="pick"
      class:on={value === e.line.id}
      onclick={() => (value = e.line.id)}
    >
      <span class="t">{e.line.name}</span>
      <span class="s" class:over={e.left < 0}>{money(e.left)} left</span>
    </button>
  {/each}
</div>

<style>
  .over {
    color: var(--danger) !important;
  }
</style>
