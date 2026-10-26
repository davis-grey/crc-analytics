// Cork Royal Challengers - Stats Engine & App Logic

// Global state
let matchesData = [];
let playersData = [];
let teamData = {};
let tournamentsData = [];
let selectedMatchId = null;
let currentTab = 'overview';
let currentMatchSubTab = 'summary'; // Default inside match detail view is Summary!
let scorecardLayout = 'side-by-side'; // 'side-by-side' or 'collapsible'
let wormChartInstance = null;
let manhattanChartInstance = null;

// Filter state - Defaults to ALL tournaments and ALL formats!
let selectedTournament = 'ALL';
let selectedEnvironment = 'ALL';

// Leaderboard sort states
let battingSort = { col: 'runs', asc: false };
let bowlingSort = { col: 'wickets', asc: false };
let mvpSort = { col: 'mvpPoints', asc: false };
let awardsSort = { col: 'mvpPoints', asc: false };

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
  await loadInitialData();
  setupEventListeners();
  // Return from the methodology page to the MVP rankings.
  if (window.location.hash === '#leaderboard') currentTab = 'leaderboard';
  renderApp();
});

async function loadInitialData() {
  const bundled = window.CRC_DATA || window.FALLBACK_DATA;
  if (bundled) {
    teamData = bundled.team || {};
    playersData = bundled.players || [];
    matchesData = bundled.matches || [];
    tournamentsData = bundled.tournaments || [];
  } else {
    try {
      const [teamRes, playersRes, matchesRes, tournamentsRes] = await Promise.all([
        fetch('data/team.json'),
        fetch('data/players.json'),
        fetch('data/all_matches.json'),
        fetch('data/tournaments.json')
      ]);
      teamData = await teamRes.json();
      playersData = await playersRes.json();
      matchesData = await matchesRes.json();
      tournamentsData = await tournamentsRes.json();
    } catch (error) {
      console.warn('Fetch fallback error:', error);
    }
  }

  // Purge any legacy browser storage overrides so official corrections apply directly
  try {
    localStorage.removeItem('crc_matches_override');
  } catch (err) {}

  const sorted = getFilteredMatches();
  selectedMatchId = sorted[0]?.id || matchesData[0]?.id || null;
}

function setupEventListeners() {
  document.querySelectorAll('[data-tab-target]').forEach(button => {
    button.addEventListener('click', (e) => {
      const target = e.currentTarget.getAttribute('data-tab-target');
      switchTab(target);
      if (e.currentTarget.classList.contains('tab-btn-mobile')) closeMobileMenu();
    });
  });

  document.getElementById('player-modal-close')?.addEventListener('click', closePlayerModal);
  document.getElementById('player-modal-backdrop')?.addEventListener('click', closePlayerModal);
}

// ----------------------------------------------------
// FILTERING
// ----------------------------------------------------
function onFilterChange() {
  selectedEnvironment = document.getElementById('filter-environment').value;
  renderApp();
}

function filterByTournament(tourneyId) {
  selectedTournament = tourneyId;
  // A prior Indoor/Outdoor selection must not hide an entire new tournament.
  selectedEnvironment = 'ALL';
  const environmentSelect = document.getElementById('filter-environment');
  if (environmentSelect) environmentSelect.value = 'ALL';
  updateActiveTournamentPill();
  switchTab('matches');
}

function clearTournamentFilter() {
  selectedTournament = 'ALL';
  updateActiveTournamentPill();
  renderApp();
}

function updateActiveTournamentPill() {
  const pill = document.getElementById('active-tournament-pill');
  const nameSpan = document.getElementById('active-tournament-name');
  if (!pill || !nameSpan) return;

  if (selectedTournament === 'ALL') {
    pill.classList.add('hidden');
  } else {
    pill.classList.remove('hidden');
    const tMatch = matchesData.find(m => m.tournamentId === selectedTournament);
    nameSpan.textContent = tournamentsData.find(t => t.id === selectedTournament)?.name || tMatch?.tournament || selectedTournament;
  }
}

function toggleMobileMenu() {
  const menu = document.getElementById('mobile-nav-menu');
  const icon = document.getElementById('mobile-menu-icon');
  if (!menu) return;
  const isHidden = menu.classList.contains('hidden');
  menu.classList.toggle('hidden', !isHidden);
  document.body.style.overflow = isHidden ? 'hidden' : '';
  if (icon) {
    icon.setAttribute('data-lucide', isHidden ? 'x' : 'menu');
  }
  if (window.lucide) window.lucide.createIcons();
}

function closeMobileMenu() {
  const menu = document.getElementById('mobile-nav-menu');
  if (menu) menu.classList.add('hidden');
  document.body.style.overflow = '';
  const icon = document.getElementById('mobile-menu-icon');
  if (icon) icon.setAttribute('data-lucide', 'menu');
  if (window.lucide) window.lucide.createIcons();
}

// Backwards compatibility for any existing deep links/inline calls.
function selectMobileTab(tabName) {
  switchTab(tabName);
  closeMobileMenu();
}

