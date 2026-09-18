// app.js — 主程式（v3：修正卡住的載入畫面、合併分頁、深化分析、精簡日期列）

const INK="#1B2430", TEAL="#2F6F5E", GOLD="#C08A3E", RUST="#B5533C", SLATE="#5C7290", PLUM="#7A5C7E", MOSS="#7A8B5A", SAND="#D8C9A3", STONE="#8C97A6";
const CAT_COLORS = {"建案頁":RUST,"生活提案(其他)":SAND,"專家文章":PLUM,"建案熱區巡禮":MOSS,"其他頁面":STONE};
const CHAN_COLORS = {"LINE":"#06C755","Paid Search/Display":GOLD,"Direct":SLATE,"Organic Social":PLUM,"Organic Search":TEAL,"Other":STONE,"Unassigned":"#C2C2C2","Referral":SAND,"Paid Social":RUST};
const BIG_COLORS = {"稅務與繼承":TEAL,"不動產交易":SLATE,"區域環境":SAND,"建築與品牌":MOSS,"居住與維護":PLUM,"市場與政策":STONE,"商用不動產":GOLD};
const SITE_ORIGIN = "https://www.farglory-realty.com.tw";

function fmt(n){ return Math.round(n||0).toLocaleString('en-US'); }
function pct(n){ return (n>0?'+':'') + n.toFixed(1) + '%'; }
function hasChart(){ return typeof Chart !== 'undefined'; }
function linkFor(url){ return SITE_ORIGIN + url; }
function chartBox(id, heightPx){ return `<div class="chart-box" style="height:${heightPx||220}px"><canvas id="${id}"></canvas></div>`; }
function safeChart(canvasId, config){
  if(!hasChart()){
    const el = document.getElementById(canvasId);
    if(el) el.parentElement.replaceWith(Object.assign(document.createElement('div'), {className:'chart-fallback', textContent:'圖表庫尚未載入，僅顯示表格數字'}));
    return null;
  }
  config.options = config.options || {};
  config.options.responsive = true;
  config.options.maintainAspectRatio = false;
  return new Chart(document.getElementById(canvasId), config);
}
function articleLink(url){
  const title = getArticleTitle(url);
  return `<a href="${linkFor(url)}" target="_blank" rel="noopener"><div>${title}</div><div class="url-sub">${url}</div></a>`;
}

// 依「進站意圖→內容成效→導流成效」邏輯排序的分頁
const TABS = [
  {id:'overview', label:'① 總覽'},
  {id:'traffic', label:'② 流量與來源（自然搜尋）'},
  {id:'keywords', label:'③ 進站意圖：關鍵字'},
  {id:'seo', label:'④ 內容成效：文章與分類'},
  {id:'monitor', label:'⑤ 內容健康監控'},
  {id:'aio', label:'⑥ AIO引用監測'},
  {id:'path', label:'⑦ 導流成效：內容→建案'},
  {id:'conversion', label:'⑧ 轉換與留單'},
  {id:'building', label:'⑨ 建案獨立分析'},
  {id:'social', label:'⑩ 自媒體'},
  {id:'guide', label:'📋 資料說明'}
];

let DATA = {};
let CLS_MAP = {};
let TITLE_MAP = {};
let ALL_MONTHS = [];
let RANGE_A = {start:null, end:null};
let RANGE_B = null;

function buildShell(){
  document.getElementById('mainArea').innerHTML = ''; // 修正：清空原本卡住的「資料載入中」文字
  const tabbar = document.getElementById('tabbar');
  TABS.forEach(t=>{ const b=document.createElement('button'); b.className='tabbtn'; b.textContent=t.label; b.dataset.id=t.id; b.onclick=()=>switchTab(t.id); tabbar.appendChild(b); });
  const main = document.getElementById('mainArea');
  TABS.forEach(t=>{ const div=document.createElement('div'); div.className='panel'; div.id='panel-'+t.id; main.appendChild(div); });
  switchTab('overview');
}
function switchTab(id){
  document.querySelectorAll('.tabbtn').forEach(b=>b.classList.toggle('active', b.dataset.id===id));
  document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('active', p.id==='panel-'+id));
}
function renderEmpty(id, title, desc, needs){
  document.getElementById('panel-'+id).innerHTML = `
    <div class="panel-head"><h2>${title}</h2></div>
    <div class="empty-state"><div class="icon">🔲</div><h4>${desc}</h4>
    ${(needs||[]).map(n=>`<span class="need-tag">${n}</span>`).join('')}</div>`;
}
function panelHead(title, purpose, source, note){
  return `<div class="panel-head"><h2>${title}</h2>
    <div class="panel-q">目的：${purpose}</div>
    <div class="panel-desc">資料來源：${source}${note ? '　｜　'+note : ''}</div></div>`;
}
function monthsInRange(start, end){ return ALL_MONTHS.filter(m => m >= start && m <= end); }
function monthLabel(m){ return m.slice(2).replace('-','/'); }
function previousPeriodMonths(mA){
  if(!mA.length) return [];
  const idx0 = ALL_MONTHS.indexOf(mA[0]);
  const n = mA.length;
  const prevStart = idx0 - n;
  if(prevStart < 0) return ALL_MONTHS.slice(0, idx0);
  return ALL_MONTHS.slice(prevStart, idx0);
}
function getArticleTitle(url){
  return TITLE_MAP[url] || (CLS_MAP[url] && CLS_MAP[url].title) || url;
}

/* ============ 精簡版日期區間列 ============ */
function buildRangeBar(){
  const bar = document.getElementById('rangebar');
  if(!ALL_MONTHS.length){ bar.style.display='none'; return; }
  const latest = ALL_MONTHS[ALL_MONTHS.length-1];
  RANGE_A = { start: latest, end: latest }; // 預設：最新一個完整月份
  const opts = ALL_MONTHS.map(m=>`<option value="${m}">${m}</option>`).join('');
  bar.innerHTML = `
    <div class="rangebar-row">
      <label>檢視月份</label>
      <select id="rangeAStart">${opts}</select><span>至</span><select id="rangeAEnd">${opts}</select>
      <label class="compare-toggle"><input type="checkbox" id="compareToggle"> 比較另一期間</label>
      <span id="compareFields" style="display:none">
        <select id="rangeBStart">${opts}</select><span>至</span><select id="rangeBEnd">${opts}</select>
      </span>
      <button id="applyRangeBtn" class="apply-btn">套用</button>
    </div>
  `;
  document.getElementById('rangeAStart').value = latest;
  document.getElementById('rangeAEnd').value = latest;
  const prevIdx = Math.max(0, ALL_MONTHS.length-2);
  document.getElementById('rangeBStart').value = ALL_MONTHS[prevIdx];
  document.getElementById('rangeBEnd').value = ALL_MONTHS[prevIdx];
  document.getElementById('compareToggle').addEventListener('change', e=>{
    document.getElementById('compareFields').style.display = e.target.checked ? 'inline-flex' : 'none';
  });
  document.getElementById('applyRangeBtn').addEventListener('click', applyRange);
}
function applyRange(){
  RANGE_A = { start: document.getElementById('rangeAStart').value, end: document.getElementById('rangeAEnd').value };
  const compareOn = document.getElementById('compareToggle').checked;
  RANGE_B = compareOn ? { start: document.getElementById('rangeBStart').value, end: document.getElementById('rangeBEnd').value } : null;
  renderAll();
}

async function main(){
  buildShell();
  const [pageviewByMonth, trafficByMonth, gscQueryByMonth, gscPageByMonth, aiAssistByMonth,
         aioPagesByMonth, aioDailyByMonth, utmByMonth, bannerAdsByMonth, classificationRaw] = await Promise.all([
    loadMonthlyFolder('pageview'), loadMonthlyFolder('traffic-source'), loadMonthlyFolder('gsc-query'),
    loadMonthlyFolder('gsc-page'), loadMonthlyFolder('ai-assistant'),
    loadMonthlyFolder('gsc-aio', m => `${m}-pages.csv`), loadMonthlyFolder('gsc-aio', m => `${m}-daily.csv`),
    loadMonthlyFolder('utm-buttons'), loadMonthlyFolder('banner-ads'), loadSingleFile('data/classification/latest.csv')
  ]);
  DATA = { pageview:pageviewByMonth, traffic:trafficByMonth, kw:gscQueryByMonth, seo:gscPageByMonth,
            ai:aiAssistByMonth, aioPages:aioPagesByMonth, aioDaily:aioDailyByMonth, utm:utmByMonth, bannerAds:bannerAdsByMonth };
  CLS_MAP = buildClassificationMap(classificationRaw);

  // 建立全站標題對照表（供文章連結顯示標題用）
  Object.values(pageviewByMonth).forEach(m=>{ m.data.forEach(r=>{ const u=normUrl(r['到達網頁']); if(u && !TITLE_MAP[u]) TITLE_MAP[u]=r['網頁標題']; }); });

  const monthSet = new Set();
  Object.values(DATA).forEach(byMonth => Object.keys(byMonth).forEach(m=>monthSet.add(m)));
  ALL_MONTHS = Array.from(monthSet).sort();

  if(!ALL_MONTHS.length){
    document.getElementById('mainArea').innerHTML = `<div class="empty-state" style="margin-top:40px;"><div class="icon">📂</div><h4>data/ 資料夾內還沒有任何資料</h4></div>`;
    return;
  }
  buildRangeBar();
  renderAll();
}

function renderAll(){
  const mA = monthsInRange(RANGE_A.start, RANGE_A.end);
  const mB = RANGE_B ? monthsInRange(RANGE_B.start, RANGE_B.end) : null;
  renderOverview(mA, mB);
  renderTraffic(mA, mB);
  renderKeywords(mA, mB);
  renderSEO(mA, mB);
  renderMonitor();
  renderAIO(mA, mB);
  renderPath(mA);
  renderConversion(mA, mB);
  renderBuilding(mA);
  renderSocial();
  renderGuide();
}


