export const DEFAULT_MONTH = '9';
export const validMonth = value => typeof value === 'string' && /^(?:[1-9]|1[0-2])$/.test(value);
export const monthOf = record => record.month ?? DEFAULT_MONTH;
export const monthOptions = selected => Array.from({length: 12}, (_, index) => {
  const value = String(index + 1);
  return `<option value="${value}" ${selected === value ? 'selected' : ''}>${value}월</option>`;
}).join('');
