let array = [];
  let isSorting = false;
  let stopFlag = false;
  let isPaused = false;
  let comparisons = 0, swaps = 0, steps = 0;
  let startTime = 0;
  let timerInterval = null;
  let totalPausedTime = 0;
  let pauseStartTime = 0;
  let soundEnabled = true;
  let lastMergeTime = 0;
  let lastQuickTime = 0;

  let audioCtx = null;
  function initAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  }
  function playBeep(freq = 200) {
    if (!audioCtx || !soundEnabled) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.value = freq;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.015, audioCtx.currentTime);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.05);
  }

  const container = document.getElementById('bar-container');
  const genBtn    = document.getElementById('gen-btn');
  const sortBtn   = document.getElementById('sort-btn');
  const pauseBtn  = document.getElementById('pause-btn');
  const stopBtn   = document.getElementById('stop-btn');
  const worstCaseBtn = document.getElementById('worst-case-btn');
  const soundToggle = document.getElementById('sound-toggle');
  const algoSel   = document.getElementById('algo-select');
  const sizeSlider= document.getElementById('size-slider');
  const speedSlider=document.getElementById('speed-slider');
  const sizeVal   = document.getElementById('size-val');
  const speedVal  = document.getElementById('speed-val');
  const stepsEl   = document.getElementById('steps');
  const compEl    = document.getElementById('comparisons');
  const swapsEl   = document.getElementById('swaps');
  const timeEl    = document.getElementById('time-ms');
  const statusDot = document.getElementById('status-dot');
  const statusTxt = document.getElementById('status-text');
  const arrayInfo = document.getElementById('array-info');
  const explanation = document.getElementById('explanation');

  sizeSlider.addEventListener('input', () => { sizeVal.textContent = sizeSlider.value; });
  speedSlider.addEventListener('input', () => { speedVal.textContent = speedSlider.value; });

  function getDelay() {
    const s = parseInt(speedSlider.value);
    // speed 1 = 300ms, speed 10 = 5ms
    return Math.max(5, 300 / s);
  }

  function setStatus(msg, state='idle') {
    statusTxt.textContent = msg;
    statusDot.className = 'status-dot' + (state === 'sorting' ? ' active' : state === 'done' ? ' done' : '');
  }

  function generateArray() {
    const n = parseInt(sizeSlider.value);
    array = Array.from({ length: n }, () => Math.floor(Math.random() * 85) + 10);
    resetStats();
    renderBars([], [], [], []);
    setStatus(`Array of ${n} elements generated — ready to sort`);
    arrayInfo.textContent = `n = ${n}`;
  }

  function resetStats() {
    comparisons = 0; swaps = 0; steps = 0;
    totalPausedTime = 0;
    stepsEl.textContent = '0';
    compEl.textContent = '0';
    swapsEl.textContent = '0';
    timeEl.textContent = '0ms';
    if(explanation) explanation.textContent = 'Explanation will appear here...';
    clearInterval(timerInterval);
  }

  function renderBars(active=[], compare=[], sorted=[], pivot=[]) {
    container.innerHTML = '';
    const containerH = container.clientHeight - 24; // slightly smaller relative to container to ensure space at top
    const max = Math.max(...array, 1);
    array.forEach((val, i) => {
      const bar = document.createElement('div');
      bar.className = 'bar';
      bar.style.height = `${(val / max) * containerH}px`;
      if (pivot.includes(i))   bar.classList.add('pivot');
      else if (active.includes(i))   bar.classList.add('active');
      else if (compare.includes(i))  bar.classList.add('compare');
      else if (sorted.includes(i))   bar.classList.add('sorted');
      container.appendChild(bar);
    });
  }

  async function sleep(ms) {
    while (isPaused && !stopFlag) {
      await new Promise(r => setTimeout(r, 50));
    }
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function isSorted(arr) {
    for (let i = 1; i < arr.length; i++) {
      if (arr[i] < arr[i - 1]) return false;
    }
    return true;
  }

  async function startSorting() {
    initAudio();
    if (!array.length) { generateArray(); return; }
    if (isSorted(array)) {
      setStatus('Array already sorted!', 'done');
      renderBars([], [], [...Array(array.length).keys()], []);
      return;
    }
    isSorting = true; stopFlag = false; isPaused = false;
    pauseBtn.textContent = 'Pause';
    pauseBtn.className = 'btn btn-secondary';
    
    genBtn.disabled = true;
    sortBtn.disabled = true;
    pauseBtn.style.display = 'inline-flex';
    algoSel.disabled = true;
    sizeSlider.disabled = true;
    speedSlider.disabled = true;
    stopBtn.style.display = 'inline-flex'; // Changed from inline-block for better flex alignment
    resetStats();
    startTime = performance.now();
    timerInterval = setInterval(() => {
      timeEl.textContent = Math.round(performance.now() - startTime - totalPausedTime) + 'ms';
    }, 50);
    setStatus('Sorting…', 'sorting');

    const algo = algoSel.value;
    try {
      if (algo === 'merge') await mergeSort(0, array.length - 1, new Set());
      else                  await quickSort(0, array.length - 1, new Set());
    } catch(e) { /* stopped */ }

    clearInterval(timerInterval);
    const timeTaken = performance.now() - startTime - totalPausedTime;
    timeEl.textContent = Math.round(timeTaken) + 'ms';

    if (!stopFlag) {
      if(algo === 'merge') lastMergeTime = timeTaken;
      else                 lastQuickTime = timeTaken;
      updatePerformanceGraph();
    }

    if (!stopFlag) {
      for (let i = 0; i < array.length; i++) {
        renderBars([], [], Array.from({length: i + 1}, (_, k) => k), []);
        await sleep(10);
      }
      setStatus('Sorted! ✓', 'done');
      arrayInfo.textContent = `Sorted Array Ready | n = ${array.length}`;
    } else {
      renderBars([], [], [], []);
      setStatus('Stopped — array may be partially sorted');
    }

    isSorting = false;
    genBtn.disabled = false;
    sortBtn.disabled = false;
    pauseBtn.style.display = 'none';
    algoSel.disabled = false;
    sizeSlider.disabled = false;
    speedSlider.disabled = false;
    stopBtn.style.display = 'none';
  }

  // ─── MERGE SORT ────────────────────────────────────────────────────────────
  async function mergeSort(l, r, sorted) {
    if (stopFlag) throw 'stop';
    if (l >= r) return;
    explanation.textContent = "Dividing array into two halves...";
    const m = Math.floor((l + r) / 2);
    await mergeSort(l, m, sorted);
    await mergeSort(m + 1, r, sorted);
    await merge(l, m, r, sorted);
  }

  async function merge(l, m, r, sorted) {
    const left  = array.slice(l, m + 1);
    const right = array.slice(m + 1, r + 1);
    let i = 0, j = 0, k = l;

    while (i < left.length && j < right.length) {
      if (stopFlag) throw 'stop';
      explanation.textContent = `Merging sorted subarrays... left[${i}] and right[${j}]`;
      comparisons++;
      steps++; stepsEl.textContent = steps;
      compEl.textContent = comparisons;
      renderBars([k], [l + i, m + 1 + j], [...sorted], []);
      playBeep(200 + array[k] * 2);
      await sleep(getDelay());

      if (left[i] <= right[j]) { 
        array[k++] = left[i++]; 
        steps++; stepsEl.textContent = steps;
      }
      else                     { array[k++] = right[j++]; swaps++; swapsEl.textContent = swaps; }
    }
    while (i < left.length) { 
      array[k++] = left[i++]; 
      steps++; stepsEl.textContent = steps;
    }
    while (j < right.length){ 
      array[k++] = right[j++]; 
      steps++; stepsEl.textContent = steps;
    }

    if (r - l === array.length - 1) {
      for (let x = l; x <= r; x++) sorted.add(x);
    }
    renderBars([], [], [...sorted], []);
    await sleep(getDelay());
  }

  // ─── QUICK SORT ────────────────────────────────────────────────────────────
  async function quickSort(l, r, sorted) {
    if (stopFlag) throw 'stop';
    if (l >= r) { sorted.add(l); return; }
    explanation.textContent = "Choosing pivot...";
    const pi = await partition(l, r, sorted);
    sorted.add(pi);
    await quickSort(l, pi - 1, sorted);
    await quickSort(pi + 1, r, sorted);
  }

  async function partition(l, r, sorted) {
    const pivot = array[r];
    let i = l - 1;
    for (let j = l; j < r; j++) {
      if (stopFlag) throw 'stop';
      explanation.textContent = `Comparing element array[${j}] with pivot (${pivot})...`;
      comparisons++;
      steps++; stepsEl.textContent = steps;
      compEl.textContent = comparisons;
      renderBars([i + 1], [j], [...sorted], [r]);
      playBeep(200 + array[j] * 2);
      await sleep(getDelay());

      if (array[j] < pivot) {
        explanation.textContent = "Placing smaller elements to left...";
        i++;
        [array[i], array[j]] = [array[j], array[i]];
        swaps++; swapsEl.textContent = swaps;
        steps++; stepsEl.textContent = steps;
        renderBars([i, j], [], [...sorted], [r]);
        await sleep(getDelay());
      }
    }
    [array[i + 1], array[r]] = [array[r], array[i + 1]];
    swaps++; swapsEl.textContent = swaps;
    steps++; stepsEl.textContent = steps;
    return i + 1;
  }

  genBtn.addEventListener('click', () => { if (!isSorting) generateArray(); });
  sortBtn.addEventListener('click', () => { if (!isSorting) startSorting(); });
  pauseBtn.addEventListener('click', () => {
    isPaused = !isPaused;
    pauseBtn.textContent = isPaused ? 'Resume' : 'Pause';
    pauseBtn.className = isPaused ? 'btn btn-primary' : 'btn btn-secondary';
    
    if (isPaused) {
      pauseStartTime = performance.now();
      clearInterval(timerInterval);
      setStatus('Paused', 'idle');
    } else {
      totalPausedTime += performance.now() - pauseStartTime;
      timerInterval = setInterval(() => {
        timeEl.textContent = Math.round(performance.now() - startTime - totalPausedTime) + 'ms';
      }, 50);
      setStatus('Sorting…', 'sorting');
    }
  });
  stopBtn.addEventListener('click', () => { stopFlag = true; isPaused = false; });

  if(soundToggle) {
    soundToggle.addEventListener('click', () => {
      soundEnabled = !soundEnabled;
      soundToggle.textContent = soundEnabled ? '🔊 Sound: ON' : '🔇 Sound: OFF';
    });
  }

  if(worstCaseBtn) {
    worstCaseBtn.addEventListener('click', () => {
      if (!isSorting && array.length > 0) {
        array.sort((a,b) => a - b);
        resetStats();
        renderBars([], [], [], []);
        setStatus('Worst Case Generated — (Sorted Ascending makes Quick Sort O(n²))', 'idle');
      }
    });
  }

  const infoTitle = document.getElementById('info-title');
  const infoList  = document.getElementById('info-list');
  function updateInfoBox() {
    if(algoSel.value === 'merge') {
      infoTitle.textContent = 'Merge Sort';
      infoList.innerHTML = '<li>Divide & Conquer</li><li>Stable</li><li>Uses extra space</li>';
    } else {
      infoTitle.textContent = 'Quick Sort';
      infoList.innerHTML = '<li>In-place</li><li>Faster in practice</li><li>Worst case O(n²)</li>';
    }
  }
  algoSel.addEventListener('change', updateInfoBox);
  updateInfoBox();

  function updatePerformanceGraph() {
    const mergeVal = document.getElementById('perf-merge-val');
    const mergeBar = document.getElementById('perf-merge-bar');
    const quickVal = document.getElementById('perf-quick-val');
    const quickBar = document.getElementById('perf-quick-bar');
    if(!mergeVal) return;
    
    mergeVal.textContent = lastMergeTime > 0 ? Math.round(lastMergeTime) + 'ms' : '—';
    quickVal.textContent = lastQuickTime > 0 ? Math.round(lastQuickTime) + 'ms' : '—';
    
    const maxTime = Math.max(lastMergeTime, lastQuickTime, 10);
    mergeBar.style.height = lastMergeTime > 0 ? `${(lastMergeTime / maxTime) * 100}%` : '0%';
    quickBar.style.height = lastQuickTime > 0 ? `${(lastQuickTime / maxTime) * 100}%` : '0%';
  }

  // Init
  generateArray();