// The Electron-side SQLite store (runs on Node's built-in SQLite).
import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Store } from '../electron/store.mjs';

const dirs = [];
function temp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'compass-test-'));
  dirs.push(dir);
  return { dir, store: new Store(path.join(dir, 'c.db'), path.join(dir, 'backups')) };
}

afterEach(() => {
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

describe('Store', () => {
  it('puts, updates, deletes and keeps settings', () => {
    const { store } = temp();
    store.apply([
      { op: 'put', collection: 'a', id: '1', data: { v: 1 } },
      { op: 'kv', key: 'settings', value: { theme: 'dark' } },
    ]);
    store.apply([{ op: 'put', collection: 'a', id: '1', data: { v: 2 } }]);
    let snap = store.loadAll();
    expect(snap.docs).toEqual([{ collection: 'a', id: '1', data: { v: 2 } }]);
    expect(snap.kv.settings).toEqual({ theme: 'dark' });
    store.apply([{ op: 'delete', collection: 'a', id: '1' }]);
    snap = store.loadAll();
    expect(snap.docs).toEqual([]);
    store.close();
  });

  it('is all-or-nothing: a bad op rolls back the whole batch', () => {
    const { store } = temp();
    expect(() =>
      store.apply([
        { op: 'put', collection: 'a', id: '1', data: { v: 1 } },
        { op: 'nope' },
      ]),
    ).toThrow();
    expect(store.loadAll().docs).toEqual([]);
    store.close();
  });

  it('survives reopening (data is on disk)', () => {
    const { dir, store } = temp();
    store.apply([{ op: 'put', collection: 'goals', id: 'g', data: { title: 'Save €10,000' } }]);
    store.close();
    const again = new Store(path.join(dir, 'c.db'), path.join(dir, 'backups'));
    expect(again.loadAll().docs[0].data.title).toBe('Save €10,000');
    again.close();
  });

  it('exports, imports (with a backup first) and rejects foreign files', () => {
    const { dir, store } = temp();
    store.apply([{ op: 'put', collection: 'c', id: 'x', data: { n: 1 } }]);
    const file = path.join(dir, 'export.json');
    store.exportTo(file);
    store.apply([{ op: 'delete', collection: 'c', id: 'x' }]);
    store.importFrom(file);
    expect(store.loadAll().docs[0].data).toEqual({ n: 1 });
    expect(store.listBackups()).toHaveLength(1);

    const bad = path.join(dir, 'bad.json');
    fs.writeFileSync(bad, JSON.stringify({ app: 'other', docs: [], kv: {} }));
    expect(() => store.importFrom(bad)).toThrow(/Not a Compass export/);
    store.close();
  });

  it('keeps at most 14 backups', () => {
    const { store } = temp();
    store.apply([{ op: 'put', collection: 'c', id: 'x', data: {} }]);
    for (let i = 0; i < 16; i++) store.backup(`t${String(i).padStart(2, '0')}`);
    expect(store.listBackups().length).toBeLessThanOrEqual(14);
    store.close();
  });
});
