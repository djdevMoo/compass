<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    value,
    size = '9rem',
    stroke = 9,
    color = 'var(--accent)',
    children,
  }: { value: number; size?: string; stroke?: number; color?: string; children?: Snippet } = $props();

  const r = $derived(50 - stroke / 2);
  const c = $derived(2 * Math.PI * r);
  const v = $derived(Math.max(0, Math.min(1, value)));
</script>

<div class="ring" style:width={size} style:height={size} style:--ring={color}>
  <svg viewBox="0 0 100 100" aria-hidden="true">
    <circle cx="50" cy="50" {r} class="track" stroke-width={stroke} />
    <circle
      cx="50"
      cy="50"
      {r}
      class="val"
      stroke-width={stroke}
      stroke-dasharray="{c * v} {c}"
      transform="rotate(-90 50 50)"
    />
  </svg>
  {#if children}<div class="inner">{@render children()}</div>{/if}
</div>

<style>
  .ring {
    position: relative;
    flex: none;
  }
  svg {
    width: 100%;
    height: 100%;
    display: block;
  }
  circle {
    fill: none;
  }
  .track {
    stroke: color-mix(in srgb, var(--ring) 8%, var(--track));
  }
  .val {
    stroke: var(--ring);
    stroke-linecap: round;
    transition: stroke-dasharray 600ms var(--ease);
  }
  .inner {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    text-align: center;
  }
</style>
