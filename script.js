'use strict';

let expenses = [], original = [];
let isSorting = false, stopFlag = false;
let comparisons = 0, swaps = 0, startTime = 0;
let selectedAlgo = 'merge', sortDir = 'asc';
let stepByStep = true, fastMode = false, renderThrottle = 0;
let perfMerge = { time: 0, comparisons: 0 };
let perfQuick = { time: 0, comparisons: 0 };

const $ = id => document.getElementById(id);
const inpCategory     = $('inp-category');
const inpAmount       = $('inp-amount');
const addBtn          = $('add-btn');
const clearAllBtn     = $('clear-all-btn');
const sampleBtn       = $('sample-btn');
const csvFile         = $('csv-file');
const fileDropArea    = $('file-drop-area');
const fileDropLabel   = $('file-drop-label');
const expenseList     = $('expense-list');
const expenseCount    = $('expense-count');
const speedSlider     = $('speed-slider');
const speedVal        = $('speed-val');
const sortBtn         = $('sort-btn');
const compareBtn      = $('compare-btn');
const stopBtn         = $('stop-btn');
const stepToggle      = $('step-toggle');
const stepLabel       = $('step-label');
const barContainer    = $('bar-container');
const statusDot       = $('status-dot');
const statusText      = $('status-text');
const stepExplanation = $('step-explanation');
const statComparisons = $('stat-comparisons');
const statSwaps       = $('stat-swaps');
const statTime        = $('stat-time');
const statN           = $('stat-n');
const sortedResults   = $('sorted-results');
const insightsList    = $('insights-list');
const headerAlgoBadge = $('header-algo-badge');
const perfMergeVal    = $('perf-merge-val');
const perfMergeBar    = $('perf-merge-bar');
const perfMergeCmp    = $('perf-merge-cmp');
const perfQuickVal    = $('perf-quick-val');
const perfQuickBar    = $('perf-quick-bar');
const perfQuickCmp    = $('perf-quick-cmp');
const perfVerdict     = $('perf-verdict');
const infoTitle       = $('info-title');
const infoContent     = $('info-content');

function delay(ms) {
  if (fastMode || !stepByStep) return Promise.resolve();
  return new Promise(res => setTimeout(res, ms));
}

function getDelay() {
  const s = parseInt(speedSlider.value);
  const n = expenses.length;
  const f = n <= 10 ? 0.5 : n <= 20 ? 0.75 : 1;
  return Math.max(15, Math.round((160 / s) * f));
}

function shouldRender() {
  if (fastMode) return false;
  if (!stepByStep) {
    renderThrottle++;
    const skip = expenses.length > 30 ? 8 : expenses.length > 15 ? 5 : 3;
    return renderThrottle % skip === 0;
  }
  return true;
}

function yieldToBrowser() { return new Promise(res => setTimeout(res, 0)); }
function fmt(n) { return '₹' + Number(n).toLocaleString('en-IN'); }
function cloneExpenses(arr) { return arr.map(e => ({ ...e })); }
function shouldSwap(pivot, el) {
  return sortDir === 'asc' ? el.amount < pivot.amount : el.amount > pivot.amount;
}
function cmpAsc(a, b) { return sortDir === 'asc' ? a.amount <= b.amount : a.amount >= b.amount; }

function setStatus(msg, state = 'idle') {
  statusText.textContent = msg;
  const cls = state === 'sorting' ? ' active' : state === 'done' ? ' done' : state === 'compare' ? ' compare' : '';
  statusDot.className = 'status-dot' + cls;
}

function setExplanation(msg) { stepExplanation.textContent = msg; }

function updateStats() {
  statComparisons.textContent = comparisons;
  statSwaps.textContent = swaps;
  statTime.textContent = Math.round(performance.now() - startTime) + 'ms';
}

function resetStats() {
  comparisons = swaps = 0;
  statComparisons.textContent = statSwaps.textContent = '0';
  statTime.textContent = '0ms';
}

function addExpense(category, amount) {
  const cat = category.trim();
  const amt = parseFloat(amount);
  if (!cat) { flashInput(inpCategory, 'Category cannot be empty'); return; }
  if (isNaN(amt) || amt <= 0) { flashInput(inpAmount, 'Enter a valid positive number'); return; }
  expenses.push({ category: cat, amount: Math.round(amt * 100) / 100 });
  renderExpenseList();
  renderBars([], [], [], []);
  clearResults();
  inpCategory.value = inpAmount.value = '';
  inpCategory.focus();
}

