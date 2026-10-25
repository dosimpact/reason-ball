(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const S = globalThis.WeddingStats;
  const baseURL = new URL('./', location.href);
  const database = 'database/참가격_웨딩홀_업체별_공시원본/';
  const url = path => new URL(path.split('/').map(encodeURIComponent).join('/'), baseURL).href;
  const e = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const money = value => Number.isFinite(value) ? new Intl.NumberFormat('ko-KR').format(Math.round(value)) : '—';
  const won = value => Number.isFinite(value) ? money(value) + '원' : '원문 확인';
  const range = value => !value ? '원문 확인' : value.min === value.max ? won(value.min) : `${won(value.min)} ~ ${won(value.max)}`;
  const normalize = value => String(value).normalize('NFKC').toLowerCase().replace(/[\s-]+/g, '');
  const metricNames = { mealMin: '1인 식대 최저가', rentalMin: '공간 대관료', combinedMin: '대관·장식 합계' };
  let catalogue, venues = [], byId = new Map(), lastMapId, toastTimer;
  const params = new URLSearchParams(location.search);
  const state = { query: params.get('q') || '', region: params.get('region') || '', type: '', budget: 200000, guests: '', year: '', pricedOnly: false, favoritesOnly: false, sort: 'name', direction: 'asc', page: 1, size: 20, metric: 'mealMin', benchmark: 'national', selected: null, view: 'all', favorites: new Set(), comparison: new Set() };
  function readStorage(key) {
    try { const value = JSON.parse(localStorage.getItem('vow-atlas:' + key) || '[]'); return Array.isArray(value) ? value : []; } catch { return []; }
  }
  function persist() {
    try { localStorage.setItem('vow-atlas:favorites', JSON.stringify([...state.favorites])); localStorage.setItem('vow-atlas:comparison', JSON.stringify([...state.comparison])); } catch { /* Session state remains usable when storage is unavailable. */ }
  }
  function toast(message) {
    $('toast').textContent = message; $('toast').hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, 2800);
  }
  function filtered() {
    const terms = state.query.trim().split(/\s+/).map(normalize).filter(Boolean);
    return venues.filter(v => (!terms.length || terms.every(term => v.search.includes(term))) && (!state.region || v.region === state.region) && (!state.type || v.type === state.type) && (state.budget === 200000 || (v.metrics.mealMin != null && v.metrics.mealMin <= state.budget)) && (!state.guests || (v.metrics.guestsMin != null && v.metrics.guestsMin <= Number(state.guests))) && (!state.year || (state.year === 'unknown' ? v.priceYear == null : v.priceYear === Number(state.year))) && (!state.pricedOnly || (v.metrics.mealMin != null && !v.archived && !v.duplicateOf)) && (!state.favoritesOnly || state.favorites.has(v.id)));
  }
  function cohort(metric = state.metric) {
    return (state.benchmark === 'filtered' ? filtered() : venues).filter(v => !v.archived && !v.duplicateOf && typeof v.metrics[metric] === 'number' && Number.isFinite(v.metrics[metric]));
  }
  function comparison(venue, metric = state.metric) {
    if (venue.archived || venue.metrics[metric] == null) return null;
    const sample = cohort(metric);
    return S.compare(venue.metrics[metric], sample.map(v => v.metrics[metric]), sample.some(v => v.id === venue.id || v.id === venue.duplicateOf));
  }
  function percentageText(result) {
    if (!result) return '비교 자료 확인';
    if (result.count < 2) return '비교 표본 부족';
    const percent = Math.abs(result.savingsPct).toFixed(1);
    return result.savingsPct >= 0 ? `평균보다 ${percent}% 낮음` : `평균보다 ${percent}% 높음`;
  }
  function updateURL() {
    const target = new URL(location.href);
    for (const [key, value] of [['q', state.query], ['region', state.region]]) value ? target.searchParams.set(key, value) : target.searchParams.delete(key);
    try { history.replaceState(null, '', target); } catch { /* file:// origin may disallow history changes. */ }
  }
  function renderStats() {
    const prices = S.summarize(venues.filter(v => !v.archived && !v.duplicateOf).map(v => v.metrics.mealMin));
    $('stat-total').innerHTML = `${venues.length}<span>건</span>`;
    $('stat-priced').innerHTML = `${prices.count}<span>곳</span>`;
    $('stat-median').innerHTML = `${money(prices.median)}<span>원</span>`;
    $('stat-saved').innerHTML = `${state.favorites.size}<span>곳</span>`;
    $('favorite-count').textContent = state.favorites.size;
  }
  function renderChart() {
    const sample = cohort();
    const stats = S.histogram(sample.map(v => v.metrics[state.metric]));
    $('sample-count').textContent = `비교 표본 ${stats.count}곳`;
    if (!stats.count) { $('price-chart').innerHTML = '<p class="chart-empty">이 항목의 비교 가능한 가격이 없습니다.<br>다른 항목이나 지역을 선택해 주세요.</p>'; return; }
    const W = 700, H = 235, left = 32, right = 18, top = 29, bottom = 37;
    const w = W - left - right, h = H - top - bottom;
    const normalValues = Array.from({ length: 121 }, (_, i) => { const x = stats.lower + (stats.upper - stats.lower) * i / 120; return { x, count: S.normalDensity(x, stats.mean, stats.sd) * stats.count * stats.width }; });
    const maxCount = Math.max(1, ...stats.bins.map(b => b.count), ...(stats.count >= 3 ? normalValues.map(p => p.count) : [])) * 1.15;
    const x = value => left + (value - stats.lower) / (stats.upper - stats.lower) * w;
    const y = count => H - bottom - count / maxCount * h;
    const bars = stats.bins.map((bin, i) => `<g class="chart-bin" tabindex="0" role="img" aria-label="${money(bin.lower)}원부터 ${money(bin.upper)}원: ${bin.count}곳"><title>${money(bin.lower)} ~ ${money(bin.upper)}원 · ${bin.count}곳</title><rect x="${x(bin.lower) + 3}" y="${y(bin.count)}" width="${w / stats.bins.length - 6}" height="${H - bottom - y(bin.count)}" rx="3" fill="${i % 2 ? '#c1d0b4' : '#d5dfcb'}"/></g>`).join('');
    const curve = stats.count >= 3 && stats.sd > 0 ? `<path d="${normalValues.map((p, i) => `${i ? 'L' : 'M'}${x(p.x).toFixed(1)},${y(p.count).toFixed(1)}`).join(' ')}" fill="none" stroke="#5a805c" stroke-width="2.5"/>` : '';
    const ticks = Array.from({ length: 5 }, (_, i) => { const value = stats.lower + (stats.upper - stats.lower) * i / 4; return `<text x="${x(value)}" y="${H - 13}" text-anchor="middle" fill="#a0aa95" font-size="10">${(value / 10000).toFixed(value < 100000 ? 1 : 0)}만</text>`; }).join('');
    const grids = [0, .5, 1].map(f => `<line x1="${left}" x2="${W - right}" y1="${y(maxCount * f)}" y2="${y(maxCount * f)}" stroke="#edf0e8"/><text x="${left - 9}" y="${y(maxCount * f) + 4}" text-anchor="end" fill="#b2baa8" font-size="9">${Math.round(maxCount * f)}</text>`).join('');
    const selected = byId.get(state.selected);
    let marker = '';
    if (selected && !selected.archived && Number.isFinite(selected.metrics[state.metric]) && selected.metrics[state.metric] >= stats.lower && selected.metrics[state.metric] <= stats.upper) {
      const at = x(selected.metrics[state.metric]), labelX = Math.max(90, Math.min(W - 90, at));
      marker = `<line x1="${at}" x2="${at}" y1="${top + 5}" y2="${H - bottom}" stroke="#ba7b58" stroke-width="1.5" stroke-dasharray="4 4"/><circle cx="${at}" cy="${H - bottom}" r="3" fill="#ba7b58"/><rect x="${labelX - 74}" y="0" width="148" height="22" rx="4" fill="#f2e9dc"/><text x="${labelX}" y="15" text-anchor="middle" font-size="10" fill="#9d795a">선택 공간 · ${money(selected.metrics[state.metric])}원</text>`;
    }
    $('price-chart').innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${e(metricNames[state.metric])} 실제 가격 분포와 정규분포 참고 곡선. 표본 ${stats.count}곳, 평균 ${money(stats.mean)}원">${grids}${bars}${curve}<line x1="${x(stats.mean)}" x2="${x(stats.mean)}" y1="${top}" y2="${H - bottom}" stroke="#90a584" stroke-dasharray="3 5" opacity=".6"/>${ticks}${marker}</svg>`;
  }
  function renderMap() {
    const venue = byId.get(state.selected);
    if (!venue) {
      if (lastMapId !== null) { $('map-preview').innerHTML = '<div class="map-placeholder"><strong>조건에 맞는 공간을 찾아보세요</strong><span>검색 결과가 나오면 위치를 표시합니다.</span></div>'; $('map-name').textContent = '검색 결과가 없어요'; $('map-address').textContent = '필터를 넓혀 공간을 찾아보세요'; $('map-detail').disabled = true; lastMapId = null; }
      return;
    }
    if (venue.id === lastMapId) return;
    lastMapId = venue.id;
    $('map-name').textContent = venue.name;
    $('map-address').textContent = venue.address;
    $('map-detail').disabled = false;
    const embed = `https://maps.google.com/maps?hl=ko&q=${encodeURIComponent(venue.address)}&z=15&output=embed`;
    $('map-preview').innerHTML = `<iframe title="${e(venue.name)} Google 지도" src="${embed}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe>`;
  }
  function renderChips() {
    const chips = [];
    if (state.query) chips.push(['query', `검색: ${state.query}`]);
    if (state.region) chips.push(['region', state.region]);
    if (state.type) chips.push(['type', state.type]);
    if (state.budget < 200000) chips.push(['budget', `식대 ${money(state.budget)}원 이하`]);
    if (state.guests) chips.push(['guests', `인원 ${state.guests}명 이하`]);
    if (state.year) chips.push(['year', state.year === 'unknown' ? '연도 미기재' : `${state.year}년 표기`]);
    if (state.pricedOnly) chips.push(['pricedOnly', '식대 확인 가능']);
    if (state.favoritesOnly) chips.push(['favoritesOnly', '관심 공간']);
    $('active-filters').innerHTML = chips.map(([key, label]) => `<span class="filter-chip">${e(label)}<button data-remove="${key}" aria-label="${e(label)} 필터 해제">×</button></span>`).join('');
  }
  function renderTable() {
    const results = S.sortVenues(filtered(), state.sort, state.direction);
    const pages = Math.max(1, Math.ceil(results.length / state.size));
    state.page = Math.min(state.page, pages);
    const from = (state.page - 1) * state.size;
    const current = results.slice(from, from + state.size);
    $('result-count').textContent = `${results.length}건`;
    $('results-eyebrow').textContent = state.favoritesOnly ? 'YOUR PERSONAL COLLECTION' : 'THE VENUE COLLECTION';
    $('venue-rows').innerHTML = current.map(venue => {
      const result = comparison(venue, 'mealMin');
      const price = venue.metrics.mealMin;
      const rent = venue.metrics.rentalMin ?? venue.metrics.combinedMin;
      const saved = state.favorites.has(venue.id);
      return `<tr data-id="${venue.id}" class="${venue.id === state.selected ? 'selected-row' : ''}"><td><button class="favorite-button ${saved ? 'saved' : ''}" data-action="favorite" aria-label="${e(venue.name)} 관심 ${saved ? '해제' : '저장'}" aria-pressed="${saved}">${saved ? '♥' : '♡'}</button></td><td><button class="venue-name" data-action="detail" aria-label="${e(venue.name)} 상세보기">${e(venue.name)}</button><span class="venue-sub"><span class="venue-type">${venue.type}</span>${venue.archived ? '이전 공시' : venue.priceYear ? `${venue.priceYear}년 표기` : '적용연도 미기재'}</span></td><td>${e(venue.region)}</td><td>${price == null ? '<span class="muted">원문 확인</span>' : `<span class="money">${money(price)}<small>원~</small></span><span class="sub-money">${venue.metrics.mealMax > price ? `최고 ${money(venue.metrics.mealMax)}원` : '기본 성인 1인'}</span>`}</td><td>${rent == null ? '<span class="muted">원문 확인</span>' : `<span class="money">${money(rent)}<small>원~</small></span><span class="sub-money">${venue.metrics.rentalMin == null ? '대관·장식 합계' : '공간 대관료'}</span>`}</td><td>${venue.metrics.guestsMin == null ? '<span class="muted">조건 확인</span>' : `${venue.metrics.guestsMin}<span class="muted">명~</span>`}</td><td>${result && result.count > 1 ? `<span class="price-pill ${result.savingsPct < 0 ? 'high' : ''}">${percentageText(result)}</span><span class="price-detail">${result.cheaperThanPct.toFixed(0)}%의 다른 공간보다 낮음</span>` : `<span class="muted">${venue.archived ? '이전 공시 · 통계 제외' : '비교 자료 확인'}</span>`}</td><td><input class="compare-checkbox" type="checkbox" data-action="compare" aria-label="${e(venue.name)} 비교 선택" ${state.comparison.has(venue.id) ? 'checked' : ''} ${state.comparison.size >= 4 && !state.comparison.has(venue.id) ? 'disabled' : ''}></td></tr>`;
    }).join('');
    $('empty-state').hidden = !!results.length;
    $('venue-table').hidden = !results.length;
    $('page-summary').textContent = results.length ? `${results.length}개 공시 중 ${from + 1}–${Math.min(from + state.size, results.length)}` : '0개 공시';
    $('page-number').textContent = `${state.page} / ${pages}`;
    $('previous-page').disabled = state.page <= 1;
    $('next-page').disabled = state.page >= pages;
    for (const button of document.querySelectorAll('[data-sort]')) {
      const active = button.dataset.sort === state.sort;
      button.closest('th').setAttribute('aria-sort', active ? state.direction === 'asc' ? 'ascending' : 'descending' : 'none');
    }
    renderChips();
  }
  function renderTray() {
    $('comparison-tray').hidden = !state.comparison.size;
    $('compare-count').textContent = state.comparison.size;
    $('open-comparison').disabled = state.comparison.size < 2;
  }
  function render() {
    renderStats(); renderTable(); renderChart(); renderMap(); renderTray(); updateURL();
  }
  function syncFilters() {
    $('search').value = state.query; $('region').value = state.region; $('venue-type').value = state.type;
    $('meal-budget').value = state.budget; $('guest-count').value = state.guests; $('price-year').value = state.year;
    $('only-priced').checked = state.pricedOnly; $('only-favorites').checked = state.favoritesOnly;
    $('budget-label').textContent = state.budget === 200000 ? '제한 없음' : `${money(state.budget)}원 이하`;
    document.querySelectorAll('[data-region]').forEach(button => button.classList.toggle('selected', button.dataset.region === state.region));
  }
  function changeFilters() { state.page = 1; const matches = filtered(); if (!matches.some(v => v.id === state.selected)) state.selected = matches[0]?.id || null; syncFilters(); render(); }
  function resetFilters() {
    Object.assign(state, { query: '', region: '', type: '', budget: 200000, guests: '', year: '', pricedOnly: false, favoritesOnly: state.view === 'favorites', page: 1 });
    changeFilters();
  }
  function toggleFavorite(id) {
    state.favorites.has(id) ? state.favorites.delete(id) : state.favorites.add(id);
    persist(); render();
    document.querySelectorAll('[data-detail-favorite]').forEach(button => { button.textContent = state.favorites.has(id) ? '♥ 관심 공간에 저장됨' : '♡ 관심 공간 저장'; });
  }
  function modalOpen(dialog) { if (!dialog.open) dialog.showModal(); document.body.classList.add('body-dialog'); }
  function closeModal(dialog) { dialog.close(); if (!document.querySelector('dialog[open]')) document.body.classList.remove('body-dialog'); }
  function googleURL(venue) { return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue.address + ' ' + venue.name)}`; }
  function naverURL(venue) { return `https://map.naver.com/p/search/${encodeURIComponent(venue.address + ' ' + venue.name)}`; }
  function sectionsHTML(venue) {
    return venue.documents.map(doc => `<details ${doc.primary ? 'open' : ''}><summary>${e(doc.title)} ${doc.primary ? '· 대표 공시' : doc.state !== 'visible' ? '· 숨김 참고 자료' : '· 별도 자료'}</summary><div>${doc.sections.map(section => `<h4>${e(section.heading)}</h4>${section.kind === 'details' ? section.items.map(item => `<p><b>${e(item.title)}</b></p><ul>${item.fields.map(field => `<li><b>${e(field.label)}</b> · ${e(field.value)}</li>`).join('')}</ul>`).join('') : section.items.map(item => `<p>${e(item)}</p>`).join('')}`).join('')}</div></details>`).join('');
  }
  function showDetail(id) {
    const venue = byId.get(id); if (!venue) return;
    state.selected = id; renderMap(); renderChart(); renderTable();
    const result = comparison(venue);
    const metric = venue.metrics[state.metric];
    const rent = venue.metrics.rentalMin ?? venue.metrics.combinedMin;
    $('detail-content').innerHTML = `<div class="detail-hero"><div class="detail-tags"><span>${e(venue.region)}</span><span>${venue.type}</span><span>${venue.archived ? '이전 공시' : venue.priceYear ? `${venue.priceYear}년 표기` : '연도 미기재'}</span></div><h2>${e(venue.name)}</h2><div class="detail-address">${e(venue.address)}<br>${e(venue.phone)} · 공개일 ${e(venue.publishedAt)}</div><div class="detail-actions"><button data-detail-favorite>${state.favorites.has(id) ? '♥ 관심 공간에 저장됨' : '♡ 관심 공간 저장'}</button><button data-detail-compare>${state.comparison.has(id) ? '✓ 비교 목록에 담김' : '＋ 비교 목록에 담기'}</button><button data-copy-link>링크 복사 ↗</button></div></div><div class="detail-body"><div class="detail-price-grid"><div><span>성인 1인 공시 식대</span><strong>${won(venue.metrics.mealMin)}</strong><small>${venue.metrics.mealMax != null ? `공시 범위 최고 ${won(venue.metrics.mealMax)}` : '아래 원문 조건을 확인하세요'}</small></div><div><span>${venue.metrics.rentalMin == null && rent != null ? '대관·장식 합계' : '공간 대관료'}</span><strong>${won(rent)}</strong><small>필수 추가 비용 전체를 합친 총액은 아닙니다</small></div></div><div class="detail-comparison"><strong>${result && result.count > 1 ? percentageText(result) : '비교 가능한 공시 가격 확인이 필요해요'}</strong><p>${result && result.count > 1 ? `${e(metricNames[state.metric])} ${won(metric)} · 다른 공간 ${result.comparisonCount}곳 중 ${result.cheaperThanPct.toFixed(1)}%보다 낮은 가격` : '가격이 비어 있거나 이전 공시인 경우 기본 통계에서 제외합니다.'}</p></div>${venue.warnings.map(warning => `<p class="warning-note">${e(warning)}</p>`).join('')}<section class="detail-section"><h3>홀과 조건에 따라 살펴보세요</h3>${venue.offers.length ? venue.offers.map(offer => `<article class="offer-card"><strong>${e(offer.hall)}</strong><div class="offer-prices"><div><span>${offer.additional ? '추가 인원 1인 단가' : '기본 성인 1인 식대'}</span><b>${range(offer.meal)}</b></div><div><span>${offer.rentalKind === 'combined' ? '대관·장식 합계' : '공간 대관료'}</span><b>${range(offer.rental)}</b></div>${offer.guests ? `<div><span>기본·보증 인원</span><b>${offer.guests}명</b></div>` : ''}</div><small>${e(offer.condition || '세부 조건은 공시 안내를 확인하세요')}</small></article>`).join('') : '<p>가격이 이미지 또는 별도 상담 형식으로 공개되어 있습니다. 아래 공시 원문과 이미지를 확인해 주세요.</p>'}</section><section class="detail-section"><h3>공시를 읽기 쉽게 정리했어요</h3>${sectionsHTML(venue)}</section><section class="detail-section"><h3>공간과 주변 살펴보기</h3><iframe class="detail-map" title="${e(venue.name)} 주변 지도" src="https://maps.google.com/maps?hl=ko&q=${encodeURIComponent(venue.address)}&z=16&output=embed" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe><div class="source-links"><a href="${googleURL(venue)}" target="_blank" rel="noopener">Google 지도 ↗</a><a href="${naverURL(venue)}" target="_blank" rel="noopener">네이버 지도 ↗</a><a href="tel:${e(venue.phone.replace(/[^+\d]/g, ''))}">전화 문의</a></div></section>${venue.assets.length ? `<section class="detail-section source-images"><h3>원본 이미지</h3>${venue.assets.map(asset => asset.path.toLowerCase().endsWith('.emf') ? `<a href="${url(asset.path)}" download>벡터 원본 이미지 다운로드</a>` : `<details><summary>원본 공시 이미지 보기</summary><div><a href="${url(asset.path)}" target="_blank" rel="noopener"><img src="${url(asset.path)}" alt="${e(venue.name)} 공시 원본" loading="lazy"></a>${asset.text ? `<h4>이미지에서 읽은 안내</h4><p>${e(asset.text)}</p><p>자동 판독 내용은 원본 이미지와 함께 확인하세요.</p>` : ''}</div></details>`).join('')}</section>` : ''}<section class="detail-section"><h3>직접 확인할 수 있는 출처</h3><div class="source-links"><a href="${url(venue.files.md)}" target="_blank" rel="noopener">정리된 Markdown ↗</a>${venue.files.xlsx ? `<a href="${url(venue.files.xlsx)}" download>공시 Excel ↓</a>` : ''}${venue.attachments?.map(attachment => `<a href="${url(attachment.path)}" download>공시 ${e(attachment.format.toUpperCase())} ↓</a>`).join('') || ''}${venue.files.txt ? `<a href="${url(venue.files.txt)}" download>전체 텍스트 ↓</a>` : ''}<a href="${e(venue.sourceUrl)}" target="_blank" rel="noopener">참가격 게시물 ↗</a>${venue.currentSourceUrl && venue.currentSourceUrl !== venue.sourceUrl ? `<a href="${e(venue.currentSourceUrl)}" target="_blank" rel="noopener">현재 게시물 ↗</a>` : ''}</div><p>가격 대표 자료: ${e(venue.primarySheet)}. 실제 예약 견적은 예식일·시간·인원·추가 항목에 따라 달라질 수 있습니다.</p></section></div>`;
    $('detail-content').querySelector('[data-detail-favorite]').onclick = () => toggleFavorite(id);
    $('detail-content').querySelector('[data-detail-compare]').onclick = event => { toggleCompare(id); event.currentTarget.textContent = state.comparison.has(id) ? '✓ 비교 목록에 담김' : '＋ 비교 목록에 담기'; };
    $('detail-content').querySelector('[data-copy-link]').onclick = async () => { const target = new URL(location.href); target.hash = 'venue-' + id; await copy(target.href); };
    modalOpen($('detail-dialog')); $('detail-dialog').scrollTop = 0;
  }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); toast('링크를 복사했어요.'); }
    catch { const box = document.createElement('textarea'); box.value = text; document.body.append(box); box.select(); document.execCommand('copy'); box.remove(); toast('링크를 복사했어요.'); }
  }
  function toggleCompare(id) {
    if (state.comparison.has(id)) state.comparison.delete(id);
    else { if (state.comparison.size >= 4) { toast('최대 4개 공간까지 비교할 수 있어요.'); return; } state.comparison.add(id); }
    persist(); renderTable(); renderTray();
  }
  function showComparison() {
    const selected = [...state.comparison].map(id => byId.get(id)).filter(Boolean);
    if (selected.length < 2) return;
    $('compare-content').innerHTML = `<div class="compare-columns" style="--count:${selected.length}">${selected.map(venue => `<article class="compare-column"><span class="venue-type">${e(venue.region)} · ${venue.type}</span><h3>${e(venue.name)}</h3>${[['1인 식대 최저가', won(venue.metrics.mealMin)], ['공간 대관료', won(venue.metrics.rentalMin)], ['대관·장식 합계', won(venue.metrics.combinedMin)], ['기본·보증 인원', venue.metrics.guestsMin == null ? '조건 확인' : `${venue.metrics.guestsMin}명`], ['표기 연도', venue.priceYear || '미기재'], ['비교 표본 평균 대비 식대', percentageText(comparison(venue, 'mealMin'))], ['공개일', venue.publishedAt]].map(([label, value]) => `<div class="compare-row"><small>${e(label)}</small><strong>${e(value)}</strong></div>`).join('')}<div class="compare-row"><small>위치</small><p>${e(venue.address)}</p><button class="primary-button" data-compare-detail="${venue.id}">조건 자세히 보기 →</button></div></article>`).join('')}</div>`;
    $('compare-content').querySelectorAll('[data-compare-detail]').forEach(button => { button.onclick = () => { closeModal($('compare-dialog')); showDetail(button.dataset.compareDetail); }; });
    modalOpen($('compare-dialog'));
  }
  function exportCSV() {
    const columns = [['업체명', 'name'], ['지역', 'region'], ['주소', 'address'], ['연락처', 'phone'], ['공개일', 'publishedAt']];
    const rows = [['업체명', '지역', '주소', '연락처', '공개일', '성인1인식대최저(원)', '대관료최저(원)', '대관장식합계최저(원)', '기본보증인원', '가격표기연도'], ...S.sortVenues(filtered(), state.sort, state.direction).map(venue => [...columns.map(([, key]) => venue[key]), venue.metrics.mealMin, venue.metrics.rentalMin, venue.metrics.combinedMin, venue.metrics.guestsMin, venue.priceYear])];
    const csv = '\ufeff' + rows.map(row => row.map(value => { let text = String(value ?? ''); if (/^[=+\-@]/.test(text)) text = "'" + text; return '"' + text.replaceAll('"', '""') + '"'; }).join(',')).join('\r\n');
    const blobURL = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = blobURL; anchor.download = '나의_웨딩공간_목록.csv'; anchor.click(); setTimeout(() => URL.revokeObjectURL(blobURL), 1000);
    toast(`${rows.length - 1}개 공간의 목록을 저장했어요.`);
  }
  function bind() {
    const controls = [['search', 'query', 'input'], ['region', 'region', 'change'], ['venue-type', 'type', 'change'], ['meal-budget', 'budget', 'input'], ['guest-count', 'guests', 'input'], ['price-year', 'year', 'change'], ['only-priced', 'pricedOnly', 'change'], ['only-favorites', 'favoritesOnly', 'change']];
    for (const [id, key, eventName] of controls) $(id).addEventListener(eventName, event => { state[key] = event.target.type === 'checkbox' ? event.target.checked : key === 'budget' ? Number(event.target.value) : event.target.value; changeFilters(); });
    $('reset-filters').onclick = $('empty-reset').onclick = resetFilters;
    $('quick-regions').onclick = event => { const button = event.target.closest('[data-region]'); if (button) { state.region = state.region === button.dataset.region ? '' : button.dataset.region; changeFilters(); } };
    $('active-filters').onclick = event => { const button = event.target.closest('[data-remove]'); if (!button) return; const key = button.dataset.remove; state[key] = key === 'budget' ? 200000 : typeof state[key] === 'boolean' ? false : ''; changeFilters(); };
    $('sort').onchange = event => { [state.sort, state.direction] = event.target.value.split(':'); state.page = 1; renderTable(); };
    document.querySelectorAll('[data-sort]').forEach(button => { button.onclick = () => { const field = button.dataset.sort; state.direction = state.sort === field && state.direction === 'asc' ? 'desc' : 'asc'; state.sort = field; state.page = 1; const value = `${field}:${state.direction}`; if (![...$('sort').options].some(option => option.value === value)) $('sort').add(new Option(button.textContent.replace('↕', '').trim() + (state.direction === 'asc' ? ' 오름차순' : ' 내림차순'), value)); $('sort').value = value; renderTable(); }; });
    $('venue-rows').onclick = event => { if (event.target.closest('input')) return; const row = event.target.closest('tr[data-id]'); if (!row) return; if (event.target.closest('[data-action=favorite]')) toggleFavorite(row.dataset.id); else showDetail(row.dataset.id); };
    $('venue-rows').onchange = event => { const row = event.target.closest('tr[data-id]'); if (row && event.target.dataset.action === 'compare') toggleCompare(row.dataset.id); };
    $('previous-page').onclick = () => { if (state.page > 1) { state.page--; renderTable(); } };
    $('next-page').onclick = () => { state.page++; renderTable(); };
    $('page-size').onchange = event => { state.size = Number(event.target.value); state.page = 1; renderTable(); };
    $('metric').onchange = event => { state.metric = event.target.value; renderChart(); };
    $('benchmark').onchange = event => { state.benchmark = event.target.value; renderTable(); renderChart(); };
    $('map-detail').onclick = () => showDetail(state.selected);
    $('clear-comparison').onclick = () => { state.comparison.clear(); persist(); renderTable(); renderTray(); };
    $('open-comparison').onclick = showComparison;
    $('export-csv').onclick = exportCSV;
    $('source-index').onclick = () => window.open(url(database + '엑셀_추출_목록.md'), '_blank', 'noopener');
    $('mobile-filters').onclick = () => { const open = $('filters').classList.toggle('open'); $('mobile-filters').setAttribute('aria-expanded', open); $('mobile-filters').textContent = open ? '필터 닫기' : '필터'; };
    document.addEventListener('click', event => { if ($('filters').classList.contains('open') && !event.target.closest('#filters,#mobile-filters')) { $('filters').classList.remove('open'); $('mobile-filters').textContent = '필터'; $('mobile-filters').setAttribute('aria-expanded', false); } });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && $('filters').classList.contains('open')) { $('filters').classList.remove('open'); $('mobile-filters').textContent = '필터'; $('mobile-filters').setAttribute('aria-expanded', false); $('mobile-filters').focus(); } });
    for (const [button, dialog] of [['close-detail', 'detail-dialog'], ['close-comparison', 'compare-dialog'], ['close-method', 'method-dialog']]) $(button).onclick = () => closeModal($(dialog));
    for (const dialog of document.querySelectorAll('dialog')) {
      dialog.addEventListener('close', () => { if (!document.querySelector('dialog[open]')) document.body.classList.remove('body-dialog'); });
      dialog.onclick = event => { if (event.target === dialog) { const box = dialog.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) closeModal(dialog); } };
    }
    $('method-open').onclick = $('chart-help').onclick = () => modalOpen($('method-dialog'));
    document.querySelectorAll('[data-view]').forEach(button => { button.onclick = () => { state.view = button.dataset.view; state.favoritesOnly = state.view === 'favorites'; document.querySelectorAll('[data-view]').forEach(other => other.classList.toggle('active', other === button)); changeFilters(); if (state.view === 'insights') document.querySelector('.explore-grid').scrollIntoView({ behavior: 'smooth', block: 'center' }); }; });
  }
  async function loadData() {
    if (location.protocol !== 'file:') {
      try { const response = await fetch(url(database + 'catalog.json')); if (!response.ok) throw new Error(response.status); return await response.json(); } catch { /* A script fallback also supports opening index.html directly. */ }
    }
    return new Promise((resolve, reject) => { const script = document.createElement('script'); script.src = url(database + 'catalog.js'); script.onload = () => globalThis.WeddingCatalog ? resolve(globalThis.WeddingCatalog) : reject(new Error('자료 파일 형식 확인 필요')); script.onerror = () => reject(new Error('공시 자료를 읽을 수 없습니다.')); document.head.append(script); });
  }
  async function start() {
    try {
      catalogue = await loadData();
      if (!Array.isArray(catalogue.venues) || catalogue.venues.length === 0) throw new Error('공시 자료가 비어 있습니다.');
      venues = catalogue.venues;
      for (const venue of venues) { venue.search = normalize([venue.name, venue.region, venue.address, venue.phone, ...venue.offers.map(offer => offer.hall)].join(' ')); byId.set(venue.id, venue); }
      state.favorites = new Set(readStorage('favorites').filter(id => byId.has(id)));
      state.comparison = new Set(readStorage('comparison').filter(id => byId.has(id)).slice(0, 4));
      const regions = [...new Set(venues.map(v => v.region))].sort((a, b) => a.localeCompare(b, 'ko'));
      for (const region of regions) $('region').add(new Option(`${region} (${venues.filter(v => v.region === region).length})`, region));
      if (!regions.includes(state.region)) state.region = '';
      state.selected = venues.find(v => v.name === '아펠가모 반포')?.id || venues.find(v => v.metrics.mealMin != null)?.id || venues[0].id;
      $('load-state').hidden = true; $('application').hidden = false;
      bind(); syncFilters(); render();
      const shared = location.hash.match(/^#venue-([a-z0-9-]+)$/); if (shared && byId.has(shared[1])) showDetail(shared[1]);
      globalThis.WeddingAtlas = { getState: () => ({ ...state, favorites: [...state.favorites], comparison: [...state.comparison] }), getFiltered: () => filtered().map(v => v.id) };
    } catch (error) {
      $('load-state').innerHTML = `<strong>자료를 불러오지 못했어요.</strong><p>${e(error.message)}</p><p>client 폴더에서 정적 서버를 실행해 주세요.</p><code>python3 scripts/serve.py</code><button class="primary-button" id="retry-load">다시 불러오기</button>`;
      $('retry-load').onclick = () => location.reload();
    }
  }
  start();
})();