/* 監控角色：SEO主打（人工指定9篇）／專家專欄／建案頁／生活提案一般 */
const SEO_URLS = new Set([
  '/life-proposal/pre-sale-property',
  '/life-proposal/how-to-calculate-house-size',
  '/life-proposal/things-to-note-when-viewing-a-house-2',
  '/life-proposal/kw_brand_construction_20240109',
  '/life-proposal/pre-sale-house-payment-methods',
  '/life-proposal/seo_youth-home-loan',
  '/life-proposal/area_presold-house-in-kaohsiung',
  '/life-proposal/area_presold-house-in-tainan',
  '/life-proposal/area_presold-house-in-taichung'
]);
const EXPERT_KEYS = [['law_y-rlee','律師'],['hoshichang','何世昌'],['housing-market','何世昌'],
  ['peizhen','劉佩真'],['macromicro','財經M平方'],['expert_zhu','朱智豪'],
  ['expert_li','李同榮'],['expert-li','李同榮']];
function expertOf(url){
  const s = String(url||'');
  if(s.includes('expert_ken')) return null;           // 商用不動產舊文，不列入專家
  for(const [k,name] of EXPERT_KEYS) if(s.includes(k)) return name;
  return null;
}
function classifyRole(url){
  const u = String(url||'');
  if(SEO_URLS.has(u)) return 'SEO主打文章';
  if(u.startsWith('/buildings/')) return '建案頁';
  if(expertOf(u)) return '專家專欄';
  if(u.startsWith('/life-proposal')) return '生活提案一般';
  return '其他';
}

function buildClassificationMap(raw){
  const map = {};
  if(!raw) return map;
  const cleanStr = s => String(s||'').replace(/[\u200b\u200c\u200d\ufeff]/g,'').trim();
  raw.data.forEach(row=>{
    let url = normUrl(row['官網連結']);
    if(!url) return;
    const big = cleanStr(row['大分類']);
    const mid = cleanStr(row['中分類']) === '遺產與贈與稅' ? '遺產與贈與' : cleanStr(row['中分類']);
    const title = cleanStr(row['標題']);
    const publish = cleanStr(row['上刊時間']) || null;
    const topic = cleanStr(row['生活提案']);
    if(big || title) map[url] = { big, mid, title, publish, topic };
  });
  return map;
}

/* ---------- 通用彙總 ---------- */
function aggTraffic(months){
  let chanTotals={}, catTotals={}, organicByCat={}, total=0;
  months.forEach(m=>{
    const tr = DATA.traffic[m]; if(!tr) return;
    tr.data.forEach(row=>{
      const users = toNum(row['所有使用者']);
      const chan = classifyChannel(row['來源/媒介']);
      const cat = classifyPage(row['網頁路徑'], row['網頁標題']);
      total += users; chanTotals[chan]=(chanTotals[chan]||0)+users; catTotals[cat]=(catTotals[cat]||0)+users;
      if(chan==='Organic Search') organicByCat[cat]=(organicByCat[cat]||0)+users;
    });
  });
  return {chanTotals, catTotals, organicByCat, total};
}
function trafficMonthlySeries(months){
  return months.map(m=>{
    const tr = DATA.traffic[m]; let total=0, organic=0; const organicByCat={};
    if(tr) tr.data.forEach(row=>{
      const u=toNum(row['所有使用者']); total+=u;
      const chan = classifyChannel(row['來源/媒介']);
      if(chan==='Organic Search'){ organic+=u; const cat=classifyPage(row['網頁路徑'],row['網頁標題']); organicByCat[cat]=(organicByCat[cat]||0)+u; }
    });
    return {month:m, total, organic, organicByCat};
  });
}
function aggKeywords(months){
  let catTotals={}, totalClicks=0, allRows=[];
  months.forEach(m=>{
    const kw = DATA.kw[m]; if(!kw) return;
    kw.data.forEach(r=>{
      const clicks = toNum(r['Google自然搜尋點擊次數']);
      const cat = classifyKeyword(r['Google自然搜尋關鍵字']);
      catTotals[cat]=(catTotals[cat]||0)+clicks; totalClicks+=clicks;
      allRows.push({ keyword:r['Google自然搜尋關鍵字'], clicks, impressions:toNum(r['Google自然搜尋曝光次數']), ctr:toNum(r['Google自然搜尋點擊率']), position:toNum(r['Google自然搜尋平均排名']) });
    });
  });
  const merged = {};
  allRows.forEach(r=>{
    if(!merged[r.keyword]) merged[r.keyword] = {keyword:r.keyword, clicks:0, impressions:0, position:0, ctr:0, n:0};
    merged[r.keyword].clicks += r.clicks; merged[r.keyword].impressions += r.impressions;
    merged[r.keyword].position += r.position; merged[r.keyword].ctr += r.ctr; merged[r.keyword].n++;
  });
  const rows = Object.values(merged).map(r=>({...r, position:r.position/r.n, ctr:r.ctr/r.n}));
  return {catTotals, totalClicks, rows};
}
function keywordMonthlySeries(months){
  return months.map(m=>{
    const kw = DATA.kw[m]; let total=0;
    if(kw) kw.data.forEach(r=>{ total += toNum(r['Google自然搜尋點擊次數']); });
    return {month:m, total};
  });
}
function aggSEO(months){
  const merged = {};
  months.forEach(m=>{
    const seo = DATA.seo[m]; if(!seo) return;
    seo.data.forEach(r=>{
      const url = normUrl(r['到達網頁'] || Object.values(r)[0]);
      const clicks = toNum(r['Google自然搜尋點擊次數']||r['clicks']);
      if(!merged[url]) merged[url] = { url, clicks:0, impressions:0, position:0, ctr:0, n:0 };
      merged[url].clicks += clicks;
      merged[url].impressions += toNum(r['Google自然搜尋曝光次數']||r['impressions']);
      merged[url].position += toNum(r['Google自然搜尋平均排名']||r['position']);
      merged[url].ctr += toNum(r['Google自然搜尋點擊率']||r['ctr']);
      merged[url].n++;
    });
  });
  return Object.values(merged).map(r=>({...r, position:r.position/r.n, ctr:r.ctr/r.n, cat:classifyPage(r.url)}));
}
function seoMonthlySeries(months){
  return months.map(m=>{
    const seo = DATA.seo[m]; let total=0;
    if(seo) seo.data.forEach(r=>{ total += toNum(r['Google自然搜尋點擊次數']); });
    return {month:m, total};
  });
}
function aggConversion(months){
  const byCat = {};
  months.forEach(m=>{
    const pv = DATA.pageview[m]; if(!pv) return;
    pv.data.forEach(r=>{
      const url = normUrl(r['到達網頁']); const title = r['網頁標題'];
      const cat = classifyPage(url, title);
      byCat[cat] = byCat[cat] || { users:0, appts:0, click_line:0, click_cs:0, click_phone:0, click_price:0, click_nav:0 };
      byCat[cat].users += toNum(r['所有使用者']); byCat[cat].appts += toNum(r['點擊預約賞屋']);
      byCat[cat].click_line += toNum(r['點擊Line']); byCat[cat].click_cs += toNum(r['點擊客服Omi']);
      byCat[cat].click_phone += toNum(r['點擊來電0800']); byCat[cat].click_price += toNum(r['點擊實價']); byCat[cat].click_nav += toNum(r['點擊導航']);
    });
  });
  return byCat;
}
function conversionMonthlySeries(months){
  return months.map(m=>{
    const pv = DATA.pageview[m]; let users=0, appts=0;
    if(pv) pv.data.forEach(r=>{ users+=toNum(r['所有使用者']); appts+=toNum(r['點擊預約賞屋']); });
    return {month:m, cvr: users? appts/users*100 : 0};
  });
}

/* ============ ① 總覽（含全歷史趨勢，不受篩選期間限制） ============ */
function renderOverview(mA, mB){
  const p = document.getElementById('panel-overview');
  const A = aggTraffic(mA);
  const kwA = aggKeywords(mA);
  let aioImpr = 0; mA.forEach(m=>{ const d=DATA.aioDaily[m]; if(d) d.data.forEach(r=>aioImpr+=toNum(r['曝光'])); });
  const rangeLabel = mA.length ? (mA.length===1? mA[0] : `${mA[0]} ~ ${mA[mA.length-1]}`) : '—';

  // 全歷史趨勢（不受篩選影響，讓總覽真正看得出走勢）
  const trendSeries = trafficMonthlySeries(ALL_MONTHS);
  const kwTrendSeries = keywordMonthlySeries(ALL_MONTHS);

  let compareBlock = '';
  if(mB && mB.length){
    compareBlock = `<div class="card" style="margin-bottom:18px;"><h3>期間比較</h3><div class="cap">A：${mA[0]}~${mA[mA.length-1]}　vs　B：${mB[0]}~${mB[mB.length-1]}</div>${chartBox('cmpChart', 200)}</div>`;
  }
  p.innerHTML = `
    ${panelHead('總覽', '一眼看懂網站整體表現與長期走勢', 'GA4到達頁面／Google Search Console', `目前檢視：${rangeLabel}`)}
    <div class="stat-row">
      <div class="stat-chip"><div class="n">${fmt(A.total)}</div><div class="l">全站使用者總數</div></div>
      <div class="stat-chip"><div class="n">${fmt(A.chanTotals['Organic Search']||0)}</div><div class="l">自然搜尋使用者</div></div>
      <div class="stat-chip"><div class="n">${fmt(kwA.totalClicks)}</div><div class="l">Google搜尋點擊總數</div></div>
      <div class="stat-chip"><div class="n">${fmt(aioImpr)}</div><div class="l">AI摘要曝光總次數</div></div>
    </div>
    <div class="card" style="margin-bottom:18px;"><h3>全站流量長期趨勢</h3><div class="cap">${ALL_MONTHS[0]} ~ ${ALL_MONTHS[ALL_MONTHS.length-1]}，不受上方檢視月份篩選影響</div>${chartBox('ovTrend',240)}</div>
    ${compareBlock}
    <div class="grid2">
      <div class="card"><h3>頁面類別佔比（全通路，當期）</h3>${chartBox('ovDonut1',200)}</div>
      <div class="card"><h3>流量管道佔比（當期）</h3>${chartBox('ovDonut2',200)}</div>
    </div>
  `;
  safeChart('ovTrend', { type:'line', data:{ labels: trendSeries.map(s=>monthLabel(s.month)), datasets:[
    {label:'全站使用者', data:trendSeries.map(s=>s.total), borderColor:SLATE, backgroundColor:SLATE, tension:.3},
    {label:'自然搜尋使用者', data:trendSeries.map(s=>s.organic), borderColor:TEAL, backgroundColor:TEAL, tension:.3},
    {label:'Google搜尋點擊', data:kwTrendSeries.map(s=>s.total), borderColor:GOLD, backgroundColor:GOLD, tension:.3, yAxisID:'y1', borderDash:[4,3]}
  ]}, options:{ plugins:{legend:{position:'bottom'}}, scales:{ y:{title:{display:true,text:'使用者數'}}, y1:{position:'right', title:{display:true,text:'搜尋點擊'}, grid:{drawOnChartArea:false}} } } });
  const cats = Object.keys(A.catTotals);
  safeChart('ovDonut1', { type:'doughnut', data:{labels:cats, datasets:[{data:cats.map(c=>A.catTotals[c]), backgroundColor:cats.map(c=>CAT_COLORS[c]||STONE)}]}, options:{plugins:{legend:{position:'bottom',labels:{boxWidth:9,font:{size:10}}}}, cutout:'58%'} });
  const chans = Object.keys(A.chanTotals);
  safeChart('ovDonut2', { type:'doughnut', data:{labels:chans, datasets:[{data:chans.map(c=>A.chanTotals[c]), backgroundColor:chans.map(c=>CHAN_COLORS[c]||STONE)}]}, options:{plugins:{legend:{position:'bottom',labels:{boxWidth:9,font:{size:9.5}}}}, cutout:'58%'} });
  if(mB && mB.length){
    const B = aggTraffic(mB); const kwB = aggKeywords(mB);
    safeChart('cmpChart', { type:'bar', data:{ labels:['全站使用者','自然搜尋使用者','Google搜尋點擊'],
      datasets:[ {label:'期間A', data:[A.total, A.chanTotals['Organic Search']||0, kwA.totalClicks], backgroundColor:TEAL},
                 {label:'期間B', data:[B.total, B.chanTotals['Organic Search']||0, kwB.totalClicks], backgroundColor:GOLD} ] },
      options:{ plugins:{legend:{position:'bottom'}} } });
  }
}