function flashInput(el, msg) {
  el.style.borderColor = 'var(--red)';
  el.placeholder = msg;
  el.focus();
  setTimeout(() => {
    el.style.borderColor = '';
    el.placeholder = el === inpCategory ? 'Category (e.g. Food)' : 'Amount';
  }, 1800);
}

function removeExpense(idx) {
  expenses.splice(idx, 1);
  renderExpenseList();
  renderBars([], [], [], []);
  clearResults();
}

function clearAll() {
  if (!expenses.length) return;
  expenses = [];
  renderExpenseList();
  clearBars();
  clearResults();
  setStatus('All expenses cleared.');
  setExplanation('Step-by-step comparisons will appear here');
}

function clearResults() {
  sortedResults.innerHTML = '<div class="empty-state">Results will appear after sorting</div>';
  insightsList.innerHTML  = '<div class="empty-state">Insights will appear after sorting</div>';
  statN.textContent = expenses.length;
  resetStats();
}

const SAMPLE_EXPENSES = [
  { category: 'Groceries',   amount: 850  },
  { category: 'Travel',      amount: 340  },
  { category: 'Shopping',    amount: 2200 },
  { category: 'Food',        amount: 620  },
  { category: 'Electricity', amount: 1450 },
  { category: 'Internet',    amount: 499  },
  { category: 'Movies',      amount: 250  },
  { category: 'Gym',         amount: 700  },
];

