// app.js — 主程式：讀取 data/ 資料夾、整理各分頁資料、渲染圖表與表格

const INK="#1B2430", TEAL="#2F6F5E", GOLD="#C08A3E", RUST="#B5533C", SLATE="#5C7290", PLUM="#7A5C7E", MOSS="#7A8B5A", SAND="#D8C9A3", STONE="#8C97A6";
const CAT_COLORS = {"建案頁":RUST,"生活提案(其他)":SAND,"專家文章":PLUM,"建案熱區巡禮":MOSS,"其他頁面":STONE};
const CHAN_COLORS = {"LINE":"#06C755","Paid Search/Display":GOLD,"Direct":SLATE,"Organic Social":PLUM,"Organic Search":TEAL,"Other":STONE,"Unassigned":"#C2C2C2","Referral":SAND,"Paid Social":RUST};
const BIG_COLORS = {"稅務與繼承":TEAL,"不動產交易":SLATE,"區域環境":SAND,"建築與品牌":MOSS,"居住與維護":PLUM,"市場與政策":STONE,"商用不動產":GOLD};

function fmt(n){ return Math.round(n||0).toLocaleString('en-US'); }
function pct(n){ return (n>0?'+':'') + n.toFixed(1) + '%'; }
function hasChart(){ return typeof Chart !== 'undefined'; }
function safeChart(canvasId, config){
  if(!hasChart()){
    const el = document.getElementById(canvasId);
    if(el) el.replaceWith(Object.assign(document.createElement('div'), {className:'chart-fallback', textContent:'圖表庫尚未載入，僅顯示表格數字'}));
    return null;
  }
  return new Chart(document.getElementById(canvasId), config);
}

const TABS = [
  {id:'overview', label:'① 總覽'},
  {id:'traffic', label:'② 流量與來源'},
  {id:'keywords', label:'③ 進站關鍵字'},
  {id:'seo', label:'④ SEO文章與排名成效'},
  {id:'category', label:'④b 內容分類貢獻度'},
  {id:'monitor', label:'⑤ 內容健康監控'},
  {id:'aio', label:'⑥ AIO引用監測'},
  {id:'path', label:'⑦ 內容→建案路徑'},
  {id:'conversion', label:'⑧ 轉換與留單'},
  {id:'building', label:'⑨ 建案獨立分析'},
  {id:'social', label:'⑩ 自媒體'},
  {id:'guide', label:'📋 資料說明'}
];

