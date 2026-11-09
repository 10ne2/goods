// Render one shared list so option alignment and width are consistent across browsers.
export function mountDropdowns() {
  const list = document.createElement('div');
  list.id = 'table-dropdown-options';
  list.className = 'table-dropdown-options';
  list.setAttribute('role', 'listbox');
  list.setAttribute('popover', 'manual');
  list.hidden = true;
  document.body.append(list);
  let active = null;
  function close(restoreFocus = false) {
    const previous = active;
    if (list.matches(':popover-open')) list.hidePopover();
    list.hidden = true;
    previous?.setAttribute('aria-expanded', 'false');
    active = null;
    if (restoreFocus && previous?.isConnected) previous.focus({preventScroll: true});
  }
  function open(select) {
    close();
    active = select;
    const rect = select.closest('td').getBoundingClientRect();
    list.replaceChildren(...[...select.options].map((option, index) => {
      const button = document.createElement('button');
      button.type = 'button'; button.disabled = option.disabled; button.setAttribute('role', 'option');
      button.setAttribute('aria-selected', String(index === select.selectedIndex));
      button.textContent = option.text; button.dataset.optionIndex = index;
      return button;
    }));
    list.setAttribute('aria-label', select.getAttribute('aria-label') || '선택');
    const groupedSale = select.matches('#sheet select[data-side="sales"]');
    const independentSale = !!select.closest('[data-independent-side="sales"]');
    // Collapsed cell borders differ at the sales section and table edges.
    list.style.width = (rect.width + 1 + (groupedSale ? 1 : 0)) + 'px';
    list.style.left = (rect.left - (groupedSale || independentSale ? 1 : 0)) + 'px';
    const below = window.innerHeight - rect.bottom - 4, above = rect.top - 4;
    const height = Math.min(select.options.length * 28 + 2, 280, Math.max(below, above));
    list.style.maxHeight = Math.max(28, height) + 'px';
    list.style.top = (below >= height ? rect.bottom - 1 : Math.max(0, rect.top - height)) + 'px';
    list.hidden = false;
    list.showPopover();
    select.setAttribute('aria-expanded', 'true');
    select.setAttribute('aria-controls', list.id);
    (list.querySelector('[aria-selected=true]:not(:disabled)') || list.querySelector('button:not(:disabled)'))?.focus({preventScroll: true});
  }
  function selectIndex(select, index) {
    if (index === select.selectedIndex) return;
    select.selectedIndex = index;
    select.dispatchEvent(new Event('input', {bubbles: true}));
    select.dispatchEvent(new Event('change', {bubbles: true}));
  }
  function choose(button) {
    const select = active;
    if (!select?.isConnected) { close(); return; }
    const index = Number(button.dataset.optionIndex);
    close(true);
    selectIndex(select, index);
  }
  let lastWheelSelect = null, lastWheelTime = -Infinity;
  document.addEventListener('wheel', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || !event.deltaY || Math.abs(event.deltaX) > Math.abs(event.deltaY) || active) return;
    const select = event.target.closest('table select[data-field="status"], table select[data-field="purchaseStatus"], table select[data-independent-field="status"]');
    if (!select || select.disabled) return;
    event.preventDefault();
    // A wheel gesture can emit many events; keep changes deliberate.
    const now = performance.now();
    const identity = JSON.stringify([select.closest('table').dataset.independentSide, select.closest('tr').dataset.independentId, select.dataset.group, select.dataset.id, select.dataset.field, select.dataset.independentField]);
    if (identity === lastWheelSelect && now - lastWheelTime < 180) return;
    lastWheelSelect = identity; lastWheelTime = now;
    const enabled = [...select.options].map((option, index) => option.disabled ? -1 : index).filter(index => index >= 0);
    const position = enabled.indexOf(select.selectedIndex);
    const index = enabled[Math.max(0, Math.min(enabled.length - 1, position + Math.sign(event.deltaY)))];
    if (index === undefined) return;
    selectIndex(select, index);
  }, {passive: false});
  document.addEventListener('pointerdown', event => {
    const select = event.target.closest('table select');
    if (select && event.button === 0) {
      event.preventDefault();
      if (active === select) close(true); else open(select);
    } else if (active && !list.contains(event.target)) close();
  });
  document.addEventListener('keydown', event => {
    const select = event.target.closest('table select');
    if (select && ['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
      event.preventDefault(); event.stopImmediatePropagation(); open(select); return;
    }
    if (!active || !list.contains(event.target)) return;
    const options = [...list.children].filter(button => !button.disabled), index = options.indexOf(event.target);
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault(); event.stopImmediatePropagation();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
      options[next].focus();
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault(); event.stopImmediatePropagation(); choose(event.target);
    } else if (event.key === 'Escape') {
      event.preventDefault(); event.stopImmediatePropagation(); close(true);
    } else if (event.key === 'Tab') close(true);
  }, true);
  list.addEventListener('click', event => {
    const button = event.target.closest('[data-option-index]');
    if (button) choose(button);
  });
  window.addEventListener('resize', () => close());
  document.addEventListener('scroll', event => {
    if (active && !list.contains(event.target)) close();
  }, true);
}
