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

// 依資料夾+月份清單，抓取所有存在的月份，回傳 { month: parsedCSV }
async function loadMonthlyFolder(folder, filenamePattern) {
  filenamePattern = filenamePattern || (m => `${m}.csv`);
  const results = {};
  const fetches = MONTH_CANDIDATES.map(async (m) => {
    const text = await tryFetchText(`data/${folder}/${filenamePattern(m)}`);
    if (text !== null) results[m] = parseCSV(text);
  });
  await Promise.all(fetches);
  return results; // { '2026-08': {headers, data}, ... }
}

async function loadSingleFile(path) {
  const text = await tryFetchText(path);
  if (text === null) return null;
  return parseCSV(text);
}

function sortedMonths(obj) {
  return Object.keys(obj).sort();
}

function latestMonth(obj) {
  const ms = sortedMonths(obj);
  return ms.length ? ms[ms.length - 1] : null;
}
