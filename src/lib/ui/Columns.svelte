<!-- A small column chart: one series, optional target line, value on hover, current column labelled. -->
<script lang="ts">
  let {
    bars,
    color = 'var(--accent)',
    target = null,
    height = '9rem',
    format = (v: number) => String(v),
    label = 'Chart',
  }: {
    bars: { key: string; label: string; value: number; current?: boolean; tip?: string }[];
    color?: string;
    target?: number | null;
    height?: string;
    format?: (v: number) => string;
    label?: string;
  } = $props();

  const max = $derived(Math.max(1, target ?? 0, ...bars.map((b) => b.value)) * 1.08);
</script>

<div class="cols" style:--h={height} style:--c={color} role="img" aria-label={label}>
  <div class="plot">
    {#if target}
      <div class="target" style:bottom="{(target / max) * 100}%">
        <span>{format(target)}</span>
      </div>
    {/if}
    {#each bars as b (b.key)}
      <div class="col" class:current={b.current}>
        <div class="bar-wrap">
          <div class="bar" class:zero={b.value === 0} style:height="{(b.value / max) * 100}%">
            {#if b.current && b.value > 0}<span class="cap num">{format(b.value)}</span>{/if}
          </div>
          <div class="tip"><b class="num">{format(b.value)}</b>{#if b.tip}<span>{b.tip}</span>{/if}</div>
        </div>
      </div>
    {/each}
  </div>
  <div class="labels">
    {#each bars as b (b.key)}<span class:current={b.current}>{b.label}</span>{/each}
  </div>
</div>

<style>
  .cols {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }
  .plot {
    position: relative;
    height: var(--h);
    display: flex;
    align-items: stretch;
    gap: 2px;
    border-bottom: 1px solid var(--border);
  }
  .col {
    flex: 1;
    display: flex;
    justify-content: center;
    min-width: 0;
  }
  .bar-wrap {
    position: relative;
    width: 100%;
    max-width: 24px;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    align-items: center;
  }
  .bar {
    position: relative;
    width: 100%;
    border-radius: 4px 4px 0 0;
    background: color-mix(in srgb, var(--c) 55%, var(--surface-3));
    transition: height 400ms var(--ease);
  }
  .current .bar {
    background: var(--c);
  }
  .bar.zero {
    height: 2px !important;
    background: var(--surface-3);
  }
  .cap {
    position: absolute;
    bottom: calc(100% + 3px);
    left: 50%;
    transform: translateX(-50%);
    font-size: 11px;
    font-weight: 650;
    color: var(--text);
    white-space: nowrap;
  }
  .tip {
    position: absolute;
    bottom: calc(100% + 0.375rem);
    left: 50%;
    transform: translateX(-50%);
    display: none;
    flex-direction: column;
    align-items: center;
    padding: 0.3rem 0.5rem;
    border-radius: var(--radius-xs);
    background: var(--surface-3);
    box-shadow: var(--shadow-pop);
    font-size: var(--fs-xs);
    white-space: nowrap;
    z-index: 3;
    pointer-events: none;
  }
  .tip span {
    color: var(--text-2);
  }
  .col:hover .tip {
    display: flex;
  }
  .col:hover .cap {
    visibility: hidden;
  }
  .col:hover .bar {
    filter: brightness(1.15);
  }
  .target {
    position: absolute;
    left: 0;
    right: 0;
    border-top: 1px solid var(--text-3);
    pointer-events: none;
  }
  .target span {
    position: absolute;
    right: 0;
    top: -1.05rem;
    font-size: 10px;
    color: var(--text-2);
    font-weight: 600;
    background: var(--surface);
    padding: 0 0.25rem;
  }
  .labels {
    display: flex;
    gap: 2px;
  }
  .labels span {
    flex: 1;
    text-align: center;
    font-size: 10.5px;
    color: var(--text-3);
    white-space: nowrap;
    overflow: hidden;
  }
  .labels span.current {
    color: var(--text);
    font-weight: 650;
  }
</style>