function buildShell(){
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

async function main(){
  buildShell();

  const [pageviewByMonth, trafficByMonth, gscQueryByMonth, gscPageByMonth, aiAssistByMonth,
         aioPagesByMonth, aioDailyByMonth, utmByMonth, classificationRaw] = await Promise.all([
    loadMonthlyFolder('pageview'),
    loadMonthlyFolder('traffic-source'),
    loadMonthlyFolder('gsc-query'),
    loadMonthlyFolder('gsc-page'),
    loadMonthlyFolder('ai-assistant'),
    loadMonthlyFolder('gsc-aio', m => `${m}-pages.csv`),
    loadMonthlyFolder('gsc-aio', m => `${m}-daily.csv`),
    loadMonthlyFolder('utm-buttons'),
    loadSingleFile('data/classification/latest.csv')
  ]);

  const clsMap = buildClassificationMap(classificationRaw);

  const latestPV = latestMonth(pageviewByMonth);
  const latestTR = latestMonth(trafficByMonth);
  const latestKW = latestMonth(gscQueryByMonth);
  const latestSEO = latestMonth(gscPageByMonth);
  const latestAI = latestMonth(aiAssistByMonth);
  const latestAIOp = latestMonth(aioPagesByMonth);
  const latestAIOd = latestMonth(aioDailyByMonth);

  if(!latestPV && !latestTR && !latestKW && !latestSEO){
    document.getElementById('mainArea').innerHTML = `<div class="empty-state" style="margin-top:40px;"><div class="icon">📂</div><h4>data/ 資料夾內還沒有任何資料</h4><p>請依 📋資料說明 分頁的格式，把CSV放進對應的 data/ 子資料夾後重新整理頁面。</p></div>`;
    return;
  }

  renderOverview(pageviewByMonth, trafficByMonth, gscQueryByMonth, aioDailyByMonth, latestTR, latestKW, latestAIOd);
  renderTraffic(trafficByMonth, latestTR);
  renderKeywords(gscQueryByMonth, latestKW);
  renderSEO(gscPageByMonth, latestSEO, clsMap);
  renderCategoryTrend(gscPageByMonth, clsMap);
  renderMonitor(gscPageByMonth);
  renderAIO(aiAssistByMonth, aioPagesByMonth, aioDailyByMonth, latestAI, latestAIOp, latestAIOd);
  renderPath(utmByMonth);
  renderConversion(pageviewByMonth, latestPV);
  renderBuilding(pageviewByMonth, latestPV);
  renderSocial();
  renderGuide(pageviewByMonth, trafficByMonth, gscQueryByMonth, gscPageByMonth, aiAssistByMonth, utmByMonth, classificationRaw);
}

function buildClassificationMap(raw){
  const map = {};
  if(!raw) return map;
  raw.data.forEach(row=>{
    let url = String(row['官網連結']||'').trim();
    url = url.replace(/^https?:\/\/[^/]+/, '').replace(/\/+$/, '');
    if(url && !url.startsWith('/')) url = '/' + url;
    if(!url) return;
    const big = String(row['大分類']||'').trim();
    const mid = String(row['中分類']||'').trim();
    const title = String(row['標題']||'').trim();
    if(big) map[url] = { big, mid, title };
  });
  return map;
}

/* ============ ① 總覽 ============ */
function renderOverview(pvByMonth, trByMonth, kwByMonth, aioDByMonth, latestTR, latestKW, latestAIOd){
  const p = document.getElementById('panel-overview');
  const tr = latestTR ? trByMonth[latestTR] : null;
  const kw = latestKW ? kwByMonth[latestKW] : null;
  const aioD = latestAIOd ? aioDByMonth[latestAIOd] : null;

  let totalUsers=0, organicUsers=0, catTotals={}, chanTotals={};
  if(tr){
    tr.data.forEach(row=>{
      const users = toNum(row['所有使用者']);
      const chan = classifyChannel(row['來源/媒介']);
      const cat = classifyPage(row['網頁路徑'], row['網頁標題']);
      totalUsers += users;
      chanTotals[chan] = (chanTotals[chan]||0) + users;
      catTotals[cat] = (catTotals[cat]||0) + users;
      if(chan==='Organic Search') organicUsers += users;
    });
  }
  let kwClicks = 0;
  if(kw){ kw.data.forEach(r=>{ kwClicks += toNum(r['Google自然搜尋點擊次數']); }); }
  let aioImpr = 0;
  if(aioD){ aioD.data.forEach(r=>{ aioImpr += toNum(r['曝光']); }); }

  p.innerHTML = `
    <div class="panel-head"><h2>總覽 Dashboard</h2><div class="panel-q">回答：這個月網站整體好不好？</div>
    <div class="panel-desc">資料月份：${latestTR||'—'}。自然搜尋佔全站使用者 ${totalUsers?(organicUsers/totalUsers*100).toFixed(1):'—'}%。</div></div>
    <div class="stat-row">
      <div class="stat-chip"><div class="n">${fmt(totalUsers)}</div><div class="l">全站使用者總數（${latestTR||'—'}）</div></div>
      <div class="stat-chip"><div class="n">${fmt(organicUsers)}</div><div class="l">自然搜尋使用者</div></div>
      <div class="stat-chip"><div class="n">${fmt(kwClicks)}</div><div class="l">GSC查詢字總點擊（${latestKW||'—'}）</div></div>
      <div class="stat-chip"><div class="n">${fmt(aioImpr)}</div><div class="l">AIO曝光總次數（${latestAIOd||'—'}）</div></div>
    </div>
    <div class="grid2">
      <div class="card"><h3>頁面類別佔比（全通路）</h3><canvas id="ovDonut1" height="230"></canvas></div>
      <div class="card"><h3>頻道分組佔比</h3><canvas id="ovDonut2" height="230"></canvas></div>
    </div>
  `;
  const cats = Object.keys(catTotals);
  safeChart('ovDonut1', { type:'doughnut', data:{labels:cats, datasets:[{data:cats.map(c=>catTotals[c]), backgroundColor:cats.map(c=>CAT_COLORS[c]||STONE)}]}, options:{plugins:{legend:{position:'bottom',labels:{boxWidth:9,font:{size:10}}}}, cutout:'58%'} });
  const chans = Object.keys(chanTotals);
  safeChart('ovDonut2', { type:'doughnut', data:{labels:chans, datasets:[{data:chans.map(c=>chanTotals[c]), backgroundColor:chans.map(c=>CHAN_COLORS[c]||STONE)}]}, options:{plugins:{legend:{position:'bottom',labels:{boxWidth:9,font:{size:9.5}}}}, cutout:'58%'} });
}

/* ============ ② 流量與來源 ============ */
function renderTraffic(trByMonth, latestTR){
  const p = document.getElementById('panel-traffic');
  if(!latestTR){ renderEmpty('traffic','流量與來源','尚無 data/traffic-source/ 資料',['data/traffic-source/YYYY-MM.csv']); return; }
  const tr = trByMonth[latestTR];
  let chanTotals={}, organicByCat={}, total=0;
  tr.data.forEach(row=>{
    const users = toNum(row['所有使用者']);
    const chan = classifyChannel(row['來源/媒介']);
    const cat = classifyPage(row['網頁路徑'], row['網頁標題']);
    chanTotals[chan] = (chanTotals[chan]||0) + users;
    total += users;
    if(chan==='Organic Search') organicByCat[cat] = (organicByCat[cat]||0) + users;
  });
  const rows = Object.keys(chanTotals).map(c=>({name:c, users:chanTotals[c], share:chanTotals[c]/total*100})).sort((a,b)=>b.users-a.users);
  p.innerHTML = `
    <div class="panel-head"><h2>流量與來源</h2><div class="panel-q">回答：流量結構有沒有在改變？自然搜尋重不重要？</div>
    <div class="panel-desc">資料月份：${latestTR}。依「來源/媒介」重建頻道分組（無現成頻道分組欄位時的替代做法）。</div></div>
    <div class="grid2">
      <div class="card"><h3>頻道分組佔比</h3><canvas id="trChart" height="230"></canvas></div>
      <div class="card"><h3>各頻道使用者數</h3><table><thead><tr><th>頻道</th><th class="num">使用者數</th><th class="num">佔比</th></tr></thead>
      <tbody>${rows.map(r=>`<tr><td>${r.name}</td><td class="num">${fmt(r.users)}</td><td class="num">${r.share.toFixed(1)}%</td></tr>`).join('')}</tbody></table></div>
    </div>
    <div class="card"><h3>自然搜尋流量：依頁面類別分布</h3><canvas id="trOrganicBreak" height="180"></canvas></div>
  `;
  safeChart('trChart', { type:'bar', data:{labels:rows.map(r=>r.name), datasets:[{label:'使用者數', data:rows.map(r=>r.users), backgroundColor:rows.map(r=>CHAN_COLORS[r.name]||STONE)}]}, options:{plugins:{legend:{display:false}}, indexAxis:'y'} });
  const obCats = Object.keys(organicByCat);
  safeChart('trOrganicBreak', { type:'bar', data:{labels:obCats, datasets:[{label:'自然搜尋使用者數', data:obCats.map(c=>organicByCat[c]), backgroundColor:obCats.map(c=>CAT_COLORS[c]||STONE)}]}, options:{plugins:{legend:{display:false}}} });
}

/* ============ ③ 進站關鍵字 ============ */
function renderKeywords(kwByMonth, latestKW){
  const p = document.getElementById('panel-keywords');
  if(!latestKW){ renderEmpty('keywords','進站關鍵字','尚無 data/gsc-query/ 資料',['data/gsc-query/YYYY-MM.csv']); return; }
  const kw = kwByMonth[latestKW];
  let catTotals={};
  const rows = kw.data.map(r=>({
    keyword: r['Google自然搜尋關鍵字'], clicks: toNum(r['Google自然搜尋點擊次數']),
    impressions: toNum(r['Google自然搜尋曝光次數']), ctr: toNum(r['Google自然搜尋點擊率']), position: toNum(r['Google自然搜尋平均排名'])
  }));
  rows.forEach(r=>{ const cat = classifyKeyword(r.keyword); catTotals[cat] = (catTotals[cat]||0) + r.clicks; });
  const totalClicks = rows.reduce((s,r)=>s+r.clicks,0);
  const catArr = Object.entries(catTotals).sort((a,b)=>b[1]-a[1]);
  const top15 = rows.slice().sort((a,b)=>b.clicks-a.clicks).slice(0,15);
  p.innerHTML = `
    <div class="panel-head"><h2>進站關鍵字（GSC查詢字）</h2><div class="panel-q">回答：大家用什麼字搜尋進站？意圖是什麼？</div>
    <div class="panel-desc">資料月份：${latestKW}，依搜尋意圖分10大類。</div></div>
    <div class="grid2">
      <div class="card"><h3>10大類佔比</h3><canvas id="kwDonut" height="240"></canvas></div>
      <div class="card"><h3>類別清單</h3><table><thead><tr><th>分類</th><th class="num">點擊</th><th class="num">佔比</th></tr></thead>
      <tbody>${catArr.map(([c,v])=>`<tr><td>${c}</td><td class="num">${fmt(v)}</td><td class="num">${(v/totalClicks*100).toFixed(1)}%</td></tr>`).join('')}</tbody></table></div>
    </div>
    <div class="card"><h3>TOP15關鍵字</h3><table><thead><tr><th>關鍵字</th><th class="num">點擊</th><th class="num">曝光</th><th class="num">CTR</th><th class="num">平均排名</th></tr></thead>
    <tbody>${top15.map(r=>`<tr><td>${r.keyword}</td><td class="num">${fmt(r.clicks)}</td><td class="num">${fmt(r.impressions)}</td><td class="num">${(r.ctr*100).toFixed(1)}%</td><td class="num">${r.position.toFixed(1)}</td></tr>`).join('')}</tbody></table></div>
  `;
  const palette=[RUST,TEAL,GOLD,SLATE,PLUM,MOSS,SAND,STONE,"#4A5568","#BFAF9B"];
  safeChart('kwDonut', { type:'doughnut', data:{labels:catArr.map(c=>c[0]), datasets:[{data:catArr.map(c=>c[1]), backgroundColor:palette}]}, options:{plugins:{legend:{position:'bottom',labels:{boxWidth:9,font:{size:9.5}}}}, cutout:'55%'} });
}

/* ============ ④ SEO文章與排名成效 ============ */
function renderSEO(gscPageByMonth, latestSEO, clsMap){
  const p = document.getElementById('panel-seo');
  if(!latestSEO){ renderEmpty('seo','SEO文章與排名成效','尚無 data/gsc-page/ 資料',['data/gsc-page/YYYY-MM.csv']); return; }
  const seo = gscPageByMonth[latestSEO];
  const rows = seo.data.map(r=>{
    const url = normUrl(r['到達網頁'] || r['url'] || Object.values(r)[0]);
    return { url, clicks: toNum(r['Google自然搜尋點擊次數']||r['clicks']), impressions: toNum(r['Google自然搜尋曝光次數']||r['impressions']),
      ctr: toNum(r['Google自然搜尋點擊率']||r['ctr']), position: toNum(r['Google自然搜尋平均排名']||r['position']),
      cat: classifyPage(url) };
  });
  const nonbuild = rows.filter(r=>r.cat!=='建案頁');
  const top20 = nonbuild.slice().sort((a,b)=>b.clicks-a.clicks).slice(0,20);
  const top20Sum = top20.reduce((s,r)=>s+r.clicks,0);
  const nbTotal = nonbuild.reduce((s,r)=>s+r.clicks,0);
  const grandTotal = rows.reduce((s,r)=>s+r.clicks,0);

  let bigTotals={}, coveredClicks=0;
  nonbuild.forEach(r=>{ const c = clsMap[r.url]; if(c && c.big){ bigTotals[c.big]=(bigTotals[c.big]||0)+r.clicks; coveredClicks += r.clicks; } });
  const bigArr = Object.entries(bigTotals).sort((a,b)=>b[1]-a[1]);
  const coverage = nbTotal ? (coveredClicks/nbTotal*100) : 0;

  p.innerHTML = `
    <div class="panel-head"><h2>SEO文章與排名成效</h2><div class="panel-q">回答：大家來都看什麼文章？排名/CTR表現如何？</div>
    <div class="panel-desc">資料月份：${latestSEO}，排除建案頁。文章健康警示請至⑤內容健康監控。</div></div>
    <div class="stat-row">
      <div class="stat-chip"><div class="n">${fmt(top20Sum)}</div><div class="l">TOP20頁面合計點擊</div></div>
      <div class="stat-chip"><div class="n">${nbTotal?(top20Sum/nbTotal*100).toFixed(1):0}%</div><div class="l">佔非建案內容比重</div></div>
      <div class="stat-chip"><div class="n">${grandTotal?(top20Sum/grandTotal*100).toFixed(1):0}%</div><div class="l">佔全站比重</div></div>
      <div class="stat-chip"><div class="n">${coverage.toFixed(1)}%</div><div class="l">官方分類表收錄率</div></div>
    </div>
    <div class="grid2">
      <div class="card"><h3>官方大分類佔比</h3><canvas id="seoBigDonut" height="220"></canvas></div>
      <div class="card"><h3>TOP20文章</h3><table><thead><tr><th>#</th><th>網址</th><th class="num">點擊</th><th class="num">排名</th><th class="num">CTR</th></tr></thead>
      <tbody>${top20.slice(0,12).map((a,i)=>`<tr><td>${i+1}</td><td>${a.url}</td><td class="num">${fmt(a.clicks)}</td><td class="num">${a.position.toFixed(1)}</td><td class="num">${(a.ctr*100).toFixed(1)}%</td></tr>`).join('')}</tbody></table></div>
    </div>
  `;
  safeChart('seoBigDonut', { type:'doughnut', data:{labels:bigArr.map(c=>c[0]), datasets:[{data:bigArr.map(c=>c[1]), backgroundColor:[TEAL,SLATE,GOLD,PLUM,MOSS,SAND,STONE]}]}, options:{plugins:{legend:{position:'bottom',labels:{boxWidth:9,font:{size:10}}}}, cutout:'55%'} });
}

/* ============ ④b 內容分類貢獻度（大分類/中分類趨勢＋受歡迎文章）============ */
function renderCategoryTrend(gscPageByMonth, clsMap){
  const p = document.getElementById('panel-category');
  const months = sortedMonths(gscPageByMonth);
  if(!months.length){ renderEmpty('category','內容分類貢獻度','尚無 data/gsc-page/ 資料',['data/gsc-page/YYYY-MM.csv']); return; }

  // 逐月大分類加總
  const bigMonthly = {}; // {大分類: {month: clicks}}
  const midLatestTotals = {};
  const articleLatest = []; // for popular articles in latest month
  const latest = months[months.length-1];

  months.forEach(m=>{
    const seo = gscPageByMonth[m];
    seo.data.forEach(r=>{
      const url = normUrl(r['到達網頁'] || Object.values(r)[0]);
      const clicks = toNum(r['Google自然搜尋點擊次數']);
      const c = clsMap[url];
      if(!c || !c.big) return;
      bigMonthly[c.big] = bigMonthly[c.big] || {};
      bigMonthly[c.big][m] = (bigMonthly[c.big][m]||0) + clicks;
      if(m===latest){
        midLatestTotals[c.mid] = (midLatestTotals[c.mid]||0) + clicks;
        articleLatest.push({ url, title:c.title||url, big:c.big, mid:c.mid, clicks });
      }
    });
  });

  const bigCats = Object.keys(bigMonthly);
  const topArticles = articleLatest.sort((a,b)=>b.clicks-a.clicks).slice(0,15);
  const midArr = Object.entries(midLatestTotals).sort((a,b)=>b[1]-a[1]).slice(0,10);

  p.innerHTML = `
    <div class="panel-head"><h2>內容分類貢獻度（大分類/中分類）</h2><div class="panel-q">回答：哪個主題該投入？哪些文章最受歡迎？</div>
    <div class="panel-desc">依「遠房官網文章對應分類表」拆解，橫跨 ${months.length} 個月趨勢，最新月份：${latest}。</div></div>
    <div class="card" style="margin-bottom:18px;"><h3>大分類逐月趨勢</h3><canvas id="bigTrendChart" height="260"></canvas></div>
    <div class="grid2">
      <div class="card"><h3>中分類佔比（${latest}）</h3><table><thead><tr><th>中分類</th><th class="num">點擊</th></tr></thead>
      <tbody>${midArr.map(([c,v])=>`<tr><td>${c}</td><td class="num">${fmt(v)}</td></tr>`).join('')}</tbody></table></div>
      <div class="card"><h3>最受歡迎文章（${latest}，依分類標註）</h3><table><thead><tr><th>文章</th><th>大分類</th><th class="num">點擊</th></tr></thead>
      <tbody>${topArticles.map(a=>`<tr><td>${a.title}</td><td class="cat-tag">${a.big}</td><td class="num">${fmt(a.clicks)}</td></tr>`).join('')}</tbody></table></div>
    </div>
  `;
  safeChart('bigTrendChart', { type:'line', data:{ labels: months, datasets: bigCats.map(c=>({label:c, data: months.map(m=>bigMonthly[c][m]||0), borderColor:BIG_COLORS[c]||STONE, backgroundColor:BIG_COLORS[c]||STONE, tension:.3})) },
    options:{ plugins:{legend:{position:'bottom',labels:{boxWidth:10,font:{size:10}}}} } });
}

/* ============ ⑤ 內容健康監控 ============ */
function renderMonitor(gscPageByMonth){
  const p = document.getElementById('panel-monitor');
  const months = sortedMonths(gscPageByMonth);
  if(months.length < 2){ renderEmpty('monitor','內容健康監控','至少需要2個月的 data/gsc-page/ 資料才能計算趨勢',['data/gsc-page/YYYY-MM.csv（多個月份）']); return; }

  // 整理成 {url: {clicks:[...], position:[...], ctr:[...]}}
  const seriesMap = {};
  months.forEach(m=>{
    const seo = gscPageByMonth[m];
    seo.data.forEach(r=>{
      const url = normUrl(r['到達網頁'] || Object.values(r)[0]);
      if(classifyPage(url)==='建案頁') return;
      seriesMap[url] = seriesMap[url] || { clicks:{}, position:{}, ctr:{} };
      seriesMap[url].clicks[m] = toNum(r['Google自然搜尋點擊次數']);
      seriesMap[url].position[m] = toNum(r['Google自然搜尋平均排名']);
      seriesMap[url].ctr[m] = toNum(r['Google自然搜尋點擊率'])*100;
    });
  });
  const latest = months[months.length-1];
  const urls = Object.keys(seriesMap).sort((a,b)=>(seriesMap[b].clicks[latest]||0)-(seriesMap[a].clicks[latest]||0)).slice(0,20);
  const articles = urls.map(u=>({
    url: u,
    clicks: months.map(m=>seriesMap[u].clicks[m] ?? null),
    position: months.map(m=>seriesMap[u].position[m] ?? null),
    ctr: months.map(m=>seriesMap[u].ctr[m] ?? null)
  }));

  p.innerHTML = `
    <div class="panel-head"><h2>內容健康監控</h2><div class="panel-q">回答：哪些文章正在退燒、需要優先改版？</div>
    <div class="panel-desc">${months.length}個月趨勢（${months[0]} ~ ${latest}）。用可調式數據條件標記需要處理的文章。</div></div>
    <div class="stat-row" id="mStatStrip"></div>
    <div class="controls">
      <div class="ctrl-group"><label>🔴 緊急：距歷史高峰下滑超過</label><div class="row"><input type="range" id="redSlider" min="15" max="70" value="40"><span class="ctrl-val" id="redVal">40%</span></div></div>
      <div class="ctrl-group"><label>🟠 觀察：距歷史高峰下滑超過</label><div class="row"><input type="range" id="orangeSlider" min="10" max="50" value="25"><span class="ctrl-val" id="orangeVal">25%</span></div></div>
      <div class="ctrl-group"><label>🟡 標題優化：CTR相對衰退超過</label><div class="row"><input type="range" id="yellowSlider" min="10" max="50" value="25"><span class="ctrl-val" id="yellowVal">25%</span></div></div>
      <div class="ctrl-group"><label>排序依據</label><select id="sortSelect"><option value="alert">警示等級</option><option value="clicks">本月流量</option><option value="peak">距高峰跌幅</option></select></div>
    </div>
    <table><thead><tr><th style="width:20px"></th><th>網址</th><th class="num">最新月流量</th><th class="num">MoM</th><th class="num">距高峰跌幅</th><th class="num">平均排名</th><th class="num">CTR</th><th>狀態</th></tr></thead>
    <tbody id="mTableBody"></tbody></table>
  `;
  function lastValid(arr){ for(let i=arr.length-1;i>=0;i--){ if(arr[i]!=null) return {v:arr[i], i}; } return {v:null,i:-1}; }
  function prevValid(arr, idx){ for(let i=idx-1;i>=0;i--){ if(arr[i]!=null) return arr[i]; } return null; }
  function computeMetrics(a){
    const clicks=a.clicks; const {v:latestV,i:latestIdx}=lastValid(clicks); const prev=prevValid(clicks,latestIdx);
    const mom=(prev&&prev>0)?(latestV-prev)/prev*100:0;
    const nz=clicks.filter(v=>v!=null); const peak=nz.length?Math.max(...nz):0; const peakDrop=peak>0?(peak-latestV)/peak*100:0;
    const pos=a.position.filter(x=>x!=null);
    const avgPosRecent=pos.slice(-3).reduce((s,v)=>s+v,0)/Math.max(1,pos.slice(-3).length);
    const avgPosEarly=pos.slice(0,3).reduce((s,v)=>s+v,0)/Math.max(1,pos.slice(0,3).length);
    const posWorsen=avgPosRecent-avgPosEarly;
    const ctrArr=a.ctr.filter(x=>x!=null);
    const ctrRecent=ctrArr.slice(-3).reduce((s,v)=>s+v,0)/Math.max(1,ctrArr.slice(-3).length);
    const ctrEarly=ctrArr.slice(0,3).reduce((s,v)=>s+v,0)/Math.max(1,ctrArr.slice(0,3).length);
    const ctrDecline=ctrEarly>0?(ctrEarly-ctrRecent)/ctrEarly*100:0;
    return {latest:latestV,mom,peak,peakDrop,avgPosRecent,posWorsen,ctrRecent,ctrDecline};
  }
  function classify(m,th){
    if(m.peakDrop>=th.red && m.mom<0) return 'red';
    if(m.peakDrop>=th.orange || m.posWorsen>=2) return 'orange';
    if(m.ctrDecline>=th.yellow && m.posWorsen<1.5) return 'yellow';
    return 'green';
  }
  const badgeText={red:'🔴 緊急改版',orange:'🟠 排入觀察',yellow:'🟡 標題優化',green:'🟢 正常'};
  let sortMode='alert', th={red:40,orange:25,yellow:25};
  function render(){
    const scored = articles.map(a=>{ const m=computeMetrics(a); return {a,m,status:classify(m,th)}; });
    const counts={red:0,orange:0,yellow:0,green:0}; scored.forEach(s=>counts[s.status]++);
    document.getElementById('mStatStrip').innerHTML = ['red','orange','yellow','green'].map(k=>
      `<div class="stat-chip"><div class="n" style="color:${{red:RUST,orange:GOLD,yellow:'#8A7A1E',green:TEAL}[k]}">${counts[k]}</div><div class="l">${badgeText[k]}</div></div>`).join('');
    const order={red:0,orange:1,yellow:2,green:3};
    let sorted=scored.slice();
    if(sortMode==='alert') sorted.sort((x,y)=>order[x.status]-order[y.status]||y.m.peakDrop-x.m.peakDrop);
    else if(sortMode==='clicks') sorted.sort((x,y)=>y.m.latest-x.m.latest);
    else if(sortMode==='peak') sorted.sort((x,y)=>y.m.peakDrop-x.m.peakDrop);
    document.getElementById('mTableBody').innerHTML = sorted.map(({a,m,status})=>{
      const momArrow = m.mom>=0 ? `<span style="color:${TEAL}">▲${m.mom.toFixed(1)}%</span>` : `<span style="color:${RUST}">▼${Math.abs(m.mom).toFixed(1)}%</span>`;
      return `<tr onclick='openMonitorModal(${JSON.stringify(a.url)})'>
        <td><span class="dot ${status}"></span></td><td><b>${a.url}</b></td>
        <td class="num">${fmt(m.latest)}</td><td class="num">${momArrow}</td><td class="num">${m.peakDrop.toFixed(0)}%</td>
        <td class="num">${m.avgPosRecent?m.avgPosRecent.toFixed(1):'—'}</td><td class="num">${m.ctrRecent?m.ctrRecent.toFixed(1)+'%':'—'}</td>
        <td><span class="badge ${status}">${badgeText[status]}</span></td></tr>`;
    }).join('');
  }
  window.openMonitorModal = function(url){
    const a = articles.find(x=>x.url===url); const m = computeMetrics(a); const status = classify(m, th);
    const actionMap = {red:'建議：全文重寫＋更新數據/法規＋補充當年度新規定，2週內排入改版排程。',orange:'建議：檢查標題與內容時效性，觀察下月是否持續惡化。',yellow:'建議：排名尚可但CTR下滑，優先改寫標題與meta描述。',green:'目前表現穩定，維持現狀。'};
    document.getElementById('modalContent').innerHTML = `
      <div class="modal-head"><div><h2>${a.url}</h2><div class="modal-meta">${months.length}個月自然搜尋點擊/排名趨勢</div></div>
      <button class="modal-close" onclick="document.getElementById('overlay').classList.remove('show')">&times;</button></div>
      <canvas id="trendChart" height="200"></canvas>
      <div class="action-box"><b>${badgeText[status]}：</b>${actionMap[status]}</div>`;
    document.getElementById('overlay').classList.add('show');
    setTimeout(()=>{
      safeChart('trendChart', { type:'line', data:{ labels: months, datasets:[
        {label:'點擊', data:a.clicks, borderColor:TEAL, backgroundColor:TEAL, tension:.3, yAxisID:'y', spanGaps:true},
        {label:'平均排名', data:a.position, borderColor:GOLD, backgroundColor:GOLD, tension:.3, yAxisID:'y1', borderDash:[4,3], spanGaps:true}
      ]}, options:{ plugins:{legend:{position:'bottom'}}, scales:{ y:{title:{display:true,text:'點擊'}}, y1:{position:'right', reverse:true, title:{display:true,text:'平均排名'}, grid:{drawOnChartArea:false}} } } });
    },30);
  };
  document.getElementById('overlay').addEventListener('click', e=>{ if(e.target.id==='overlay') e.target.classList.remove('show'); });
  ['red','orange','yellow'].forEach(k=>{ document.getElementById(k+'Slider').addEventListener('input', e=>{ th[k]=+e.target.value; document.getElementById(k+'Val').textContent=th[k]+'%'; render(); }); });
  document.getElementById('sortSelect').addEventListener('change', e=>{ sortMode=e.target.value; render(); });
  render();
}

/* ============ ⑥ AIO引用監測 ============ */
function renderAIO(aiByMonth, aioPByMonth, aioDByMonth, latestAI, latestAIOp, latestAIOd){
  const p = document.getElementById('panel-aio');
  if(!latestAI && !latestAIOp){ renderEmpty('aio','AIO引用監測','尚無 data/ai-assistant/ 或 data/gsc-aio/ 資料',['data/ai-assistant/YYYY-MM.csv','data/gsc-aio/YYYY-MM-pages.csv','data/gsc-aio/YYYY-MM-daily.csv']); return; }
  let chanTotals={}, totalSessions=0, aiSessions=0;
  if(latestAI){
    aiByMonth[latestAI].data.forEach(r=>{
      const sessions = toNum(r['工作階段']||r['Sessions']);
      const chan = r['預設頻道群組']||r['Session default channel group']||r['頻道']||Object.values(r)[0];
      chanTotals[chan] = (chanTotals[chan]||0)+sessions; totalSessions += sessions;
      if(String(chan).includes('AI Assistant')) aiSessions += sessions;
    });
  }
  let aioTotal=0, aioTopPages=[];
  if(latestAIOd){ aioDByMonth[latestAIOd].data.forEach(r=>{ aioTotal += toNum(r['曝光']); }); }
  if(latestAIOp){ aioTopPages = aioPByMonth[latestAIOp].data.slice(0,10).map(r=>({url: String(r['熱門網頁']||Object.values(r)[0]).replace(/^https?:\/\/[^/]+/,''), impressions: toNum(r['曝光'])})); }

  p.innerHTML = `
    <div class="panel-head"><h2>AIO引用監測</h2><div class="panel-q">回答：內容有沒有被AI引用？AI有沒有帶來流量？</div>
    <div class="panel-desc">兩個資料源分開看，單位不同不可相加：GA4 AI Assistant(流量,${latestAI||'—'}) vs GSC生成式AI報告(曝光,${latestAIOd||'—'})。</div></div>
    <div class="stat-row">
      <div class="stat-chip"><div class="n">${fmt(aiSessions)}</div><div class="l">AI Assistant工作階段</div></div>
      <div class="stat-chip"><div class="n">${totalSessions?(aiSessions/totalSessions*100).toFixed(2):0}%</div><div class="l">佔全站工作階段比例</div></div>
      <div class="stat-chip"><div class="n">${fmt(aioTotal)}</div><div class="l">GSC生成式AI曝光總數</div></div>
    </div>
    <div class="grid2">
      <div class="card"><h3>GA4頻道分組（含AI Assistant）</h3><canvas id="aioChan" height="230"></canvas></div>
      <div class="card"><h3>被AI引用曝光最高的頁面</h3><table><thead><tr><th>頁面</th><th class="num">曝光</th></tr></thead>
      <tbody>${aioTopPages.map(r=>`<tr><td>${r.url}</td><td class="num">${fmt(r.impressions)}</td></tr>`).join('')}</tbody></table></div>
    </div>
    <div class="note-box">兩張圖表資料源不同、單位不同，僅能分別看趨勢，不可相加。Perplexity目前兩個資料源都涵蓋不到。</div>
  `;
  const chans = Object.keys(chanTotals);
  safeChart('aioChan', { type:'bar', data:{labels:chans, datasets:[{label:'工作階段', data:chans.map(c=>chanTotals[c]), backgroundColor: chans.map(c=>String(c).includes('AI Assistant')?GOLD:SLATE)}]}, options:{plugins:{legend:{display:false}}, indexAxis:'y'} });
}

/* ============ ⑦ 內容→建案路徑 ============ */
function renderPath(utmByMonth){
  const p = document.getElementById('panel-path');
  const months = sortedMonths(utmByMonth);
  if(!months.length){ renderEmpty('path','內容→建案路徑','尚無 data/utm-buttons/ 資料',['data/utm-buttons/YYYY-MM.csv','GA4漏斗探索匯出表格(待補)']); return; }
  const destByMonth = {}; const destTotals = {}; const campaignTotals = {};
  months.forEach(m=>{
    utmByMonth[m].data.forEach(r=>{
      const url = r['網頁路徑']||r['url'];
      const users = toNum(r['所有使用者']);
      const dest = classifyDest(url);
      destByMonth[dest] = destByMonth[dest] || {};
      destByMonth[dest][m] = (destByMonth[dest][m]||0) + users;
      destTotals[dest] = (destTotals[dest]||0) + users;
      const camp = r['廣告活動']||'—';
      campaignTotals[camp] = (campaignTotals[camp]||0) + users;
    });
  });
  const destTypes = Object.keys(destTotals);
  const campArr = Object.entries(campaignTotals).sort((a,b)=>b[1]-a[1]).slice(0,8);
  p.innerHTML = `
    <div class="panel-head"><h2>內容→建案路徑</h2><div class="panel-q">回答：看什麼內容會導去看建案？</div>
    <div class="panel-desc">來源：站內按鈕/內文廣告UTM點擊（fg/button, fg/post, fg/article），${months[0]}~${months[months.length-1]}。「廣告活動」欄位是目的地代碼而非來源文章，故只能看到「導去哪裡」而非「從哪篇文章導出」。</div></div>
    <div class="card" style="margin-bottom:18px;"><h3>站內按鈕點擊：目的地類型逐月趨勢</h3><canvas id="pathTrend" height="240"></canvas></div>
    <div class="grid2">
      <div class="card"><h3>目的地類型合計</h3><table><thead><tr><th>類型</th><th class="num">使用者數</th></tr></thead>
      <tbody>${destTypes.sort((a,b)=>destTotals[b]-destTotals[a]).map(d=>`<tr><td>${d}</td><td class="num">${fmt(destTotals[d])}</td></tr>`).join('')}</tbody></table></div>
      <div class="card"><h3>依廣告活動代碼（目的地）</h3><table><thead><tr><th>代碼</th><th class="num">使用者數</th></tr></thead>
      <tbody>${campArr.map(([c,v])=>`<tr><td>${c}</td><td class="num">${fmt(v)}</td></tr>`).join('')}</tbody></table></div>
    </div>
    <div class="empty-state"><div class="icon">🔲</div><h4>GA4漏斗探索資料待補</h4>
    <p>「看過生活提案→看過建案頁（自然流量）」的漏斗步驟人數/轉換率，設定完成後匯出表格即可補上。</p>
    <span class="need-tag">GA4漏斗探索匯出表格</span></div>
  `;
  safeChart('pathTrend', { type:'bar', data:{ labels: months, datasets: destTypes.map((d,i)=>({label:d, data:months.map(m=>destByMonth[d][m]||0), backgroundColor:[RUST,GOLD,TEAL,SLATE,PLUM,STONE][i%6]})) },
    options:{ plugins:{legend:{position:'bottom'}}, scales:{x:{stacked:true},y:{stacked:true}} } });
}

/* ============ ⑧ 轉換與留單 ============ */
function renderConversion(pvByMonth, latestPV){
  const p = document.getElementById('panel-conversion');
  if(!latestPV){ renderEmpty('conversion','轉換與留單','尚無 data/pageview/ 資料',['data/pageview/YYYY-MM.csv']); return; }
  const pv = pvByMonth[latestPV];
  const byCat = {};
  let notfoundUsers=0, notfoundAppts=0;
  pv.data.forEach(r=>{
    const url = normUrl(r['到達網頁']); const title = r['網頁標題'];
    const cat = classifyPage(url, title);
    const users = toNum(r['所有使用者']), appts = toNum(r['點擊預約賞屋']);
    byCat[cat] = byCat[cat] || { users:0, appts:0, click_line:0, click_cs:0, click_phone:0, click_price:0, click_nav:0 };
    byCat[cat].users += users; byCat[cat].appts += appts;
    byCat[cat].click_line += toNum(r['點擊Line']); byCat[cat].click_cs += toNum(r['點擊客服Omi']);
    byCat[cat].click_phone += toNum(r['點擊來電0800']); byCat[cat].click_price += toNum(r['點擊實價']); byCat[cat].click_nav += toNum(r['點擊導航']);
    if(String(title).includes('找不到頁面')){ notfoundUsers += users; notfoundAppts += appts; }
  });
  const catArr = Object.entries(byCat).sort((a,b)=>b[1].users-a[1].users);
  const build = byCat['建案頁'] || {users:0,appts:0,click_line:0,click_cs:0,click_phone:0,click_price:0,click_nav:0};
  p.innerHTML = `
    <div class="panel-head"><h2>轉換與留單</h2><div class="panel-q">回答：流量最後有沒有變成名單？哪裡在浪費流量？</div>
    <div class="panel-desc">資料月份：${latestPV}。</div></div>
    <div class="grid2">
      <div class="card"><h3>各類別預約賞屋轉換率</h3><canvas id="cvChart" height="230"></canvas></div>
      <div class="card"><h3>各CTA類型點擊數（建案頁）</h3><table><thead><tr><th>CTA類型</th><th class="num">點擊數</th></tr></thead>
      <tbody><tr><td>預約賞屋</td><td class="num">${fmt(build.appts)}</td></tr><tr><td>點擊LINE</td><td class="num">${fmt(build.click_line)}</td></tr>
      <tr><td>點擊客服Omi</td><td class="num">${fmt(build.click_cs)}</td></tr><tr><td>點擊來電0800</td><td class="num">${fmt(build.click_phone)}</td></tr>
      <tr><td>點擊實價</td><td class="num">${fmt(build.click_price)}</td></tr><tr><td>點擊導航</td><td class="num">${fmt(build.click_nav)}</td></tr></tbody></table></div>
    </div>
    <div class="card"><h3>404流失清單</h3><div class="stat-row" style="margin-top:10px;">
      <div class="stat-chip"><div class="n" style="color:${RUST}">${fmt(notfoundUsers)}</div><div class="l">404頁面訪問人次</div></div>
      <div class="stat-chip"><div class="n" style="color:${RUST}">${fmt(notfoundAppts)}</div><div class="l">其中轉換數</div></div></div></div>
    <div class="empty-state"><div class="icon">🔲</div><h4>第一次接觸到成交歷程 — 目前資料無法回答</h4>
    <p>需要銷售系統的成交名單反查造訪紀錄，或GA4事件層級明細＋使用者ID才能建立。</p>
    <span class="need-tag">銷售成交名單</span><span class="need-tag">GA4事件層級明細</span></div>
  `;
  safeChart('cvChart', { type:'bar', data:{labels:catArr.map(x=>x[0]), datasets:[{label:'轉換率(%)', data:catArr.map(x=>x[1].users?x[1].appts/x[1].users*100:0), backgroundColor:catArr.map(x=>CAT_COLORS[x[0]]||SLATE)}]}, options:{plugins:{legend:{display:false}}} });
}

/* ============ ⑨ 建案獨立分析 ============ */
function renderBuilding(pvByMonth, latestPV){
  const p = document.getElementById('panel-building');
  if(!latestPV){ renderEmpty('building','建案獨立分析','尚無資料',['同⑧']); return; }
  const pv = pvByMonth[latestPV];
  const buildings = {};
  pv.data.forEach(r=>{
    const url = normUrl(r['到達網頁']);
    if(!url.includes('buildings')) return;
    buildings[url] = buildings[url] || { title:r['網頁標題'], users:0, appts:0 };
    buildings[url].users += toNum(r['所有使用者']); buildings[url].appts += toNum(r['點擊預約賞屋']);
  });
  const list = Object.entries(buildings).sort((a,b)=>b[1].users-a[1].users);
  p.innerHTML = `
    <div class="panel-head"><h2>建案獨立分析</h2><div class="panel-q">回答：這個建案自己表現好不好？</div>
    <div class="panel-desc">資料月份：${latestPV}，點選下拉選單切換建案。</div></div>
    <div class="controls"><div class="ctrl-group"><label>選擇建案</label><select id="buildingSelect">
      ${list.map(([u,d])=>`<option value="${u}">${d.title}</option>`).join('')}
    </select></div></div>
    <div id="buildingDetail"></div>
  `;
  function showBuilding(url){
    const d = buildings[url];
    document.getElementById('buildingDetail').innerHTML = `
      <div class="stat-row"><div class="stat-chip"><div class="n">${fmt(d.users)}</div><div class="l">使用者數</div></div>
      <div class="stat-chip"><div class="n">${fmt(d.appts)}</div><div class="l">預約賞屋點擊</div></div>
      <div class="stat-chip"><div class="n">${d.users?(d.appts/d.users*100).toFixed(2):0}%</div><div class="l">轉換率</div></div></div>`;
  }
  document.getElementById('buildingSelect').addEventListener('change', e=>showBuilding(e.target.value));
  if(list.length) showBuilding(list[0][0]);
}

/* ============ ⑩ 自媒體 ============ */
function renderSocial(){
  renderEmpty('social','自媒體','待每月人工填表（觸及/互動/完播率/受眾池新增/導站外數/廣告花費/廣告轉換）',['data/social/YYYY-MM.csv（人工填寫）']);
}

/* ============ 📋 資料說明 ============ */
function renderGuide(pv, tr, kw, seo, ai, utm, cls){
  const p = document.getElementById('panel-guide');
  const stat = (obj, label) => { const ms = sortedMonths(obj); return `<tr><td>${label}</td><td>${ms.length? ms.join(', ') : '<i>尚無資料</i>'}</td></tr>`; };
  p.innerHTML = `
    <div class="panel-head"><h2>資料說明</h2></div>
    <div class="card"><h3>目前已偵測到的資料月份</h3>
      <table class="req-table"><thead><tr><th>資料夾</th><th>已有的月份</th></tr></thead><tbody>
        ${stat(pv,'data/pageview/')}${stat(tr,'data/traffic-source/')}${stat(kw,'data/gsc-query/')}
        ${stat(seo,'data/gsc-page/')}${stat(ai,'data/ai-assistant/')}${stat(utm,'data/utm-buttons/')}
        <tr><td>data/classification/latest.csv</td><td>${cls?('已載入，'+cls.data.length+'筆'):'<i>尚無資料</i>'}</td></tr>
      </tbody></table>
    </div>
    <div class="card" style="margin-top:16px;"><h3>怎麼加新月份資料</h3>
      <ol style="font-size:12.5px;color:var(--ink-soft);line-height:1.9;">
        <li>每月匯出時維持相同欄位格式（跟現有檔案一致）</li>
        <li>檔名存成 <code>YYYY-MM.csv</code>（例如 <code>2026-09.csv</code>），丟進對應的 <code>data/</code> 子資料夾</li>
        <li>commit並push到GitHub，重新整理網頁即可看到新月份自動出現在趨勢圖裡，<b>不需要改任何程式碼</b></li>
        <li>分類表只有新增文章時才需要更新，直接覆蓋 <code>data/classification/latest.csv</code></li>
      </ol>
    </div>
  `;
}

main();
