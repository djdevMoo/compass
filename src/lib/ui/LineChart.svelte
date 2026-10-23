<script lang="ts" module>
  export interface Series {
    label: string;
    color: string;
    points: { x: number; y: number }[];
    dashed?: boolean;
    area?: boolean;
  }

  function niceStep(span: number, count: number): number {
    const raw = span / Math.max(1, count);
    const mag = 10 ** Math.floor(Math.log10(raw));
    const n = raw / mag;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag;
  }
</script>

<script lang="ts">
  import { getDateLocale } from '../dates';

  let {
    series,
    height = '15rem',
    yFormat = (v: number) => String(Math.round(v)),
    xFormat = (x: number) => new Date(x).toLocaleDateString(getDateLocale(), { day: 'numeric', month: 'short' }),
    zeroBased = true,
    target = null,
    label = 'Chart',
  }: {
    series: Series[];
    height?: string;
    yFormat?: (v: number) => string;
    xFormat?: (x: number) => string;
    zeroBased?: boolean;
    target?: { y: number; label: string } | null;
    label?: string;
  } = $props();

  let w = $state(0);
  let h = $state(0);
  let hoverX = $state<number | null>(null);

  const pad = { l: 52, r: 16, t: 14, b: 28 };

  const visible = $derived(series.filter((s) => s.points.length > 0));
  const all = $derived(visible.flatMap((s) => s.points));

  const xDomain = $derived.by(() => {
    if (!all.length) return [0, 1] as const;
    let lo = Math.min(...all.map((p) => p.x));
    let hi = Math.max(...all.map((p) => p.x));
    if (lo === hi) {
      lo -= 86_400_000 * 3;
      hi += 86_400_000 * 3;
    }
    return [lo, hi] as const;
  });

  const yAxis = $derived.by(() => {
    const ys = all.map((p) => p.y);
    if (target) ys.push(target.y);
    let lo = ys.length ? Math.min(...ys) : 0;
    let hi = ys.length ? Math.max(...ys) : 1;
    if (zeroBased) lo = Math.min(0, lo);
    if (hi === lo) {
      hi += 1;
      lo -= zeroBased ? 0 : 1;
    }
    const step = niceStep(hi - lo, 4);
    const min = Math.floor(lo / step) * step;
    const max = Math.ceil(hi / step) * step;
    const ticks: number[] = [];
    for (let v = min; v <= max + step / 2; v += step) ticks.push(v);
    return { min, max, ticks };
  });

  const iw = $derived(Math.max(0, w - pad.l - pad.r));
  const ih = $derived(Math.max(0, h - pad.t - pad.b));
  const sx = (x: number) => pad.l + ((x - xDomain[0]) / (xDomain[1] - xDomain[0])) * iw;
  const sy = (y: number) => pad.t + ih - ((y - yAxis.min) / (yAxis.max - yAxis.min)) * ih;

  const xTicks = $derived.by(() => {
    const n = Math.max(2, Math.min(6, Math.floor(iw / 110)));
    const [a, b] = xDomain;
    return Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));
  });

  function path(s: Series): string {
    return s.points.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join('');
  }
  function areaPath(s: Series): string {
    if (s.points.length < 2) return '';
    const base = sy(Math.max(yAxis.min, 0));
    const first = s.points[0];
    const last = s.points[s.points.length - 1];
    return `${path(s)}L${sx(last.x).toFixed(1)},${base}L${sx(first.x).toFixed(1)},${base}Z`;
  }

  function nearest(s: Series, x: number) {
    let best = s.points[0];
    for (const p of s.points) if (Math.abs(p.x - x) < Math.abs(best.x - x)) best = p;
    return best;
  }

  const hover = $derived.by(() => {
    if (hoverX === null || !visible.length) return null;
    const x = xDomain[0] + ((hoverX - pad.l) / Math.max(1, iw)) * (xDomain[1] - xDomain[0]);
    const rows = visible.map((s) => ({ s, p: nearest(s, x) }));
    // Anchor the crosshair on the closest point of any series.
    const anchor = rows.reduce((a, b) => (Math.abs(b.p.x - x) < Math.abs(a.p.x - x) ? b : a));
    return { x: anchor.p.x, rows: rows.filter((r) => Math.abs(r.p.x - anchor.p.x) < (xDomain[1] - xDomain[0]) * 0.04) };
  });
</script>

