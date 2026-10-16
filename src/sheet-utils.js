export function formatMoney(value) {
  const raw = String(value).replaceAll(',', '');
  return /^\d+$/.test(raw) && Number.isSafeInteger(Number(raw)) ? new Intl.NumberFormat('ko-KR').format(Number(raw)) : raw;
}
export function readMoneyInput(input, composing = false) {
  const raw = input.value.replaceAll(',', '');
  if (composing) return raw;
  const count = input.value.slice(0, input.selectionStart ?? input.value.length).replaceAll(',', '').length;
  const formatted = formatMoney(raw);
  input.value = formatted;
  let cursor = 0, characters = 0;
  while (cursor < formatted.length && characters < count) {if (formatted[cursor] !== ',') characters++; cursor++;}
  input.setSelectionRange(cursor, cursor);
  return raw;
}
export function enableWheelScroll(element) {
  element.addEventListener('wheel', event => {
    if (event.ctrlKey || event.metaKey) return;
    const factor = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientWidth : 1;
    const delta = (Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY) * factor;
    const target = Math.min(Math.max(element.scrollLeft + delta, 0), element.scrollWidth - element.clientWidth);
    if (target >= 0 && target !== element.scrollLeft) {event.preventDefault(); element.scrollLeft = target;}
  }, {passive: false});
}