/* ============ ② 流量與來源（聚焦自然搜尋） ============ */
function renderTraffic(mA, mB){
  const p = document.getElementById('panel-traffic');
  if(!mA.length){ renderEmpty('traffic','流量與來源','此期間尚無資料',['data/traffic-source/YYYY-MM.csv']); return; }
  const A = aggTraffic(mA);
  const fullSeries = trafficMonthlySeries(ALL_MONTHS);
  const organicShareSeries = fullSeries.map(s=>({month:s.month, share: s.total? s.organic/s.total*100 : 0}));
  const organicCatSeries = fullSeries.map(s=>s.organicByCat);
  const cats = Object.keys(CAT_COLORS);

  const rows = Object.keys(A.chanTotals).map(c=>({name:c, users:A.chanTotals[c], share:A.chanTotals[c]/A.total*100})).sort((a,b)=>b.users-a.users);

  p.innerHTML = `
    ${panelHead('流量與來源', '深入分析自然搜尋流量的重要性與組成，其他管道僅供對照', 'GA4到達頁面（依來源/媒介重建管道分類）')}
    <div class="stat-row">
      <div class="stat-chip"><div class="n">${fmt(A.chanTotals['Organic Search']||0)}</div><div class="l">當期自然搜尋使用者</div></div>
      <div class="stat-chip"><div class="n">${A.total? (A.chanTotals['Organic Search']||0)/A.total*100 : 0 | 0}%</div><div class="l">自然搜尋佔全站比例</div></div>
      <div class="stat-chip"><div class="n">${fmt(A.total)}</div><div class="l">全站使用者（對照用）</div></div>
    </div>
    <div class="card" style="margin-bottom:18px;"><h3>自然搜尋佔比長期趨勢</h3><div class="cap">${ALL_MONTHS[0]} ~ ${ALL_MONTHS[ALL_MONTHS.length-1]}，自然搜尋使用者佔全站比例</div>${chartBox('organicShareTrend',220)}</div>
    <div class="card" style="margin-bottom:18px;"><h3>自然搜尋流量：依頁面類別逐月趨勢</h3><div class="cap">哪類內容承接自然搜尋流量、趨勢如何</div>${chartBox('organicCatTrend',240)}</div>
    <h3 class="section-label">對照：全通路管道組成（當期）</h3>
    <div class="grid2">
      <div class="card"><h3>流量管道佔比</h3>${chartBox('trChart',200)}</div>
      <div class="card"><h3>各管道使用者數</h3><table><thead><tr><th>管道</th><th class="num">使用者數</th><th class="num">佔比</th></tr></thead>
      <tbody>${rows.map(r=>`<tr><td>${r.name}</td><td class="num">${fmt(r.users)}</td><td class="num">${r.share.toFixed(1)}%</td></tr>`).join('')}</tbody></table></div>
    </div>
  `;
  safeChart('organicShareTrend', { type:'line', data:{ labels: fullSeries.map(s=>monthLabel(s.month)), datasets:[{label:'自然搜尋佔比(%)', data: organicShareSeries.map(s=>s.share), borderColor:TEAL, backgroundColor:TEAL, tension:.3}] }, options:{plugins:{legend:{display:false}}} });
  safeChart('organicCatTrend', { type:'line', data:{ labels: fullSeries.map(s=>monthLabel(s.month)), datasets: cats.map(c=>({label:c, data: organicCatSeries.map(o=>o[c]||0), borderColor:CAT_COLORS[c], backgroundColor:CAT_COLORS[c], tension:.3})) }, options:{plugins:{legend:{position:'bottom'}}} });
  safeChart('trChart', { type:'bar', data:{labels:rows.map(r=>r.name), datasets:[{label:'使用者數', data:rows.map(r=>r.users), backgroundColor:rows.map(r=>CHAN_COLORS[r.name]||STONE)}]}, options:{plugins:{legend:{display:false}}, indexAxis:'y'} });
}

/* ============ ③ 進站意圖：關鍵字 ============ */
function renderKeywords(mA, mB){
  const p = document.getElementById('panel-keywords');
  if(!mA.length){ renderEmpty('keywords','進站關鍵字','此期間尚無資料',['data/gsc-query/YYYY-MM.csv']); return; }
  const A = aggKeywords(mA);
  const catArr = Object.entries(A.catTotals).sort((a,b)=>b[1]-a[1]);
  const top15 = A.rows.slice().sort((a,b)=>b.clicks-a.clicks).slice(0,15);
  const series = keywordMonthlySeries(ALL_MONTHS);

  // 分析①：漲跌幅比較（跟上一個等長期間比）
  const prevMonths = previousPeriodMonths(mA);
  const prevA = prevMonths.length ? aggKeywords(prevMonths) : null;
  let moversHtml = '<p class="cap">尚無足夠歷史資料可比較</p>';
  if(prevA){
    const prevMap = {}; prevA.rows.forEach(r=>prevMap[r.keyword]=r.clicks);
    const movers = A.rows.map(r=>({keyword:r.keyword, now:r.clicks, prev:prevMap[r.keyword]||0, delta:r.clicks-(prevMap[r.keyword]||0)})).filter(r=>r.now>=5||r.prev>=5);
    const rising = movers.slice().sort((a,b)=>b.delta-a.delta).slice(0,8);
    const falling = movers.slice().sort((a,b)=>a.delta-b.delta).slice(0,8);
    moversHtml = `<div class="grid2">
      <div><h4 class="mini-h">📈 上升最多</h4><table><thead><tr><th>關鍵字</th><th class="num">前期→本期</th><th class="num">變化</th></tr></thead>
      <tbody>${rising.map(r=>`<tr><td>${r.keyword}</td><td class="num">${fmt(r.prev)}→${fmt(r.now)}</td><td class="num" style="color:${TEAL}">+${fmt(r.delta)}</td></tr>`).join('')}</tbody></table></div>
      <div><h4 class="mini-h">📉 下滑最多</h4><table><thead><tr><th>關鍵字</th><th class="num">前期→本期</th><th class="num">變化</th></tr></thead>
      <tbody>${falling.map(r=>`<tr><td>${r.keyword}</td><td class="num">${fmt(r.prev)}→${fmt(r.now)}</td><td class="num" style="color:${RUST}">${fmt(r.delta)}</td></tr>`).join('')}</tbody></table></div>
    </div>`;
  }

  // 分析②：高曝光低點閱率機會字（排名不錯但沒人點，標題/摘要可能要優化）
  const avgCtr = A.rows.reduce((s,r)=>s+r.ctr,0)/Math.max(1,A.rows.length);
  const opportunities = A.rows.filter(r=>r.impressions>=50 && r.ctr < avgCtr*0.6).sort((a,b)=>b.impressions-a.impressions).slice(0,10);

  p.innerHTML = `
    ${panelHead('進站意圖：關鍵字', '了解大家用什麼字搜尋進站，並找出上升/下滑趨勢與優化機會', 'Google Search Console')}
    <div class="card" style="margin-bottom:18px;"><h3>逐月點擊趨勢</h3><div class="cap">${ALL_MONTHS[0]} ~ ${ALL_MONTHS[ALL_MONTHS.length-1]}</div>${chartBox('kwTrend',200)}</div>
    <h3 class="section-label">分析①：本期 vs 上一期，誰漲誰跌</h3>
    <div class="card" style="margin-bottom:18px;">${moversHtml}</div>
    <h3 class="section-label">分析②：高曝光低點閱率（標題/摘要優化機會）</h3>
    <div class="card" style="margin-bottom:18px;"><div class="cap">曝光≥50次、點閱率低於當期平均60%的關鍵字——代表排名尚可但沒吸引人點擊</div>
    <table><thead><tr><th>關鍵字</th><th class="num">曝光</th><th class="num">點擊</th><th class="num">點閱率</th><th class="num">平均排名</th></tr></thead>
    <tbody>${opportunities.map(r=>`<tr><td>${r.keyword}</td><td class="num">${fmt(r.impressions)}</td><td class="num">${fmt(r.clicks)}</td><td class="num" style="color:${GOLD}">${(r.ctr*100).toFixed(2)}%</td><td class="num">${r.position.toFixed(1)}</td></tr>`).join('') || '<tr><td colspan="5">此期間無明顯機會字</td></tr>'}</tbody></table></div>
    <h3 class="section-label">基本盤：搜尋意圖10大類 ＋ TOP15關鍵字</h3>
    <div class="grid2">
      <div class="card"><h3>搜尋意圖10大類佔比</h3>${chartBox('kwDonut',220)}</div>
      <div class="card"><h3>類別清單</h3><table><thead><tr><th>分類</th><th class="num">點擊</th><th class="num">佔比</th></tr></thead>
      <tbody>${catArr.map(([c,v])=>`<tr><td>${c}</td><td class="num">${fmt(v)}</td><td class="num">${(v/A.totalClicks*100).toFixed(1)}%</td></tr>`).join('')}</tbody></table></div>
    </div>
    <div class="card"><h3>搜尋量前15名關鍵字</h3><table><thead><tr><th>關鍵字</th><th class="num">點擊</th><th class="num">曝光</th><th class="num">點閱率</th><th class="num">平均排名</th></tr></thead>
    <tbody>${top15.map(r=>`<tr><td>${r.keyword}</td><td class="num">${fmt(r.clicks)}</td><td class="num">${fmt(r.impressions)}</td><td class="num">${(r.ctr*100).toFixed(1)}%</td><td class="num">${r.position.toFixed(1)}</td></tr>`).join('')}</tbody></table></div>
  `;
  safeChart('kwTrend', { type:'line', data:{labels:series.map(s=>monthLabel(s.month)), datasets:[{label:'點擊', data:series.map(s=>s.total), borderColor:TEAL, backgroundColor:TEAL, tension:.3}]}, options:{plugins:{legend:{display:false}}} });
  const palette=[RUST,TEAL,GOLD,SLATE,PLUM,MOSS,SAND,STONE,"#4A5568","#BFAF9B"];
  safeChart('kwDonut', { type:'doughnut', data:{labels:catArr.map(c=>c[0]), datasets:[{data:catArr.map(c=>c[1]), backgroundColor:palette}]}, options:{plugins:{legend:{position:'bottom',labels:{boxWidth:9,font:{size:9.5}}}}, cutout:'55%'} });
}

