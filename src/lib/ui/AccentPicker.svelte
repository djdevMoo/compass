<!-- Pick an accent colour: eight presets plus any custom colour. -->
<script lang="ts">
  import { ACCENTS, accentName, normalizeHex } from '../accent';
  import { Check, Pipette } from '../icons';

  let { value = $bindable() }: { value: string } = $props();

  const isCustom = $derived(!ACCENTS.some((a) => a.hex === value));
</script>

<div class="picker" role="radiogroup" aria-label="Accent colour">
  {#each ACCENTS as a (a.hex)}
    <button
      type="button"
      role="radio"
      aria-checked={value === a.hex}
      aria-label={a.name}
      title={a.name}
      class="swatch"
      class:on={value === a.hex}
      style:--sw={a.hex}
      onclick={() => (value = a.hex)}
    >
      {#if value === a.hex}<Check size={14} strokeWidth={3} />{/if}
    </button>
  {/each}
  <label class="swatch custom" class:on={isCustom} style:--sw={isCustom ? value : 'transparent'} title="Pick any colour">
    {#if isCustom}<Check size={14} strokeWidth={3} />{:else}<Pipette size={14} />{/if}
    <input
      type="color"
      aria-label="Custom accent colour"
      value={value}
      oninput={(e) => {
        const hex = normalizeHex((e.currentTarget as HTMLInputElement).value);
        if (hex) value = hex;
      }}
    />
  </label>
  <span class="name xs muted">{accentName(value)}</span>
</div>

<style>
  .picker {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
  }
  .swatch {
    position: relative;
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    border: 0;
    padding: 0;
    display: grid;
    place-items: center;
    background: var(--sw);
    /* Readable tick on any swatch: dark on light colours, light on dark ones. */
    color: oklch(from var(--sw) clamp(0.15, calc((0.62 - l) * 100), 0.98) 0 0);
    box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.12);
    cursor: pointer;
    transition: transform var(--dur) var(--ease), box-shadow var(--dur) var(--ease);
  }
  .swatch:hover {
    transform: scale(1.08);
  }
  .swatch.on {
    box-shadow: 0 0 0 2px var(--surface), 0 0 0 4px var(--sw);
  }
  .custom {
    border: 1.5px dashed var(--border-strong);
    color: var(--text-2);
  }
  .custom.on {
    border-style: solid;
    border-color: transparent;
    color: oklch(from var(--sw) clamp(0.15, calc((0.62 - l) * 100), 0.98) 0 0);
  }
  .custom input {
    position: absolute;
    inset: 0;
    opacity: 0;
    width: 100%;
    height: 100%;
    cursor: pointer;
  }
  .name {
    margin-left: 0.25rem;
  }
</style>