function loadSampleExpenses() {
  expenses = cloneExpenses(SAMPLE_EXPENSES);
  renderExpenseList();
  renderBars([], [], [], []);
  clearResults();
  setStatus(`${expenses.length} sample expenses loaded — ready to sort`, 'idle');
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function renderExpenseList() {
  expenseCount.textContent = statN.textContent = expenses.length;
  expenseList.innerHTML = expenses.length
    ? expenses.map((e, i) => `
        <div class="expense-item">
          <span class="expense-item-cat">${escHtml(e.category)}</span>
          <span class="expense-item-amt">${fmt(e.amount)}</span>
          <button class="expense-item-del" onclick="removeExpense(${i})" title="Remove">✕</button>
        </div>`).join('')
    : '<div class="empty-state">No expenses yet. Add some above!</div>';
}

function renderBars(active = [], compare = [], sorted = [], pivot = []) {
  if (!expenses.length) {
    barContainer.innerHTML = '<div class="bars-empty-state">Add expenses to visualize sorting</div>';
    return;
  }
  const h = barContainer.clientHeight - 40 || 240;
  const max = Math.max(...expenses.map(e => e.amount), 1);
  const sortedSet   = new Set(sorted);
  const activeSet   = new Set(active);
  const compareSet  = new Set(compare);
  const pivotSet    = new Set(pivot);
  const allSorted   = sorted.length === expenses.length;
  const maxIdx = allSorted ? expenses.reduce((mi, e, i, a) => e.amount > a[mi].amount ? i : mi, 0) : -1;
  const minIdx = allSorted ? expenses.reduce((mi, e, i, a) => e.amount < a[mi].amount ? i : mi, 0) : -1;

  barContainer.innerHTML = expenses.map((e, i) => {
    const barH = Math.max(4, Math.round((e.amount / max) * h));
    let cls = 'bar';
    if (pivotSet.has(i))                           cls += ' pivot';
    else if (activeSet.has(i))                     cls += ' active';
    else if (compareSet.has(i))                    cls += ' compare';
    else if (allSorted && i === maxIdx)            cls += ' highest';
    else if (allSorted && i === minIdx)            cls += ' lowest';
    else if (sortedSet.has(i))                     cls += ' sorted';
    return `<div class="bar-column"><div class="${cls}" style="height:${barH}px;"></div><div class="bar-label">${escHtml(e.category)}</div></div>`;
  }).join('');
}

function clearBars() {
  barContainer.innerHTML = '<div class="bars-empty-state">Add expenses to visualize sorting</div>';
}

function renderSortedResults() {
  if (!expenses.length) { sortedResults.innerHTML = '<div class="empty-state">No expenses to display</div>'; return; }
  const maxAmt = Math.max(...expenses.map(e => e.amount));
  const minAmt = Math.min(...expenses.map(e => e.amount));
  sortedResults.innerHTML = expenses.map((e, i) => {
    const isMax = e.amount === maxAmt, isMin = e.amount === minAmt;
    const color = isMax ? 'var(--red)' : isMin ? 'var(--bar-lowest)' : 'var(--accent)';
    const tag   = isMax ? '<span class="result-tag tag-highest">Highest</span>'
                : isMin ? '<span class="result-tag tag-lowest">Lowest</span>' : '';
    return `<div class="result-item" style="animation-delay:${i*40}ms">
      <span class="result-rank">#${i+1}</span>
      <span class="result-cat">${escHtml(e.category)}</span>
      <span class="result-amt" style="color:${color}">${fmt(e.amount)}</span>${tag}
    </div>`;
  }).join('');
}

function generateInsights() {
  if (!expenses.length) return;
  const total    = expenses.reduce((s, e) => s + e.amount, 0);
  const avg      = total / expenses.length;
  const sorted   = [...expenses].sort((a, b) => b.amount - a.amount);
  const highest  = sorted[0], lowest = sorted[sorted.length - 1];
  const topShare = ((highest.amount / total) * 100).toFixed(1);
  const aboveAvg = expenses.filter(e => e.amount > avg);

  const items = [
    { icon: '💸', type: 'alert', text: `You are spending the <strong>most on ${highest.category}</strong> (${fmt(highest.amount)}).` },
    { icon: '✅', type: 'good',  text: `Your <strong>lowest expense</strong> is ${lowest.category} at ${fmt(lowest.amount)}.` },
    { icon: '📊', type: 'info',  text: `Total spending: <strong>${fmt(total)}</strong> across ${expenses.length} categories.` },
    { icon: '📈', type: 'info',  text: `Average expense per category: <strong>${fmt(Math.round(avg))}</strong>.` },
  ];

  if (parseFloat(topShare) > 40)
    items.push({ icon: '⚠️', type: 'warn', text: `<strong>${highest.category}</strong> takes up <strong>${topShare}%</strong> of your total budget. Consider reducing it.` });

  if (aboveAvg.length && aboveAvg.length < expenses.length)
    items.push({ icon: '🔍', type: 'warn', text: `<strong>${aboveAvg.length} categor${aboveAvg.length > 1 ? 'ies' : 'y'}</strong> above average: ${aboveAvg.map(e => e.category).join(', ')}.` });

  if (expenses.length >= 3)
    items.push({ icon: '💡', type: 'good', text: `Sorting revealed the expense hierarchy clearly — Used ${selectedAlgo === 'merge' ? 'Merge' : 'Quick'} Sort with <strong>${comparisons} comparisons</strong>.` });

  insightsList.innerHTML = items.map(ins =>
    `<div class="insight-item ${ins.type}"><span class="insight-icon">${ins.icon}</span><span class="insight-text">${ins.text}</span></div>`
  ).join('');
}

async function animatedMergeSort(arr, l, r, ss) {
  if (stopFlag) throw new Error('stopped');
  if (l >= r) return;
  const m = Math.floor((l + r) / 2);
  setExplanation(`Dividing range [${l}…${r}] → left [${l}…${m}] | right [${m+1}…${r}]`);
  await animatedMergeSort(arr, l, m, ss);
  await animatedMergeSort(arr, m + 1, r, ss);
  await animatedMerge(arr, l, m, r, ss);
}

async function animatedMerge(arr, l, m, r, ss) {
  const left = arr.slice(l, m + 1), right = arr.slice(m + 1, r + 1);
  let i = 0, j = 0, k = l;
  while (i < left.length && j < right.length) {
    if (stopFlag) throw new Error('stopped');
    comparisons++;
    if (shouldRender()) {
      renderBars([k], [l + i, m + 1 + j], [...ss], []);
      updateStats();
      setExplanation(`Comparing "${left[i].category}" (${fmt(left[i].amount)}) vs "${right[j].category}" (${fmt(right[j].amount)})`);
      await delay(getDelay());
      if (stopFlag) throw new Error('stopped');
    } else if (comparisons % 50 === 0) {
      await yieldToBrowser();
      if (stopFlag) throw new Error('stopped');
    }
    if (cmpAsc(left[i], right[j])) { arr[k] = left[i++]; }
    else                           { arr[k] = right[j++]; swaps++; }
    expenses[k] = arr[k]; k++;
  }
  while (i < left.length)  { arr[k] = left[i++];  expenses[k] = arr[k]; k++; }
  while (j < right.length) { arr[k] = right[j++]; expenses[k] = arr[k]; k++; }
  for (let x = l; x <= r; x++) ss.add(x);
  if (shouldRender()) { renderBars([], [], [...ss], []); await delay(getDelay() * 0.35); }
}

async function animatedQuickSort(arr, l, r, ss) {
  if (stopFlag) throw new Error('stopped');
  if (l >= r) { ss.add(l); return; }
  const pi = await animatedPartition(arr, l, r, ss);
  ss.add(pi);
  await animatedQuickSort(arr, l, pi - 1, ss);
  await animatedQuickSort(arr, pi + 1, r, ss);
}

async function animatedPartition(arr, l, r, ss) {
  const pivot = arr[r];
  if (shouldRender()) setExplanation(`Pivot chosen: "${pivot.category}" (${fmt(pivot.amount)})`);
  let i = l - 1;
  for (let j = l; j < r; j++) {
    if (stopFlag) throw new Error('stopped');
    comparisons++;
    if (shouldRender()) {
      renderBars([i + 1], [j], [...ss], [r]);
      updateStats();
      setExplanation(`Comparing "${arr[j].category}" (${fmt(arr[j].amount)}) with pivot "${pivot.category}" (${fmt(pivot.amount)})`);
      await delay(getDelay());
      if (stopFlag) throw new Error('stopped');
    } else if (comparisons % 50 === 0) {
      await yieldToBrowser();
      if (stopFlag) throw new Error('stopped');
    }
    if (shouldSwap(pivot, arr[j])) {
      i++;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      expenses[i] = arr[i]; expenses[j] = arr[j];
      swaps++;
      if (shouldRender()) {
        updateStats();
        renderBars([i, j], [], [...ss], [r]);
        setExplanation(`Swapping "${arr[i].category}" ↔ "${arr[j].category}"`);
        await delay(getDelay());
        if (stopFlag) throw new Error('stopped');
      }
    }
  }
  [arr[i + 1], arr[r]] = [arr[r], arr[i + 1]];
  expenses[i + 1] = { ...arr[i + 1] };
  expenses[r]     = { ...arr[r] };
  swaps++;
  if (shouldRender()) updateStats();
  return i + 1;
}

function instantMergeSort(arr, l, r, cmp) {
  if (l >= r) return;
  const m = Math.floor((l + r) / 2);
  instantMergeSort(arr, l, m, cmp);
  instantMergeSort(arr, m + 1, r, cmp);
  const left = arr.slice(l, m + 1), right = arr.slice(m + 1, r + 1);
  let i = 0, j = 0, k = l;
  while (i < left.length && j < right.length) {
    cmp.count++;
    arr[k++] = cmpAsc(left[i], right[j]) ? left[i++] : right[j++];
  }
  while (i < left.length)  arr[k++] = left[i++];
  while (j < right.length) arr[k++] = right[j++];
}

function instantQuickSort(arr, l, r, cmp) {
  if (l >= r) return;
  const pi = instantPartition(arr, l, r, cmp);
  instantQuickSort(arr, l, pi - 1, cmp);
  instantQuickSort(arr, pi + 1, r, cmp);
}

function instantPartition(arr, l, r, cmp) {
  const pivot = arr[r];
  let i = l - 1;
  for (let j = l; j < r; j++) {
    cmp.count++;
    if (shouldSwap(pivot, arr[j])) { i++; [arr[i], arr[j]] = [arr[j], arr[i]]; }
  }
  [arr[i + 1], arr[r]] = [arr[r], arr[i + 1]];
  return i + 1;
}

async function startSorting() {
  if (!expenses.length) { setStatus('Add at least one expense first!', 'idle'); return; }
  if (expenses.length === 1) {
    setStatus('Only 1 expense — already sorted!', 'done');
    renderBars([], [], [0], []);
    renderSortedResults();
    generateInsights();
    return;
  }
  isSorting = true; stopFlag = false; renderThrottle = 0;
  setUILocked(true);
  resetStats();
  original = cloneExpenses(expenses);
  const arr = cloneExpenses(expenses);
  const ss  = new Set();
  const autoFast = !stepByStep && expenses.length <= 10;
  const usingFast = fastMode || autoFast;
  startTime = performance.now();
  setStatus(`Sorting with ${selectedAlgo === 'merge' ? 'Merge' : 'Quick'} Sort${usingFast ? ' (Fast)' : ''}…`, 'sorting');

  if (usingFast) {
    const cmp = { count: 0 };
    if (selectedAlgo === 'merge') instantMergeSort(arr, 0, arr.length - 1, cmp);
    else                          instantQuickSort(arr, 0, arr.length - 1, cmp);
    comparisons = cmp.count;
    expenses = arr;
    const elapsed = Math.round(performance.now() - startTime);
    statTime.textContent = elapsed + 'ms';
    statComparisons.textContent = comparisons;
    statSwaps.textContent = swaps;
    renderExpenseList();
    renderBars([], [], expenses.map((_, i) => i), []);
    setStatus(`Sorted! ✓  —  ${comparisons} comparisons in ${elapsed}ms${autoFast ? ' (auto-fast)' : ' (Fast Mode)'}`, 'done');
    setExplanation(`${selectedAlgo === 'merge' ? 'Merge' : 'Quick'} Sort complete instantly.`);
    renderSortedResults();
    generateInsights();
    setUILocked(false);
    isSorting = false;
    return;
  }

  try {
    if (selectedAlgo === 'merge') await animatedMergeSort(arr, 0, arr.length - 1, ss);
    else                          await animatedQuickSort(arr, 0, arr.length - 1, ss);
  } catch (_) {
    expenses = cloneExpenses(original);
    renderExpenseList();
    renderBars([], [], [], []);
    setStatus('Sorting stopped.', 'idle');
    setExplanation('Sorting was stopped. Expenses restored to original order.');
    setUILocked(false);
    isSorting = false;
    return;
  }

  const elapsed = Math.round(performance.now() - startTime);
  statTime.textContent = elapsed + 'ms';
  expenses = cloneExpenses(arr);
  renderExpenseList();
  renderBars([], [], expenses.map((_, i) => i), []);
  setStatus(`Sorted! ✓  —  ${comparisons} comparisons in ${elapsed}ms`, 'done');
  setExplanation(`${selectedAlgo === 'merge' ? 'Merge' : 'Quick'} Sort complete. Highest: ${expenses[sortDir === 'desc' ? 0 : expenses.length - 1].category}`);
  renderSortedResults();
  generateInsights();
  setUILocked(false);
  isSorting = false;
}

function runComparison() {
  if (!expenses.length) { setStatus('Add expenses before comparing algorithms.', 'idle'); return; }
  const base = cloneExpenses(original.length ? original : expenses);

  const run = (sortFn, arr) => {
    const cmp = { count: 0 }, t0 = performance.now();
    sortFn(arr, 0, arr.length - 1, cmp);
    return { time: performance.now() - t0, comparisons: cmp.count };
  };

  perfMerge = run(instantMergeSort, cloneExpenses(base));
  perfQuick = run(instantQuickSort, cloneExpenses(base));

  const { time: mTime, comparisons: mCmp } = perfMerge;
  const { time: qTime, comparisons: qCmp } = perfQuick;
  const maxT = Math.max(mTime, qTime, 0.001);

  perfMergeVal.textContent = (Math.round(mTime * 1000) / 1000) + 'ms';
  perfQuickVal.textContent = (Math.round(qTime * 1000) / 1000) + 'ms';
  perfMergeCmp.textContent = mCmp + ' cmps';
  perfQuickCmp.textContent = qCmp + ' cmps';
  perfMergeBar.style.height = `${(mTime / maxT) * 100}%`;
  perfQuickBar.style.height = `${(qTime / maxT) * 100}%`;

  perfVerdict.className = 'perf-verdict winner';
  if (mTime < qTime)      perfVerdict.textContent = `✓ Merge Sort was faster by ${(qTime - mTime).toFixed(3)}ms`;
  else if (qTime < mTime) perfVerdict.textContent = `✓ Quick Sort was faster by ${(mTime - qTime).toFixed(3)}ms`;
  else                    perfVerdict.textContent = '⚖ Both algorithms performed equally';

  setStatus(`Comparison done! Merge: ${(Math.round(mTime*1000)/1000)}ms (${mCmp} cmps)  |  Quick: ${(Math.round(qTime*1000)/1000)}ms (${qCmp} cmps)`, 'done');
}

function setUILocked(locked) {
  [addBtn, clearAllBtn, sampleBtn, sortBtn, compareBtn, csvFile].forEach(el => el.disabled = locked);
  stopBtn.style.display = locked ? 'inline-flex' : 'none';
  document.querySelectorAll('.algo-btn').forEach(b => {
    b.disabled = locked;
    b.style.pointerEvents = locked ? 'none' : '';
  });
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return { parsed: [], skipped: 0 };

  const split = line => {
    for (const sep of [',', ';', ' - ']) if (line.includes(sep)) return line.split(sep).map(p => p.trim());
    return null;
  };

  const parsed = [], skipped_ref = { n: 0 };
  const header = split(lines[0]);
  let start = 0;

  if (header && header.length >= 2) {
    const ci = header.findIndex(h => h.toLowerCase().includes('category'));
    const ai = header.findIndex(h => h.toLowerCase().includes('amount'));
    if (ci !== -1 && ai !== -1) {
      for (let i = 1; i < lines.length; i++) {
        const parts = split(lines[i]);
        if (!parts || parts.length <= Math.max(ci, ai)) { skipped_ref.n++; continue; }
        const cat = parts[ci].trim(), amt = parseFloat(parts[ai]);
        if (!cat || isNaN(amt) || amt <= 0) { skipped_ref.n++; continue; }
        parsed.push({ category: cat, amount: Math.round(amt * 100) / 100 });
      }
      return { parsed, skipped: skipped_ref.n };
    }
    if (isNaN(parseFloat(header[1]))) start = 1;
  }

  for (let i = start; i < lines.length; i++) {
    const parts = split(lines[i]);
    if (!parts || parts.length < 2) { skipped_ref.n++; continue; }
    const cat = parts[0].trim(), amt = parseFloat(parts[1]);
    if (!cat || isNaN(amt) || amt <= 0) { skipped_ref.n++; continue; }
    parsed.push({ category: cat, amount: Math.round(amt * 100) / 100 });
  }
  return { parsed, skipped: skipped_ref.n };
}

function parseExcel(buffer) {
  const wb    = XLSX.read(buffer, { type: 'array' });
  const rows  = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
  const parsed = []; let skipped = 0;
  rows.forEach((row, idx) => {
    if (!row || row.length < 2) { skipped++; return; }
    const cat = String(row[0] || '').trim(), rawAmt = row[1];
    if (idx === 0 && isNaN(parseFloat(rawAmt))) return;
    const amt = parseFloat(rawAmt);
    if (!cat || isNaN(amt) || amt <= 0) { skipped++; return; }
    parsed.push({ category: cat, amount: Math.round(amt * 100) / 100 });
  });
  return { parsed, skipped };
}

function processParsedData(parsed, skipped, fileName) {
  if (!parsed.length) { setStatus('No valid rows found. Check format: Category, Amount', 'idle'); return; }
  expenses = [...expenses, ...parsed];
  renderExpenseList();
  renderBars([], [], [], []);
  clearResults();
  fileDropLabel.textContent = `✓ ${fileName} — ${parsed.length} expenses loaded`;
  setStatus(`File loaded: ${parsed.length} expenses added${skipped ? ` (${skipped} skipped)` : ''}`, 'done');
  setTimeout(() => { if (!isSorting && expenses.length > 1) startSorting(); }, 500);
}

function handleFile(file) {
  if (!file) return;
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv')) {
    const r = new FileReader();
    r.onload = e => { const { parsed, skipped } = parseCSV(e.target.result); processParsedData(parsed, skipped, file.name); };
    r.readAsText(file);
  } else if (name.endsWith('.xlsx')) {
    const r = new FileReader();
    r.onload = e => { const { parsed, skipped } = parseExcel(e.target.result); processParsedData(parsed, skipped, file.name); };
    r.readAsArrayBuffer(file);
  } else {
    setStatus('Unsupported file type. Please upload a .csv or .xlsx file.', 'idle');
  }
}

