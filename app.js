/**
 * RMSearch - RoboMaster BBS Article Search Engine
 * Hosted on GitHub Pages | Only searches bbs.robomaster.com/article
 */

(function () {
  'use strict';

  // --- STATE ---
  const state = {
    articles: [],
    dictionary: [],
    schools: [],
    filteredArticles: [],
    
    // Search settings
    mode: 'hybrid', // 'hybrid' | 'dict' | 'translate'
    query: '',
    chineseQuery: '',
    isTranslating: false,
    
    // Filters
    hasPdf: false,
    hasZip: false,
    hasBaidu: false,
    selectedSchools: new Set(),
    season: 'all',
    startDate: '',
    endDate: '',
    sortBy: 'relevance', // 'relevance' | 'date_desc' | 'date_asc'
    
    // Pagination
    page: 1,
    pageSize: 20,
    
    // UI state
    schoolSearchFilter: '',
    translationCache: new Map()
  };

  // --- DOM ELEMENTS ---
  const el = {
    searchInput: document.getElementById('searchInput'),
    clearSearchBtn: document.getElementById('clearSearchBtn'),
    translationBar: document.getElementById('translationBar'),
    queryTranslationPill: document.getElementById('queryTranslationPill'),
    activeChineseQuery: document.getElementById('activeChineseQuery'),
    translationSourceBadge: document.getElementById('translationSourceBadge'),
    translatingSpinner: document.getElementById('translatingSpinner'),
    editChineseBtn: document.getElementById('editChineseBtn'),
    
    // Modes
    modeHybrid: document.getElementById('modeHybrid'),
    modeDict: document.getElementById('modeDict'),
    modeTranslate: document.getElementById('modeTranslate'),

    // Checkboxes
    checkPdf: document.getElementById('checkPdf'),
    checkZip: document.getElementById('checkZip'),
    checkBaidu: document.getElementById('checkBaidu'),
    countPdf: document.getElementById('countPdf'),
    countZip: document.getElementById('countZip'),
    countBaidu: document.getElementById('countBaidu'),
    resFilterCountBadge: document.getElementById('resFilterCountBadge'),

    // Sorting & Dates
    sortSelect: document.getElementById('sortSelect'),
    seasonPills: document.getElementById('seasonPills'),
    dateStart: document.getElementById('dateStart'),
    dateEnd: document.getElementById('dateEnd'),
    resetDateBtn: document.getElementById('resetDateBtn'),

    // Schools
    schoolSearchInput: document.getElementById('schoolSearchInput'),
    schoolListContainer: document.getElementById('schoolListContainer'),
    schoolSelectedCount: document.getElementById('schoolSelectedCount'),
    selectAllSchoolsBtn: document.getElementById('selectAllSchoolsBtn'),
    clearSchoolsBtn: document.getElementById('clearSchoolsBtn'),

    // Results
    resultsCount: document.getElementById('resultsCount'),
    searchSpeed: document.getElementById('searchSpeed'),
    pageSizeSelect: document.getElementById('pageSizeSelect'),
    activeChipsContainer: document.getElementById('activeChipsContainer'),
    articlesList: document.getElementById('articlesList'),
    noResultsState: document.getElementById('noResultsState'),
    noResultsResetBtn: document.getElementById('noResultsResetBtn'),
    resetAllFiltersBtn: document.getElementById('resetAllFiltersBtn'),
    paginationContainer: document.getElementById('paginationContainer'),
    paginationInfo: document.getElementById('paginationInfo'),
    paginationControls: document.getElementById('paginationControls'),

    // Modals
    openDictModalBtn: document.getElementById('openDictModalBtn'),
    dictModal: document.getElementById('dictModal'),
    closeDictModalBtn: document.getElementById('closeDictModalBtn'),
    closeDictModalFooterBtn: document.getElementById('closeDictModalFooterBtn'),
    dictSearchInput: document.getElementById('dictSearchInput'),
    dictModalList: document.getElementById('dictModalList'),

    manualEditModal: document.getElementById('manualEditModal'),
    manualChineseInput: document.getElementById('manualChineseInput'),
    saveManualEditBtn: document.getElementById('saveManualEditBtn'),
    cancelManualEditBtn: document.getElementById('cancelManualEditBtn'),
    closeManualEditBtn: document.getElementById('closeManualEditBtn'),

    themeToggleBtn: document.getElementById('themeToggleBtn'),
    mobileFilterToggleBtn: document.getElementById('mobileFilterToggleBtn'),
    sidebar: document.getElementById('sidebar')
  };

  // --- INITIALIZATION ---
  async function init() {
    loadUrlParams();
    initTheme();
    bindEvents();

    try {
      el.resultsCount.textContent = 'Loading RoboMaster BBS archive...';
      const [articlesData, dictData, schoolsData] = await Promise.all([
        fetch('./data/articles.json').then(r => r.json()),
        fetch('./data/dictionary.json').then(r => r.json()),
        fetch('./data/schools.json').then(r => r.json())
      ]);

      state.articles = articlesData;
      state.dictionary = dictData;
      state.schools = schoolsData;

      renderSchoolsList();
      renderDictionaryModal();

      if (state.query) {
        await resolveAndSearch(state.query, true);
      } else {
        runSearch();
      }
    } catch (err) {
      console.error('Failed to load dataset:', err);
      el.resultsCount.innerHTML = '<span class="text-red-500 font-mono text-xs">' + escapeHtml(err.stack || err.message) + '</span>';
    }
  }

  // --- THEME SUPPORT ---
  function initTheme() {
    const isDark = localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }

  function toggleTheme() {
    if (document.documentElement.classList.contains('dark')) {
      document.documentElement.classList.remove('dark');
      localStorage.theme = 'light';
    } else {
      document.documentElement.classList.add('dark');
      localStorage.theme = 'dark';
    }
    if (window.lucide) lucide.createIcons();
  }

  // --- URL STATE SYNC ---
  function loadUrlParams() {
    const params = new URLSearchParams(window.location.search);
    if (params.has('q')) {
      state.query = params.get('q');
      el.searchInput.value = state.query;
      el.clearSearchBtn.classList.remove('hidden');
    }
    if (params.has('zh')) state.chineseQuery = params.get('zh');
    if (params.has('mode')) setMode(params.get('mode'));
    if (params.get('pdf') === '1') { state.hasPdf = true; el.checkPdf.checked = true; }
    if (params.get('zip') === '1') { state.hasZip = true; el.checkZip.checked = true; }
    if (params.get('baidu') === '1') { state.hasBaidu = true; el.checkBaidu.checked = true; }
    if (params.has('sort')) { state.sortBy = params.get('sort'); el.sortSelect.value = state.sortBy; }
    if (params.has('season')) { state.season = params.get('season'); }
    if (params.has('start')) { state.startDate = params.get('start'); el.dateStart.value = state.startDate; }
    if (params.has('end')) { state.endDate = params.get('end'); el.dateEnd.value = state.endDate; }
    if (params.has('school')) {
      params.get('school').split(',').forEach(s => {
        if (s.trim()) state.selectedSchools.add(s.trim());
      });
    }
    if (params.has('page')) state.page = parseInt(params.get('page')) || 1;
    if (params.has('size')) {
      state.pageSize = parseInt(params.get('size')) || 20;
      el.pageSizeSelect.value = state.pageSize;
    }
  }

  function syncUrlParams() {
    const params = new URLSearchParams();
    if (state.query) params.set('q', state.query);
    if (state.chineseQuery && state.chineseQuery !== state.query) params.set('zh', state.chineseQuery);
    if (state.mode !== 'hybrid') params.set('mode', state.mode);
    if (state.hasPdf) params.set('pdf', '1');
    if (state.hasZip) params.set('zip', '1');
    if (state.hasBaidu) params.set('baidu', '1');
    if (state.sortBy !== 'date_desc') params.set('sort', state.sortBy);
    if (state.season !== 'all') params.set('season', state.season);
    if (state.startDate) params.set('start', state.startDate);
    if (state.endDate) params.set('end', state.endDate);
    if (state.selectedSchools.size > 0) params.set('school', Array.from(state.selectedSchools).join(','));
    if (state.page > 1) params.set('page', state.page.toString());
    if (state.pageSize !== 20) params.set('size', state.pageSize.toString());

    const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
    window.history.replaceState({}, '', newUrl);
  }

  // --- TRANSLATION / DICTIONARY ENGINE ---
  function lookupDictionary(term) {
    if (!term) return null;
    const clean = term.toLowerCase().trim();
    for (const item of state.dictionary) {
      if (item.en && item.en.some(e => e.toLowerCase() === clean)) {
        return item.zh;
      }
    }
    return null;
  }

  // Multi-word phrase replacer using dictionary
  function translateViaDictionary(text) {
    if (!text || !text.trim()) return '';
    let result = text.trim();
    const sortedDict = [...state.dictionary].sort((a, b) => {
      const maxA = Math.max(...a.en.map(e => e.length));
      const maxB = Math.max(...b.en.map(e => e.length));
      return maxB - maxA;
    });

    const replacedTokens = [];
    for (const item of sortedDict) {
      for (const enPhrase of item.en) {
        const regex = new RegExp(`\\b${escapeRegExp(enPhrase)}\\b`, 'gi');
        if (regex.test(result)) {
          result = result.replace(regex, item.zh);
          replacedTokens.push({ en: enPhrase, zh: item.zh });
        }
      }
    }
    return { translatedText: result, replacedCount: replacedTokens.length, replacedTokens };
  }

  // Live Machine Translation via MyMemory API (with cache & debounce)
  async function fetchMachineTranslation(text) {
    const clean = text.trim();
    if (!clean) return '';
    if (state.translationCache.has(clean)) {
      return state.translationCache.get(clean);
    }

    try {
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(clean)}&langpair=en|zh-CN`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Translation API status ' + res.status);
      const data = await res.json();
      if (data && data.responseData && data.responseData.translatedText) {
        let zh = data.responseData.translatedText;
        zh = zh.replace(/[，。！？]/g, ' ').trim();
        state.translationCache.set(clean, zh);
        return zh;
      }
    } catch (err) {
      console.warn('Machine translation fallback failed:', err);
    }
    return clean;
  }

  // Checks if string already contains Chinese characters
  function containsChinese(str) {
    return /[\u4e00-\u9fa5]/.test(str);
  }

  async function resolveChineseQuery(rawQuery) {
    if (!rawQuery || !rawQuery.trim()) {
      return { zh: '', source: 'none' };
    }

    const trimmed = rawQuery.trim();

    // If user already typed Chinese, use directly
    if (containsChinese(trimmed)) {
      return { zh: trimmed, source: 'Direct Chinese' };
    }

    // Mode: Dictionary Only
    if (state.mode === 'dict') {
      const { translatedText, replacedCount } = translateViaDictionary(trimmed);
      return { 
        zh: translatedText, 
        source: replacedCount > 0 ? 'Dictionary Map' : 'Direct (No match in dict)' 
      };
    }

    // Mode: Machine Translation Only
    if (state.mode === 'translate') {
      el.translatingSpinner.classList.remove('hidden');
      const machineZh = await fetchMachineTranslation(trimmed);
      el.translatingSpinner.classList.add('hidden');
      return { zh: machineZh || trimmed, source: 'Machine Translation' };
    }

    // Mode: Smart Hybrid (Default)
    // First, translate all known domain terms using our high-precision dictionary
    const dictResult = translateViaDictionary(trimmed);
    let zhResult = dictResult.translatedText;

    // Check if any English letters remain
    const remainingEnglish = zhResult.match(/[a-zA-Z]{2,}/g);
    if (remainingEnglish && remainingEnglish.length > 0) {
      el.translatingSpinner.classList.remove('hidden');
      const untranslatedSnippet = remainingEnglish.join(' ');
      const machineFallback = await fetchMachineTranslation(untranslatedSnippet);
      el.translatingSpinner.classList.add('hidden');
      
      // Replace remaining english words
      for (const word of remainingEnglish) {
        zhResult = zhResult.replace(new RegExp(`\\b${escapeRegExp(word)}\\b`, 'g'), machineFallback);
      }
      return { zh: zhResult.trim(), source: 'Hybrid (Dict + Translate)' };
    }

    return { 
      zh: zhResult, 
      source: dictResult.replacedCount > 0 ? 'Dictionary Map' : 'Direct Input' 
    };
  }

  let debounceTimer = null;
  function resolveAndSearch(text, forceImmediate = false) {
    state.query = text;
    if (debounceTimer) clearTimeout(debounceTimer);

    if (forceImmediate) {
      return doResolve();
    } else {
      return new Promise((resolve) => {
        debounceTimer = setTimeout(async () => {
          await doResolve();
          resolve();
        }, 350);
      });
    }

    async function doResolve() {
      if (!state.query || !state.query.trim()) {
        state.chineseQuery = '';
        updateTranslationUI('', 'none');
        state.page = 1;
        runSearch();
        return;
      }

      state.isTranslating = true;
      const { zh, source } = await resolveChineseQuery(state.query);
      state.isTranslating = false;
      state.chineseQuery = zh;
      updateTranslationUI(zh, source);
      state.page = 1;
      runSearch();
    }
  }

  function updateTranslationUI(zh, source) {
    if (!zh || zh === state.query) {
      el.queryTranslationPill.classList.add('hidden');
      el.queryTranslationPill.classList.remove('flex');
    } else {
      el.activeChineseQuery.textContent = `"${zh}"`;
      el.translationSourceBadge.textContent = source;
      el.queryTranslationPill.classList.remove('hidden');
      el.queryTranslationPill.classList.add('flex');
    }
    if (window.lucide) lucide.createIcons();
  }

  // --- SEARCH & FILTER LOGIC ---
  function runSearch() {
    const startTime = performance.now();
    let results = state.articles;

    // 1. Search Query Match & Multi-Factor Relevance Scoring
    const effectiveQuery = (state.chineseQuery || state.query || '').trim().toLowerCase();
    if (effectiveQuery) {
      const tokens = effectiveQuery.split(/\s+/).filter(Boolean);

      // Known RoboMaster robot classes for title disambiguation
      const robotTypesMap = {
        '英雄': ['哨兵', '步兵', '工程', '空中', '无人机', '飞镖', '雷达'],
        '哨兵': ['英雄', '步兵', '工程', '空中', '无人机', '飞镖', '雷达'],
        '步兵': ['英雄', '哨兵', '工程', '空中', '无人机', '飞镖', '雷达'],
        '工程': ['英雄', '哨兵', '步兵', '空中', '无人机', '飞镖', '雷达'],
        '空中': ['英雄', '哨兵', '步兵', '工程', '飞镖', '雷达'],
        '无人机': ['英雄', '哨兵', '步兵', '工程', '飞镖', '雷达'],
        '飞镖': ['英雄', '哨兵', '步兵', '工程', '空中', '无人机', '雷达'],
        '雷达': ['英雄', '哨兵', '步兵', '工程', '空中', '无人机', '飞镖']
      };

      const activeRobotClass = Object.keys(robotTypesMap).find(type => 
        tokens.some(tok => tok.includes(type) || type.includes(tok))
      );

      results = results.map(article => {
        let score = 0;
        let hasMatch = false;
        const titleLower = (article.title || '').toLowerCase();
        const snippetLower = (article.snippet || '').toLowerCase();
        const authorLower = (article.author || '').toLowerCase();
        const collegeLower = (article.college || '').toLowerCase();

        for (const token of tokens) {
          if (titleLower.includes(token)) {
            score += 100;
            hasMatch = true;
            if (titleLower.startsWith(token) || titleLower.includes(`【${token}`) || titleLower.includes(`[${token}`)) {
              score += 40;
            }
          }
          if (collegeLower.includes(token)) {
            score += 35;
            hasMatch = true;
          }
          if (authorLower.includes(token)) {
            score += 20;
            hasMatch = true;
          }
          if (snippetLower.includes(token)) {
            score += 8;
            hasMatch = true;
          }
        }

        // Conflicting robot class demotion:
        // If searching for "hero", an article whose title is about "sentry" and only mentions "hero" in passing
        // is demoted so actual Hero robot designs stay at the top.
        if (activeRobotClass && !titleLower.includes(activeRobotClass)) {
          const conflicting = robotTypesMap[activeRobotClass];
          if (conflicting.some(c => titleLower.includes(c))) {
            score = Math.min(score, 2);
          }
        }

        // Slight recency boost (max ~2-3 pts) so newer posts within the same relevance tier rank higher
        if (hasMatch && article.time) {
          const yearsSince2020 = (article.time - 1577836800000) / (1000 * 3600 * 24 * 365);
          score += yearsSince2020 * 0.4;
        }

        article._score = score;
        return { article, score, hasMatch };
      })
      .filter(item => item.hasMatch)
      .map(item => item.article);
    } else {
      results.forEach(a => a._score = 0);
    }

    // 2. Resource Attachments Checkboxes
    if (state.hasPdf) {
      results = results.filter(a => a.has_pdf);
    }
    if (state.hasZip) {
      results = results.filter(a => a.has_zip);
    }
    if (state.hasBaidu) {
      results = results.filter(a => a.has_baidu);
    }

    // 3. School Filter
    if (state.selectedSchools.size > 0) {
      results = results.filter(a => state.selectedSchools.has(a.college));
    }

    // 4. Season / Year Filter
    if (state.season !== 'all') {
      const year = parseInt(state.season);
      const startMs = new Date(year, 0, 1).getTime();
      const endMs = new Date(year + 1, 0, 1).getTime();
      results = results.filter(a => a.time >= startMs && a.time < endMs);
    }

    // 5. Custom Date Range
    if (state.startDate) {
      const startMs = new Date(state.startDate + 'T00:00:00').getTime();
      results = results.filter(a => a.time >= startMs);
    }
    if (state.endDate) {
      const endMs = new Date(state.endDate + 'T23:59:59').getTime();
      results = results.filter(a => a.time <= endMs);
    }

    // 6. Sorting
    if (state.sortBy === 'relevance') {
      if (effectiveQuery) {
        results.sort((a, b) => {
          const diff = (b._score || 0) - (a._score || 0);
          if (Math.abs(diff) > 0.1) return diff;
          return b.time - a.time;
        });
      } else {
        results.sort((a, b) => b.time - a.time);
      }
    } else if (state.sortBy === 'date_desc') {
      results.sort((a, b) => b.time - a.time);
    } else if (state.sortBy === 'date_asc') {
      results.sort((a, b) => a.time - b.time);
    }

    state.filteredArticles = results;
    const duration = ((performance.now() - startTime) / 1000).toFixed(3);

    // Update Counts
    updateCounts(results.length, duration);
    renderActiveChips();
    renderResultsPage();
    syncUrlParams();
  }

  function updateCounts(totalMatches, duration) {
    el.resultsCount.textContent = `Found ${totalMatches.toLocaleString()} articles`;
    el.searchSpeed.textContent = `(${duration}s)`;

    // Calculate dynamic attachment counts based on current query without resource checkboxes
    let basePool = state.articles;
    const effectiveQuery = (state.chineseQuery || state.query || '').trim().toLowerCase();
    if (effectiveQuery) {
      const tokens = effectiveQuery.split(/\s+/).filter(Boolean);
      basePool = basePool.filter(a => {
        const text = (a.title + ' ' + a.snippet + ' ' + a.college + ' ' + a.author).toLowerCase();
        return tokens.some(t => text.includes(t));
      });
    }
    if (state.selectedSchools.size > 0) {
      basePool = basePool.filter(a => state.selectedSchools.has(a.college));
    }

    const pdfCount = basePool.filter(a => a.has_pdf).length;
    const zipCount = basePool.filter(a => a.has_zip).length;
    const baiduCount = basePool.filter(a => a.has_baidu).length;

    el.countPdf.textContent = pdfCount.toLocaleString();
    el.countZip.textContent = zipCount.toLocaleString();
    el.countBaidu.textContent = baiduCount.toLocaleString();

    let selCount = 0;
    if (state.hasPdf) selCount++;
    if (state.hasZip) selCount++;
    if (state.hasBaidu) selCount++;
    el.resFilterCountBadge.textContent = selCount > 0 ? `${selCount} active` : '0 selected';

    el.schoolSelectedCount.textContent = state.selectedSchools.size > 0 ? `${state.selectedSchools.size} active` : 'All';
  }

  // --- RENDERING RESULTS ---
  function renderResultsPage() {
    const total = state.filteredArticles.length;
    const totalPages = Math.ceil(total / state.pageSize) || 1;
    if (state.page > totalPages) state.page = totalPages;
    if (state.page < 1) state.page = 1;

    if (total === 0) {
      el.articlesList.innerHTML = '';
      el.noResultsState.classList.remove('hidden');
      el.noResultsState.classList.add('flex');
      el.paginationContainer.classList.add('hidden');
      return;
    }

    el.noResultsState.classList.add('hidden');
    el.noResultsState.classList.remove('flex');
    el.paginationContainer.classList.remove('hidden');

    const startIndex = (state.page - 1) * state.pageSize;
    const endIndex = Math.min(startIndex + state.pageSize, total);
    const pageItems = state.filteredArticles.slice(startIndex, endIndex);

    const highlightTokens = (state.chineseQuery || state.query || '').trim().split(/\s+/).filter(Boolean);

    el.articlesList.innerHTML = pageItems.map(article => {
      const highlightedTitle = highlightMatches(article.title || 'Untitled', highlightTokens);
      const highlightedSnippet = highlightMatches(article.snippet || '', highlightTokens);
      const dateFormatted = formatDate(article.time);
      const relativeDate = formatRelativeTime(article.time);
      const schoolBadge = article.college ? `
        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/50 text-[11px] font-medium">
          <i data-lucide="graduation-cap" class="w-3 h-3"></i>
          <span>${escapeHtml(article.college)}</span>
        </span>
      ` : '';

      // Cover image if present
      const imageHtml = article.img ? `
        <div class="hidden sm:block w-36 h-24 shrink-0 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-darkBorder relative">
          <img src="${escapeHtml(article.img)}" alt="Cover" class="w-full h-full object-cover transition-transform duration-300 hover:scale-105" loading="lazy" onerror="this.parentElement.remove()" />
        </div>
      ` : '';

      // Attachments badges
      const pdfBadge = article.has_pdf ? `
        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 text-[11px] font-medium" title="Article contains PDF document download">
          <i data-lucide="file-text" class="w-3 h-3"></i>
          <span>PDF Attached</span>
        </span>
      ` : '';

      const zipBadge = article.has_zip ? `
        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[11px] font-medium" title="Article contains direct ZIP/RAR archive download on BBS">
          <i data-lucide="archive" class="w-3 h-3"></i>
          <span>Direct ZIP</span>
        </span>
      ` : '';

      let baiduBadge = '';
      if (article.has_baidu) {
        let baiduActions = '';
        if (article.baidu_links && article.baidu_links.length > 0) {
          const rawLink = article.baidu_links[0];
          const pwdMatch = rawLink.match(/[?&]pwd=([a-zA-Z0-9]+)/);
          const pwdCode = pwdMatch ? pwdMatch[1] : '';
          baiduActions = `
            ${pwdCode ? `<span class="bg-blue-600/15 dark:bg-blue-400/20 text-blue-700 dark:text-blue-300 px-1.5 py-0.2 rounded font-mono text-[10px] font-bold">pwd: ${escapeHtml(pwdCode)}</span>` : ''}
            <a href="${escapeHtml(rawLink)}" target="_blank" rel="noopener noreferrer" class="hover:underline flex items-center gap-0.5 ml-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400">
              Open <i data-lucide="external-link" class="w-2.5 h-2.5"></i>
            </a>
            <button class="copy-baidu-btn hover:text-blue-800 dark:hover:text-blue-200 underline ml-0.5 font-mono text-[10px]" data-url="${escapeHtml(rawLink)}" title="Copy Baidu Netdisk URL with password">
              Copy
            </button>
          `;
        }
        baiduBadge = `
          <div class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-[11px] font-medium">
            <i data-lucide="cloud-download" class="w-3 h-3"></i>
            <span>Baidu Netdisk</span>
            ${baiduActions}
          </div>
        `;
      }

      return `
        <article class="article-card bg-white dark:bg-darkCard rounded-2xl p-4 sm:p-5 border border-gray-200 dark:border-darkBorder shadow-sm flex flex-col justify-between">
          <div class="flex items-start justify-between gap-4">
            
            <div class="flex-1 min-w-0">
              <!-- Top Metadata Row -->
              <div class="flex flex-wrap items-center gap-2 mb-2 text-xs text-gray-500 dark:text-gray-400">
                <div class="flex items-center gap-1.5">
                  <img src="${escapeHtml(article.avatar || 'https://hz-rm-bbs-web-prod.oss-cn-hangzhou.aliyuncs.com/avatar/pre/v1/default.png')}" alt="Avatar" class="w-5 h-5 rounded-full object-cover border border-gray-200 dark:border-gray-700" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22%23999%22><circle cx=%2212%22 cy=%228%22 r=%224%22/><path d=%22M4 20c0-4 4-6 8-6s8 2 8 6%22/></svg>'" />
                  <span class="font-medium text-gray-700 dark:text-gray-300">${escapeHtml(article.author || 'Anonymous')}</span>
                </div>
                <span>•</span>
                ${schoolBadge}
                <span>•</span>
                <time title="${dateFormatted}" class="hover:underline">${relativeDate}</time>
              </div>

              <!-- Title -->
              <h2 class="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-2 leading-snug">
                <a href="${escapeHtml(article.url)}" target="_blank" rel="noopener noreferrer" class="hover:text-brand-500 transition line-clamp-2">
                  ${highlightedTitle}
                </a>
              </h2>

              <!-- Snippet -->
              <p class="text-xs sm:text-sm text-gray-600 dark:text-gray-400 leading-relaxed line-clamp-3 mb-3">
                ${highlightedSnippet || 'No description preview available.'}
              </p>
            </div>

            <!-- Optional Cover Image -->
            ${imageHtml}
          </div>

          <!-- Bottom Action Bar -->
          <div class="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-gray-100 dark:border-gray-800/80 mt-1">
            <div class="flex flex-wrap items-center gap-2">
              ${pdfBadge}
              ${zipBadge}
              ${baiduBadge}
            </div>

            <a href="${escapeHtml(article.url)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 hover:underline">
              <span>Read Article on BBS</span>
              <i data-lucide="external-link" class="w-3.5 h-3.5"></i>
            </a>
          </div>
        </article>
      `;
    }).join('');

    renderPagination(total, totalPages, startIndex + 1, endIndex);
    if (window.lucide) lucide.createIcons();
    bindCardEvents();
  }

  function bindCardEvents() {
    document.querySelectorAll('.copy-baidu-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const url = btn.dataset.url;
        navigator.clipboard.writeText(url).then(() => {
          const original = btn.textContent;
          btn.textContent = 'Copied!';
          setTimeout(() => { btn.textContent = original; }, 2000);
        });
      });
    });
  }

  // --- PAGINATION RENDERING ---
  function renderPagination(total, totalPages, startItem, endItem) {
    el.paginationInfo.textContent = `Showing ${startItem}–${endItem} of ${total.toLocaleString()}`;

    let controlsHtml = '';
    
    // Previous Page
    controlsHtml += `
      <button class="pagination-btn ${state.page === 1 ? 'opacity-40 pointer-events-none' : ''}" data-page="${state.page - 1}">
        <i data-lucide="chevron-left" class="w-4 h-4"></i>
      </button>
    `;

    // Page Numbers logic
    const pagesToShow = [];
    pagesToShow.push(1);
    for (let i = state.page - 2; i <= state.page + 2; i++) {
      if (i > 1 && i < totalPages) pagesToShow.push(i);
    }
    if (totalPages > 1) pagesToShow.push(totalPages);

    let lastP = 0;
    for (const p of pagesToShow) {
      if (lastP && p - lastP > 1) {
        controlsHtml += `<span class="px-2 text-gray-400 text-xs">...</span>`;
      }
      controlsHtml += `
        <button class="pagination-num-btn ${p === state.page ? 'active' : ''}" data-page="${p}">
          ${p}
        </button>
      `;
      lastP = p;
    }

    // Next Page
    controlsHtml += `
      <button class="pagination-btn ${state.page === totalPages ? 'opacity-40 pointer-events-none' : ''}" data-page="${state.page + 1}">
        <i data-lucide="chevron-right" class="w-4 h-4"></i>
      </button>
    `;

    el.paginationControls.innerHTML = controlsHtml;
    if (window.lucide) lucide.createIcons();

    el.paginationControls.querySelectorAll('button[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.page = parseInt(btn.dataset.page);
        renderResultsPage();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  }

  // --- SCHOOLS SIDEBAR RENDERING ---
  function renderSchoolsList() {
    const filter = (state.schoolSearchFilter || '').toLowerCase().trim();
    const filteredSchools = state.schools.filter(s => {
      if (!filter) return true;
      return s.name.toLowerCase().includes(filter);
    });

    if (filteredSchools.length === 0) {
      el.schoolListContainer.innerHTML = `<div class="p-3 text-center text-gray-400 text-xs">No matching schools</div>`;
      return;
    }

    el.schoolListContainer.innerHTML = filteredSchools.map(s => {
      const isChecked = state.selectedSchools.has(s.name);
      return `
        <label class="flex items-center justify-between p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-darkInput/60 cursor-pointer transition">
          <div class="flex items-center gap-2 min-w-0 pr-1">
            <input type="checkbox" class="school-cb filter-checkbox shrink-0" data-name="${escapeHtml(s.name)}" ${isChecked ? 'checked' : ''} />
            <span class="truncate text-gray-700 dark:text-gray-300 font-medium ${isChecked ? 'text-brand-500 font-bold' : ''}">${escapeHtml(s.name)}</span>
          </div>
          <span class="badge-count shrink-0">${s.count}</span>
        </label>
      `;
    }).join('');

    el.schoolListContainer.querySelectorAll('.school-cb').forEach(cb => {
      cb.addEventListener('change', () => {
        const schoolName = cb.dataset.name;
        if (cb.checked) {
          state.selectedSchools.add(schoolName);
        } else {
          state.selectedSchools.delete(schoolName);
        }
        state.page = 1;
        runSearch();
      });
    });
  }

  // --- ACTIVE FILTER CHIPS ---
  function renderActiveChips() {
    const chips = [];

    if (state.query) {
      chips.push({
        label: `Query: "${state.query}"`,
        onRemove: () => {
          el.searchInput.value = '';
          el.clearSearchBtn.classList.add('hidden');
          resolveAndSearch('', true);
        }
      });
    }

    if (state.hasPdf) {
      chips.push({
        label: 'PDF Attachment',
        onRemove: () => { el.checkPdf.checked = false; state.hasPdf = false; runSearch(); }
      });
    }

    if (state.hasZip) {
      chips.push({
        label: 'ZIP Download',
        onRemove: () => { el.checkZip.checked = false; state.hasZip = false; runSearch(); }
      });
    }

    if (state.hasBaidu) {
      chips.push({
        label: 'Baidu Netdisk',
        onRemove: () => { el.checkBaidu.checked = false; state.hasBaidu = false; runSearch(); }
      });
    }

    if (state.season !== 'all') {
      chips.push({
        label: `Season: ${state.season}`,
        onRemove: () => {
          state.season = 'all';
          updateSeasonPillsUI('all');
          runSearch();
        }
      });
    }

    if (state.startDate || state.endDate) {
      chips.push({
        label: `Date: ${state.startDate || 'min'} to ${state.endDate || 'max'}`,
        onRemove: () => {
          state.startDate = '';
          state.endDate = '';
          el.dateStart.value = '';
          el.dateEnd.value = '';
          runSearch();
        }
      });
    }

    for (const school of state.selectedSchools) {
      chips.push({
        label: school,
        onRemove: () => {
          state.selectedSchools.delete(school);
          renderSchoolsList();
          runSearch();
        }
      });
    }

    if (chips.length === 0) {
      el.activeChipsContainer.innerHTML = '';
      return;
    }

    el.activeChipsContainer.innerHTML = `
      <span class="text-xs text-gray-400 mr-1 font-medium">Filters:</span>
      ${chips.map((chip, idx) => `
        <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-brand-50 dark:bg-brand-950/70 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800 text-xs font-medium">
          <span>${escapeHtml(chip.label)}</span>
          <button class="chip-remove-btn hover:text-red-500 transition p-0.5" data-chip-idx="${idx}">
            <i data-lucide="x" class="w-3 h-3"></i>
          </button>
        </span>
      `).join('')}
      <button id="clearAllChipsBtn" class="text-xs text-red-500 hover:underline ml-2">Clear All</button>
    `;

    if (window.lucide) lucide.createIcons();

    el.activeChipsContainer.querySelectorAll('.chip-remove-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.chipIdx);
        if (chips[idx]) chips[idx].onRemove();
      });
    });

    const clearAll = document.getElementById('clearAllChipsBtn');
    if (clearAll) {
      clearAll.addEventListener('click', resetAllFilters);
    }
  }

  // --- DICTIONARY MODAL RENDERING ---
  function renderDictionaryModal() {
    const filter = (el.dictSearchInput.value || '').toLowerCase().trim();
    const filtered = state.dictionary.filter(item => {
      if (!filter) return true;
      const enMatch = item.en.some(e => e.toLowerCase().includes(filter));
      const zhMatch = item.zh.toLowerCase().includes(filter);
      const catMatch = (item.category || '').toLowerCase().includes(filter);
      return enMatch || zhMatch || catMatch;
    });

    // Group by category
    const groups = {};
    for (const item of filtered) {
      const cat = item.category || 'General';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    }

    el.dictModalList.innerHTML = Object.keys(groups).map(category => `
      <div class="mb-4">
        <h4 class="text-xs font-bold uppercase tracking-wider text-brand-500 mb-2">${category}</h4>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
          ${groups[category].map(entry => `
            <div class="dict-entry-card p-2.5 rounded-xl bg-gray-50 dark:bg-darkInput border border-gray-200 dark:border-darkBorder hover:border-brand-500 transition cursor-pointer flex items-center justify-between" data-insert="${escapeHtml(entry.en[0])}">
              <div>
                <strong class="text-gray-900 dark:text-white block text-sm">${escapeHtml(entry.zh)}</strong>
                <span class="text-gray-500 dark:text-gray-400 font-mono text-[11px]">${escapeHtml(entry.en.join(' / '))}</span>
              </div>
              <span class="text-brand-500 opacity-0 hover:opacity-100 transition text-[11px] font-semibold">Search →</span>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');

    el.dictModalList.querySelectorAll('.dict-entry-card').forEach(card => {
      card.addEventListener('click', () => {
        const term = card.dataset.insert;
        el.searchInput.value = term;
        el.clearSearchBtn.classList.remove('hidden');
        closeDictModal();
        resolveAndSearch(term, true);
      });
    });
  }

  // --- EVENT HANDLERS ---
  function bindEvents() {
    // Search input
    el.searchInput.addEventListener('input', (e) => {
      const val = e.target.value;
      if (val) {
        el.clearSearchBtn.classList.remove('hidden');
      } else {
        el.clearSearchBtn.classList.add('hidden');
      }
      resolveAndSearch(val);
    });

    el.clearSearchBtn.addEventListener('click', () => {
      el.searchInput.value = '';
      el.clearSearchBtn.classList.add('hidden');
      resolveAndSearch('', true);
    });

    // Keyboard shortcut '/' to search
    window.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement !== el.searchInput && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        el.searchInput.focus();
        el.searchInput.select();
      }
      if (e.key === 'Escape') {
        closeDictModal();
        closeManualEditModal();
      }
    });

    // Search Modes
    el.modeHybrid.addEventListener('click', () => setMode('hybrid'));
    el.modeDict.addEventListener('click', () => setMode('dict'));
    el.modeTranslate.addEventListener('click', () => setMode('translate'));

    // Checkboxes
    el.checkPdf.addEventListener('change', (e) => {
      state.hasPdf = e.target.checked;
      state.page = 1;
      runSearch();
    });
    el.checkZip.addEventListener('change', (e) => {
      state.hasZip = e.target.checked;
      state.page = 1;
      runSearch();
    });
    el.checkBaidu.addEventListener('change', (e) => {
      state.hasBaidu = e.target.checked;
      state.page = 1;
      runSearch();
    });

    // Sorting
    el.sortSelect.addEventListener('change', (e) => {
      state.sortBy = e.target.value;
      state.page = 1;
      runSearch();
    });

    // Season pills
    el.seasonPills.querySelectorAll('.season-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        const year = pill.dataset.year;
        state.season = year;
        updateSeasonPillsUI(year);
        state.page = 1;
        runSearch();
      });
    });

    // Custom Date Range
    el.dateStart.addEventListener('change', (e) => {
      state.startDate = e.target.value;
      state.page = 1;
      runSearch();
    });
    el.dateEnd.addEventListener('change', (e) => {
      state.endDate = e.target.value;
      state.page = 1;
      runSearch();
    });
    el.resetDateBtn.addEventListener('click', () => {
      state.season = 'all';
      state.startDate = '';
      state.endDate = '';
      el.dateStart.value = '';
      el.dateEnd.value = '';
      updateSeasonPillsUI('all');
      state.page = 1;
      runSearch();
    });

    // School search filter
    el.schoolSearchInput.addEventListener('input', (e) => {
      state.schoolSearchFilter = e.target.value;
      renderSchoolsList();
    });

    el.selectAllSchoolsBtn.addEventListener('click', () => {
      // Select top 5 schools
      state.schools.slice(0, 5).forEach(s => state.selectedSchools.add(s.name));
      renderSchoolsList();
      state.page = 1;
      runSearch();
    });

    el.clearSchoolsBtn.addEventListener('click', () => {
      state.selectedSchools.clear();
      renderSchoolsList();
      state.page = 1;
      runSearch();
    });

    // Page size
    el.pageSizeSelect.addEventListener('change', (e) => {
      state.pageSize = parseInt(e.target.value);
      state.page = 1;
      renderResultsPage();
    });

    // Reset All Filters
    el.resetAllFiltersBtn.addEventListener('click', resetAllFilters);
    el.noResultsResetBtn.addEventListener('click', resetAllFilters);

    // Dictionary Modal
    el.openDictModalBtn.addEventListener('click', openDictModal);
    el.closeDictModalBtn.addEventListener('click', closeDictModal);
    el.closeDictModalFooterBtn.addEventListener('click', closeDictModal);
    el.dictSearchInput.addEventListener('input', renderDictionaryModal);
    el.dictModal.addEventListener('click', (e) => {
      if (e.target === el.dictModal) closeDictModal();
    });

    // Manual Chinese Edit
    el.editChineseBtn.addEventListener('click', openManualEditModal);
    el.closeManualEditBtn.addEventListener('click', closeManualEditModal);
    el.cancelManualEditBtn.addEventListener('click', closeManualEditModal);
    el.saveManualEditBtn.addEventListener('click', () => {
      const val = el.manualChineseInput.value.trim();
      state.chineseQuery = val;
      updateTranslationUI(val, 'Manual Override');
      closeManualEditModal();
      state.page = 1;
      runSearch();
    });

    // Theme toggle
    el.themeToggleBtn.addEventListener('click', toggleTheme);

    // Mobile filter toggle
    el.mobileFilterToggleBtn.addEventListener('click', () => {
      el.sidebar.classList.toggle('mobile-open');
    });
  }

  function setMode(mode) {
    state.mode = mode;
    [el.modeHybrid, el.modeDict, el.modeTranslate].forEach(b => b.classList.remove('active'));
    if (mode === 'hybrid') el.modeHybrid.classList.add('active');
    else if (mode === 'dict') el.modeDict.classList.add('active');
    else if (mode === 'translate') el.modeTranslate.classList.add('active');

    if (state.query) {
      resolveAndSearch(state.query, true);
    }
  }

  function updateSeasonPillsUI(selectedYear) {
    el.seasonPills.querySelectorAll('.season-pill').forEach(pill => {
      if (pill.dataset.year === selectedYear) {
        pill.classList.add('active');
      } else {
        pill.classList.remove('active');
      }
    });
  }

  function resetAllFilters() {
    state.query = '';
    state.chineseQuery = '';
    el.searchInput.value = '';
    el.clearSearchBtn.classList.add('hidden');
    updateTranslationUI('', 'none');

    state.hasPdf = false;
    state.hasZip = false;
    state.hasBaidu = false;
    el.checkPdf.checked = false;
    el.checkZip.checked = false;
    el.checkBaidu.checked = false;

    state.season = 'all';
    state.startDate = '';
    state.endDate = '';
    el.dateStart.value = '';
    el.dateEnd.value = '';
    updateSeasonPillsUI('all');

    state.selectedSchools.clear();
    state.schoolSearchFilter = '';
    el.schoolSearchInput.value = '';
    renderSchoolsList();

    state.sortBy = 'date_desc';
    el.sortSelect.value = 'date_desc';

    state.page = 1;
    runSearch();
  }

  function openDictModal() {
    el.dictModal.classList.remove('hidden');
    el.dictModal.classList.add('flex');
    el.dictSearchInput.focus();
  }

  function closeDictModal() {
    el.dictModal.classList.add('hidden');
    el.dictModal.classList.remove('flex');
  }

  function openManualEditModal() {
    el.manualChineseInput.value = state.chineseQuery || '';
    el.manualEditModal.classList.remove('hidden');
    el.manualEditModal.classList.add('flex');
    el.manualChineseInput.focus();
    el.manualChineseInput.select();
  }

  function closeManualEditModal() {
    el.manualEditModal.classList.add('hidden');
    el.manualEditModal.classList.remove('flex');
  }

  // --- HELPERS ---
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function highlightMatches(text, tokens) {
    if (!text || !tokens || tokens.length === 0) return escapeHtml(text);
    let escaped = escapeHtml(text);
    for (const t of tokens) {
      if (!t || t.length < 1) continue;
      const regex = new RegExp(`(${escapeRegExp(escapeHtml(t))})`, 'gi');
      escaped = escaped.replace(regex, '<mark>$1</mark>');
    }
    return escaped;
  }

  function formatDate(ms) {
    if (!ms) return '';
    const d = new Date(ms);
    return d.toISOString().split('T')[0];
  }

  function formatRelativeTime(ms) {
    if (!ms) return '';
    const now = Date.now();
    const diffDays = Math.floor((now - ms) / (1000 * 3600 * 24));
    if (diffDays < 1) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 30) return `${diffDays} days ago`;
    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths < 12) return `${diffMonths} mo ago`;
    const diffYears = Math.floor(diffDays / 365);
    return `${diffYears} yr${diffYears > 1 ? 's' : ''} ago`;
  }

  // Start app
  document.addEventListener('DOMContentLoaded', init);

})();
