<!-- Text that edits in place. Saves on blur or Enter; Esc cancels. -->
<script lang="ts">
  let {
    value,
    onchange,
    placeholder = '',
    label = 'Text',
    multiline = false,
    onempty,
  }: {
    value: string;
    onchange: (v: string) => void;
    placeholder?: string;
    label?: string;
    multiline?: boolean;
    /** Called when the field is left empty (e.g. to drop a blank new row). */
    onempty?: () => void;
  } = $props();

  let draft = $state('');
  let focused = $state(false);

  $effect(() => {
    const v = value;
    if (!focused) draft = v;
  });

  function commit() {
    const v = draft.trim();
    if (!v && onempty) onempty();
    else if (v !== value) onchange(v);
  }
</script>

{#if multiline}
  <textarea
    class="inline-input area"
    rows="2"
    aria-label={label}
    {placeholder}
    bind:value={draft}
    onfocus={() => (focused = true)}
    onblur={() => {
      focused = false;
      commit();
    }}
    onkeydown={(e) => {
      if (e.key === 'Escape') {
        draft = value;
        (e.currentTarget as HTMLTextAreaElement).blur();
        e.stopPropagation();
      }
    }}
  ></textarea>
{:else}
  <input
    class="inline-input"
    aria-label={label}
    {placeholder}
    bind:value={draft}
    onfocus={() => (focused = true)}
    onblur={() => {
      focused = false;
      commit();
    }}
    onkeydown={(e) => {
      if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
      if (e.key === 'Escape') {
        draft = value;
        (e.currentTarget as HTMLInputElement).blur();
        e.stopPropagation();
      }
    }}
  />
{/if}

<style>
  .area {
    height: auto;
    min-height: 2rem;
    padding-top: 0.35rem;
    padding-bottom: 0.35rem;
    resize: none;
    field-sizing: content;
    line-height: 1.4;
  }
</style>