/* ============ ④ 內容成效：文章與分類（原④+④b合併） ============ */
function renderSEO(mA, mB){
  const p = document.getElementById('panel-seo');
  if(!mA.length){ renderEmpty('seo','內容成效：文章與分類','此期間尚無資料',['data/gsc-page/YYYY-MM.csv']); return; }
  const rows = aggSEO(mA);
  const nonbuild = rows.filter(r=>r.cat!=='建案頁');
  const top20 = nonbuild.slice().sort((a,b)=>b.clicks-a.clicks).slice(0,20);
  const top20Sum = top20.reduce((s,r)=>s+r.clicks,0);
  const nbTotal = nonbuild.reduce((s,r)=>s+r.clicks,0);
  const grandTotal = rows.reduce((s,r)=>s+r.clicks,0);
  let bigTotals={}, coveredClicks=0;
  nonbuild.forEach(r=>{ const c = CLS_MAP[r.url]; if(c && c.big){ bigTotals[c.big]=(bigTotals[c.big]||0)+r.clicks; coveredClicks += r.clicks; } });
  const bigArr = Object.entries(bigTotals).sort((a,b)=>b[1]-a[1]);
  const coverage = nbTotal ? (coveredClicks/nbTotal*100) : 0;
  const series = seoMonthlySeries(ALL_MONTHS);

  // 分析①：本期 vs 上一期 文章漲跌
  const prevMonths = previousPeriodMonths(mA);
  const prevRows = prevMonths.length ? aggSEO(prevMonths) : [];
  const prevMap = {}; prevRows.forEach(r=>prevMap[r.url]=r.clicks);
  const movers = nonbuild.map(r=>({url:r.url, now:r.clicks, prev:prevMap[r.url]||0, delta:r.clicks-(prevMap[r.url]||0)})).filter(r=>r.now>=5||r.prev>=5);
  const rising = movers.slice().sort((a,b)=>b.delta-a.delta).slice(0,6);
  const falling = movers.slice().sort((a,b)=>a.delta-b.delta).slice(0,6);

  // 分析②：高曝光低點閱率文章（標題待優化）
  const avgCtr = nonbuild.reduce((s,r)=>s+r.ctr,0)/Math.max(1,nonbuild.length);
  const opportunities = nonbuild.filter(r=>r.impressions>=100 && r.ctr < avgCtr*0.6).sort((a,b)=>b.impressions-a.impressions).slice(0,8);

  // 大分類逐月（全歷史）+ 分類結構（供展開）
  const bigMonthly = {}; const structure = {};
  ALL_MONTHS.forEach(m=>{
    const seo = DATA.seo[m]; if(!seo) return;
    seo.data.forEach(r=>{
      const url = normUrl(r['到達網頁'] || Object.values(r)[0]);
      const clicks = toNum(r['Google自然搜尋點擊次數']);
      const c = CLS_MAP[url]; if(!c || !c.big) return;
      bigMonthly[c.big] = bigMonthly[c.big] || {};
      bigMonthly[c.big][m] = (bigMonthly[c.big][m]||0) + clicks;
      if(mA.includes(m)){
        structure[c.big] = structure[c.big] || {};
        structure[c.big][c.mid] = structure[c.big][c.mid] || {};
        structure[c.big][c.mid][url] = structure[c.big][c.mid][url] || { title:getArticleTitle(url), clicks:0 };
        structure[c.big][c.mid][url].clicks += clicks;
      }
    });
  });
  const bigCatsAll = Object.keys(bigMonthly);
  const structTotals = {}; Object.keys(structure).forEach(big=>{ structTotals[big]=Object.values(structure[big]).reduce((s,mid)=>s+Object.values(mid).reduce((s2,a)=>s2+a.clicks,0),0); });
  const bigOrder = Object.keys(structure).sort((a,b)=>structTotals[b]-structTotals[a]);
  const structGrand = Object.values(structTotals).reduce((s,v)=>s+v,0);

  p.innerHTML = `
    ${panelHead('內容成效：文章與分類', '了解進站後大家看什麼文章、哪個主題該投入，並找出上升/下滑與優化機會', 'Google Search Console ＋ 遠房官網文章對應分類表')}
    <div class="stat-row">
      <div class="stat-chip"><div class="n">${fmt(top20Sum)}</div><div class="l">TOP20頁面合計點擊</div></div>
      <div class="stat-chip"><div class="n">${nbTotal?(top20Sum/nbTotal*100).toFixed(1):0}%</div><div class="l">佔非建案內容比重</div></div>
      <div class="stat-chip"><div class="n">${grandTotal?(top20Sum/grandTotal*100).toFixed(1):0}%</div><div class="l">佔全站比重</div></div>
      <div class="stat-chip"><div class="n">${coverage.toFixed(1)}%</div><div class="l">官方分類表收錄率</div></div>
    </div>
    <div class="card" style="margin-bottom:18px;"><h3>逐月點擊趨勢（不含建案頁）</h3><div class="cap">${ALL_MONTHS[0]} ~ ${ALL_MONTHS[ALL_MONTHS.length-1]}</div>${chartBox('seoTrend',200)}</div>

    <h3 class="section-label">分析①：本期 vs 上一期，哪些文章漲跌最多</h3>
    <div class="card" style="margin-bottom:18px;"><div class="grid2">
      <div><h4 class="mini-h">📈 上升最多</h4><table><thead><tr><th>文章</th><th class="num">前期→本期</th><th class="num">變化</th></tr></thead>
      <tbody>${rising.map(r=>`<tr><td>${articleLink(r.url)}</td><td class="num">${fmt(r.prev)}→${fmt(r.now)}</td><td class="num" style="color:${TEAL}">+${fmt(r.delta)}</td></tr>`).join('') || '<tr><td colspan="3">尚無足夠資料比較</td></tr>'}</tbody></table></div>
      <div><h4 class="mini-h">📉 下滑最多</h4><table><thead><tr><th>文章</th><th class="num">前期→本期</th><th class="num">變化</th></tr></thead>
      <tbody>${falling.map(r=>`<tr><td>${articleLink(r.url)}</td><td class="num">${fmt(r.prev)}→${fmt(r.now)}</td><td class="num" style="color:${RUST}">${fmt(r.delta)}</td></tr>`).join('') || '<tr><td colspan="3">尚無足夠資料比較</td></tr>'}</tbody></table></div>
    </div></div>

    <h3 class="section-label">分析②：高曝光低點閱率（標題待優化）</h3>
    <div class="card" style="margin-bottom:18px;"><div class="cap">曝光≥100次、點閱率低於當期平均60%——排名不錯但標題不吸引人點擊</div>
    <table><thead><tr><th>文章</th><th class="num">曝光</th><th class="num">點擊</th><th class="num">點閱率</th><th class="num">排名</th></tr></thead>
    <tbody>${opportunities.map(r=>`<tr><td>${articleLink(r.url)}</td><td class="num">${fmt(r.impressions)}</td><td class="num">${fmt(r.clicks)}</td><td class="num" style="color:${GOLD}">${(r.ctr*100).toFixed(2)}%</td><td class="num">${r.position.toFixed(1)}</td></tr>`).join('') || '<tr><td colspan="5">此期間無明顯機會文章</td></tr>'}</tbody></table></div>

    <h3 class="section-label">基本盤：TOP20文章 ＋ 官方分類貢獻度</h3>
    <div class="grid2">
      <div class="card"><h3>官方大分類佔比（當期）</h3>${chartBox('seoBigDonut',220)}</div>
      <div class="card"><h3>TOP20文章（點標題開新視窗）</h3><table><thead><tr><th>#</th><th>文章</th><th class="num">點擊</th><th class="num">排名</th><th class="num">點閱率</th></tr></thead>
      <tbody>${top20.slice(0,12).map((a,i)=>`<tr><td>${i+1}</td><td>${articleLink(a.url)}</td><td class="num">${fmt(a.clicks)}</td><td class="num">${a.position.toFixed(1)}</td><td class="num">${(a.ctr*100).toFixed(1)}%</td></tr>`).join('')}</tbody></table></div>
    </div>

    <h3 class="section-label">大分類逐月趨勢 ＋ 展開至中分類／文章</h3>
    <div class="card" style="margin-bottom:18px;"><div class="cap">${ALL_MONTHS[0]} ~ ${ALL_MONTHS[ALL_MONTHS.length-1]}，長期趨勢不受檢視月份篩選影響</div>${chartBox('bigTrendChart',260)}</div>
    <div class="card"><h3>點大分類展開中分類，再點中分類展開文章（依當期資料）</h3><div id="drilldown"></div></div>
  `;
  safeChart('seoTrend', { type:'line', data:{ labels:series.map(s=>monthLabel(s.month)), datasets:[{label:'點擊', data:series.map(s=>s.total), borderColor:TEAL, backgroundColor:TEAL, tension:.3}] }, options:{plugins:{legend:{display:false}}} });
  safeChart('seoBigDonut', { type:'doughnut', data:{labels:bigArr.map(c=>c[0]), datasets:[{data:bigArr.map(c=>c[1]), backgroundColor:[TEAL,SLATE,GOLD,PLUM,MOSS,SAND,STONE]}]}, options:{plugins:{legend:{position:'bottom',labels:{boxWidth:9,font:{size:10}}}}, cutout:'55%'} });
  safeChart('bigTrendChart', { type:'line', data:{ labels: ALL_MONTHS.map(monthLabel), datasets: bigCatsAll.sort((a,b)=>Object.values(bigMonthly[b]).reduce((s,v)=>s+v,0)-Object.values(bigMonthly[a]).reduce((s,v)=>s+v,0)).map(c=>({label:c, data: ALL_MONTHS.map(m=>bigMonthly[c][m]||0), borderColor:BIG_COLORS[c]||STONE, backgroundColor:BIG_COLORS[c]||STONE, tension:.3})) },
    options:{ plugins:{legend:{position:'bottom',labels:{boxWidth:10,font:{size:10}}}} } });

  const dd = document.getElementById('drilldown');
  if(!bigOrder.length){ dd.innerHTML = '<p class="cap">此期間無已分類文章可展開</p>'; return; }
  dd.innerHTML = bigOrder.map(big=>{
    const share = (structTotals[big]/structGrand*100).toFixed(1);
    return `<div class="tree-row tree-big" data-big="${big}"><span class="tree-toggle">▸</span> <b>${big}</b><span class="tree-meta">${fmt(structTotals[big])} 次點擊　·　${share}%</span></div>
    <div class="tree-children" id="mid-${cssId(big)}" style="display:none"></div>`;
  }).join('');
  bigOrder.forEach(big=>{
    const row = dd.querySelector(`.tree-row[data-big="${CSS.escape(big)}"]`);
    row.addEventListener('click', ()=>{
      const container = document.getElementById('mid-'+cssId(big));
      const isOpen = container.style.display !== 'none';
      container.style.display = isOpen ? 'none' : 'block';
      row.querySelector('.tree-toggle').textContent = isOpen ? '▸' : '▾';
      if(!isOpen && !container.dataset.built){
        const mids = structure[big];
        const midTotals = Object.keys(mids).map(mid=>({mid, total: Object.values(mids[mid]).reduce((s,a)=>s+a.clicks,0)})).sort((a,b)=>b.total-a.total);
        container.innerHTML = midTotals.map(({mid,total})=>`
          <div class="tree-row tree-mid" data-big="${big}" data-mid="${mid}"><span class="tree-toggle">▸</span> ${mid} <span class="tree-meta">${fmt(total)} 次點擊</span></div>
          <div class="tree-children" id="art-${cssId(big)}-${cssId(mid)}" style="display:none"></div>`).join('');
        container.dataset.built = '1';
        midTotals.forEach(({mid})=>{
          const midRow = container.querySelector(`.tree-row[data-mid="${CSS.escape(mid)}"]`);
          midRow.addEventListener('click', (ev)=>{
            ev.stopPropagation();
            const artContainer = document.getElementById(`art-${cssId(big)}-${cssId(mid)}`);
            const artOpen = artContainer.style.display !== 'none';
            artContainer.style.display = artOpen ? 'none' : 'block';
            midRow.querySelector('.tree-toggle').textContent = artOpen ? '▸' : '▾';
            if(!artOpen && !artContainer.dataset.built){
              const articles = Object.entries(structure[big][mid]).map(([url,d])=>({url, ...d})).sort((a,b)=>b.clicks-a.clicks);
              artContainer.innerHTML = `<table><thead><tr><th>文章</th><th class="num">點擊</th></tr></thead><tbody>
                ${articles.map(a=>`<tr><td>${articleLink(a.url)}</td><td class="num">${fmt(a.clicks)}</td></tr>`).join('')}
              </tbody></table>`;
              artContainer.dataset.built = '1';
            }
          });
        });
      }
    });
  });
}
function cssId(s){ return String(s).replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g,'_'); }

