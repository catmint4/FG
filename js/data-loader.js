// data-loader.js — 自動偵測 data/ 資料夾內有哪些月份的檔案，逐一 fetch + 解析
// 新增月份資料時，只要把CSV丟進對應資料夾，不需要修改任何程式碼

// 產生候選月份清單：從 START_MONTH 到目前月份+1（多抓一個月避免時區誤差，抓不到就跳過)
function generateMonthCandidates(startYear, startMonth) {
  const months = [];
  const now = new Date();
  let y = startYear, m = startMonth;
  const endY = now.getFullYear(), endM = now.getMonth() + 2; // +2 = 抓到下個月，抓不到就跳過
  while (y < endY || (y === endY && m <= endM)) {
    months.push(`${y}-${String(m).padStart(2, '0')}`);
    m++; if (m > 12) { m = 1; y++; }
  }
  return months;
}
const MONTH_CANDIDATES = generateMonthCandidates(2025, 1);

// 嘗試 fetch 單一檔案，抓不到回傳 null（不拋錯，讓上層可以跳過不存在的月份）
async function tryFetchText(path) {
  try {
    const res = await fetch(path, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.text();
  } catch (e) {
    return null;
  }
}
async function tryFetchArrayBuffer(path) {
  try {
    const res = await fetch(path, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch (e) {
    return null;
  }
}
// 把Excel(.xlsx)第一個工作表解析成跟parseCSV相同的 {headers, data} 格式
function parseXLSXBuffer(buf) {
  if (typeof XLSX === 'undefined') return null;
  try {
    const wb = XLSX.read(buf, { type: 'array' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
    const headers = rows.length ? Object.keys(rows[0]) : [];
    return { headers, data: rows };
  } catch (e) {
    console.error('XLSX解析失敗:', e);
    return null;
  }
}

// 依資料夾+月份清單，抓取所有存在的月份，回傳 { month: parsedCSV }
// 同時支援 .csv 與 .xlsx：先試.csv，找不到再試同名的.xlsx
async function loadMonthlyFolder(folder, filenamePattern) {
  filenamePattern = filenamePattern || (m => `${m}.csv`);
  const results = {};
  const fetches = MONTH_CANDIDATES.map(async (m) => {
    const csvName = filenamePattern(m);
    const csvPath = `data/${folder}/${csvName}`;
    const text = await tryFetchText(csvPath);
    if (text !== null) { results[m] = parseCSV(text); return; }
    const xlsxPath = `data/${folder}/${csvName.replace(/\.csv$/i, '.xlsx')}`;
    const buf = await tryFetchArrayBuffer(xlsxPath);
    if (buf !== null) {
      const parsed = parseXLSXBuffer(buf);
      if (parsed) results[m] = parsed;
    }
  });
  await Promise.all(fetches);
  return results; // { '2026-08': {headers, data}, ... }
}

async function loadSingleFile(path) {
  const text = await tryFetchText(path);
  if (text !== null) return parseCSV(text);
  const xlsxPath = path.replace(/\.csv$/i, '.xlsx');
  const buf = await tryFetchArrayBuffer(xlsxPath);
  if (buf !== null) return parseXLSXBuffer(buf);
  return null;
}

function sortedMonths(obj) {
  return Object.keys(obj).sort();
}

function latestMonth(obj) {
  const ms = sortedMonths(obj);
  return ms.length ? ms[ms.length - 1] : null;
}
