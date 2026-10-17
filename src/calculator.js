export function calculate(expression) {
  const source = expression.replaceAll(',', '').replaceAll('×', '*').replaceAll('÷', '/').replaceAll('−', '-').replace(/\s/g, '');
  let index = 0;
  function value() {
    let result;
    if (source[index] === '+' || source[index] === '-') {
      const sign = source[index++];
      result = (sign === '-' ? -1 : 1) * value();
    } else if (source[index] === '(') {
      index++;
      result = sum();
      if (source[index++] !== ')') throw Error('괄호를 확인하세요');
    } else {
      const number = source.slice(index).match(/^(?:\d+(?:\.\d*)?|\.\d+)/);
      if (!number) throw Error('계산식을 확인하세요');
      index += number[0].length;
      result = Number(number[0]);
    }
    while (source[index] === '%') { index++; result /= 100; }
    return result;
  }
  function product() {
    let result = value();
    while (source[index] === '*' || source[index] === '/') {
      const operator = source[index++], right = value();
      if (operator === '/' && right === 0) throw Error('0으로 나눌 수 없어요');
      result = operator === '*' ? result * right : result / right;
    }
    return result;
  }
  function sum() {
    let result = product();
    while (source[index] === '+' || source[index] === '-') {
      const operator = source[index++], right = product();
      result = operator === '+' ? result + right : result - right;
    }
    return result;
  }
  const result = sum();
  if (index !== source.length || !Number.isFinite(result)) throw Error('계산식을 확인하세요');
  return Number(result.toPrecision(12));
}

export function mountCalculator() {
  const dialog = document.createElement('dialog');
  dialog.className = 'calculator';
  dialog.setAttribute('aria-labelledby', 'calculator-title');
  dialog.innerHTML = `<div class="calculator-heading"><h2 id="calculator-title">계산기</h2><button type="button" data-close aria-label="계산기 닫기">×</button></div><input id="calculator-expression" aria-label="계산식" placeholder="0" autocomplete="off" spellcheck="false"><output aria-live="polite" id="calculator-result"></output><div class="calculator-keys">${['C','(',')','⌫','7','8','9','÷','4','5','6','×','1','2','3','−','0','.','%','+'].map(key => `<button type="button" data-key="${key}"${key === '⌫' ? ' aria-label="한 글자 지우기"' : key === 'C' ? ' aria-label="전체 지우기"' : ''}>${key}</button>`).join('')}<button type="button" data-key="=" class="calculator-equals">=</button></div>`;
  document.body.append(dialog);
  const input = dialog.querySelector('input'), output = dialog.querySelector('output');
  const solve = () => {
    try {
      const result = calculate(input.value);
      output.textContent = new Intl.NumberFormat('ko-KR', {maximumFractionDigits: 12}).format(result);
      input.value = String(result);
    } catch (error) { output.textContent = error.message; }
  };
  document.querySelector('#open-calculator').onclick = () => { if (!dialog.open) dialog.show(); input.focus(); };
  dialog.querySelector('[data-close]').onclick = () => dialog.close();
  dialog.addEventListener('click', event => {
    const key = event.target.closest('[data-key]')?.dataset.key;
    if (!key) return;
    if (key === '=') { solve(); return; }
    if (key === 'C') { input.value = ''; output.textContent = ''; }
    else {
      const start = input.selectionStart, end = input.selectionEnd;
      input.setRangeText(key === '⌫' ? '' : key, key === '⌫' && start === end ? Math.max(0, start - 1) : start, end, 'end');
      output.textContent = '';
    }
    input.focus();
  });
  input.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === '=') { event.preventDefault(); solve(); } });
  input.addEventListener('input', () => { output.textContent = ''; });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && dialog.open) dialog.close();
    if (!dialog.open || event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target;
    if (target.matches('input,textarea,select') || target.isContentEditable) return;
    if (/^[0-9.+*/%()=−×÷-]$/.test(event.key)) {
      event.preventDefault();
      input.focus();
      if (event.key === '=') solve();
      else { input.setRangeText(event.key, input.selectionStart, input.selectionEnd, 'end'); output.textContent = ''; }
    } else if (event.key === 'Enter') { event.preventDefault(); solve(); input.focus(); }
    else if (event.key === 'Backspace') {
      event.preventDefault(); input.focus();
      const start = input.selectionStart, end = input.selectionEnd;
      input.setRangeText('', start === end ? Math.max(0, start - 1) : start, end, 'end'); output.textContent = '';
    }
  });
  const heading = dialog.querySelector('.calculator-heading');
  heading.addEventListener('pointerdown', event => {
    if (event.target.closest('button') || event.button !== 0) return;
    const rect = dialog.getBoundingClientRect(), startX = event.clientX, startY = event.clientY;
    heading.setPointerCapture(event.pointerId);
    const move = next => {
      dialog.style.left = Math.max(0, Math.min(window.innerWidth - rect.width, rect.left + next.clientX - startX)) + 'px';
      dialog.style.top = Math.max(0, Math.min(window.innerHeight - rect.height, rect.top + next.clientY - startY)) + 'px';
      dialog.style.right = 'auto';
    };
    heading.addEventListener('pointermove', move);
    heading.addEventListener('lostpointercapture', () => heading.removeEventListener('pointermove', move), {once: true});
  });
}