const ALGO_INFO = {
  merge: { title: 'Merge Sort Info', rows: [['Type','Divide & Conquer'],['Stable','✓ Yes'],['Best','O(n log n)'],['Average','O(n log n)'],['Worst','O(n log n)'],['Space','O(n)']] },
  quick: { title: 'Quick Sort Info', rows: [['Type','Divide & Conquer'],['Stable','✗ No'],  ['Best','O(n log n)'],['Average','O(n log n)'],['Worst','O(n²)'],        ['Space','O(log n)']] },
};

function updateAlgoInfo() {
  const info = ALGO_INFO[selectedAlgo];
  infoTitle.textContent = info.title;
  infoContent.innerHTML = info.rows.map(([k, v]) => {
    const mono = v.startsWith('O(');
    return `<div class="info-row"><span class="info-key">${k}</span><span class="info-val${mono ? ' mono' : ''}">${v}</span></div>`;
  }).join('');
  headerAlgoBadge.textContent = selectedAlgo === 'merge' ? 'Merge Sort' : 'Quick Sort';
}

addBtn.addEventListener('click', () => addExpense(inpCategory.value, inpAmount.value));
inpAmount.addEventListener('keydown',   e => e.key === 'Enter' && addExpense(inpCategory.value, inpAmount.value));
inpCategory.addEventListener('keydown', e => e.key === 'Enter' && inpAmount.focus());
clearAllBtn.addEventListener('click', clearAll);
sampleBtn.addEventListener('click', loadSampleExpenses);
sortBtn.addEventListener('click', () => { if (!isSorting) startSorting(); });
stopBtn.addEventListener('click', () => { stopFlag = true; });
compareBtn.addEventListener('click', () => { if (!isSorting) runComparison(); });
speedSlider.addEventListener('input', () => { speedVal.textContent = speedSlider.value; });

