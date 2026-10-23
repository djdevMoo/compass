<!-- Tap a glass to set how many you've had. Tapping the last full glass removes one. -->
<script lang="ts">
  import { db, settings } from '../store.svelte';
  import { waterOn } from '../stats';
  import { GlassWater } from '../icons';
  import type { ISODate } from '../types';

  let { date }: { date: ISODate } = $props();

  const count = $derived(waterOn(db.days.items, date));
  const target = $derived(Math.max(1, settings.v.waterTarget));
  const slots = $derived(Math.max(target, count));

  function set(n: number) {
    const next = n === count ? n - 1 : n;
    db.days.put({ id: date, date, water: Math.max(0, next) });
  }
</script>

<div class="water">
  <div class="head small"><span>Water</span><span class="num muted">{count} / {target} glasses</span></div>
  <div class="glasses" role="group" aria-label="Glasses of water">
    {#each Array.from({ length: slots }, (_, i) => i + 1) as n (n)}
      <button class:full={n <= count} aria-label="{n} glass{n === 1 ? '' : 'es'}" onclick={() => set(n)}>
        <GlassWater size={18} />
      </button>
    {/each}
    <button class="more" aria-label="One more glass" title="One more" onclick={() => set(count + 1)}>+</button>
  </div>
</div>

<style>
  .water {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .head {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
  }
  .glasses {
    display: flex;
    flex-wrap: wrap;
    margin-left: -0.3rem;
  }
  button {
    width: 1.75rem;
    height: 1.75rem;
    display: grid;
    place-items: center;
    border: 0;
    border-radius: var(--radius-xs);
    background: transparent;
    color: color-mix(in srgb, var(--text-3) 55%, transparent);
    transition: color var(--dur) var(--ease), background var(--dur) var(--ease);
  }
  button:hover {
    background: var(--hover);
  }
  button.full {
    color: var(--c-fit) !important;
  }
  .more {
    color: var(--text-3);
    font-weight: 600;
    font-size: var(--fs-lg);
  }
</style>
