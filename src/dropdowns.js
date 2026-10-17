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
      button.type = 'button'; button.setAttribute('role', 'option');
      button.setAttribute('aria-selected', String(index === select.selectedIndex));
      button.textContent = option.text; button.dataset.optionIndex = index;
      return button;
    }));
    list.setAttribute('aria-label', select.getAttribute('aria-label') || '선택');
    list.style.width = rect.width + 'px';
    list.style.left = rect.left + 'px';
    const below = window.innerHeight - rect.bottom - 4, above = rect.top - 4;
    const height = Math.min(select.options.length * 28 + 2, 280, Math.max(below, above));
    list.style.maxHeight = Math.max(28, height) + 'px';
    list.style.top = (below >= height ? rect.bottom : Math.max(0, rect.top - height)) + 'px';
    list.hidden = false;
    list.showPopover();
    select.setAttribute('aria-expanded', 'true');
    select.setAttribute('aria-controls', list.id);
    list.querySelector('[aria-selected=true]')?.focus({preventScroll: true});
  }
  function choose(button) {
    const select = active;
    if (!select?.isConnected) { close(); return; }
    const index = Number(button.dataset.optionIndex), changed = index !== select.selectedIndex;
    select.selectedIndex = index;
    close(true);
    if (changed) {
      select.dispatchEvent(new Event('input', {bubbles: true}));
      select.dispatchEvent(new Event('change', {bubbles: true}));
    }
  }
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
    const options = [...list.children], index = options.indexOf(event.target);
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
