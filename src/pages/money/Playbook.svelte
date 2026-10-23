<script lang="ts">
  import InlineText from '../../lib/ui/InlineText.svelte';
  import { db, uid } from '../../lib/store.svelte';
  import { toast } from '../../lib/ui.svelte';
  import { Plus, Trash2, BookOpen } from '../../lib/icons';
  import type { PlaybookItem } from '../../lib/types';

  const groups = $derived.by(() => {
    const m = new Map<string, PlaybookItem[]>();
    for (const it of [...db.playbook.items].sort((a, b) => a.order - b.order)) {
      const list = m.get(it.group) ?? [];
      list.push(it);
      m.set(it.group, list);
    }
    return [...m.entries()];
  });

  let newGroup = $state('');

  const nextOrder = () => db.playbook.items.reduce((m, x) => Math.max(m, x.order), -1) + 1;

  function addTo(group: string) {
    db.playbook.add({ id: uid(), group, text: '', order: nextOrder() });
    // Focus the new, empty rule so you can type straight away.
    requestAnimationFrame(() => {
      const inputs = document.querySelectorAll<HTMLTextAreaElement>(`[data-group="${CSS.escape(group)}"] textarea`);
      inputs[inputs.length - 1]?.focus();
    });
  }

  function addGroup(e: SubmitEvent) {
    e.preventDefault();
    const g = newGroup.trim();
    if (!g) return;
    newGroup = '';
    addTo(g);
  }

  function remove(it: PlaybookItem) {
    const r = db.playbook.remove(it.id);
    if (r && it.text) toast.undoable('Removed rule', () => db.playbook.restore(r));
  }
</script>

<p class="muted small intro">
  <BookOpen size={15} /> The rule behind all of these: make spending slower and saving automatic.
</p>

<div class="grid" style="--min: 22rem">
  {#each groups as [group, items] (group)}
    <section class="card" data-group={group}>
      <div class="card-head">
        <h2>{group}</h2>
        <div class="actions">
          <button class="btn ghost icon sm" aria-label="Add a rule to {group}" onclick={() => addTo(group)}><Plus size={16} /></button>
        </div>
      </div>
      <ul>
        {#each items as it (it.id)}
          <li>
            <span class="bullet"></span>
            <div class="grow">
              <InlineText
                multiline
                value={it.text}
                label="Rule"
                placeholder="Write a rule…"
                onchange={(v) => db.playbook.update(it.id, { text: v })}
                onempty={() => remove(it)}
              />
            </div>
            <button class="btn ghost icon sm del" aria-label="Remove rule" onclick={() => remove(it)}><Trash2 size={14} /></button>
          </li>
        {/each}
      </ul>
    </section>
  {/each}
  <form class="card add" onsubmit={addGroup}>
    <h2>New group</h2>
    <div class="row">
      <input class="input" bind:value={newGroup} placeholder="e.g. Clothes, Nights out" maxlength="40" />
      <button class="btn" type="submit" disabled={!newGroup.trim()}>Add</button>
    </div>
  </form>
</div>

<style>
  .intro {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }
  li {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
  }
  .bullet {
    width: 0.375rem;
    height: 0.375rem;
    border-radius: 50%;
    background: var(--c-money);
    margin-top: 0.8rem;
    flex: none;
  }
  .del {
    opacity: 0;
    margin-top: 0.125rem;
  }
  li:hover .del,
  li:focus-within .del {
    opacity: 1;
  }
  .add {
    border-style: dashed;
    background: transparent;
  }
  .add h2 {
    font-size: var(--fs-md);
  }
</style>
