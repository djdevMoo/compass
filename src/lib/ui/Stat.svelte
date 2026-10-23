<script lang="ts">
  let {
    label,
    value,
    sub = '',
    tone = '',
  }: { label: string; value: string; sub?: string; tone?: '' | 'ok' | 'warn' | 'danger' } = $props();
</script>

<div class="stat">
  <span class="label">{label}</span>
  <span class="value num">{value}</span>
  {#if sub}<span class="sub {tone}">{sub}</span>{/if}
</div>

<style>
  .stat {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    min-width: 0;
  }
  .label {
    font-size: var(--fs-xs);
    color: var(--text-2);
    font-weight: 540;
  }
  .value {
    font-size: var(--fs-xl);
    font-weight: 660;
    letter-spacing: -0.01em;
    white-space: nowrap;
  }
  .sub {
    font-size: var(--fs-xs);
    color: var(--text-3);
  }
</style>