/* ============ ⑤ 內容健康監控（三道閘門 × 四級判定 × 區間參數化） ============ */
function renderMonitor(){
  const p = document.getElementById('panel-monitor');
  const months = ALL_MONTHS.filter(m => DATA.seo[m]);
  if(months.length < 2){ renderEmpty('monitor','內容健康監控','至少需要2個月資料才能計算趨勢',['gsc_page 分頁（多個月份）']); return; }

  /* --- 門檻：優先讀 config 分頁，讀不到用預設 --- */
  const C = (typeof CONFIG === 'object' && CONFIG) ? CONFIG : {};
  const num = (k, d) => { const v = parseFloat(C[k]); return isNaN(v) ? d : v; };
  let TH = {
    clickDrop: num('點擊跌幅門檻%', 20),      // 點擊較比較期下滑超過此值
    posWorsen: num('排名退步門檻', 3),         // 平均排名退步超過此名次
    minImp:    num('最低曝光門檻_月', 300),     // 當期月均曝光低於此值不判定
    ctrAchieve:num('CTR達成率門檻%', 70),      // 實際CTR ÷ 該排名期望CTR
    exemptDays:num('新頁豁免天數', 90),
    peakDrop:  num('距高峰跌幅門檻%', 40)
  };

  /* --- 建立 url × month 的序列 --- */
  const S = {};
  months.forEach(m=>{
    DATA.seo[m].data.forEach(r=>{
      const url = normUrl(r['到達網頁'] || Object.values(r)[0]);
      if(!url || classifyPage(url)==='建案頁') return;
      (S[url] = S[url] || {c:{},i:{},t:{},p:{}});
      S[url].c[m] = toNum(r['Google自然搜尋點擊次數']);
      S[url].i[m] = toNum(r['Google自然搜尋曝光次數'] || r['Google自然搜尋曝光數']);
      S[url].t[m] = toNum(r['Google自然搜尋點擊率']);
      S[url].p[m] = toNum(r['Google自然搜尋平均排名']);
    });
  });

  /* --- 期間：跟隨頂部的檢視月份 --- */
  function periodMonths(){ return monthsInRange(RANGE_A.start, RANGE_A.end).filter(m=>DATA.seo[m]); }
  function shiftYear(ms){ return ms.map(m=>{ const [y,mm]=m.split('-'); return (Number(y)-1)+'-'+mm; }).filter(m=>DATA.seo[m]); }
  function basisMonths(cur, basis){
    if(basis==='yoy') return shiftYear(cur);
    const i0 = months.indexOf(cur[0]); const n = cur.length;
    return months.slice(Math.max(0,i0-n), i0);
  }
  const sum = (o, ms, k) => ms.reduce((s,m)=>s+((S[o]&&S[o][k][m])||0),0);
  function wPos(o, ms){ let a=0,b=0; ms.forEach(m=>{ const im=(S[o]&&S[o].i[m])||0, ps=(S[o]&&S[o].p[m]); if(im>0&&ps){a+=ps*im;b+=im;} }); return b? a/b : null; }

  /* --- 期望CTR：用本站自己各排名區間的中位數 --- */
  function median(arr){ if(!arr.length) return null; const a=arr.slice().sort((x,y)=>x-y); const h=Math.floor(a.length/2); return a.length%2?a[h]:(a[h-1]+a[h])/2; }
  function buildExpectedCtr(ms){
    const buckets={};
    Object.keys(S).forEach(u=>ms.forEach(m=>{
      const im=S[u].i[m], ps=S[u].p[m], ct=S[u].t[m];
      if(im>=50 && ps){ const b=Math.min(20,Math.max(1,Math.round(ps))); (buckets[b]=buckets[b]||[]).push(ct); }
    }));
    const exp={}; Object.keys(buckets).forEach(b=>exp[b]=median(buckets[b]));
    return pos => { if(!pos) return null; const b=Math.min(20,Math.max(1,Math.round(pos))); return exp[b]||null; };
  }

  /* --- 首次出現月份（沒有上刊日時的備援） --- */
  const firstSeen={}; Object.keys(S).forEach(u=>{ const ms=months.filter(m=>S[u].c[m]!=null||S[u].i[m]>0); firstSeen[u]=ms.length?ms[0]:null; });
  function ageDays(url, curEnd){
    const cls = CLS_MAP[url];
    const base = (cls && cls.publish) ? cls.publish : (firstSeen[url] ? firstSeen[url]+'-01' : null);
    if(!base) return null;
    return Math.round((new Date(curEnd+'-28') - new Date(base)) / 86400000);
  }

  let basis='prev', group='all', sortMode='alert';

  p.innerHTML = `
    ${panelHead('內容健康監控', '用一致的規則分出「該立刻改版 / 該觀察 / 資料不足 / 正常」，並直接給出建議動作',
      'Google Search Console ＋ 文章對應分類表', '期間跟隨上方「檢視月份」；門檻可在試算表 config 分頁調整')}
    <div class="stat-row" id="mStatStrip"></div>
    <div class="controls">
      <div class="ctrl-group"><label>比較基準</label>
        <select id="basisSel"><option value="prev">上一期（等長）</option><option value="yoy">去年同期</option></select></div>
      <div class="ctrl-group"><label>監控分群</label>
        <select id="groupSel"><option value="all">全部</option><option value="SEO主打文章">SEO主打</option><option value="專家專欄">專家專欄</option><option value="生活提案一般">生活提案一般</option></select></div>
      <div class="ctrl-group"><label>點擊跌幅門檻</label><div class="row"><input type="range" id="thClick" min="5" max="60" value="${TH.clickDrop}"><span class="ctrl-val" id="thClickV">${TH.clickDrop}%</span></div></div>
      <div class="ctrl-group"><label>最低曝光門檻（期間合計）</label><div class="row"><input type="range" id="thImp" min="0" max="3000" step="50" value="${TH.minImp}"><span class="ctrl-val" id="thImpV">${TH.minImp}</span></div></div>
      <div class="ctrl-group"><label>排序依據</label>
        <select id="sortSel"><option value="alert">警示等級</option><option value="clicks">當期點擊</option><option value="drop">跌幅</option></select></div>
    </div>
    <div class="panel-desc" id="mPeriodNote" style="margin:8px 0 12px"></div>
    <table><thead><tr><th style="width:20px"></th><th>文章</th><th>分類</th><th class="num">當期點擊</th><th class="num">變化</th>
      <th class="num">平均排名</th><th class="num">排名變化</th><th class="num">CTR達成率</th><th>建議動作</th></tr></thead>
    <tbody id="mTableBody"></tbody></table>`;

  function evaluate(){
    const cur = periodMonths(); if(!cur.length) return {rows:[], cur:[], base:[]};
    const base = basisMonths(cur, basis);
    const expCtr = buildExpectedCtr(cur);
    const curEnd = cur[cur.length-1];
    const rows = Object.keys(S).map(u=>{
      const cls = CLS_MAP[u] || {};
      const role = (typeof classifyRole==='function') ? classifyRole(u) : (cls.role || '生活提案一般');
      const c1=sum(u,cur,'c'), i1=sum(u,cur,'i'), c0=sum(u,base,'c');
      const p1=wPos(u,cur), p0=wPos(u,base);
      const ctr = i1>0 ? c1/i1 : null;
      const e = expCtr(p1);
      const achieve = (ctr!=null && e) ? ctr/e*100 : null;
      const dClick = (c0>0) ? (c1-c0)/c0*100 : null;
      const dPos = (p1!=null && p0!=null) ? p1-p0 : null;          // 正=退步
      const peak = Math.max(0, ...months.map(m=>(S[u].c[m]||0)));
      const peakDrop = peak>0 ? (peak-c1)/peak*100 : 0;
      const age = ageDays(u, curEnd);
      const scissors = (base.length && sum(u,base,'i')>0) ? ((i1-sum(u,base,'i'))/sum(u,base,'i')*100 > 0 && dClick!=null && dClick < -10) : false;

      let status, reasons=[];
      if(i1 < TH.minImp){ status='na'; }
      else if(age!=null && age < TH.exemptDays){ status='exempt'; }
      else {
        const hit=[];
        if(dClick!=null && dClick <= -TH.clickDrop) hit.push('click');
        if(dPos!=null && dPos > TH.posWorsen) hit.push('pos');
        if(achieve!=null && achieve < TH.ctrAchieve) hit.push('ctr');
        if(peakDrop >= TH.peakDrop) hit.push('peak');
        reasons=hit;
        if(hit.length>=2) status='red';
        else if(hit.length===1) status='orange';
        else if((dClick!=null && dClick <= -TH.clickDrop*0.7) || (dPos!=null && dPos > TH.posWorsen*0.7)) status='yellow';
        else status='green';
      }
      let action='維持現狀';
      if(status==='na') action='曝光不足，不判定';
      else if(status==='exempt') action='新頁觀察期，只看成長';
      else if(reasons.includes('peak') && reasons.includes('click')) action='全文重寫，更新法規與數據';
      else if(reasons.includes('pos')) action='補內容、更新時效性資訊';
      else if(reasons.includes('ctr') || scissors) action='改標題與 meta 描述';
      else if(reasons.includes('click')) action='檢查是否被新內容蠶食';
      else if(status==='yellow') action='列入觀察，下期再看';
      return {u, cls, role, c1, i1, dClick, p1, dPos, achieve, peakDrop, status, action};
    }).filter(r => r.c1>0 || r.i1>0);
    return {rows, cur, base};
  }

  const BADGE={red:'🔴 立即處理',orange:'🟠 需關注',yellow:'🟡 觀察中',green:'🟢 正常',na:'⚪ 資料不足',exempt:'⚪ 豁免中'};
  const COLOR={red:RUST,orange:GOLD,yellow:'#8A7A1E',green:TEAL,na:STONE,exempt:STONE};

  function render(){
    const {rows, cur, base} = evaluate();
    document.getElementById('mPeriodNote').innerHTML = cur.length
      ? `當期：${cur[0]} ~ ${cur[cur.length-1]}（${cur.length}個月）　｜　比較基準：${base.length? base[0]+' ~ '+base[base.length-1] : '<b style="color:'+RUST+'">無對應期間，變化欄為空</b>'}`
      : '請於上方選擇檢視月份';
    const shown = rows.filter(r => group==='all' || r.role===group);
    const counts={red:0,orange:0,yellow:0,green:0,na:0,exempt:0};
    shown.forEach(r=>counts[r.status]++);
    document.getElementById('mStatStrip').innerHTML = ['red','orange','yellow','green','na','exempt'].map(k=>
      `<div class="stat-chip"><div class="n" style="color:${COLOR[k]}">${counts[k]}</div><div class="l">${BADGE[k]}</div></div>`).join('');
    const ord={red:0,orange:1,yellow:2,green:3,exempt:4,na:5};
    let list=shown.slice();
    if(sortMode==='alert') list.sort((a,b)=>ord[a.status]-ord[b.status] || b.c1-a.c1);
    else if(sortMode==='clicks') list.sort((a,b)=>b.c1-a.c1);
    else list.sort((a,b)=>(a.dClick??0)-(b.dClick??0));
    list=list.slice(0,120);
    document.getElementById('mTableBody').innerHTML = list.map(r=>{
      const dc = r.dClick==null ? '—' : `<span style="color:${r.dClick>=0?TEAL:RUST}">${r.dClick>=0?'▲':'▼'}${Math.abs(r.dClick).toFixed(0)}%</span>`;
      const dp = r.dPos==null ? '—' : `<span style="color:${r.dPos<=0?TEAL:RUST}">${r.dPos>0?'+':''}${r.dPos.toFixed(1)}</span>`;
      const ac = r.achieve==null ? '—' : `<span style="color:${r.achieve<TH.ctrAchieve?RUST:INK}">${r.achieve.toFixed(0)}%</span>`;
      return `<tr onclick='openMonitorModal(${JSON.stringify(r.u)})'>
        <td><span class="dot ${r.status==='na'||r.status==='exempt'?'green':r.status}" style="background:${COLOR[r.status]}"></span></td>
        <td><b>${getArticleTitle(r.u)}</b><div class="url-sub">${r.u}</div></td>
        <td>${(r.cls.big||'')}${r.cls.mid?' / '+r.cls.mid:''}</td>
        <td class="num">${fmt(r.c1)}</td><td class="num">${dc}</td>
        <td class="num">${r.p1?r.p1.toFixed(1):'—'}</td><td class="num">${dp}</td>
        <td class="num">${ac}</td>
        <td><span class="badge ${r.status==='na'||r.status==='exempt'?'green':r.status}">${BADGE[r.status]}</span><div class="url-sub">${r.action}</div></td></tr>`;
    }).join('') || `<tr><td colspan="9" style="text-align:center;padding:24px;color:#888">此分群在本期間沒有資料</td></tr>`;
  }

  window.openMonitorModal = function(url){
    const s=S[url]; if(!s) return;
    const cs=months.map(m=>s.c[m]??null), ps=months.map(m=>s.p[m]??null);
    document.getElementById('modalContent').innerHTML = `
      <div class="modal-head"><div><h2>${articleLink(url)}</h2>
      <div class="modal-meta">${months[0]} ~ ${months[months.length-1]} 全期間點擊與平均排名</div></div>
      <button class="modal-close" onclick="document.getElementById('overlay').classList.remove('show')">&times;</button></div>
      ${chartBox('trendChart',240)}`;
    document.getElementById('overlay').classList.add('show');
    setTimeout(()=>{ safeChart('trendChart',{type:'line',data:{labels:months.map(monthLabel),datasets:[
      {label:'點擊',data:cs,borderColor:TEAL,backgroundColor:TEAL,tension:.3,yAxisID:'y',spanGaps:true},
      {label:'平均排名',data:ps,borderColor:GOLD,backgroundColor:GOLD,tension:.3,yAxisID:'y1',borderDash:[4,3],spanGaps:true}
    ]},options:{plugins:{legend:{position:'bottom'}},scales:{y:{title:{display:true,text:'點擊'}},
      y1:{position:'right',reverse:true,title:{display:true,text:'平均排名'},grid:{drawOnChartArea:false}}}}}); },30);
  };
  document.getElementById('overlay').addEventListener('click', e=>{ if(e.target.id==='overlay') e.target.classList.remove('show'); });
  document.getElementById('basisSel').addEventListener('change', e=>{ basis=e.target.value; render(); });
  document.getElementById('groupSel').addEventListener('change', e=>{ group=e.target.value; render(); });
  document.getElementById('sortSel').addEventListener('change', e=>{ sortMode=e.target.value; render(); });
  document.getElementById('thClick').addEventListener('input', e=>{ TH.clickDrop=+e.target.value; document.getElementById('thClickV').textContent=TH.clickDrop+'%'; render(); });
  document.getElementById('thImp').addEventListener('input', e=>{ TH.minImp=+e.target.value; document.getElementById('thImpV').textContent=TH.minImp; render(); });
  render();
}