function parseTimeToMinutes(t) {
  if (!t) return 0;
  const m = t.match(/(\d+):(\d+)\s*(AM|PM)?/i);
  if (!m) return 0;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const period = (m[3] || '').toUpperCase();
  if (period === 'PM' && h < 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return (h * 60) + min;
}

function getFilteredMatches() {
  const filtered = matchesData.filter(m => {
    const matchTourney = (selectedTournament === 'ALL') || (m.tournamentId === selectedTournament);
    const matchEnv = (selectedEnvironment === 'ALL') || (m.environment === selectedEnvironment);
    return matchTourney && matchEnv;
  });

  // Sort latest matches first! (Date desc, then stage priority desc, then time desc)
  const stageWeight = {
    'Final': 100,
    'Semi-Final': 90,
    'Quarter-Final': 80,
    'Pre-Quarter Final': 70,
    'Pre-Quarters': 70,
    'Pre-Quarter': 70,
    'Group Stage': 50,
    'Group A': 50,
    'Group B': 50,
    'Warm-up Round': 10,
    'Warm-up': 10
  };

  return filtered.sort((a, b) => {
    if (a.date !== b.date) {
      return (b.date || '').localeCompare(a.date || '');
    }
    const sa = stageWeight[a.stage] || 50;
    const sb = stageWeight[b.stage] || 50;
    if (sb !== sa) return sb - sa;
    const ta = parseTimeToMinutes(a.time);
    const tb = parseTimeToMinutes(b.time);
    if (tb !== ta) return tb - ta;
    return (b.id || '').localeCompare(a.id || '');
  });
}

// ----------------------------------------------------
// TAB SWITCHING
// ----------------------------------------------------
function switchTab(tabName) {
  currentTab = tabName;
  document.querySelectorAll('[data-tab-target]').forEach(btn => {
    const isActive = btn.getAttribute('data-tab-target') === tabName;
    if (btn.classList.contains('tab-btn')) {
      btn.classList.toggle('active-tab', isActive);
      btn.classList.toggle('text-amber-400', isActive);
      btn.classList.toggle('border-amber-400', isActive);
      btn.classList.toggle('text-slate-400', !isActive);
      btn.classList.toggle('border-transparent', !isActive);
    }
    if (btn.classList.contains('tab-btn-mobile')) {
      btn.classList.toggle('text-amber-400', isActive);
      btn.classList.toggle('bg-amber-500/10', isActive);
      btn.classList.toggle('border-amber-500/30', isActive);
      btn.classList.toggle('text-slate-300', !isActive);
      btn.classList.toggle('bg-slate-900', !isActive);
      btn.classList.toggle('border-slate-800', !isActive);
    }
  });

  document.querySelectorAll('.tab-content-panel').forEach(panel => {
    panel.classList.add('hidden');
  });

  const activePanel = document.getElementById(`tab-panel-${tabName}`);
  if (activePanel) {
    activePanel.classList.remove('hidden');
  }

  if (tabName === 'overview') renderOverviewTab();
  if (tabName === 'tournaments') renderTournamentsTab();
  if (tabName === 'matches') renderMatchesList();
  if (tabName === 'leaderboard') renderLeaderboardTab();
  if (tabName === 'players') renderPlayersTab();

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function renderApp() {
  updateActiveTournamentPill();
  switchTab(currentTab);
}

// ----------------------------------------------------
// TAB: OVERVIEW
// ----------------------------------------------------
function renderOverviewTab() {
  const filtered = getFilteredMatches();
  const wonCount = filtered.filter(m => m.outcome === 'WIN').length;
  const lostCount = filtered.filter(m => m.outcome === 'LOSS').length;
  const totalMatches = filtered.length;
  const winPercent = totalMatches > 0 ? Math.round((wonCount / totalMatches) * 100) : 0;

  document.getElementById('stat-total-matches').textContent = totalMatches;
  document.getElementById('stat-matches-won').textContent = wonCount;
  document.getElementById('stat-matches-lost').textContent = lostCount;
  document.getElementById('stat-win-rate').textContent = `${winPercent}%`;

  const envText = selectedEnvironment === 'ALL' ? 'All Formats' : selectedEnvironment;
  const tourneyMatch = matchesData.find(m => m.tournamentId === selectedTournament);
  const tourneyName = tournamentsData.find(t => t.id === selectedTournament)?.name || tourneyMatch?.tournament || selectedTournament;
  const tourneyText = selectedTournament === 'ALL' ? '' : ` • ${tourneyName}`;
  document.getElementById('overview-filter-indicator').textContent = `${envText}${tourneyText}`;

  renderCapsShowcase();
  renderOverviewRecentMatches();
}

function renderOverviewRecentMatches() {
  const container = document.getElementById('overview-recent-matches');
  if (!container) return;

  const filtered = getFilteredMatches();
  if (filtered.length === 0) {
    container.innerHTML = `<div class="col-span-3 text-center py-8 text-xs text-slate-500">No matches found for the selected filter.</div>`;
    return;
  }

  container.innerHTML = filtered.map(match => {
    const oppInnings = match.innings.find(i => !isCrcTeam(i));
    const crcInnings = match.innings.find(i => isCrcTeam(i));
    const isWin = match.outcome === 'WIN';
    const crcPotm = getCrcPotm(match);

    return `
      <div onclick="openMatchScorecard('${match.id}')"
           class="bg-slate-900/80 border border-slate-800 hover:border-amber-500/50 rounded-2xl p-4 cursor-pointer transition-all hover:-translate-y-1 hover:shadow-lg group">
        <div class="flex justify-between items-center text-xs text-slate-400 mb-2">
          <div class="flex items-center gap-1.5">
            <span class="font-medium">${match.matchTitle}</span>
            <span class="px-1.5 py-0.2 text-[9px] font-bold bg-slate-800 text-amber-400 rounded">${match.environment || 'Indoor'}</span>
          </div>
          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${
            isWin ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
          }">
            ${isWin ? 'WON' : 'LOST'}
          </span>
        </div>
        <div class="space-y-1 mb-3">
          <div class="flex justify-between items-center text-sm font-semibold">
            <span class="text-white group-hover:text-amber-400 transition-colors">${crcInnings?.shortName || 'CRC'}</span>
            <span class="text-amber-400 font-mono">${crcInnings?.runs}/${crcInnings?.wickets} <span class="text-xs text-slate-400">(${crcInnings?.overs})</span></span>
          </div>
          <div class="flex justify-between items-center text-sm font-semibold">
            <span class="text-slate-300">${oppInnings?.shortName || oppInnings?.team}</span>
            <span class="text-slate-300 font-mono">${oppInnings?.runs}/${oppInnings?.wickets} <span class="text-xs text-slate-400">(${oppInnings?.overs})</span></span>
          </div>
        </div>
        <div class="pt-2 border-t border-slate-800 flex justify-between items-center text-[11px]">
          <span class="text-slate-400 truncate mr-2">${match.result}</span>
          ${crcPotm ? `<span class="text-amber-400 font-semibold text-[10px] bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">POTM: ${crcPotm}</span>` : ''}
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) window.lucide.createIcons();
}

// ----------------------------------------------------
// TAB: TOURNAMENTS (Dedicated Section!)
// ----------------------------------------------------
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

function renderTournamentsTab() {
  const container = document.getElementById('tournaments-list');
  if (!container) return;
  // Tournament metadata holds editorial facts (venue, placement), NOT player stats.
  // Adding a tournament requires only a new tournaments.json row + match JSON files.
  const competitions = [...tournamentsData].sort((a, b) =>
    (b.date || '').localeCompare(a.date || '') || (b.sequence || 0) - (a.sequence || 0));

  container.innerHTML = competitions.map((t, idx) => {
    const played = matchesData.filter(m => m.tournamentId === t.id);
    const won = played.filter(m => m.outcome === 'WIN').length;
    const lost = played.filter(m => m.outcome === 'LOSS').length;
    const rate = played.length ? Math.round(won / played.length * 100) : 0;
    const { batting, bowling, officialAwards } = getTournamentHighlights(played);
    const leadingRuns = batting.length ? batting[0].runs : 0;
    const battingLeaders = batting.filter(b => b.runs === leadingRuns);
    const fmtBat = battingLeaders.map(b => `${escapeHtml(b.name)} (${b.runs} runs, HS ${b.highest}, ${b.sixes} sixes)`).join(' • ') || 'Awaiting scorecards';
    const fmtBowl = bowling.slice(0, 4).map(b => `${escapeHtml(b.name)} (${b.wickets} wkts)`).join(' • ') || 'No wickets recorded';
    const fmtPotm = officialAwards.map(p => `${escapeHtml(p.name)} (${p.count})`).join(' • ') || 'No CRC player awards recorded';
    const badge = t.sequence ? `Tournament ${t.sequence}` : 'Tournament';
    const highlightCard = (label, value, tone) => `
      <div class="bg-slate-950/60 border border-slate-800/80 p-3 rounded-xl">
        <span class="text-xs font-semibold text-slate-400 block mb-1">${label}</span>
        <div class="text-sm font-bold ${tone}">${value}</div>
      </div>`;
    return `
      <section class="bg-slate-900/90 border ${idx === 0 ? 'border-amber-500/30' : 'border-slate-800'} rounded-3xl p-4 sm:p-6 shadow-xl relative overflow-hidden min-w-0">
        <div class="flex flex-wrap justify-between items-start gap-2 mb-4 pb-3 border-b border-slate-800">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2 mb-2">
              <span class="inline-flex px-2.5 py-1 rounded-md text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">${escapeHtml(t.season)} • ${escapeHtml(badge)}</span>
              <span class="inline-flex px-2.5 py-1 rounded-md text-xs bg-slate-800 text-slate-300">${escapeHtml(t.environment || played[0]?.environment || '')}</span>
              <span class="inline-flex px-2.5 py-1 rounded-md text-xs bg-slate-800 text-slate-300">${escapeHtml(t.pitchType || played[0]?.pitchType || '')}</span>
            </div>
            <h3 class="text-lg sm:text-xl font-bold text-white break-words">${escapeHtml(t.name)}</h3>
            <p class="text-xs text-slate-400">Venue: ${escapeHtml(t.venue)} • ${escapeHtml(t.placement)}</p>
          </div>
          <span class="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">${escapeHtml(t.stageNote || t.placement)}</span>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center bg-slate-950/70 p-3 rounded-2xl border border-slate-800/80 mb-5">
          ${[['Matches', played.length, 'text-white'], ['Won', won, 'text-emerald-400'], ['Lost', lost, 'text-rose-400'], ['Win Rate', rate + '%', 'text-amber-400']]
            .map(([label, val, cls]) => `<div><span class="text-xs text-slate-400 block">${label}</span><span class="font-mono font-bold ${cls} text-base">${val}</span></div>`).join('')}
        </div>
        <div class="space-y-2.5 mb-6 text-xs">
          ${highlightCard('Top Run Scorer', fmtBat, 'text-white')}
          ${highlightCard('Top Wicket Takers', fmtBowl, 'text-purple-400')}
          ${highlightCard('Official Player of the Match Awards', fmtPotm, 'text-amber-300')}
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <button data-tournament-id="${escapeHtml(t.id)}" class="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl transition-colors flex items-center gap-2">
            <i data-lucide="trophy" class="w-4 h-4"></i> View Tournament Matches (${played.length})
          </button>
          <button data-action="leaderboard" class="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl border border-slate-700 transition-colors flex items-center gap-2">
            <i data-lucide="award" class="w-4 h-4"></i> View Leaderboard
          </button>
        </div>
      </section>`;
  }).join('');

  container.onclick = event => {
    const tournamentButton = event.target.closest('[data-tournament-id]');
    if (tournamentButton) filterByTournament(tournamentButton.dataset.tournamentId);
    else if (event.target.closest('[data-action="leaderboard"]')) switchTab('leaderboard');
  };
  if (window.lucide) window.lucide.createIcons();
}

// ----------------------------------------------------
// STATS & CAPS CALCULATION
// ----------------------------------------------------
function getOppositionName(match) {
  const oppInnings = match.innings.find(i => !isCrcTeam(i));
  return oppInnings ? (oppInnings.shortName || oppInnings.team) : 'OPP';
}

function renderCapsShowcase() {
  const stats = calculateSeasonStats();
  const playerList = Object.values(stats);

  const orangeLeader = [...playerList].sort((a, b) => b.runs - a.runs || b.strikeRateNum - a.strikeRateNum)[0];

  const purpleLeader = [...playerList]
    .filter(p => p.wickets > 0)
    .sort((a, b) => b.wickets - a.wickets || a.economyNum - b.economyNum)[0];

  const mvpLeaders = getPointWinners(rankByPoints(playerList.filter(p => p.matches > 0), 'mvpPoints'), 'mvpPoints');
  const mvpLeader = mvpLeaders[0];

  if (orangeLeader) {
    document.getElementById('orange-cap-name').textContent = orangeLeader.name;
    document.getElementById('orange-cap-runs').textContent = `${orangeLeader.runs} Runs`;
    document.getElementById('orange-cap-meta').textContent = `${orangeLeader.innings} Inns • SR ${orangeLeader.strikeRate} • HS ${orangeLeader.highestScore}${orangeLeader.isNotOutHighest ? '*' : ''}`;
  }

  if (purpleLeader) {
    document.getElementById('purple-cap-name').textContent = purpleLeader.name;
    document.getElementById('purple-cap-wickets').textContent = `${purpleLeader.wickets} Wkts`;
    document.getElementById('purple-cap-meta').textContent = `${purpleLeader.overs} ov • Econ ${purpleLeader.economy} • Best ${purpleLeader.bestBowling.wkts}/${purpleLeader.bestBowling.runs}`;
  }

  if (mvpLeader) {
    document.getElementById('mvp-leader-name').textContent = mvpLeaders.map(p => p.name).join(' & ');
    document.getElementById('mvp-leader-points').textContent = `${formatMvpPoints(mvpLeader.mvpPoints)} Pts`;
    document.getElementById('mvp-leader-meta').textContent = mvpLeaders.length > 1 ? 'Shared statistical MVP lead • v2.0' : `${mvpLeader.runs} Runs • ${mvpLeader.wickets} Wkts • ${mvpLeader.totalFielding} Dismissals`;
  }

  if (!mvpLeader) {
    document.getElementById('mvp-leader-name').textContent = '—';
    document.getElementById('mvp-leader-points').textContent = '—';
    document.getElementById('mvp-leader-meta').textContent = 'No appearances in this selection';
  }

  // Match Awards Leaders Showcase
  const topBatLeaders = [...playerList].filter(p => p.awards.topBatter > 0).sort((a, b) => b.awards.topBatter - a.awards.topBatter);
  const topBowlLeaders = [...playerList].filter(p => p.awards.topBowler > 0).sort((a, b) => b.awards.topBowler - a.awards.topBowler);
  const topFldLeaders = [...playerList].filter(p => p.awards.topFielder > 0).sort((a, b) => b.awards.topFielder - a.awards.topFielder);
  const matchMvpLeaders = [...playerList].filter(p => p.awards.matchMvp > 0).sort((a, b) => b.awards.matchMvp - a.awards.matchMvp);

  const formatLeaders = (list, key, colorClass = 'amber') => {
    if (!list || list.length === 0) {
      return { html: '<div class="text-xs text-slate-500 py-1">None yet</div>', count: '0x' };
    }
    const maxVal = list[0].awards[key];
    const topTied = list.filter(p => p.awards[key] === maxVal);
    const countText = topTied.length > 1 ? `${maxVal}x each` : `${maxVal}x`;

    const html = topTied.map(p => `
      <div class="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5 py-0.5 cursor-pointer hover:text-amber-400 transition-colors" onclick="openPlayerProfileByName('${p.name}')">
        <span class="w-1.5 h-1.5 rounded-full bg-${colorClass}-400 shrink-0"></span>
        <span class="truncate">${p.name}</span>
      </div>
    `).join('');

    return { html, count: countText };
  };

  const batL = formatLeaders(topBatLeaders, 'topBatter', 'amber');
  const batNameEl = document.getElementById('award-top-batter-name');
  if (batNameEl) batNameEl.innerHTML = batL.html;
  const batCntEl = document.getElementById('award-top-batter-count');
  if (batCntEl) batCntEl.textContent = batL.count;

  const bowlL = formatLeaders(topBowlLeaders, 'topBowler', 'purple');
  const bowlNameEl = document.getElementById('award-top-bowler-name');
  if (bowlNameEl) bowlNameEl.innerHTML = bowlL.html;
  const bowlCntEl = document.getElementById('award-top-bowler-count');
  if (bowlCntEl) bowlCntEl.textContent = bowlL.count;

  const fldL = formatLeaders(topFldLeaders, 'topFielder', 'sky');
  const fldNameEl = document.getElementById('award-top-fielder-name');
  if (fldNameEl) fldNameEl.innerHTML = fldL.html;
  const fldCntEl = document.getElementById('award-top-fielder-count');
  if (fldCntEl) fldCntEl.textContent = fldL.count;

  const mvpL = formatLeaders(matchMvpLeaders, 'matchMvp', 'red');
  const mvpNameEl = document.getElementById('award-match-mvp-name');
  if (mvpNameEl) mvpNameEl.innerHTML = mvpL.html;
  const mvpCntEl = document.getElementById('award-match-mvp-count');
  if (mvpCntEl) mvpCntEl.textContent = mvpL.count;
}

// ----------------------------------------------------
// TAB: MATCHES
// ----------------------------------------------------
function renderMatchesList() {
  const container = document.getElementById('matches-grid');
  if (!container) return;

  document.getElementById('matches-list-container')?.classList.remove('hidden');
  document.getElementById('match-scorecard-view')?.classList.add('hidden');

  const filtered = getFilteredMatches();
  if (filtered.length === 0) {
    container.innerHTML = `<div class="col-span-3 text-center py-12 text-sm text-slate-500">No matches found matching your filters.</div>`;
    return;
  }

  container.innerHTML = filtered.map(match => {
    const oppInnings = match.innings.find(i => !isCrcTeam(i));
    const crcInnings = match.innings.find(i => isCrcTeam(i));
    const isWin = match.outcome === 'WIN';
    const crcPotm = getCrcPotm(match);

    return `
      <div onclick="openMatchScorecard('${match.id}')"
           class="bg-slate-900/80 border border-slate-800 hover:border-amber-500/50 rounded-2xl p-5 cursor-pointer transition-all hover:-translate-y-1 hover:shadow-xl group flex flex-col justify-between">
        
        <div>
          <!-- Tournament & Match Header -->
          <div class="flex items-start justify-between gap-2 mb-3">
            <div class="space-y-1 min-w-0">
              <span class="text-[11px] font-bold text-amber-400 block truncate uppercase tracking-wider">
                ${match.tournament}
              </span>
              <h3 class="font-bold text-white text-sm group-hover:text-amber-400 transition-colors truncate" title="${match.matchTitle}">
                ${match.matchTitle}
              </h3>
              <div class="flex items-center gap-1.5 pt-0.5">
                <span class="inline-flex items-center px-2 py-0.5 text-[10px] font-bold bg-amber-500/10 text-amber-300 rounded border border-amber-500/30 leading-none">
                  ${match.environment || 'Indoor'}
                </span>
                <span class="inline-flex items-center px-2 py-0.5 text-[10px] font-medium bg-slate-800 text-slate-300 rounded border border-slate-700/60 leading-none">
                  ${match.pitchType || 'Turf Wicket'}
                </span>
              </div>
            </div>
            <span class="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold shrink-0 ${
              isWin ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
            }">
              ${isWin ? 'WON' : 'LOST'}
            </span>
          </div>

          <!-- Score Row with Monospace Tabular Right-Aligned Numbers -->
          <div class="space-y-2 mb-4 bg-slate-950/70 p-3.5 rounded-xl border border-slate-800/80">
            <div class="flex items-center justify-between text-sm font-semibold gap-3">
              <div class="flex items-center gap-2 min-w-0">
                <span class="w-2 h-2 rounded-full bg-amber-400 shrink-0"></span>
                <span class="text-white truncate group-hover:text-amber-400 transition-colors">
                  ${crcInnings?.team || 'Cork Royal Challengers'}
                </span>
              </div>
              <div class="text-right font-mono shrink-0 whitespace-nowrap">
                <span class="text-amber-400 font-bold text-sm">${crcInnings?.runs}/${crcInnings?.wickets}</span>
                <span class="text-xs text-slate-400 font-normal ml-1">(${crcInnings?.overs} ov)</span>
              </div>
            </div>
            <div class="flex items-center justify-between text-sm font-semibold gap-3">
              <div class="flex items-center gap-2 min-w-0 pl-4">
                <span class="text-slate-300 truncate">
                  ${oppInnings?.team || 'Opponent'}
                </span>
              </div>
              <div class="text-right font-mono shrink-0 whitespace-nowrap">
                <span class="text-slate-300 font-bold text-sm">${oppInnings?.runs}/${oppInnings?.wickets}</span>
                <span class="text-xs text-slate-400 font-normal ml-1">(${oppInnings?.overs} ov)</span>
              </div>
            </div>
          </div>

          <div class="text-xs text-slate-400 mb-3 space-y-1">
            <div class="truncate"><strong class="text-slate-300 font-semibold">Result:</strong> ${match.result}</div>
            <div class="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
              <span class="truncate mr-2">${match.venue}</span>
              <span class="shrink-0 font-mono">${match.date} • ${match.time}</span>
            </div>
          </div>
        </div>

        <div class="pt-3 border-t border-slate-800 flex justify-between items-center mt-auto">
          ${crcPotm ? `<span class="text-[11px] text-amber-400 font-medium flex items-center gap-1"><i data-lucide="trophy" class="w-3.5 h-3.5"></i> POTM: ${crcPotm}</span>` : `<span></span>`}
          <span class="text-xs font-bold text-slate-300 group-hover:text-amber-400 flex items-center gap-1 transition-colors">
            View Details <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
          </span>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) window.lucide.createIcons();
}

function openMatchScorecard(matchId) {
  selectedMatchId = matchId;

  if (currentTab !== 'matches') {
    switchTab('matches');
  }

  document.getElementById('matches-list-container')?.classList.add('hidden');
  document.getElementById('match-scorecard-view')?.classList.remove('hidden');

  currentMatchSubTab = 'summary'; // Default first view is SUMMARY as requested!
  renderSelectedMatchDetail();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function backToMatchesList() {
  document.getElementById('match-scorecard-view')?.classList.add('hidden');
  document.getElementById('matches-list-container')?.classList.remove('hidden');
  if (window.lucide) window.lucide.createIcons();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ----------------------------------------------------
// MATCH DETAIL (SUMMARY FIRST, TABS ON TOP)
// ----------------------------------------------------
function switchMatchSubTab(subTabName) {
  currentMatchSubTab = subTabName;
  document.querySelectorAll('.match-subtab-btn').forEach(btn => {
    const isTarget = btn.getAttribute('data-subtab') === subTabName;
    btn.classList.toggle('active-subtab', isTarget);
    btn.classList.toggle('text-slate-400', !isTarget);
    btn.classList.toggle('bg-slate-900', !isTarget);
  });

  document.querySelectorAll('.match-subtab-panel').forEach(panel => {
    panel.classList.add('hidden');
  });

  const activePanel = document.getElementById(`match-panel-${subTabName}`);
  if (activePanel) {
    activePanel.classList.remove('hidden');
  }

  // Keep the selected tab visible when the five match tabs overflow on phones.
  const selectedButton = document.querySelector(`.match-subtab-btn[data-subtab="${subTabName}"]`);
  selectedButton?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });

  if (subTabName === 'charts') {
    const match = matchesData.find(m => m.id === selectedMatchId) || matchesData[0];
    initMatchCharts(match);
  }

  if (window.lucide) window.lucide.createIcons();
}

function toggleScorecardLayout(layout) {
  scorecardLayout = layout;
  const match = matchesData.find(m => m.id === selectedMatchId) || matchesData[0];
  renderScorecardPanel(match);
}

function renderSelectedMatchDetail() {
  const match = matchesData.find(m => m.id === selectedMatchId) || matchesData[0];
  if (!match) return;

  const container = document.getElementById('selected-match-detail');
  if (!container) return;

  const crcInnings = match.innings.find(i => isCrcTeam(i));
  const oppInnings = match.innings.find(i => !isCrcTeam(i));
  const isWin = match.outcome === 'WIN';
  const crcPotm = getCrcPotm(match);
  const awards = getMatchCrcAwards(match);

  container.innerHTML = `
    <!-- Top Action Bar with Back Button & Sub-Tabs AT THE VERY TOP (Sticky!) -->
    <div class="sticky top-[64px] md:top-[105px] z-30 bg-slate-950/95 backdrop-blur-md pt-1.5 pb-2.5 mb-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 max-w-full">
      <div class="flex min-w-0 items-center gap-2.5">
        <button onclick="backToMatchesList()" class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-semibold transition-all shrink-0">
          <i data-lucide="arrow-left" class="w-4 h-4 text-amber-400"></i> Back to Matches
        </button>
        <span class="min-w-0 text-xs font-semibold text-slate-300 truncate" title="${escapeHtml(match.matchTitle)}">${escapeHtml(match.matchTitle)}</span>
      </div>

      <!-- Sub-Tabs on TOP (Scrollable on mobile: all five remain reachable) -->
      <div class="flex w-full items-center justify-end text-[11px] text-slate-400 sm:hidden" aria-hidden="true">Swipe tabs to see more <span class="text-amber-400 ml-1">→</span></div>
      <div class="match-subtab-scroll w-full sm:w-auto max-w-full overflow-x-auto custom-scrollbar pb-1 sm:pb-0" role="region" aria-label="Match detail tabs, scroll horizontally">
        <div class="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs whitespace-nowrap">
          <button onclick="switchMatchSubTab('summary')" data-subtab="summary" class="match-subtab-btn ${currentMatchSubTab === 'summary' ? 'active-subtab' : 'text-slate-400 hover:text-white bg-slate-900'} px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 shrink-0">
            <i data-lucide="align-left" class="w-3.5 h-3.5"></i> Summary
          </button>
          <button onclick="switchMatchSubTab('scorecard')" data-subtab="scorecard" class="match-subtab-btn ${currentMatchSubTab === 'scorecard' ? 'active-subtab' : 'text-slate-400 hover:text-white bg-slate-900'} px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 shrink-0">
            <i data-lucide="file-text" class="w-3.5 h-3.5"></i> Scorecard
          </button>
          <button onclick="switchMatchSubTab('balls')" data-subtab="balls" class="match-subtab-btn ${currentMatchSubTab === 'balls' ? 'active-subtab' : 'text-slate-400 hover:text-white bg-slate-900'} px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 shrink-0">
            <i data-lucide="list-ordered" class="w-3.5 h-3.5"></i> Ball-by-Ball
          </button>
          <button onclick="switchMatchSubTab('charts')" data-subtab="charts" class="match-subtab-btn ${currentMatchSubTab === 'charts' ? 'active-subtab' : 'text-slate-400 hover:text-white bg-slate-900'} px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 shrink-0">
            <i data-lucide="bar-chart-2" class="w-3.5 h-3.5"></i> Stats & Charts
          </button>
          <button onclick="switchMatchSubTab('awards')" data-subtab="awards" class="match-subtab-btn ${currentMatchSubTab === 'awards' ? 'active-subtab' : 'text-slate-400 hover:text-white bg-slate-900'} px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 shrink-0">
            <i data-lucide="award" class="w-3.5 h-3.5"></i> MVP & Awards
          </button>
        </div>
      </div>
    </div>

    <!-- SUB-TAB 1: SUMMARY (DEFAULT VIEW) -->
    <div id="match-panel-summary" class="match-subtab-panel ${currentMatchSubTab === 'summary' ? '' : 'hidden'} space-y-5">
      <!-- Match Header Card -->
      <div class="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div class="flex flex-wrap justify-between items-center gap-2 mb-4 pb-3 border-b border-slate-700/60">
          <div>
            <div class="flex items-center gap-2 mb-1">
              <span class="text-xs font-semibold text-amber-400 uppercase tracking-wider">${match.tournament}</span>
              <span class="px-2 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-300 rounded border border-amber-500/30">${match.environment || 'Indoor'}</span>
              <span class="px-2 py-0.5 text-[10px] bg-slate-800 text-slate-300 rounded">${match.pitchType || 'Turf Wicket'}</span>
            </div>
            <h2 class="text-xl font-bold text-white">${match.matchTitle} - ${match.venue}</h2>
            <p class="text-xs text-slate-400">${match.date} • ${match.time} • Scorer: ${match.scorer}</p>
          </div>
          <div class="flex items-center gap-2">
            <div class="px-3 py-1 rounded-full text-xs font-bold ${
              isWin ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
            }">
              ${match.result}
            </div>
          </div>
        </div>

        <!-- Teams Score Summary Row -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- CRC Box -->
          <div class="p-3.5 rounded-xl bg-slate-900/80 border border-amber-500/30">
            <div class="flex justify-between items-center mb-1">
              <span class="font-bold text-amber-400 flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                ${crcInnings?.team}
              </span>
              <span class="text-xs text-slate-400">${crcInnings?.overs} Overs (RR ${crcInnings?.runRate})</span>
            </div>
            <div class="text-2xl font-black font-mono text-white">
              ${crcInnings?.runs}/${crcInnings?.wickets}
            </div>
          </div>

          <!-- Opposition Box -->
          <div class="p-3.5 rounded-xl bg-slate-900/80 border border-slate-700/60">
            <div class="flex justify-between items-center mb-1">
              <span class="font-bold text-slate-200">${oppInnings?.team}</span>
              <span class="text-xs text-slate-400">${oppInnings?.overs} Overs (RR ${oppInnings?.runRate})</span>
            </div>
            <div class="text-2xl font-black font-mono text-white">
              ${oppInnings?.runs}/${oppInnings?.wickets}
            </div>
          </div>
        </div>
      </div>
      <!-- CRC Top Performers Card -->
      <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg">
        <h3 class="text-xs font-bold text-amber-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <i data-lucide="star" class="w-4 h-4 text-amber-400"></i> Cork Royal Challengers Match Performers
        </h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 ${crcPotm ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-3">
          ${crcPotm ? `
            <div class="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
              <span class="text-[10px] text-amber-300 uppercase font-bold block mb-0.5">🏆 Player of the Match</span>
              <div class="font-bold text-amber-300 text-sm flex items-center gap-1.5">
                <i data-lucide="trophy" class="w-3.5 h-3.5 text-amber-400 shrink-0"></i>
                <span class="cursor-pointer hover:underline" onclick="openPlayerProfileByName('${crcPotm}')">${crcPotm}</span>
              </div>
              <div class="text-[11px] text-slate-300 mt-0.5">Official match award winner</div>
            </div>
          ` : ''}

          ${awards.matchMvpWinner ? `
            <div class="p-3 bg-slate-950/70 border border-red-500/30 rounded-xl">
              <span class="text-[10px] text-red-400 uppercase font-bold block mb-0.5">⭐ CRC Match MVP</span>
              <div class="font-bold text-white text-sm cursor-pointer hover:text-amber-400 leading-snug break-words" ${awards.matchMvpWinners.length === 1 ? `onclick="openPlayerProfileByName('${awards.matchMvpWinner.name}')"` : ''}>
                ${awards.matchMvpWinner.name}
              </div>
              <div class="font-mono text-red-300 text-xs font-bold mt-0.5">
                ${formatMvpPoints(awards.matchMvpWinner.totalPts)} MVP Points
              </div>
            </div>
          ` : ''}

          ${awards.topBatterWinner ? `
            <div class="p-3 bg-slate-950/70 border border-amber-500/30 rounded-xl">
              <span class="text-[10px] text-amber-400 uppercase font-bold block mb-0.5">🏏 Top CRC Batter</span>
              <div class="font-bold text-white text-sm cursor-pointer hover:text-amber-400 leading-snug break-words" ${awards.topBatterWinners.length === 1 ? `onclick="openPlayerProfileByName('${awards.topBatterWinner.name}')"` : ''}>
                ${awards.topBatterWinner.name}
              </div>
              <div class="font-mono text-amber-400 text-xs mt-0.5">
                ${formatMvpPoints(awards.topBatterWinner.batPts)} batting pts • ${awards.topBatterWinner.runs} runs
              </div>
            </div>
          ` : ''}

          ${awards.topBowlerWinner ? `
            <div class="p-3 bg-slate-950/70 border border-purple-500/30 rounded-xl">
              <span class="text-[10px] text-purple-400 uppercase font-bold block mb-0.5">🎯 Top CRC Bowler</span>
              <div class="font-bold text-white text-sm">
                ${awards.topBowlerWinner.name}
              </div>
              <div class="font-mono text-purple-400 text-xs mt-0.5">
                ${formatMvpPoints(awards.topBowlerWinner.bowlPts)} bowling pts • ${awards.topBowlerWinner.wickets}/${awards.topBowlerWinner.runs}
              </div>
            </div>
          ` : ''}
        </div>
      </div>

      <!-- Match Breakdown Cards -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        ${match.innings.map(inn => `
          <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-5">
            <div class="flex justify-between items-center mb-2">
              <h4 class="font-bold text-white text-base">${inn.team}</h4>
              <span class="font-mono font-bold text-amber-400 text-lg">${inn.runs}/${inn.wickets}</span>
            </div>
            <div class="space-y-1.5 text-xs text-slate-300 border-t border-slate-800 pt-3">
              <div class="flex justify-between"><span>Overs:</span> <strong>${inn.overs}</strong></div>
              <div class="flex justify-between"><span>Run Rate:</span> <strong>${inn.runRate}</strong></div>
              <div class="flex justify-between"><span>Extras:</span> <strong>${inn.extras?.total || 0} (${formatExtras(inn.extras)})</strong></div>
            </div>
            ${inn.fallOfWickets && inn.fallOfWickets.length > 0 ? `
              <div class="mt-4 pt-3 border-t border-slate-800">
                <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Fall of Wickets</span>
                <div class="flex flex-wrap gap-1.5 text-xs">
                  ${inn.fallOfWickets.map(f => `<span class="bg-slate-950 px-2 py-0.5 rounded border border-slate-800"><strong>${f.score}</strong> (${normalizePlayerName(f.player)})</span>`).join('')}
                </div>
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
    </div>

    <!-- SUB-TAB 2: SCORECARD (STACKED & COLLAPSIBLE INNINGS) -->
    <div id="match-panel-scorecard" class="match-subtab-panel ${currentMatchSubTab === 'scorecard' ? '' : 'hidden'} space-y-4">
      <div id="scorecard-tables-container" class="space-y-4">
        <!-- Rendered by renderScorecardPanel -->
      </div>
    </div>

    <!-- SUB-TAB 3: BALL-BY-BALL (CLEAN OVER CARDS - NO HORIZONTAL SCROLL) -->
    <div id="match-panel-balls" class="match-subtab-panel ${currentMatchSubTab === 'balls' ? '' : 'hidden'} space-y-6">
      ${match.innings.map(inn => `
        <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4 pb-2 border-b border-slate-800">
            <h4 class="font-bold text-white text-sm flex items-center gap-2">
              <i data-lucide="play-circle" class="w-4 h-4 text-amber-400"></i>
              ${inn.team} - Over Progression
            </h4>
            <span class="text-xs font-mono font-bold text-slate-300 shrink-0">${inn.runs}/${inn.wickets} (${inn.overs} ov)</span>
          </div>

          <div class="space-y-3">
            ${(inn.overProgression || []).map(ov => `
              <div class="p-3 bg-slate-950/70 border border-slate-800/90 rounded-xl hover:border-slate-700 transition-colors">
                <div class="flex flex-wrap items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-800/60">
                  <div class="flex items-center gap-2">
                    <span class="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 font-mono font-bold text-xs border border-amber-500/30">Ov ${ov.over}</span>
                    <span class="font-bold text-white text-xs">${normalizePlayerName(ov.bowler)}</span>
                  </div>
                  <div class="font-mono text-xs flex items-center gap-2">
                    <span class="text-amber-400 font-bold">${ov.runs !== undefined ? ov.runs : (ov.runsConceded || 0)} runs</span>
                    <span class="text-slate-600">•</span>
                    <span class="text-slate-300">Total: <strong class="text-white">${ov.cumulativeRuns !== undefined ? ov.cumulativeRuns : (ov.totalRuns || 0)}/${ov.cumulativeWickets !== undefined ? ov.cumulativeWickets : (ov.totalWickets || 0)}</strong></span>
                  </div>
                </div>
                <div class="flex flex-wrap items-center gap-1.5 pt-0.5">
                  ${renderBallBadges(ov.balls)}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}
    </div>

    <!-- SUB-TAB 4: STATS & CHARTS -->
    <div id="match-panel-charts" class="match-subtab-panel ${currentMatchSubTab === 'charts' ? '' : 'hidden'} space-y-6">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <div class="flex justify-between items-center mb-3">
            <h3 class="text-sm font-bold text-white flex items-center gap-2">
              <i data-lucide="trending-up" class="w-4 h-4 text-amber-400"></i>
              Worm Chart (Run Progression)
            </h3>
            <span class="text-[11px] text-slate-400">Over-by-over</span>
          </div>
          <div class="h-64 relative">
            <canvas id="wormChart"></canvas>
          </div>
        </div>

        <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <div class="flex justify-between items-center mb-3">
            <h3 class="text-sm font-bold text-white flex items-center gap-2">
              <i data-lucide="bar-chart-3" class="w-4 h-4 text-red-400"></i>
              Manhattan Chart (Runs Per Over)
            </h3>
            <span class="text-[11px] text-slate-400">Bars with Wickets</span>
          </div>
          <div class="h-64 relative">
            <canvas id="manhattanChart"></canvas>
          </div>
        </div>
      </div>
    </div>

    <!-- SUB-TAB 5: MATCH AWARDS & MVP (TOP 3 PERFORMERS) -->
    <div id="match-panel-awards" class="match-subtab-panel ${currentMatchSubTab === 'awards' ? '' : 'hidden'} space-y-6">
      ${renderMatchAwardsSubTab(match)}
    </div>
  `;

  renderScorecardPanel(match);
  if (currentMatchSubTab === 'charts') {
    initMatchCharts(match);
  }
  if (window.lucide) window.lucide.createIcons();
}

function renderMatchAwardsSubTab(match) {
  const awards = getMatchCrcAwards(match);

  // Shared by MVP, batting, bowling and fielding podiums.
  // Stack the score beneath the name on narrow screens so the winner badge
  // cannot collide with the stat breakdown or wrap beneath the medal.
  const renderPodiumItem = (place, name, mainStat, subStat, highlightColor = 'amber') => {
    let medal = '🥇';
    let ringColor = 'border-amber-500/50 bg-amber-500/10';
    if (place === 2) {
      medal = '🥈';
      ringColor = 'border-slate-700 bg-slate-800/40';
    } else if (place === 3) {
      medal = '🥉';
      ringColor = 'border-amber-800/50 bg-amber-900/20';
    }

    return `
      <div class="podium-entry grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,auto)] gap-2.5 items-center p-3 rounded-xl border ${ringColor} transition-colors">
        <div class="flex items-center gap-2.5 min-w-0">
          <span class="text-xl shrink-0" aria-label="Rank ${place}">${medal}</span>
          <div class="flex flex-wrap items-center gap-1.5 min-w-0">
            <span class="font-bold text-white text-xs sm:text-sm break-words">${name}</span>
            ${place === 1 ? `<span class="podium-winner-tag inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[9px] leading-none bg-amber-500/20 text-amber-300 font-black border border-amber-500/30 whitespace-nowrap">WINNER</span>` : ''}
          </div>
        </div>
        <div class="podium-stats min-w-0 text-right sm:max-w-[24rem]">
          <div class="font-mono font-bold text-xs sm:text-sm text-${highlightColor}-400 break-words">${mainStat}</div>
          <div class="text-[10px] sm:text-[11px] leading-relaxed text-slate-400 font-mono whitespace-normal break-words">${subStat}</div>
        </div>
      </div>
    `;
  };

  // Include every player tied within the top three competition ranks.
  const getPodiumRanking = (list, key) => getCompetitionRanking(list, key, 3);

  return `
    <div class="space-y-6">
      <!-- 1. Match Honors Spotlight Banner (Match MVP First!) -->
      <div class="bg-gradient-to-r from-amber-950/60 via-slate-900 to-slate-900 border border-amber-500/40 rounded-2xl p-5 shadow-xl">
        <div class="flex flex-wrap justify-between items-center gap-2 mb-3 pb-2 border-b border-amber-500/20">
          <div class="flex items-center gap-2">
            <span class="text-xl">🏆</span>
            <div>
              <h3 class="font-black text-white text-base">Match Honors & Accolades (CRC)</h3>
              <p class="text-xs text-slate-400">Statistical MVP v2.0 • Official POTM is tracked separately (zero points)</p>
              <a href="methodology.html" class="text-xs text-amber-400 hover:text-amber-300 underline underline-offset-4">MVP Methodology v2.0</a>
            </div>
          </div>
          <span class="text-xs text-amber-400 font-bold bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/30">
            ${match.matchTitle}
          </span>
        </div>

        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <!-- Match MVP Card (First!) -->
          <div class="p-3 bg-slate-950/70 border border-red-500/30 rounded-xl">
            <span class="text-[10px] text-red-400 font-bold uppercase tracking-wider block mb-1">⭐ Match MVP</span>
            <div class="font-bold text-white text-sm leading-snug break-words" title="${awards.matchMvpWinner ? awards.matchMvpWinner.name : 'N/A'}">${awards.matchMvpWinner ? awards.matchMvpWinner.name : 'N/A'}</div>
            <div class="text-xs font-mono text-red-300 font-bold mt-0.5">
              ${awards.matchMvpWinner ? `${formatMvpPoints(awards.matchMvpWinner.totalPts)} MVP Points` : '-'}
            </div>
          </div>

          <!-- Top Batter Card -->
          <div class="p-3 bg-slate-950/70 border border-amber-500/30 rounded-xl">
            <span class="text-[10px] text-amber-400 font-bold uppercase tracking-wider block mb-1">🏏 Top Batter</span>
            <div class="font-bold text-white text-sm leading-snug break-words" title="${awards.topBatterWinner ? awards.topBatterWinner.name : 'N/A'}">${awards.topBatterWinner ? awards.topBatterWinner.name : 'N/A'}</div>
            <div class="text-xs font-mono text-amber-300 font-semibold mt-0.5">
              ${awards.topBatterWinner ? `${formatMvpPoints(awards.topBatterWinner.batPts)} batting pts • ${awards.topBatterWinner.runs} runs` : '-'}
            </div>
          </div>

          <!-- Top Bowler Card -->
          <div class="p-3 bg-slate-950/70 border border-purple-500/30 rounded-xl">
            <span class="text-[10px] text-purple-400 font-bold uppercase tracking-wider block mb-1">🎯 Top Bowler</span>
            <div class="font-bold text-white text-sm leading-snug break-words" title="${awards.topBowlerWinner ? awards.topBowlerWinner.name : 'N/A'}">${awards.topBowlerWinner ? awards.topBowlerWinner.name : 'N/A'}</div>
            <div class="text-xs font-mono text-purple-300 font-semibold mt-0.5">
              ${awards.topBowlerWinner ? `${formatMvpPoints(awards.topBowlerWinner.bowlPts)} bowling pts • ${awards.topBowlerWinner.wickets}/${awards.topBowlerWinner.runs}` : '-'}
            </div>
          </div>

          <!-- Top Fielder Card -->
          <div class="p-3 bg-slate-950/70 border border-sky-500/30 rounded-xl">
            <span class="text-[10px] text-sky-400 font-bold uppercase tracking-wider block mb-1">🧤 Top Fielder</span>
            <div class="font-bold text-white text-sm leading-snug break-words" title="${awards.topFielderWinner ? awards.topFielderWinner.name : 'None'}">${awards.topFielderWinner ? awards.topFielderWinner.name : 'None'}</div>
            <div class="text-xs font-mono text-sky-300 font-semibold mt-0.5">
              ${awards.topFielderWinner ? `${formatMvpPoints(awards.topFielderWinner.fieldPts)} fielding pts • ${awards.topFielderWinner.total} dismissals` : '0 dismissals'}
            </div>
          </div>
        </div>
      </div>

      <p class="text-xs text-slate-400 leading-relaxed">Match baseline: ${awards.baseline.runs} runs / ${awards.baseline.legalBalls} legal balls = ${awards.baseline.rpb.toFixed(3)} RPB (${awards.baseline.rpo.toFixed(3)} RPO). Scheduled limit: ${awards.baseline.scheduledOvers} overs. Points can be negative; rankings use full precision.</p>
      <!-- 2. Detailed Top 3 Rankings by Category Grid (MVP Category First!) -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <!-- Category 1: Match MVP / Impact Ranking (Top 3 - First!) -->
        <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
          <div class="flex justify-between items-center pb-2 border-b border-slate-800">
            <h4 class="font-bold text-white text-sm flex items-center gap-2">
              <span class="text-base">⭐</span> CRC Match MVP Impact (Top 3)
            </h4>
            <button onclick="openMvpExplainerModal()" class="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1">
              <i data-lucide="info" class="w-3 h-3"></i> Formula
            </button>
          </div>
          <div class="space-y-2">
            ${awards.mvps.length === 0 ? '<div class="text-xs text-slate-500 py-3 text-center">No player activity recorded</div>' :
              getPodiumRanking(awards.mvps, 'totalPts').map(({ item: p, place }) =>
                renderPodiumItem(
                  place,
                  p.name,
                  `${formatMvpPoints(p.totalPts)} MVP Pts`,
                  `Bat: ${formatMvpPoints(p.batPts, true)} • Bowl: ${formatMvpPoints(p.bowlPts, true)} • Fld: ${formatMvpPoints(p.fieldPts, true)}`,
                  'red'
                )
              ).join('')
            }
          </div>
        </div>

        <!-- Category 2: Top Batters (Top 3) -->
        <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
          <div class="flex justify-between items-center pb-2 border-b border-slate-800">
            <h4 class="font-bold text-white text-sm flex items-center gap-2">
              <span class="text-base">🏏</span> Top CRC Batters (Top 3)
            </h4>
            <span class="text-[11px] text-slate-400">Ranked by batting impact</span>
          </div>
          <div class="space-y-2">
            ${awards.batters.length === 0 ? '<div class="text-xs text-slate-500 py-3 text-center">No batting data recorded</div>' :
              getPodiumRanking(awards.batters, 'batPts').map(({ item: b, place }) =>
                renderPodiumItem(
                  place,
                  b.name,
                  `${formatMvpPoints(b.batPts)} Batting Impact`,
                  `Runs ${b.runs} (${b.balls}b) • SR ${b.sr} • ${b.sixes}x6, ${b.fours}x4 • ${b.isNotOut ? 'Not Out' : 'Out'}`,
                  'amber'
                )
              ).join('')
            }
          </div>
        </div>

        <!-- Category 3: Top Bowlers (Top 3 with Tied Ranks) -->
        <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
          <div class="flex justify-between items-center pb-2 border-b border-slate-800">
            <h4 class="font-bold text-white text-sm flex items-center gap-2">
              <span class="text-base">🎯</span> Top CRC Bowlers (Top 3)
            </h4>
            <span class="text-[11px] text-slate-400">Ranked by bowling impact</span>
          </div>
          <div class="space-y-2">
            ${awards.bowlers.length === 0 ? '<div class="text-xs text-slate-500 py-3 text-center">No bowling data recorded</div>' :
              getPodiumRanking(awards.bowlers, 'bowlPts').map(({ item: bw, place }) =>
                renderPodiumItem(
                  place,
                  bw.name,
                  `${formatMvpPoints(bw.bowlPts)} Bowling Impact`,
                  `Figures ${bw.wickets}/${bw.runs} (${bw.overs} ov) • Econ ${bw.economy} • ${bw.maidens} Mdns • ${bw.dots} Dots`,
                  'purple'
                )
              ).join('')
            }
          </div>
        </div>

        <!-- Category 4: Top Fielders (Top 3 with Tied Ranks) -->
        <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
          <div class="flex justify-between items-center pb-2 border-b border-slate-800">
            <h4 class="font-bold text-white text-sm flex items-center gap-2">
              <span class="text-base">🧤</span> Top CRC Fielders (Top 3)
            </h4>
            <span class="text-[11px] text-slate-400">Ranked by fielding impact</span>
          </div>
          <div class="space-y-2">
            ${awards.fielders.length === 0 ? '<div class="text-xs text-slate-500 py-3 text-center">No fielding dismissals in this innings</div>' :
              getPodiumRanking(awards.fielders, 'fieldPts').map(({ item: f, place }) =>
                renderPodiumItem(
                  place,
                  f.name,
                  `${formatMvpPoints(f.fieldPts)} Fielding Pts`,
                  `${f.catches} Catches • ${f.runouts} Run-outs${f.stumpings ? ' • ' + f.stumpings + ' St' : ''}`,
                  'sky'
                )
              ).join('')
            }
          </div>
        </div>

      </div>
    </div>
  `;
}

function renderScorecardPanel(match) {
  const container = document.getElementById('scorecard-tables-container');
  if (!container) return;

  container.className = 'space-y-4';
  container.innerHTML = match.innings.map((inn, idx) => renderInningsScorecard(inn, idx + 1, getMatchMvpContext(match))).join('');

  if (window.lucide) window.lucide.createIcons();
}

function renderInningsScorecard(inn, inningsNum, baseline) {
  const isCRC = isCrcTeam(inn);

  return `
    <details open class="group bg-slate-900/80 border ${isCRC ? 'border-amber-500/40' : 'border-slate-800'} rounded-2xl overflow-hidden shadow-lg transition-all">
      <summary class="p-4 bg-slate-800/60 hover:bg-slate-800/80 cursor-pointer flex flex-wrap justify-between items-center gap-2 list-none select-none transition-colors">
        <div class="flex items-center gap-2.5">
          <span class="px-2.5 py-0.5 rounded text-[11px] font-bold ${isCRC ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-slate-700 text-slate-300'}">
            ${inningsNum}${inningsNum === 1 ? 'st' : 'nd'} Innings
          </span>
          <h4 class="font-bold text-white text-base">${inn.team}</h4>
        </div>
        <div class="flex items-center gap-3">
          <div class="text-right">
            <span class="text-lg font-mono font-bold text-white">${inn.runs}/${inn.wickets}</span>
            <span class="text-xs text-slate-400 ml-1">(${inn.overs} ov, RR ${inn.runRate})</span>
          </div>
          <div class="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 group-open:text-amber-400 transition-colors">
            <i data-lucide="chevron-down" class="w-4 h-4 transform group-open:rotate-180 transition-transform duration-200"></i>
          </div>
        </div>
      </summary>

      <p class="px-4 pt-2 text-[11px] text-slate-400 sm:hidden">Swipe table to see all figures <span class="text-amber-400">→</span></p>
      <div class="overflow-x-auto custom-scrollbar" role="region" aria-label="Batting scorecard — scroll for more columns" tabindex="0">
        <table class="scorecard-table w-full text-left text-xs">
          <thead>
            <tr class="bg-slate-950/60 text-slate-400 border-b border-slate-800">
              <th class="py-2.5 px-4 font-semibold">Batter</th>
              <th class="py-2.5 px-3 text-right font-semibold text-amber-400" title="Batting Impact: full CRC MVP v2.0 batting component">Impact</th>
              <th class="py-2.5 px-2 font-semibold">Dismissal</th>
              <th class="py-2.5 px-3 text-right font-semibold text-white">R</th>
              <th class="py-2.5 px-3 text-right font-semibold">B</th>
              <th class="py-2.5 px-3 text-right font-semibold">4s</th>
              <th class="py-2.5 px-3 text-right font-semibold">6s</th>
              <th class="py-2.5 px-4 text-right font-semibold">SR</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-800/60">
            ${inn.batting.map(b => {
              const cleanPlayer = normalizePlayerName(b.player);
              return `
                <tr class="hover:bg-slate-800/30 transition-colors">
                  <td class="py-2.5 px-4 font-medium text-white whitespace-nowrap">
                    <span class="cursor-pointer hover:text-amber-400" onclick="openPlayerProfileByName('${cleanPlayer}')">${cleanPlayer}</span>
                    ${b.dismissal.toLowerCase().includes('not out') ? '<span class="text-emerald-400 text-[10px]">*</span>' : ''}
                  </td>
                  <td class="py-2.5 px-3 text-right text-amber-400 font-mono whitespace-nowrap">${formatMvpPoints(calculateBattingImpact(b, baseline).batPts)}</td>
                  <td class="py-2.5 px-2 text-slate-400 truncate max-w-xs">${b.dismissal}</td>
                  <td class="py-2.5 px-3 text-right font-bold text-white font-mono">${b.runs}</td>
                  <td class="py-2.5 px-3 text-right text-slate-300 font-mono">${b.balls}</td>
                  <td class="py-2.5 px-3 text-right text-slate-300 font-mono">${b.fours}</td>
                  <td class="py-2.5 px-3 text-right text-amber-400 font-mono font-semibold">${b.sixes}</td>
                  <td class="py-2.5 px-4 text-right text-slate-400 font-mono">${b.sr}</td>
                </tr>
              `;
            }).join('')}
            <tr class="bg-slate-950/30 text-slate-300 font-medium">
              <td class="py-2 px-4" colspan="3">Extras (${formatExtras(inn.extras)})</td>
              <td class="py-2 px-3 text-right font-bold font-mono text-white">${inn.extras?.total || 0}</td>
              <td colspan="4" class="py-2 px-4 text-right text-slate-400 text-[11px]">(Overs: ${inn.overs}, RR: ${inn.runRate})</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="border-t border-slate-800 overflow-x-auto custom-scrollbar" role="region" aria-label="Bowling scorecard — scroll for more columns" tabindex="0">
        <table class="scorecard-table w-full text-left text-xs">
          <thead>
            <tr class="bg-slate-950/60 text-slate-400 border-b border-slate-800">
              <th class="py-2.5 px-4 font-semibold">Bowler</th>
              <th class="py-2.5 px-3 text-right font-semibold text-purple-400" title="Bowling Impact: full CRC MVP v2.0 bowling component">Impact</th>
              <th class="py-2.5 px-3 text-right font-semibold">O</th>
              <th class="py-2.5 px-3 text-right font-semibold">M</th>
              <th class="py-2.5 px-3 text-right font-semibold text-white">R</th>
              <th class="py-2.5 px-3 text-right font-semibold text-amber-400">W</th>
              <th class="py-2.5 px-3 text-right font-semibold">Econ</th>
              <th class="py-2.5 px-3 text-right font-semibold">Dots</th>
              <th class="py-2.5 px-4 text-right font-semibold">Wd/Nb</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-800/60">
            ${inn.bowling.map(bw => {
              const cleanBowler = normalizePlayerName(bw.bowler);
              return `
                <tr class="hover:bg-slate-800/30 transition-colors">
                  <td class="py-2.5 px-4 font-medium text-white whitespace-nowrap cursor-pointer hover:text-amber-400" onclick="openPlayerProfileByName('${cleanBowler}')">
                    ${cleanBowler}
                  </td>
                  <td class="py-2.5 px-3 text-right text-purple-400 font-mono whitespace-nowrap">${formatMvpPoints(calculateBowlingImpact({...bw, dots: bw.dots || 0, maidens: bw.maidens || 0}, baseline).bowlPts)}</td>
                  <td class="py-2.5 px-3 text-right text-slate-300 font-mono">${bw.overs}</td>
                  <td class="py-2.5 px-3 text-right text-slate-300 font-mono">${bw.maidens || 0}</td>
                  <td class="py-2.5 px-3 text-right text-slate-300 font-mono">${bw.runs}</td>
                  <td class="py-2.5 px-3 text-right font-bold text-amber-400 font-mono">${bw.wickets}</td>
                  <td class="py-2.5 px-3 text-right text-slate-400 font-mono">${bw.economy}</td>
                  <td class="py-2.5 px-3 text-right text-slate-400 font-mono">${bw.dots || 0}</td>
                  <td class="py-2.5 px-4 text-right text-slate-400 font-mono">${bw.wd || 0}/${bw.nb || 0}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </details>
  `;
}

function formatExtras(extras) {
  if (!extras) return 'None';
  const parts = [];
  if (extras.wd) parts.push(`WD ${extras.wd}`);
  if (extras.nb) parts.push(`NB ${extras.nb}`);
  if (extras.b) parts.push(`B ${extras.b}`);
  if (extras.lb) parts.push(`LB ${extras.lb}`);
  return parts.length > 0 ? parts.join(', ') : '0';
}

function renderBallBadges(ballsString) {
  if (!ballsString) return '';
  const tokens = ballsString.split(/\s+/);
  return tokens.map(t => {
    let bg = 'bg-slate-800 text-slate-300 border-slate-700';
    if (t === 'W') bg = 'bg-rose-500/20 text-rose-400 border-rose-500/40 font-bold';
    else if (t === '4') bg = 'bg-sky-500/20 text-sky-400 border-sky-500/40 font-bold';
    else if (t === '6') bg = 'bg-amber-500/30 text-amber-300 border-amber-500/50 font-black';
    else if (t.includes('Wd') || t.includes('N')) bg = 'bg-purple-500/20 text-purple-300 border-purple-500/40 font-semibold';
    else if (t === '0') bg = 'bg-slate-800/40 text-slate-500 border-slate-800/80';

    return `<span class="w-7 h-7 rounded-full flex items-center justify-center font-mono text-[11px] font-bold border shrink-0 ${bg}">${t}</span>`;
  }).join('');
}

// ----------------------------------------------------
// CHART INITIALIZATION
// ----------------------------------------------------
function initMatchCharts(match) {
  if (typeof Chart === 'undefined') return;

  const crcInnings = match.innings.find(i => isCrcTeam(i));
  const oppInnings = match.innings.find(i => !isCrcTeam(i));

  const wormCtx = document.getElementById('wormChart')?.getContext('2d');
  const manhattanCtx = document.getElementById('manhattanChart')?.getContext('2d');

  if (wormChartInstance) wormChartInstance.destroy();
  if (manhattanChartInstance) manhattanChartInstance.destroy();

  const overCount = Math.max(crcInnings?.overProgression?.length || 0, oppInnings?.overProgression?.length || 0);
  const labels = ['0', ...Array.from({ length: overCount }, (_, i) => `Ov ${i + 1}`)];

  const crcProg = [0];
  if (crcInnings?.overProgression) {
    crcInnings.overProgression.forEach(o => crcProg.push(o.cumulativeRuns));
  }

  const oppProg = [0];
  if (oppInnings?.overProgression) {
    oppInnings.overProgression.forEach(o => oppProg.push(o.cumulativeRuns));
  }

  if (wormCtx) {
    wormChartInstance = new Chart(wormCtx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Cork Royal Challengers',
            data: crcProg,
            borderColor: '#F59E0B',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            borderWidth: 3,
            tension: 0.3,
            fill: true,
            pointBackgroundColor: '#F59E0B',
            pointRadius: 4
          },
          {
            label: oppInnings?.shortName || oppInnings?.team || 'Opponent',
            data: oppProg,
            borderColor: '#38BDF8',
            backgroundColor: 'rgba(56, 189, 248, 0.05)',
            borderWidth: 2,
            borderDash: [5, 5],
            tension: 0.3,
            pointBackgroundColor: '#38BDF8',
            pointRadius: 3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#94A3B8', font: { size: 11 } } },
          tooltip: { mode: 'index', intersect: false }
        },
        scales: {
          x: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#64748B' } },
          y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#64748B' } }
        }
      }
    });
  }

  const overLabels = Array.from({ length: overCount }, (_, i) => `Over ${i + 1}`);
  const crcOverRuns = Array(overCount).fill(null);
  if (crcInnings?.overProgression) {
    crcInnings.overProgression.forEach((o, i) => { crcOverRuns[i] = o.runs; });
  }

  const oppOverRuns = Array(overCount).fill(null);
  if (oppInnings?.overProgression) {
    oppInnings.overProgression.forEach((o, i) => { oppOverRuns[i] = o.runs; });
  }

  if (manhattanCtx) {
    manhattanChartInstance = new Chart(manhattanCtx, {
      type: 'bar',
      data: {
        labels: overLabels,
        datasets: [
          {
            label: 'CRC',
            data: crcOverRuns,
            backgroundColor: 'rgba(245, 158, 11, 0.85)',
            borderRadius: 4
          },
          {
            label: oppInnings?.shortName || 'Opponent',
            data: oppOverRuns,
            backgroundColor: 'rgba(56, 189, 248, 0.7)',
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#94A3B8', font: { size: 11 } } }
        },
        scales: {
          x: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#64748B' } },
          y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#64748B' } }
        }
      }
    });
  }
}

// ----------------------------------------------------
// TAB: LEADERBOARD SORTING
// ----------------------------------------------------
function sortLeaderboard(type, column) {
  let sortObj;
  if (type === 'batting') sortObj = battingSort;
  else if (type === 'bowling') sortObj = bowlingSort;
  else if (type === 'mvp') sortObj = mvpSort;
  else if (type === 'awards') sortObj = awardsSort;

  if (sortObj.col === column) {
    sortObj.asc = !sortObj.asc;
  } else {
    sortObj.col = column;
    sortObj.asc = false;
  }

  renderLeaderboardTab();
}

function updateSortIndicators() {
  document.querySelectorAll('[id^="sort-"]').forEach(el => el.textContent = '');

  const setIndicator = (id, asc) => {
    const el = document.getElementById(id);
    if (el) el.textContent = asc ? ' ▲' : ' ▼';
  };

  setIndicator(`sort-bat-${battingSort.col}`, battingSort.asc);
  setIndicator(`sort-bowl-${bowlingSort.col}`, bowlingSort.asc);
  setIndicator(`sort-mvp-${mvpSort.col}`, mvpSort.asc);
  setIndicator(`sort-awd-${awardsSort.col}`, awardsSort.asc);
}

function renderLeaderboardTab() {
  const stats = calculateSeasonStats();
  const playerList = Object.values(stats);

  const battingList = [...playerList].filter(p => p.innings > 0);
  battingList.sort((a, b) => {
    let valA = a[battingSort.col];
    let valB = b[battingSort.col];
    if (typeof valA === 'string') return battingSort.asc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    return battingSort.asc ? valA - valB : valB - valA;
  });

  const battingTbody = document.getElementById('leaderboard-batting-body');
  if (battingTbody) {
    battingTbody.innerHTML = battingList.map((p, idx) => `
      <tr class="hover:bg-slate-800/40 transition-colors border-l-4 ${idx === 0 ? 'border-amber-500 bg-amber-500/10' : 'border-transparent'}">
        <td class="py-3 px-4 font-mono font-bold ${idx === 0 ? 'text-amber-400' : 'text-slate-400'}">
          ${idx + 1}
        </td>
        <td class="py-3 px-4 font-semibold text-white cursor-pointer hover:text-amber-400" onclick="openPlayerProfileByName('${p.name}')">
          ${p.name}
        </td>
        <td class="py-3 px-3 text-right text-amber-400 font-mono whitespace-nowrap">${formatMvpPoints(p.battingImpact)}</td>
        <td class="py-3 px-3 text-right text-slate-300 font-mono">${p.matches}</td>
        <td class="py-3 px-3 text-right text-slate-300 font-mono">${p.innings}</td>
        <td class="py-3 px-3 text-right font-bold text-white font-mono">${p.runs}</td>
        <td class="py-3 px-3 text-right text-slate-300 font-mono">${p.highestScore}${p.isNotOutHighest ? '*' : ''}</td>
        <td class="py-3 px-3 text-right text-slate-400 font-mono">${p.battingAvg}</td>
        <td class="py-3 px-3 text-right text-slate-400 font-mono">${p.strikeRate}</td>
        <td class="py-3 px-4 text-right font-mono font-semibold text-amber-400">${p.sixes}</td>
      </tr>
    `).join('');
  }

  const bowlingList = [...playerList].filter(p => p.ballsBowled > 0);
  bowlingList.sort((a, b) => {
    let valA = a[bowlingSort.col];
    let valB = b[bowlingSort.col];
    if (bowlingSort.col === 'overs') { valA = a.ballsBowled; valB = b.ballsBowled; }
    if (typeof valA === 'string') return bowlingSort.asc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    return bowlingSort.asc ? valA - valB : valB - valA;
  });

  const bowlingTbody = document.getElementById('leaderboard-bowling-body');
  if (bowlingTbody) {
    bowlingTbody.innerHTML = bowlingList.map((p, idx) => `
      <tr class="hover:bg-slate-800/40 transition-colors border-l-4 ${idx === 0 ? 'border-purple-500 bg-purple-500/10' : 'border-transparent'}">
        <td class="py-3 px-4 font-mono font-bold ${idx === 0 ? 'text-purple-400' : 'text-slate-400'}">
          ${idx + 1}
        </td>
        <td class="py-3 px-4 font-semibold text-white cursor-pointer hover:text-amber-400" onclick="openPlayerProfileByName('${p.name}')">
          ${p.name}
        </td>
        <td class="py-3 px-3 text-right text-purple-400 font-mono whitespace-nowrap">${formatMvpPoints(p.bowlingImpact)}</td>
        <td class="py-3 px-3 text-right text-slate-300 font-mono">${p.overs}</td>
        <td class="py-3 px-3 text-right text-slate-300 font-mono">${p.maidens}</td>
        <td class="py-3 px-3 text-right text-slate-300 font-mono">${p.runsConceded}</td>
        <td class="py-3 px-3 text-right font-bold text-amber-400 font-mono">${p.wickets}</td>
        <td class="py-3 px-3 text-right text-slate-300 font-mono">${p.economy}</td>
        <td class="py-3 px-3 text-right text-slate-400 font-mono">${p.bestBowling.wkts}/${p.bestBowling.runs}</td>
        <td class="py-3 px-4 text-right text-slate-400 font-mono">${p.dots}</td>
      </tr>
    `).join('');
  }

  const mvpList = rankByPoints(playerList.filter(p => p.matches > 0), 'mvpPoints');
  const mvpRanks = new Map(getCompetitionRanking(mvpList, 'mvpPoints').map(({ item, place }) => [item.name, place]));
  mvpList.sort((a, b) => {
    let valA = a[mvpSort.col];
    let valB = b[mvpSort.col];
    if (typeof valA === 'string') return mvpSort.asc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    return mvpSort.asc ? valA - valB : valB - valA;
  });

  const mvpTbody = document.getElementById('leaderboard-mvp-body');
  if (mvpTbody) {
    mvpTbody.innerHTML = mvpList.map((p, idx) => `
      <tr class="hover:bg-slate-800/40 transition-colors border-l-4 ${mvpRanks.get(p.name) === 1 ? 'border-amber-400 bg-amber-500/10' : 'border-transparent'}">
        <td class="py-3 px-4 font-mono font-bold ${mvpRanks.get(p.name) === 1 ? 'text-amber-400' : 'text-slate-400'}">
          ${mvpRanks.get(p.name)}
        </td>
        <td class="py-3 px-4 font-semibold text-white cursor-pointer hover:text-amber-400" onclick="openPlayerProfileByName('${p.name}')">
          ${p.name}
        </td>
        <td class="py-3 px-3 text-right font-mono font-black text-amber-400 text-sm">${formatMvpPoints(p.mvpPoints)}</td>
        <td class="py-3 px-3 text-right text-amber-300 font-mono font-semibold">${p.potmCount}</td>
        <td class="py-3 px-3 text-right text-slate-300 font-mono">${p.runs}</td>
        <td class="py-3 px-3 text-right text-slate-300 font-mono">${p.wickets}</td>
        <td class="py-3 px-4 text-right text-slate-300 font-mono">${p.totalFielding}</td>
      </tr>
    `).join('');
  }

  // 4. Match Awards & Honors Leaderboard
  const awardsList = [...playerList].filter(p => (p.awards?.total || 0) > 0 || p.matches > 0);
  awardsList.sort((a, b) => {
    let valA, valB;
    if (awardsSort.col === 'name') {
      valA = a.name; valB = b.name;
    } else if (awardsSort.col === 'mvpPoints') {
      valA = a.mvpPoints; valB = b.mvpPoints;
    } else if (awardsSort.col === 'total') {
      valA = a.awards.total; valB = b.awards.total;
    } else {
      valA = a.awards[awardsSort.col]; valB = b.awards[awardsSort.col];
    }
    if (typeof valA === 'string') return awardsSort.asc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    return awardsSort.asc
      ? (valA - valB || a.awards.total - b.awards.total || a.mvpPoints - b.mvpPoints)
      : (valB - valA || b.awards.total - a.awards.total || b.mvpPoints - a.mvpPoints);
  });

  const awardsTbody = document.getElementById('leaderboard-awards-body');
  if (awardsTbody) {
    awardsTbody.innerHTML = awardsList.map((p, idx) => `
      <tr class="hover:bg-slate-800/40 transition-colors border-l-4 ${idx === 0 ? 'border-amber-400 bg-amber-500/10' : 'border-transparent'}">
        <td class="py-3 px-4 font-mono font-bold ${idx === 0 ? 'text-amber-400' : 'text-slate-400'}">
          ${idx + 1}
        </td>
        <td class="py-3 px-4 font-semibold text-white cursor-pointer hover:text-amber-400" onclick="openPlayerProfileByName('${p.name}')">
          ${p.name}
        </td>
        <td class="py-3 px-3 text-right font-mono font-bold text-amber-400 text-sm">
          ${formatMvpPoints(p.mvpPoints)}
        </td>
        <td class="py-3 px-3 text-right font-mono font-black text-white text-sm">
          ${p.awards.total}
        </td>
        <td class="py-3 px-3 text-right font-mono ${p.awards.matchMvp > 0 ? 'text-amber-300 font-bold' : 'text-slate-500'}">
          ${p.awards.matchMvp}
        </td>
        <td class="py-3 px-3 text-right font-mono ${p.awards.topBatter > 0 ? 'text-amber-400 font-bold' : 'text-slate-500'}">
          ${p.awards.topBatter}
        </td>
        <td class="py-3 px-3 text-right font-mono ${p.awards.topBowler > 0 ? 'text-purple-400 font-bold' : 'text-slate-500'}">
          ${p.awards.topBowler}
        </td>
        <td class="py-3 px-4 text-right font-mono ${p.awards.topFielder > 0 ? 'text-sky-400 font-bold' : 'text-slate-500'}">
          ${p.awards.topFielder}
        </td>
      </tr>
    `).join('');
  }

  // Update header cap summary badges dynamically based on current standings
  const orangeLeader = [...battingList].sort((a, b) => b.runs - a.runs)[0];
  const purpleLeader = [...bowlingList].sort((a, b) => b.wickets - a.wickets || a.economyNum - b.economyNum)[0];
  const mvpLeaders = getPointWinners(rankByPoints(mvpList, 'mvpPoints'), 'mvpPoints');
  const mvpLeader = mvpLeaders[0];
  const awardsLeader = [...awardsList].sort((a, b) => b.awards.total - a.awards.total)[0];

  const orangePill = document.getElementById('leaderboard-orange-pill');
  if (orangePill && orangeLeader) {
    orangePill.textContent = `Orange Cap: ${orangeLeader.name} (${orangeLeader.runs} Runs)`;
  }
  const purplePill = document.getElementById('leaderboard-purple-pill');
  if (purplePill && purpleLeader) {
    purplePill.textContent = `Purple Cap: ${purpleLeader.name} (${purpleLeader.wickets} Wkts)`;
  }
  const mvpPill = document.getElementById('leaderboard-mvp-pill');
  if (mvpPill && mvpLeader) {
    mvpPill.textContent = `MVP Leader: ${mvpLeaders.map(p => p.name).join(' & ')} (${formatMvpPoints(mvpLeader.mvpPoints)} Pts)`;
  }
  if (mvpPill && !mvpLeader) mvpPill.textContent = 'No MVP appearances';
  const awardsPill = document.getElementById('leaderboard-awards-pill');
  if (awardsPill && awardsLeader) {
    awardsPill.textContent = `Most Awards: ${awardsLeader.name} (${awardsLeader.awards.total} Awards)`;
  }

  updateSortIndicators();
}

// ----------------------------------------------------
// TAB: PLAYERS
// ----------------------------------------------------
function renderPlayersTab() {
  const stats = calculateSeasonStats();
  const container = document.getElementById('players-grid');
  if (!container) return;

  const playerList = Object.values(stats).sort((a, b) => b.mvpPoints - a.mvpPoints || b.runs - a.runs || b.wickets - a.wickets);

  container.innerHTML = playerList.map(p => {
    return `
      <div onclick="openPlayerProfileByName('${p.name}')"
           class="bg-slate-900/80 border border-slate-800 hover:border-amber-500/50 rounded-2xl p-5 cursor-pointer transition-all hover:-translate-y-1 hover:shadow-xl group">
        <div class="flex items-center gap-3.5 mb-4">
          <div class="w-12 h-12 rounded-full bg-gradient-to-tr from-amber-500 to-red-600 flex items-center justify-center font-bold text-white text-lg shadow-md group-hover:ring-2 group-hover:ring-amber-400">
            ${p.name.charAt(0)}
          </div>
          <div>
            <h3 class="font-bold text-white text-base group-hover:text-amber-400 transition-colors">${p.name}</h3>
          </div>
        </div>

        <div class="grid grid-cols-3 gap-2 text-center py-2.5 px-3 bg-slate-950/60 rounded-xl mb-3">
          <div>
            <span class="text-[10px] text-slate-400 block">Runs</span>
            <span class="font-bold text-white font-mono">${p.runs}</span>
          </div>
          <div>
            <span class="text-[10px] text-slate-400 block">Wickets</span>
            <span class="font-bold text-amber-400 font-mono">${p.wickets}</span>
          </div>
          <div>
            <span class="text-[10px] text-slate-400 block">MVP Pts</span>
            <span class="font-bold text-slate-200 font-mono">${formatMvpPoints(p.mvpPoints)}</span>
          </div>
        </div>

        <div class="flex flex-wrap gap-1">
          ${p.awards?.total > 0 ? `<span class="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">🏆 ${p.awards.total}x Awards</span>` : ''}
          ${p.potmCount > 0 ? `<span class="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30">🏆 ${p.potmCount}x POTM</span>` : ''}
          ${p.sixes > 0 ? `<span class="px-2 py-0.5 rounded-full text-[10px] bg-red-500/20 text-red-300 border border-red-500/30">💥 ${p.sixes} Sixes</span>` : ''}
          ${p.maidens > 0 ? `<span class="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">🎯 Maiden</span>` : ''}
          ${p.totalFielding > 0 ? `<span class="px-2 py-0.5 rounded-full text-[10px] bg-sky-500/20 text-sky-300 border border-sky-500/30">🧤 ${p.totalFielding} Dismissals</span>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function openPlayerProfileByName(name) {
  const stats = calculateSeasonStats();
  const clean = normalizePlayerName(name);
  const p = stats[clean];
  if (!p) return;

  const modal = document.getElementById('player-profile-modal');
  if (!modal) return;

  document.getElementById('modal-player-name').textContent = p.name;
  document.getElementById('modal-player-role').textContent = `Cork Royal Challengers • #${p.player.jerseyNumber || '-'}`;

  document.getElementById('modal-stat-matches').textContent = p.matches;
  document.getElementById('modal-stat-runs').textContent = p.runs;
  document.getElementById('modal-stat-avg').textContent = p.battingAvg;
  document.getElementById('modal-stat-sr').textContent = p.strikeRate;
  document.getElementById('modal-stat-hs').textContent = `${p.highestScore}${p.isNotOutHighest ? '*' : ''}`;

  document.getElementById('modal-stat-wkts').textContent = p.wickets;
  document.getElementById('modal-stat-overs').textContent = p.overs;
  document.getElementById('modal-stat-econ').textContent = p.economy;
  document.getElementById('modal-stat-best').textContent = `${p.bestBowling.wkts}/${p.bestBowling.runs === 999 ? 0 : p.bestBowling.runs}`;
  document.getElementById('modal-stat-catches').textContent = p.totalFielding;

  document.getElementById('modal-stat-batting-impact').textContent = formatMvpPoints(p.battingImpact);
  document.getElementById('modal-stat-bowling-impact').textContent = formatMvpPoints(p.bowlingImpact);
  document.getElementById('modal-stat-fielding-impact').textContent = formatMvpPoints(p.fieldingImpact);
  document.getElementById('modal-stat-mvp').textContent = formatMvpPoints(p.mvpPoints);
  document.getElementById('modal-stat-potm').textContent = p.potmCount;

  // Populate Match Honors & Awards Summary Grid
  const elBat = document.getElementById('modal-award-bat');
  if (elBat) elBat.textContent = p.awards?.topBatter || 0;
  const elBowl = document.getElementById('modal-award-bowl');
  if (elBowl) elBowl.textContent = p.awards?.topBowler || 0;
  const elFld = document.getElementById('modal-award-fld');
  if (elFld) elFld.textContent = p.awards?.topFielder || 0;
  const elMvp = document.getElementById('modal-award-mvp');
  if (elMvp) elMvp.textContent = p.awards?.matchMvp || 0;

  const historyList = document.getElementById('modal-match-history');
  if (historyList) {
    historyList.innerHTML = getFilteredMatches().map(match => {
      const crcInnings = match.innings.find(i => isCrcTeam(i));
      const oppInnings = match.innings.find(i => !isCrcTeam(i));

      const batRecord = crcInnings?.batting.find(b => normalizePlayerName(b.player) === p.name);
      const bowlRecord = oppInnings?.bowling.find(bw => normalizePlayerName(bw.bowler) === p.name);

      const isParticipant = (match.crcPlayingXI && match.crcPlayingXI.some(n => normalizePlayerName(n) === p.name))
        || !!batRecord || !!bowlRecord;

      if (!isParticipant) return '';

      const awards = getMatchCrcAwards(match);
      const matchImpact = awards.mvps.find(score => score.name === p.name);
      const isPotm = getCrcPotm(match) === p.name;
      const isMatchMvp = (awards.matchMvpWinners || []).some(w => w.name === p.name) || awards.matchMvpWinner?.name === p.name;
      const isTopBatter = (awards.topBatterWinners || []).some(w => w.name === p.name) || awards.topBatterWinner?.name === p.name;
      const isTopBowler = (awards.topBowlerWinners || []).some(w => w.name === p.name) || awards.topBowlerWinner?.name === p.name;
      const isTopFielder = (awards.topFielderWinners || []).some(w => w.name === p.name) || awards.topFielderWinner?.name === p.name;

      return `
        <div class="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1.5 text-xs">
          <div class="flex justify-between items-center">
            <div>
              <div class="font-bold text-white">${match.matchTitle} vs ${oppInnings?.shortName || oppInnings?.team}</div>
              <div class="text-[11px] text-slate-400">${match.date} • Result: ${match.result}</div>
            </div>
            <div class="text-right space-y-0.5">
              ${matchImpact ? `<div class="font-mono font-bold text-red-300">Statistical MVP: ${formatMvpPoints(matchImpact.totalPts)} pts</div><div class="font-mono text-[10px] text-slate-400">Batting Impact ${formatMvpPoints(matchImpact.batPts)} • Bowling Impact ${formatMvpPoints(matchImpact.bowlPts)} • Fielding Impact ${formatMvpPoints(matchImpact.fieldPts)}</div>` : ''}
              ${batRecord ? `<div class="font-mono font-bold text-amber-400">Bat: ${batRecord.runs} (${batRecord.balls}b, ${batRecord.sixes}x6)</div>` : (!bowlRecord ? `<div class="font-mono text-slate-400 text-[11px]">Did Not Bat</div>` : '')}
              ${bowlRecord ? `<div class="font-mono text-sky-400">Bowl: ${bowlRecord.overs} ov, ${bowlRecord.wickets}-${bowlRecord.runs}</div>` : ''}
            </div>
          </div>
          ${(isPotm || isMatchMvp || isTopBatter || isTopBowler || isTopFielder) ? `
            <div class="flex flex-wrap gap-1 pt-1.5 border-t border-slate-800/80">
              ${isPotm ? `<span class="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 font-black border border-amber-500/40">🏆 Official POTM</span>` : ''}
              ${isMatchMvp ? `<span class="px-1.5 py-0.5 rounded text-[10px] bg-red-500/20 text-red-300 font-black border border-red-500/30">⭐ Match MVP</span>` : ''}
              ${isTopBatter ? `<span class="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">🏏 Top Batter</span>` : ''}
              ${isTopBowler ? `<span class="px-1.5 py-0.5 rounded text-[10px] bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30">🎯 Top Bowler</span>` : ''}
              ${isTopFielder ? `<span class="px-1.5 py-0.5 rounded text-[10px] bg-sky-500/20 text-sky-300 font-bold border border-sky-500/30">🧤 Top Fielder</span>` : ''}
            </div>
          ` : ''}
        </div>
      `;
    }).join('') || '<div class="text-xs text-slate-500">No match records available.</div>';
  }

  modal.classList.remove('hidden');
}

function closePlayerModal() {
  document.getElementById('player-profile-modal')?.classList.add('hidden');
}

function openMvpExplainerModal() {
  document.getElementById('mvp-explainer-modal')?.classList.remove('hidden');
  if (window.lucide) window.lucide.createIcons();
}

function closeMvpExplainerModal() {
  document.getElementById('mvp-explainer-modal')?.classList.add('hidden');
}

