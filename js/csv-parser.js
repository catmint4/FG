// csv-parser.js — 輕量CSV解析器，不依賴外部套件（PapaParse等），避免CDN失效風險
// 支援：BOM、雙引號欄位內含逗號/換行、標準逗號分隔
function parseCSV(text) {
  // 移除BOM
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else {
        field += c;
      }
    } else {
      if (c === '"') { inQuotes = true; }
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\r') { /* skip */ }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else { field += c; }
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  // 過濾掉尾端空行
  while (rows.length && rows[rows.length - 1].every(v => v === '')) rows.pop();
  if (rows.length === 0) return { headers: [], data: [] };
  const headers = rows[0].map(h => h.trim());
  const data = rows.slice(1).map(r => {
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = r[idx] !== undefined ? r[idx] : ''; });
    return obj;
  });
  return { headers, data };
}

function toNum(v) {
  if (v === null || v === undefined || v === '') return 0;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
}