/* ============ ⑥ AIO引用監測（含逐月趨勢） ============ */
function renderAIO(mA, mB){
  const p = document.getElementById('panel-aio');
  const hasAI = ALL_MONTHS.some(m=>DATA.ai[m]);
  const hasAIOd = ALL_MONTHS.some(m=>DATA.aioDaily[m]);
  if(!hasAI && !hasAIOd){ renderEmpty('aio','內容有沒有被AI引用','尚無資料',['data/ai-assistant/YYYY-MM.csv','data/gsc-aio/YYYY-MM-*.csv']); return; }

  let chanTotals={}, totalSessions=0, aiSessions=0;
  mA.forEach(m=>{ const ai=DATA.ai[m]; if(!ai) return; ai.data.forEach(r=>{
    const sessions = toNum(r['工作階段']||r['Sessions']);
    const chan = r['預設頻道群組']||r['Session default channel group']||r['頻道']||Object.values(r)[0];
    chanTotals[chan]=(chanTotals[chan]||0)+sessions; totalSessions+=sessions;
    if(String(chan).includes('AI Assistant')) aiSessions += sessions;
  });});
  let aioTotal=0, aioTopPages=[];
  mA.forEach(m=>{ const d=DATA.aioDaily[m]; if(d) d.data.forEach(r=>aioTotal+=toNum(r['曝光'])); });
  const latestAIOp = [...mA].reverse().find(m=>DATA.aioPages[m]);
  if(latestAIOp) aioTopPages = DATA.aioPages[latestAIOp].data.slice(0,10).map(r=>({url:String(r['熱門網頁']||Object.values(r)[0]).replace(SITE_ORIGIN,''), impressions:toNum(r['曝光'])}));

  // 全歷史逐月趨勢
  const aiTrend = ALL_MONTHS.map(m=>{
    const ai = DATA.ai[m]; let ses=0, total=0;
    if(ai) ai.data.forEach(r=>{ const s=toNum(r['工作階段']||r['Sessions']); total+=s; const chan=r['預設頻道群組']||r['Session default channel group']||r['頻道']||Object.values(r)[0]; if(String(chan).includes('AI Assistant')) ses+=s; });
    return {month:m, ses, total};
  });
  const aioTrend = ALL_MONTHS.map(m=>{ const d=DATA.aioDaily[m]; let t=0; if(d) d.data.forEach(r=>t+=toNum(r['曝光'])); return {month:m, total:t}; });

  p.innerHTML = `
    ${panelHead('內容有沒有被AI引用', '了解內容有沒有被AI引用、AI有沒有帶來流量', 'GA4 AI Assistant ＋ Google Search Console（生成式AI報告）')}
    <div class="stat-row">
      <div class="stat-chip"><div class="n">${fmt(aiSessions)}</div><div class="l">AI帶來的工作階段(ChatGPT/Gemini/DeepSeek/Copilot/Grok)</div></div>
      <div class="stat-chip"><div class="n">${totalSessions?(aiSessions/totalSessions*100).toFixed(2):0}%</div><div class="l">佔全站工作階段比例</div></div>
      <div class="stat-chip"><div class="n">${fmt(aioTotal)}</div><div class="l">AI摘要曝光總數（當期）</div></div>
    </div>
    <div class="grid2">
      <div class="card"><h3>AI帶來的工作階段：逐月趨勢</h3><div class="cap">${ALL_MONTHS[0]}~${ALL_MONTHS[ALL_MONTHS.length-1]}</div>${chartBox('aiTrendChart',220)}</div>
      <div class="card"><h3>AI摘要曝光：逐月趨勢</h3><div class="cap">${ALL_MONTHS[0]}~${ALL_MONTHS[ALL_MONTHS.length-1]}</div>${chartBox('aioTrendChart',220)}</div>
    </div>
    <div class="grid2">
      <div class="card"><h3>流量管道分布（含AI Assistant，當期）</h3>${chartBox('aioChan',220)}</div>
      <div class="card"><h3>被AI引用曝光最高的頁面（當期）</h3><table><thead><tr><th>頁面</th><th class="num">曝光</th></tr></thead>
      <tbody>${aioTopPages.map(r=>`<tr><td>${articleLink(r.url)}</td><td class="num">${fmt(r.impressions)}</td></tr>`).join('')}</tbody></table></div>
    </div>
    <div class="note-box">兩個資料來源單位不同（工作階段 vs 曝光次數），僅能分別看趨勢，不可相加。Perplexity目前兩個資料源都涵蓋不到。</div>
  `;
  safeChart('aiTrendChart', { type:'line', data:{labels:aiTrend.map(s=>monthLabel(s.month)), datasets:[{label:'AI Assistant工作階段', data:aiTrend.map(s=>s.ses), borderColor:GOLD, backgroundColor:GOLD, tension:.3}]}, options:{plugins:{legend:{display:false}}} });
  safeChart('aioTrendChart', { type:'line', data:{labels:aioTrend.map(s=>monthLabel(s.month)), datasets:[{label:'AI摘要曝光', data:aioTrend.map(s=>s.total), borderColor:SLATE, backgroundColor:SLATE, tension:.3}]}, options:{plugins:{legend:{display:false}}} });
  const chans = Object.keys(chanTotals);
  safeChart('aioChan', { type:'bar', data:{labels:chans, datasets:[{label:'工作階段', data:chans.map(c=>chanTotals[c]), backgroundColor: chans.map(c=>String(c).includes('AI Assistant')?GOLD:SLATE)}]}, options:{plugins:{legend:{display:false}}, indexAxis:'y'} });
}

