<!-- A thin progress bar. The track is a faint step of the same colour, so state reads across the whole bar. -->
<script lang="ts">
  let {
    value,
    max = 1,
    color = 'var(--accent)',
    warnAt = 0.85,
    overColor = 'var(--danger)',
    auto = false,
    height = 0.375,
    label = '',
  }: {
    value: number;
    max?: number;
    color?: string;
    warnAt?: number;
    overColor?: string;
    /** Colour by how full it is (for budgets): normal, then warning, then over. */
    auto?: boolean;
    height?: number;
    label?: string;
  } = $props();

  const ratio = $derived(max > 0 ? value / max : value > 0 ? 1 : 0);
  const fill = $derived(
    auto ? (ratio > 1 ? overColor : ratio >= warnAt ? 'var(--warn)' : color) : color,
  );
</script>

<div
  class="meter"
  role="meter"
  aria-label={label}
  aria-valuemin={0}
  aria-valuemax={max}
  aria-valuenow={value}
  style:--fill={fill}
  style:height="{height}rem"
>
  <div class="bar" style:width="{Math.max(0, Math.min(1, ratio)) * 100}%"></div>
</div>

<style>
  .meter {
    width: 100%;
    border-radius: 999px;
    background: color-mix(in srgb, var(--fill) 7%, var(--track));
    overflow: hidden;
  }
  .bar {
    height: 100%;
    border-radius: 999px;
    background: var(--fill);
    transition: width 420ms var(--ease);
  }
</style>