stepToggle.addEventListener('click', () => {
  if (stepByStep && !fastMode)       { stepByStep = false; stepLabel.textContent = 'Fast Viz'; stepToggle.style.opacity = '0.8'; }
  else if (!stepByStep && !fastMode) { fastMode = true;    stepLabel.textContent = 'Fast Mode'; stepToggle.style.opacity = '0.6'; }
  else                               { fastMode = false; stepByStep = true; stepLabel.textContent = 'ON'; stepToggle.style.opacity = '1'; }
});

document.querySelectorAll('#algo-toggle .algo-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (isSorting) return;
    selectedAlgo = btn.dataset.algo;
    document.querySelectorAll('#algo-toggle .algo-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    updateAlgoInfo();
    if (original.length) {
      expenses = cloneExpenses(original);
      renderExpenseList();
      renderBars([], [], [], []);
      clearResults();
      setStatus(`Switched to ${selectedAlgo === 'merge' ? 'Merge' : 'Quick'} Sort — expenses reset.`);
    }
  });
});

document.querySelectorAll('#dir-toggle .algo-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (isSorting) return;
    sortDir = btn.dataset.dir;
    document.querySelectorAll('#dir-toggle .algo-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if (original.length) {
      expenses = cloneExpenses(original);
      renderExpenseList();
      renderBars([], [], [], []);
      clearResults();
      setStatus(`Direction: ${sortDir === 'asc' ? 'Ascending ↑' : 'Descending ↓'} — expenses reset.`);
    }
  });
});

csvFile.addEventListener('change', e => { if (e.target.files[0]) handleFile(e.target.files[0]); });
fileDropArea.addEventListener('click', () => csvFile.click());
fileDropArea.addEventListener('dragover', e => { e.preventDefault(); fileDropArea.classList.add('drag-over'); });
fileDropArea.addEventListener('dragleave', () => fileDropArea.classList.remove('drag-over'));
fileDropArea.addEventListener('drop', e => {
  e.preventDefault();
  fileDropArea.classList.remove('drag-over');
  if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
});

(function init() {
  updateAlgoInfo();
  renderExpenseList();
  setStatus('Ready — Add expenses or load sample data');
  setExplanation('Step-by-step comparisons will appear here');
})();