/* ============ ⑦ 導流成效：內容→建案 ============ */
function renderPath(mA){
  const p = document.getElementById('panel-path');
  const utmMonths = mA.filter(m=>DATA.utm[m]);
  const bannerMonths = mA.filter(m=>DATA.bannerAds[m]);
  if(!utmMonths.length && !bannerMonths.length){ renderEmpty('path','什麼內容會導去看建案','此期間尚無資料',['data/utm-buttons/YYYY-MM.csv','data/banner-ads/YYYY-MM.csv','GA4漏斗探索匯出表格(待補)']); return; }

  let destByMonth = {}, destTotals = {}, campaignTotals = {};
  utmMonths.forEach(m=>{
    DATA.utm[m].data.forEach(r=>{
      const url = r['網頁路徑']||r['url']; const users = toNum(r['所有使用者']); const dest = classifyDest(url);
      destByMonth[dest] = destByMonth[dest] || {}; destByMonth[dest][m] = (destByMonth[dest][m]||0) + users;
      destTotals[dest] = (destTotals[dest]||0) + users;
      const camp = r['廣告活動']||'—'; campaignTotals[camp] = (campaignTotals[camp]||0) + users;
    });
  });
  const destTypes = Object.keys(destTotals);
  const campArr = Object.entries(campaignTotals).sort((a,b)=>b[1]-a[1]).slice(0,8);

  let bannerMonthlyImpr = {}, bannerMonthlyClicks = {}, bannerDestTotals = {}, bannerTotalImpr=0, bannerTotalClicks=0;
  bannerMonths.forEach(m=>{
    DATA.bannerAds[m].data.forEach(r=>{
      const impr = toNum(r['曝光']), clicks = toNum(r['點擊']);
      const dest = extractBannerDest(r['圖片名稱']);
      bannerMonthlyImpr[m] = (bannerMonthlyImpr[m]||0) + impr;
      bannerMonthlyClicks[m] = (bannerMonthlyClicks[m]||0) + clicks;
      bannerDestTotals[dest] = bannerDestTotals[dest] || {impr:0, clicks:0};
      bannerDestTotals[dest].impr += impr; bannerDestTotals[dest].clicks += clicks;
      bannerTotalImpr += impr; bannerTotalClicks += clicks;
    });
  });
  const bannerDestArr = Object.entries(bannerDestTotals).sort((a,b)=>b[1].impr-a[1].impr).slice(0,12);
  const bannerCTR = bannerTotalImpr ? (bannerTotalClicks/bannerTotalImpr*100) : 0;

  p.innerHTML = `
    ${panelHead('導流成效：內容→建案', '了解站內導流工具（文章按鈕、內文廣告橫幅）有沒有把讀者帶去建案頁', '站內按鈕UTM點擊 ＋ 內文廣告橫幅曝光/點擊', `「廣告活動」欄位是目的地代碼而非來源文章，只能看到「導去哪裡」`)}
    <h3 class="section-label">Ⓐ 文章內按鈕點擊</h3>
    ${utmMonths.length ? `
    <div class="card" style="margin-bottom:18px;"><h3>站內按鈕點擊：目的地類型逐月趨勢</h3>${chartBox('pathTrend',220)}</div>
    <div class="grid2">
      <div class="card"><h3>目的地類型合計</h3><table><thead><tr><th>類型</th><th class="num">使用者數</th></tr></thead>
      <tbody>${destTypes.sort((a,b)=>destTotals[b]-destTotals[a]).map(d=>`<tr><td>${d}</td><td class="num">${fmt(destTotals[d])}</td></tr>`).join('')}</tbody></table></div>
      <div class="card"><h3>依廣告活動代碼（目的地）</h3><table><thead><tr><th>代碼</th><th class="num">使用者數</th></tr></thead>
      <tbody>${campArr.map(([c,v])=>`<tr><td>${c}</td><td class="num">${fmt(v)}</td></tr>`).join('')}</tbody></table></div>
    </div>` : `<div class="empty-state"><div class="icon">🔲</div><h4>此期間尚無按鈕UTM資料</h4><span class="need-tag">data/utm-buttons/YYYY-MM.csv</span></div>`}

    <h3 class="section-label">Ⓑ 內文廣告橫幅（文章內Banner）</h3>
    ${bannerMonths.length ? `
    <div class="stat-row">
      <div class="stat-chip"><div class="n">${fmt(bannerTotalImpr)}</div><div class="l">橫幅曝光總數</div></div>
      <div class="stat-chip"><div class="n">${fmt(bannerTotalClicks)}</div><div class="l">橫幅點擊總數</div></div>
      <div class="stat-chip"><div class="n">${bannerCTR.toFixed(3)}%</div><div class="l">整體點閱率</div></div>
    </div>
    <div class="card" style="margin-bottom:18px;"><h3>內文廣告逐月曝光/點擊趨勢</h3>${chartBox('bannerTrend',220)}</div>
    <div class="card"><h3>依目的地建案代碼（點擊圖片名稱解析）</h3><table><thead><tr><th>目的地代碼</th><th class="num">曝光</th><th class="num">點擊</th><th class="num">點閱率</th></tr></thead>
    <tbody>${bannerDestArr.map(([d,v])=>`<tr><td>${d}</td><td class="num">${fmt(v.impr)}</td><td class="num">${fmt(v.clicks)}</td><td class="num">${v.impr?(v.clicks/v.impr*100).toFixed(2):0}%</td></tr>`).join('')}</tbody></table></div>
    <div class="note-box">內文廣告整體點閱率偏低，代表這個版位的曝光量雖大，但實際帶來的點擊非常有限，建議評估版位設計或改用其他導流方式。</div>
    ` : `<div class="empty-state"><div class="icon">🔲</div><h4>此期間尚無內文廣告資料</h4><span class="need-tag">data/banner-ads/YYYY-MM.csv</span></div>`}

    <div class="empty-state" style="margin-top:18px;"><div class="icon">🔲</div><h4>GA4漏斗探索資料待補</h4>
    <p>「看過生活提案→看過建案頁（自然流量）」的漏斗步驟人數/轉換率，設定完成後匯出表格即可補上。</p>
    <span class="need-tag">GA4漏斗探索匯出表格</span></div>
  `;
  if(utmMonths.length){
    safeChart('pathTrend', { type:'bar', data:{ labels: utmMonths.map(monthLabel), datasets: destTypes.map((d,i)=>({label:d, data:utmMonths.map(m=>destByMonth[d][m]||0), backgroundColor:[RUST,GOLD,TEAL,SLATE,PLUM,STONE][i%6]})) },
      options:{ plugins:{legend:{position:'bottom'}}, scales:{x:{stacked:true},y:{stacked:true}} } });
  }
  if(bannerMonths.length){
    safeChart('bannerTrend', { type:'bar', data:{ labels: bannerMonths.map(monthLabel), datasets:[
      {type:'bar', label:'曝光', data: bannerMonths.map(m=>bannerMonthlyImpr[m]||0), backgroundColor:SAND, yAxisID:'y'},
      {type:'line', label:'點擊', data: bannerMonths.map(m=>bannerMonthlyClicks[m]||0), borderColor:RUST, backgroundColor:RUST, yAxisID:'y1', tension:.3}
    ]}, options:{ plugins:{legend:{position:'bottom'}}, scales:{ y:{title:{display:true,text:'曝光'}}, y1:{position:'right', title:{display:true,text:'點擊'}, grid:{drawOnChartArea:false}} } } });
  }
}

