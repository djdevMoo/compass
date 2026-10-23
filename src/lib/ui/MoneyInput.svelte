<script lang="ts">
  import { centsToInput, currencySymbol, parseMoney } from '../money';

  let {
    value = $bindable(null),
    placeholder = '0',
    autofocus = false,
    id,
    allowNegative = false,
  }: {
    value?: number | null;
    placeholder?: string;
    autofocus?: boolean;
    id?: string;
    allowNegative?: boolean;
  } = $props();

  let focused = $state(false);
  let text = $state('');

  // Mirror outside changes into the box, but never while someone is typing in it.
  $effect(() => {
    const v = value;
    if (!focused) text = v == null ? '' : centsToInput(v);
  });

  const parsed = $derived(parseMoney(text));
  const sym = currencySymbol();
  const invalid = $derived(text.trim() !== '' && (parsed === null || (!allowNegative && parsed < 0)));
</script>

<div class="money" class:invalid>
  <span class="cur">{sym}</span>
  <!-- svelte-ignore a11y_autofocus -->
  <input
    {id}
    class="input num"
    style:padding-left="calc(1.1rem + {sym.length * 0.62}em)"
    inputmode="decimal"
    autocomplete="off"
    {placeholder}
    {autofocus}
    bind:value={text}
    oninput={() => {
      const p = parseMoney(text);
      value = text.trim() === '' ? null : p !== null && (allowNegative || p >= 0) ? p : value;
    }}
    onfocus={(e) => {
      focused = true;
      (e.currentTarget as HTMLInputElement).select();
    }}
    onblur={() => {
      focused = false;
      text = value == null ? '' : centsToInput(value);
    }}
    aria-invalid={invalid}
  />
</div>

<style>
  .money {
    position: relative;
  }
  .cur {
    position: absolute;
    left: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-3);
    pointer-events: none;
    font-weight: 560;
  }
  .invalid .input {
    border-color: var(--danger);
  }
</style>