<div class="chart">
  {#if visible.length > 1}
    <div class="legend">
      {#each visible as s (s.label)}
        <span class="key"><i class:dashed={s.dashed} style:--c={s.color}></i>{s.label}</span>
      {/each}
    </div>
  {/if}
  <div
    class="plot"
    style:height
    bind:clientWidth={w}
    bind:clientHeight={h}
    role="img"
    aria-label={label}
    onpointermove={(e) => {
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = e.clientX - r.left;
      hoverX = x >= pad.l - 8 && x <= w - pad.r + 8 ? x : null;
    }}
    onpointerleave={() => (hoverX = null)}
  >
    {#if w > 0 && h > 0}
      <svg width={w} height={h}>
        {#each yAxis.ticks as t (t)}
          <line class="grid" x1={pad.l} x2={w - pad.r} y1={sy(t)} y2={sy(t)} />
          <text class="tick" x={pad.l - 8} y={sy(t)} text-anchor="end" dominant-baseline="middle">{yFormat(t)}</text>
        {/each}
        {#each xTicks as t, i (i)}
          <text
            class="tick"
            x={sx(t)}
            y={h - 8}
            text-anchor={i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle'}>{xFormat(t)}</text
          >
        {/each}
        {#if target}
          <line class="target" x1={pad.l} x2={w - pad.r} y1={sy(target.y)} y2={sy(target.y)} />
          <text class="target-label" x={w - pad.r} y={sy(target.y) - 6} text-anchor="end">{target.label}</text>
        {/if}
        {#each visible as s (s.label)}
          {#if s.area}<path d={areaPath(s)} fill={s.color} opacity="0.1" />{/if}
          <path d={path(s)} class="line" class:dashed={s.dashed} stroke={s.color} />
          {#if s.points.length === 1 || !s.dashed}
            {@const last = s.points[s.points.length - 1]}
            <circle class="dot" cx={sx(last.x)} cy={sy(last.y)} r="4.5" fill={s.color} />
          {/if}
        {/each}
        {#if hover}
          <line class="cross" x1={sx(hover.x)} x2={sx(hover.x)} y1={pad.t} y2={pad.t + ih} />
          {#each hover.rows as r (r.s.label)}
            <circle class="dot" cx={sx(r.p.x)} cy={sy(r.p.y)} r="4.5" fill={r.s.color} />
          {/each}
        {/if}
      </svg>
      {#if hover}
        {@const left = sx(hover.x)}
        <div class="tip" style:left="{left}px" class:flip={left > w * 0.62}>
          <div class="tip-date">{xFormat(hover.x)}</div>
          {#each hover.rows as r (r.s.label)}
            <div class="tip-row">
              <i style:--c={r.s.color}></i><span>{r.s.label}</span><b class="num">{yFormat(r.p.y)}</b>
            </div>
          {/each}
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  .chart {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-width: 0;
  }
  .legend {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
    font-size: var(--fs-xs);
    color: var(--text-2);
  }
  .key {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
  }
  .key i {
    width: 1rem;
    height: 0;
    border-top: 2px solid var(--c);
    border-radius: 2px;
  }
  .key i.dashed {
    border-top-style: dashed;
  }
  .plot {
    position: relative;
    width: 100%;
    touch-action: none;
  }
  svg {
    position: absolute;
    inset: 0;
    overflow: visible;
  }
  .grid {
    stroke: var(--border);
    stroke-width: 1;
    shape-rendering: crispEdges;
  }
  .tick {
    fill: var(--text-3);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
  }
  .target {
    stroke: var(--text-3);
    stroke-width: 1;
    shape-rendering: crispEdges;
  }
  .target-label {
    fill: var(--text-2);
    font-size: 11px;
    font-weight: 600;
  }
  .line {
    fill: none;
    stroke-width: 2;
    stroke-linejoin: round;
    stroke-linecap: round;
  }
  .line.dashed {
    stroke-dasharray: 5 5;
    opacity: 0.85;
  }
  .dot {
    stroke: var(--surface);
    stroke-width: 2;
  }
  .cross {
    stroke: var(--border-strong);
    stroke-width: 1;
  }
  .tip {
    position: absolute;
    top: 0;
    transform: translateX(12px);
    background: var(--surface-3);
    border-radius: var(--radius-sm);
    box-shadow: var(--shadow-pop);
    padding: 0.5rem 0.625rem;
    font-size: var(--fs-xs);
    pointer-events: none;
    min-width: 9rem;
    z-index: 2;
  }
  .tip.flip {
    transform: translateX(calc(-100% - 12px));
  }
  .tip-date {
    color: var(--text-2);
    margin-bottom: 0.25rem;
    font-weight: 600;
  }
  .tip-row {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .tip-row i {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 2px;
    background: var(--c);
  }
  .tip-row span {
    color: var(--text-2);
    flex: 1;
  }
  .tip-row b {
    font-weight: 650;
    color: var(--text);
  }
</style>