/* ============ ⑧ 轉換與留單 ============ */
function renderConversion(mA, mB){
  const p = document.getElementById('panel-conversion');
  if(!mA.some(m=>DATA.pageview[m])){ renderEmpty('conversion','流量有沒有變成名單','此期間尚無資料',['data/pageview/YYYY-MM.csv']); return; }
  const byCat = aggConversion(mA);
  let notfoundUsers=0, notfoundAppts=0;
  mA.forEach(m=>{ const pv=DATA.pageview[m]; if(!pv) return; pv.data.forEach(r=>{ if(String(r['網頁標題']).includes('找不到頁面')){ notfoundUsers+=toNum(r['所有使用者']); notfoundAppts+=toNum(r['點擊預約賞屋']); } }); });
  const catArr = Object.entries(byCat).sort((a,b)=>b[1].users-a[1].users);
  const build = byCat['建案頁'] || {users:0,appts:0,click_line:0,click_cs:0,click_phone:0,click_price:0,click_nav:0};
  const series = conversionMonthlySeries(ALL_MONTHS);
  p.innerHTML = `
    ${panelHead('流量有沒有變成名單', '了解流量最後有沒有變成名單，哪裡在浪費流量', 'GA4到達頁面')}
    <div class="card" style="margin-bottom:18px;"><h3>建案頁轉換率逐月趨勢</h3><div class="cap">${ALL_MONTHS[0]}~${ALL_MONTHS[ALL_MONTHS.length-1]}</div>${chartBox('cvTrend',200)}</div>
    <div class="grid2">
      <div class="card"><h3>各類別預約賞屋轉換率（當期）</h3>${chartBox('cvChart',220)}</div>
      <div class="card"><h3>各類型點擊數（建案頁，當期）</h3><table><thead><tr><th>類型</th><th class="num">點擊數</th></tr></thead>
      <tbody><tr><td>預約賞屋</td><td class="num">${fmt(build.appts)}</td></tr><tr><td>點擊LINE</td><td class="num">${fmt(build.click_line)}</td></tr>
      <tr><td>點擊客服Omi</td><td class="num">${fmt(build.click_cs)}</td></tr><tr><td>點擊來電0800</td><td class="num">${fmt(build.click_phone)}</td></tr>
      <tr><td>點擊實價</td><td class="num">${fmt(build.click_price)}</td></tr><tr><td>點擊導航</td><td class="num">${fmt(build.click_nav)}</td></tr></tbody></table></div>
    </div>
    <div class="card"><h3>404流失清單（當期）</h3><div class="stat-row" style="margin-top:10px;">
      <div class="stat-chip"><div class="n" style="color:${RUST}">${fmt(notfoundUsers)}</div><div class="l">404頁面訪問人次</div></div>
      <div class="stat-chip"><div class="n" style="color:${RUST}">${fmt(notfoundAppts)}</div><div class="l">其中轉換數</div></div></div></div>
    <div class="empty-state"><div class="icon">🔲</div><h4>第一次接觸到成交歷程 — 目前資料無法回答</h4>
    <p>需要銷售系統的成交名單反查造訪紀錄，或GA4事件層級明細＋使用者ID才能建立。</p>
    <span class="need-tag">銷售成交名單</span><span class="need-tag">GA4事件層級明細</span></div>
  `;
  safeChart('cvTrend', { type:'line', data:{labels:series.map(s=>monthLabel(s.month)), datasets:[{label:'建案頁轉換率(%)', data:series.map(s=>s.cvr), borderColor:RUST, backgroundColor:RUST, tension:.3}]}, options:{plugins:{legend:{display:false}}} });
  safeChart('cvChart', { type:'bar', data:{labels:catArr.map(x=>x[0]), datasets:[{label:'轉換率(%)', data:catArr.map(x=>x[1].users?x[1].appts/x[1].users*100:0), backgroundColor:catArr.map(x=>CAT_COLORS[x[0]]||SLATE)}]}, options:{plugins:{legend:{display:false}}} });
}

/* ============ ⑨ 建案獨立分析 ============ */
function renderBuilding(mA){
  const p = document.getElementById('panel-building');
  const months = mA.filter(m=>DATA.pageview[m]);
  if(!months.length){ renderEmpty('building','單一建案表現','此期間尚無資料',['同⑧']); return; }
  const buildings = {}; const buildingsMonthly = {};
  months.forEach(m=>{
    DATA.pageview[m].data.forEach(r=>{
      const url = normUrl(r['到達網頁']); if(!url.includes('buildings')) return;
      buildings[url] = buildings[url] || { title:r['網頁標題'], users:0, appts:0 };
      buildings[url].users += toNum(r['所有使用者']); buildings[url].appts += toNum(r['點擊預約賞屋']);
      buildingsMonthly[url] = buildingsMonthly[url] || {};
      buildingsMonthly[url][m] = (buildingsMonthly[url][m]||0) + toNum(r['所有使用者']);
    });
  });
  const list = Object.entries(buildings).sort((a,b)=>b[1].users-a[1].users);
  p.innerHTML = `
    ${panelHead('單一建案表現', '檢視單一建案自己的表現，不與其他建案混在一起看', 'GA4到達頁面')}
    <div class="controls"><div class="ctrl-group"><label>選擇建案</label><select id="buildingSelect">
      ${list.map(([u,d])=>`<option value="${u}">${d.title}</option>`).join('')}
    </select></div></div>
    <div id="buildingDetail"></div>
  `;
  function showBuilding(url){
    const d = buildings[url];
    document.getElementById('buildingDetail').innerHTML = `
      <div class="stat-row"><div class="stat-chip"><div class="n">${fmt(d.users)}</div><div class="l">使用者數（當期）</div></div>
      <div class="stat-chip"><div class="n">${fmt(d.appts)}</div><div class="l">預約賞屋點擊</div></div>
      <div class="stat-chip"><div class="n">${d.users?(d.appts/d.users*100).toFixed(2):0}%</div><div class="l">轉換率</div></div></div>
      <div class="card"><h3>逐月流量趨勢</h3>${chartBox('buildingTrend',200)}</div>`;
    const fullMonths = ALL_MONTHS.filter(m=>DATA.pageview[m]);
    const fullSeries = fullMonths.map(m=>{
      const pv = DATA.pageview[m]; let u=0;
      pv.data.forEach(r=>{ if(normUrl(r['到達網頁'])===url) u+=toNum(r['所有使用者']); });
      return {month:m, users:u};
    });
    safeChart('buildingTrend', { type:'line', data:{ labels: fullMonths.map(monthLabel), datasets:[{label:'使用者數', data: fullSeries.map(s=>s.users), borderColor:RUST, backgroundColor:RUST, tension:.3}] }, options:{plugins:{legend:{display:false}}} });
  }
  document.getElementById('buildingSelect').addEventListener('change', e=>showBuilding(e.target.value));
  if(list.length) showBuilding(list[0][0]);
}

function renderSocial(){
  renderEmpty('social','FB/IG/YT/TikTok經營成效','待每月人工填表（觸及/互動/完播率/受眾池新增/導站外數/廣告花費/廣告轉換）',['data/social/YYYY-MM.csv（人工填寫）']);
}

function renderGuide(){
  const p = document.getElementById('panel-guide');
  const stat = (obj, label) => { const ms = sortedMonths(obj); return `<tr><td>${label}</td><td>${ms.length? ms.join(', ') : '<i>尚無資料</i>'}</td></tr>`; };
  p.innerHTML = `
    <div class="panel-head"><h2>資料說明</h2></div>
    <div class="card"><h3>目前已偵測到的資料月份</h3>
      <table class="req-table"><thead><tr><th>資料夾</th><th>已有的月份</th></tr></thead><tbody>
        ${stat(DATA.pageview,'data/pageview/')}${stat(DATA.traffic,'data/traffic-source/')}${stat(DATA.kw,'data/gsc-query/')}
        ${stat(DATA.seo,'data/gsc-page/')}${stat(DATA.ai,'data/ai-assistant/')}${stat(DATA.utm,'data/utm-buttons/')}${stat(DATA.bannerAds,'data/banner-ads/')}
        <tr><td>data/classification/latest.csv</td><td>${Object.keys(CLS_MAP).length ? ('已載入，'+Object.keys(CLS_MAP).length+'筆') : '<i>尚無資料</i>'}</td></tr>
      </tbody></table>
    </div>
    <div class="card" style="margin-top:16px;"><h3>怎麼加新月份資料</h3>
      <ol style="font-size:12.5px;color:var(--ink-soft);line-height:1.9;">
        <li>每月匯出時維持相同欄位格式（跟現有檔案一致）</li>
        <li>檔名存成 <code>YYYY-MM.csv</code>，丟進對應的 <code>data/</code> 子資料夾</li>
        <li>commit並push到GitHub，重新整理網頁即可看到新月份自動出現在上方的檢視月份選單裡</li>
        <li>分類表只有新增文章時才需要更新，直接覆蓋 <code>data/classification/latest.csv</code></li>
      </ol>
    </div>
  `;
}

main();
