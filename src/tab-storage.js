const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const copy = value => value === undefined ? undefined : structuredClone(value);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const records = value => Array.isArray(value) && value.every(row => object(row) && typeof row.id === 'string');

// Merge only local changes over the latest stored records. Unchanged fields and
// remotely added/deleted rows follow storage; middle insertions keep their order.
export function mergeChanges(base, local, remote) {
  if (same(local, base)) return copy(remote);
  if (same(remote, base) || same(local, remote)) return copy(local);
  if (records(base) && records(local) && records(remote)) {
    const before = new Map(base.map(row => [row.id, row]));
    const current = new Map(local.map(row => [row.id, row]));
    let result = remote.filter(row => current.has(row.id) || !before.has(row.id)).map(row =>
      current.has(row.id) ? mergeChanges(before.get(row.id), current.get(row.id), row) : copy(row));
    for (let index = 0; index < local.length; index++) {
      const row = local[index];
      if (result.some(item => item.id === row.id) || same(row, before.get(row.id))) continue;
      const previous = local.slice(0, index).reverse().find(item => result.some(value => value.id === item.id));
      const next = local.slice(index + 1).find(item => result.some(value => value.id === item.id));
      const position = previous ? result.findIndex(item => item.id === previous.id) + 1 : next ? result.findIndex(item => item.id === next.id) : result.length;
      result.splice(position, 0, copy(row));
    }
    const baseOrder = base.filter(row => current.has(row.id)).map(row => row.id);
    const localOrder = local.filter(row => before.has(row.id)).map(row => row.id);
    if (!same(baseOrder, localOrder)) {
      const byId = new Map(result.map(row => [row.id, row]));
      const ordered = local.filter(row => byId.has(row.id)).map(row => byId.get(row.id));
      let index = 0;
      result = result.map(row => current.has(row.id) ? ordered[index++] : row);
    }
    return result;
  }
  if (object(base) && object(local) && object(remote)) {
    const result = {};
    for (const key of new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)])) {
      const value = mergeChanges(base[key], local[key], remote[key]);
      if (value !== undefined) result[key] = value;
    }
    return result;
  }
  return copy(local);
}

export function createTabStorage({key, empty, valid, getValue, onValue, onError, onFlush, initialBase}) {
  const prefix = key + ':pending:';
  const draftKey = prefix + crypto.randomUUID();
  function read() {
    const raw = localStorage.getItem(key);
    const value = raw === null ? copy(empty) : JSON.parse(raw);
    if (!valid(value)) throw Error('다른 탭의 저장 기록을 읽지 못했습니다. 현재 입력은 유지됩니다.');
    return value;
  }
  let base = initialBase === undefined ? read() : copy(initialBase), pending = null, initializing = null;
  const initialValue = copy(getValue()), loadedValue = copy(base);
  const withLock = task => navigator.locks ? navigator.locks.request('goods-ledger:' + key, task) : Promise.resolve().then(task);
  function pull() {
    if (initializing) return;
    try {
      const remote = read(), local = getValue();
      const merged = mergeChanges(base, local, remote);
      base = copy(remote);
      if (!same(merged, local)) onValue(merged);
    } catch (error) { onError(error); }
  }
  window.addEventListener('storage', event => {
    if (event.storageArea === localStorage && (event.key === key || event.key === null)) pull();
  });
  window.addEventListener('focus', pull);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') onFlush();
    else pull();
  });
  function commit() {
    let remote = read();
    const drafts = [];
    for (let index = 0; index < localStorage.length; index++) {
      const name = localStorage.key(index);
      if (!name?.startsWith(prefix)) continue;
      const raw = localStorage.getItem(name);
      try {
        const draft = JSON.parse(raw);
        if (valid(draft.base) && valid(draft.value) && Number.isFinite(draft.time)) drafts.push({name, raw, ...draft});
      } catch { /* Preserve unreadable drafts rather than deleting them. */ }
    }
    drafts.sort((a, b) => a.time - b.time || a.name.localeCompare(b.name));
    for (const draft of drafts) remote = mergeChanges(draft.base, draft.value, remote);
    const local = getValue(), merged = mergeChanges(base, local, remote);
    if (!valid(merged)) throw Error('저장할 금액을 확인해주세요.');
    const serialized = JSON.stringify(merged);
    if (serialized !== localStorage.getItem(key)) localStorage.setItem(key, serialized);
    base = copy(merged);
    // Pending changes are written synchronously before waiting for the lock.
    // Recover them on the next save if a tab closed before it could commit.
    for (const draft of drafts) if (localStorage.getItem(draft.name) === draft.raw) localStorage.removeItem(draft.name);
    if (!same(merged, local)) onValue(merged);
  }
  function initialize() {
    initializing = withLock(() => {
      if (same(getValue(), initialValue) && localStorage.getItem(key) !== null) {
        const latest = read();
        if (!same(latest, loadedValue)) {
          base = copy(latest);
          if (!same(getValue(), latest)) onValue(latest);
        }
      }
      commit();
    }).then(() => { initializing = null; pull(); }, error => { initializing = null; throw error; });
    return initializing;
  }
  function save(local) {
    if (initializing && same(local, initialValue)) return initializing;
    if (!valid(local)) throw Error('저장할 금액을 확인해주세요.');
    localStorage.setItem(draftKey, JSON.stringify({base, value: local, time: Date.now(), token: crypto.randomUUID()}));
    if (pending) return pending;
    // Web Locks serialize read/merge/write across tabs, including simultaneous edits.
    const write = withLock(commit);
    pending = write.then(() => {
      pending = null;
      if (localStorage.getItem(draftKey) !== null) return save(getValue());
    }, error => { pending = null; throw error; });
    return pending;
  }
  return {save, initialize};
}

export function preserveEditor(root, render) {
  const active = document.activeElement;
  let selector, start, end;
  if (root.contains(active) && active.matches('[data-field],[data-independent-field]')) {
    const row = active.closest('[data-independent-id]');
    selector = row ? `[data-independent-id="${CSS.escape(row.dataset.independentId)}"] ` : '';
    selector += ['data-group', 'data-side', 'data-id', 'data-field', 'data-independent-field']
      .filter(name => active.hasAttribute(name)).map(name => `[${name}="${CSS.escape(active.getAttribute(name))}"]`).join('');
    if (active.tagName === 'INPUT') { start = active.selectionStart; end = active.selectionEnd; }
  }
  render();
  const replacement = selector && root.querySelector(selector);
  if (replacement) {
    replacement.focus({preventScroll: true});
    if (start !== undefined && replacement.tagName === 'INPUT') replacement.setSelectionRange(start, end);
  }
}
