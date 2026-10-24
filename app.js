// Cork Royal Challengers - Stats Engine & App Logic

// Global state
let matchesData = [];
let playersData = [];
let teamData = {};
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

// Club MVP Formula Constants
const MVP_WEIGHTS = {
  RUN: 1.0,
  FOUR: 1.0,
  SIX: 2.0,
  MILESTONE_25: 10.0,
  WICKET: 25.0,
  MAIDEN: 12.0,
  DOT_BALL: 1.0,
  CATCH: 10.0,
  RUNOUT: 15.0,
  STUMPING: 12.0,
  ECONOMY_BONUS: 10.0, // under 6.0 in limited overs (min 1 over)
  POTM_BONUS: 20.0     // only for CRC players
};

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
  await loadInitialData();
  setupEventListeners();
  renderApp();
});

function normalizePlayerName(name) {
  if (!name) return '';
  let clean = name.replace(/\s*\((?:C|Wk|c|wk)\)/gi, '').trim();
  const lower = clean.toLowerCase();
  if (lower.startsWith('avinash')) return 'Avinash';
  if (lower.startsWith('joyvin')) return 'Joyvin';
  if (lower.startsWith('jenson')) return 'Jenson';
  if (lower.startsWith('davison')) return 'Davison';
  if (lower.includes('savio lobo')) return 'Savio Lobo';
  if (lower === 'savio' || lower.startsWith('savio r')) return 'Savio';
  if (lower === 'j. d' || lower === 'j.d' || lower === 'joy d' || lower.startsWith('joy d')) return 'Joy D';
  if (lower.startsWith('srikanth')) return 'Srikanth';
  if (lower.startsWith('yash')) return 'Yash';
  if (lower.startsWith('shivam')) return 'Shivam';
  if (lower.startsWith('rifaz')) return 'Rifaz';
  return clean;
}

function isCrcTeam(inn) {
  return inn.team.includes('CORK ROYAL') || inn.shortName === 'CRC';
}

function isCrcPlayer(playerName) {
  if (!playerName) return false;
  const clean = normalizePlayerName(playerName).toLowerCase();
  return playersData.some(p => p.name.trim().toLowerCase() === clean);
}

function getCrcPotm(match) {
  if (match.playerOfTheMatch && isCrcPlayer(match.playerOfTheMatch)) {
    return normalizePlayerName(match.playerOfTheMatch);
  }
  return null; // Don't show if won by opponent
}

function getMatchCrcAwards(match) {
  if (!match || !match.innings) {
    return {
      batters: [], bowlers: [], fielders: [], mvps: [],
      topBatterWinner: null, topBowlerWinner: null, topFielderWinner: null, matchMvpWinner: null,
      topBatterWinners: [], topBowlerWinners: [], topFielderWinners: [], matchMvpWinners: []
    };
  }

  const crcInn = match.innings.find(i => isCrcTeam(i));
  const oppInn = match.innings.find(i => !isCrcTeam(i));

  // 1. Top CRC Batters (ranked by runs, not-out, sixes, fours, SR)
  const batters = (crcInn?.batting || []).map(b => {
    const runs = b.runs || 0;
    const balls = b.balls || 0;
    const fours = b.fours || 0;
    const sixes = b.sixes || 0;
    const sr = balls > 0 ? ((runs / balls) * 100).toFixed(1) : '0.0';
    const isNotOut = (b.dismissal || '').toLowerCase().includes('not out');
    return {
      name: normalizePlayerName(b.player),
      runs,
      balls,
      fours,
      sixes,
      sr,
      srNum: parseFloat(sr),
      dismissal: b.dismissal || 'not out',
      isNotOut
    };
  }).sort((a, b) => b.runs - a.runs || (b.isNotOut ? 1 : 0) - (a.isNotOut ? 1 : 0) || b.sixes - a.sixes || b.fours - a.fours || b.srNum - a.srNum);

  // 2. Top CRC Bowlers (ranked by wickets, fewer runs, lower economy, maidens, dots)
  const bowlers = (oppInn?.bowling || []).map(bw => {
    const ov = parseFloat(bw.overs) || 1;
    const econ = (bw.runs / ov).toFixed(2);
    return {
      name: normalizePlayerName(bw.bowler),
      overs: bw.overs,
      maidens: bw.maidens || 0,
      runs: bw.runs || 0,
      wickets: bw.wickets || 0,
      dots: bw.dots || 0,
      economy: econ,
      economyNum: parseFloat(econ)
    };
  }).sort((a, b) => b.wickets - a.wickets || a.runs - b.runs || b.dots - a.dots || a.economyNum - b.economyNum || b.maidens - a.maidens);

  // 3. Top CRC Fielders (catches, run-outs, stumpings in opponent innings)
  const fieldingMap = {};
  (oppInn?.batting || []).forEach(b => {
    const d = b.dismissal || '';
    if (d.includes('c ') && !d.includes('c & b')) {
      const fm = d.match(/c ([^b]+) b /);
      if (fm && fm[1]) {
        const fn = normalizePlayerName(fm[1].trim());
        if (!fieldingMap[fn]) fieldingMap[fn] = { name: fn, catches: 0, runouts: 0, stumpings: 0, total: 0 };
        fieldingMap[fn].catches += 1;
        fieldingMap[fn].total += 1;
      }
    }
    if (d.includes('c & b ')) {
      const bn = normalizePlayerName(d.replace('c & b ', '').trim());
      if (!fieldingMap[bn]) fieldingMap[bn] = { name: bn, catches: 0, runouts: 0, stumpings: 0, total: 0 };
      fieldingMap[bn].catches += 1;
      fieldingMap[bn].total += 1;
    }
    if (d.includes('runout')) {
      const rm = d.match(/runout\s*\(([^)]+)\)/);
      if (rm && rm[1]) {
        rm[1].split('/').forEach(fn => {
          const cleanN = normalizePlayerName(fn.trim());
          if (!fieldingMap[cleanN]) fieldingMap[cleanN] = { name: cleanN, catches: 0, runouts: 0, stumpings: 0, total: 0 };
          fieldingMap[cleanN].runouts += 1;
          fieldingMap[cleanN].total += 1;
        });
      }
    }
    if (d.includes('st ')) {
      const sm = d.match(/st ([^b]+) b /);
      if (sm && sm[1]) {
        const sn = normalizePlayerName(sm[1].trim());
        if (!fieldingMap[sn]) fieldingMap[sn] = { name: sn, catches: 0, runouts: 0, stumpings: 0, total: 0 };
        fieldingMap[sn].stumpings += 1;
        fieldingMap[sn].total += 1;
      }
    }
  });
  const fielders = Object.values(fieldingMap).sort((a, b) => b.total - a.total || b.catches - a.catches || b.runouts - a.runouts);

  // 4. Match MVP / Impact Ranking (Calculated specifically for this match)
  const playerMap = {};
  batters.forEach(b => {
    if (!playerMap[b.name]) playerMap[b.name] = { name: b.name, batPts: 0, bowlPts: 0, fieldPts: 0, potmPts: 0, totalPts: 0, runs: 0, balls: 0, wkts: 0, overs: '0', catches: 0, runouts: 0 };
    let pts = (b.runs * MVP_WEIGHTS.RUN) + (b.fours * MVP_WEIGHTS.FOUR) + (b.sixes * MVP_WEIGHTS.SIX);
    if (b.runs >= 25) pts += MVP_WEIGHTS.MILESTONE_25;
    playerMap[b.name].batPts = pts;
    playerMap[b.name].runs = b.runs;
    playerMap[b.name].balls = b.balls;
  });
  bowlers.forEach(bw => {
    if (!playerMap[bw.name]) playerMap[bw.name] = { name: bw.name, batPts: 0, bowlPts: 0, fieldPts: 0, potmPts: 0, totalPts: 0, runs: 0, balls: 0, wkts: 0, overs: '0', catches: 0, runouts: 0 };
    let pts = (bw.wickets * MVP_WEIGHTS.WICKET) + (bw.maidens * MVP_WEIGHTS.MAIDEN) + (bw.dots * MVP_WEIGHTS.DOT_BALL);
    const ovNum = parseFloat(bw.overs) || 1;
    if (ovNum >= 1 && (bw.runs / ovNum) <= 6.0) pts += MVP_WEIGHTS.ECONOMY_BONUS;
    playerMap[bw.name].bowlPts = pts;
    playerMap[bw.name].wkts = bw.wickets;
    playerMap[bw.name].overs = bw.overs;
  });
  fielders.forEach(f => {
    if (!playerMap[f.name]) playerMap[f.name] = { name: f.name, batPts: 0, bowlPts: 0, fieldPts: 0, potmPts: 0, totalPts: 0, runs: 0, balls: 0, wkts: 0, overs: '0', catches: 0, runouts: 0 };
    let pts = (f.catches * MVP_WEIGHTS.CATCH) + (f.runouts * MVP_WEIGHTS.RUNOUT) + (f.stumpings * MVP_WEIGHTS.STUMPING);
    playerMap[f.name].fieldPts = pts;
    playerMap[f.name].catches = f.catches;
    playerMap[f.name].runouts = f.runouts;
    playerMap[f.name].stumpings = f.stumpings || 0;
  });
  const crcPotm = getCrcPotm(match);
  if (crcPotm && playerMap[crcPotm]) {
    playerMap[crcPotm].potmPts = MVP_WEIGHTS.POTM_BONUS;
  }
  Object.values(playerMap).forEach(p => {
    p.totalPts = Math.round(p.batPts + p.bowlPts + p.fieldPts + p.potmPts);
  });
  const mvps = Object.values(playerMap).sort((a, b) => b.totalPts - a.totalPts || b.bowlPts - a.bowlPts || b.batPts - a.batPts);

  // Tied / Joint Winners Logic
  // Bowlers: share top wickets and least runs conceded
  let topBowlerWinners = [];
  if (bowlers.length > 0 && bowlers[0].wickets > 0) {
    const topW = bowlers[0].wickets;
    const topR = bowlers[0].runs;
    topBowlerWinners = bowlers.filter(b => b.wickets === topW && b.runs === topR);
  } else if (bowlers.length > 0) {
    const topR = bowlers[0].runs;
    topBowlerWinners = bowlers.filter(b => b.wickets === 0 && b.runs === topR);
  }

  // Fielders: share top dismissals (> 0)
  let topFielderWinners = [];
  if (fielders.length > 0 && fielders[0].total > 0) {
    const topTot = fielders[0].total;
    topFielderWinners = fielders.filter(f => f.total === topTot);
  }

  // Batters: share top runs (> 0)
  let topBatterWinners = [];
  if (batters.length > 0 && batters[0].runs > 0) {
    const topR = batters[0].runs;
    topBatterWinners = batters.filter(b => b.runs === topR);
  } else if (batters.length > 0) {
    topBatterWinners = [batters[0]];
  }

  // MVPs: share top points (> 0)
  let matchMvpWinners = [];
  if (mvps.length > 0 && mvps[0].totalPts > 0) {
    const topPts = mvps[0].totalPts;
    matchMvpWinners = mvps.filter(m => m.totalPts === topPts);
  }

  const formatWinner = (winners) => {
    if (!winners || winners.length === 0) return null;
    if (winners.length === 1) return winners[0];
    const jointName = winners.map(w => w.name).join(' & ') + ' (Joint Winners)';
    return { ...winners[0], name: jointName, isJoint: true, winners };
  };

  const topBowlerWinner = formatWinner(topBowlerWinners);
  const topFielderWinner = formatWinner(topFielderWinners);
  const topBatterWinner = formatWinner(topBatterWinners);
  const matchMvpWinner = formatWinner(matchMvpWinners);

  return {
    batters,
    bowlers,
    fielders,
    mvps,
    topBatterWinner,
    topBowlerWinner,
    topFielderWinner,
    matchMvpWinner,
    topBatterWinners,
    topBowlerWinners,
    topFielderWinners,
    matchMvpWinners
  };
}

async function loadInitialData() {
  const bundled = window.CRC_DATA || window.FALLBACK_DATA;
  if (bundled) {
    teamData = bundled.team || {};
    playersData = bundled.players || [];
    matchesData = bundled.matches || [];
  } else {
    try {
      const [teamRes, playersRes, matchesRes] = await Promise.all([
        fetch('data/team.json'),
        fetch('data/players.json'),
        fetch('data/all_matches.json')
      ]);
      teamData = await teamRes.json();
      playersData = await playersRes.json();
      matchesData = await matchesRes.json();
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
    nameSpan.textContent = tMatch ? tMatch.tournament : selectedTournament;
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

function selectMobileTab(tabName) {
  switchTab(tabName);
  const menu = document.getElementById('mobile-nav-menu');
  if (menu) menu.classList.add('hidden');
  document.body.style.overflow = '';
  const icon = document.getElementById('mobile-menu-icon');
  if (icon) {
    icon.setAttribute('data-lucide', 'menu');
  }
  if (window.lucide) window.lucide.createIcons();
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
      btn.classList.toggle('text-slate-300', !isActive);
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
  renderOverviewTab();
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
  const tourneyText = selectedTournament === 'ALL' ? '' : ` • ${tourneyMatch ? tourneyMatch.tournament : selectedTournament}`;
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
function renderTournamentsTab() {
  const container = document.getElementById('tournaments-list');
  if (!container) return;

  // 1. CSK Indoor Tournament Season 3
  const cskMatches = matchesData.filter(m => m.tournamentId === 'csk-indoor-2026-s3');
  const cskWon = cskMatches.filter(m => m.outcome === 'WIN').length;
  const cskLost = cskMatches.filter(m => m.outcome === 'LOSS').length;
  const cskTotal = cskMatches.length;
  const cskWinRate = cskTotal > 0 ? Math.round((cskWon / cskTotal) * 100) : 0;

  // 2. Nemo CC 2026 S2
  const nemoMatches = matchesData.filter(m => m.tournamentId === 'nemo-cc-2026-s2');
  const wonCount = nemoMatches.filter(m => m.outcome === 'WIN').length;
  const lostCount = nemoMatches.filter(m => m.outcome === 'LOSS').length;
  const total = nemoMatches.length;
  const winRate = total > 0 ? Math.round((wonCount / total) * 100) : 0;

  container.innerHTML = `
    <!-- Tournament Card: CSK Indoor Tournament Season 3 (Latest) -->
    <div class="bg-slate-900/90 border border-amber-500/30 rounded-3xl p-6 shadow-xl relative overflow-hidden">
      <div class="flex flex-wrap justify-between items-start gap-2 mb-4 pb-3 border-b border-slate-800">
        <div>
          <div class="flex flex-wrap items-center gap-2 mb-2">
            <span class="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 leading-none">
              Season 2026-27 • Tournament 2
            </span>
            <span class="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700/60 leading-none">
              Indoor
            </span>
            <span class="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700/60 leading-none">
              Turf Wicket
            </span>
          </div>
          <h3 class="text-xl font-bold text-white">CSK Indoor Tournament Season 3</h3>
          <p class="text-xs text-slate-400">Venue: Mallow GAA, Cork • Result: Semi-Finalists 🎖️</p>
        </div>
        <span class="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
          Semi-Finals
        </span>
      </div>

      <!-- Quick Stats Row -->
      <div class="grid grid-cols-4 gap-2 text-center bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800/80 mb-5">
        <div>
          <span class="text-[10px] text-slate-400 block">Matches</span>
          <span class="font-mono font-bold text-white text-base">${cskTotal}</span>
        </div>
        <div>
          <span class="text-[10px] text-slate-400 block">Won</span>
          <span class="font-mono font-bold text-emerald-400 text-base">${cskWon}</span>
        </div>
        <div>
          <span class="text-[10px] text-slate-400 block">Lost</span>
          <span class="font-mono font-bold text-rose-400 text-base">${cskLost}</span>
        </div>
        <div>
          <span class="text-[10px] text-slate-400 block">Win Rate</span>
          <span class="font-mono font-bold text-amber-400 text-base">${cskWinRate}%</span>
        </div>
      </div>

      <!-- Highlights & Awards (Spacious Card Layout) -->
      <div class="space-y-2.5 mb-6 text-xs">
        <div class="bg-slate-950/60 border border-slate-800/80 p-3 rounded-xl">
          <span class="text-[11px] font-semibold text-slate-400 block mb-1">Top Run Scorer</span>
          <div class="text-sm font-bold text-white">Jenson (73 runs, HS 37, 8 sixes)</div>
        </div>
        <div class="bg-slate-950/60 border border-slate-800/80 p-3 rounded-xl">
          <span class="text-[11px] font-semibold text-slate-400 block mb-1">Top Wicket Takers</span>
          <div class="text-sm font-bold text-purple-400">Davison (3 wkts) • Savio (3 wkts) • Joyvin (2 wkts)</div>
        </div>
        <div class="bg-slate-950/60 border border-slate-800/80 p-3 rounded-xl">
          <span class="text-[11px] font-semibold text-slate-400 block mb-1">Player of the Match Awards</span>
          <div class="text-sm font-bold text-amber-300 flex items-center gap-1.5">
            <span>Davison (Pre-QF vs BD Tigers & QF vs Cork Indians)</span>
            <span>🌟🌟</span>
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex flex-wrap items-center gap-3">
        <button onclick="filterByTournament('csk-indoor-2026-s3')" class="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl shadow-lg transition-colors flex items-center gap-2">
          <i data-lucide="trophy" class="w-4 h-4"></i> View Tournament Matches (${cskTotal})
        </button>
        <button onclick="switchTab('leaderboard')" class="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl border border-slate-700 transition-colors flex items-center gap-2">
          <i data-lucide="award" class="w-4 h-4"></i> View Leaderboard
        </button>
      </div>
    </div>

    <!-- Tournament Card: Nemo CC 2026 S2 -->
    <div class="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
      <div class="flex flex-wrap justify-between items-start gap-2 mb-4 pb-3 border-b border-slate-800">
        <div>
          <div class="flex flex-wrap items-center gap-2 mb-2">
            <span class="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 leading-none">
              Season 2026-27 • First Tournament
            </span>
            <span class="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700/60 leading-none">
              Indoor
            </span>
            <span class="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700/60 leading-none">
              Turf Wicket
            </span>
          </div>
          <h3 class="text-xl font-bold text-white">Nemo Cricket Club Tournament 2026 S2</h3>
          <p class="text-xs text-slate-400">Venue: Nemo Rangers, Cork • Stage: Group B</p>
        </div>
        <span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
          Group Stage
        </span>
      </div>

      <!-- Quick Stats Row -->
      <div class="grid grid-cols-4 gap-2 text-center bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800/80 mb-5">
        <div>
          <span class="text-[10px] text-slate-400 block">Matches</span>
          <span class="font-mono font-bold text-white text-base">${total}</span>
        </div>
        <div>
          <span class="text-[10px] text-slate-400 block">Won</span>
          <span class="font-mono font-bold text-emerald-400 text-base">${wonCount}</span>
        </div>
        <div>
          <span class="text-[10px] text-slate-400 block">Lost</span>
          <span class="font-mono font-bold text-rose-400 text-base">${lostCount}</span>
        </div>
        <div>
          <span class="text-[10px] text-slate-400 block">Win Rate</span>
          <span class="font-mono font-bold text-amber-400 text-base">${winRate}%</span>
        </div>
      </div>

      <!-- Highlights & Awards (Spacious Card Layout) -->
      <div class="space-y-2.5 mb-6 text-xs">
        <div class="bg-slate-950/60 border border-slate-800/80 p-3 rounded-xl">
          <span class="text-[11px] font-semibold text-slate-400 block mb-1">Top Run Scorer</span>
          <div class="text-sm font-bold text-white">Yash (11 runs, HS 10*)</div>
        </div>
        <div class="bg-slate-950/60 border border-slate-800/80 p-3 rounded-xl">
          <span class="text-[11px] font-semibold text-slate-400 block mb-1">Top Wicket Takers</span>
          <div class="text-sm font-bold text-purple-400">Savio, Davison, Jenson (2 wkts each)</div>
        </div>
        <div class="bg-slate-950/60 border border-slate-800/80 p-3 rounded-xl">
          <span class="text-[11px] font-semibold text-slate-400 block mb-1">Player of the Match Awards</span>
          <div class="text-sm font-bold text-amber-300">
            Davison (Match 1) • Jenson (Match 3)
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex flex-wrap items-center gap-3">
        <button onclick="filterByTournament('nemo-cc-2026-s2')" class="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl shadow-lg transition-colors flex items-center gap-2">
          <i data-lucide="trophy" class="w-4 h-4"></i> View Tournament Matches (3)
        </button>
        <button onclick="switchTab('leaderboard')" class="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl border border-slate-700 transition-colors flex items-center gap-2">
          <i data-lucide="award" class="w-4 h-4"></i> View Leaderboard
        </button>
      </div>
    </div>

    <!-- Future Tournaments Placeholder -->
    <div class="bg-slate-900/40 border border-dashed border-slate-800 rounded-3xl p-6 flex flex-col items-center justify-center text-center">
      <div class="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
        <i data-lucide="calendar" class="w-6 h-6"></i>
      </div>
      <h4 class="font-bold text-white text-base mb-1">Upcoming Tournaments</h4>
      <p class="text-xs text-slate-400 max-w-sm mb-4">
        As Cork Royal Challengers competes in future indoor cups and outdoor summer leagues, each tournament will appear here with dedicated standings.
      </p>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();
}

// ----------------------------------------------------
// STATS & CAPS CALCULATION
// ----------------------------------------------------
function oversToBalls(overs) {
  if (typeof overs === 'string' && overs.includes('.')) {
    const [ov, b] = overs.split('.').map(Number);
    return (ov * 6) + (b || 0);
  }
  const ov = Math.floor(overs);
  const b = Math.round((overs - ov) * 10);
  return (ov * 6) + b;
}

function ballsToOvers(balls) {
  const ov = Math.floor(balls / 6);
  const b = balls % 6;
  return b > 0 ? `${ov}.${b}` : `${ov}`;
}

function calculateSeasonStats() {
  const stats = {};
  const filteredMatches = getFilteredMatches();

  playersData.forEach(p => {
    const cleanName = normalizePlayerName(p.name);
    stats[cleanName] = {
      player: p,
      name: cleanName,
      matches: 0,
      innings: 0,
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      highestScore: 0,
      isNotOutHighest: false,
      notOuts: 0,
      wickets: 0,
      ballsBowled: 0,
      overs: '0',
      maidens: 0,
      runsConceded: 0,
      dots: 0,
      bestBowling: { wkts: 0, runs: 999 },
      catches: 0,
      runouts: 0,
      potmCount: 0,
      mvpPoints: 0,
      recentScores: [],
      awards: {
        topBatter: 0,
        topBowler: 0,
        topFielder: 0,
        matchMvp: 0,
        total: 0
      }
    };
  });

  filteredMatches.forEach(match => {
    const crcPotm = getCrcPotm(match);
    if (crcPotm && stats[crcPotm]) {
      stats[crcPotm].potmCount += 1;
      stats[crcPotm].mvpPoints += MVP_WEIGHTS.POTM_BONUS;
    }

    // Tally CRC Match Awards for this match (crediting all tied/joint winners)
    const matchAwards = getMatchCrcAwards(match);
    (matchAwards.topBatterWinners || (matchAwards.topBatterWinner ? [matchAwards.topBatterWinner] : [])).forEach(w => {
      const n = w.name;
      if (!stats[n]) stats[n] = createEmptyPlayerStat(n);
      stats[n].awards.topBatter += 1;
      stats[n].awards.total += 1;
    });
    (matchAwards.topBowlerWinners || (matchAwards.topBowlerWinner ? [matchAwards.topBowlerWinner] : [])).forEach(w => {
      const n = w.name;
      if (!stats[n]) stats[n] = createEmptyPlayerStat(n);
      stats[n].awards.topBowler += 1;
      stats[n].awards.total += 1;
    });
    (matchAwards.topFielderWinners || (matchAwards.topFielderWinner ? [matchAwards.topFielderWinner] : [])).forEach(w => {
      const n = w.name;
      if (!stats[n]) stats[n] = createEmptyPlayerStat(n);
      stats[n].awards.topFielder += 1;
      stats[n].awards.total += 1;
    });
    (matchAwards.matchMvpWinners || (matchAwards.matchMvpWinner ? [matchAwards.matchMvpWinner] : [])).forEach(w => {
      const n = w.name;
      if (!stats[n]) stats[n] = createEmptyPlayerStat(n);
      stats[n].awards.matchMvp += 1;
      stats[n].awards.total += 1;
    });

    // Determine participating CRC players for this match (counted ONCE per match)
    const matchParticipants = new Set();
    if (Array.isArray(match.crcPlayingXI) && match.crcPlayingXI.length > 0) {
      match.crcPlayingXI.forEach(name => matchParticipants.add(normalizePlayerName(name)));
    } else {
      match.innings.forEach(inn => {
        if (isCrcTeam(inn)) {
          inn.batting.forEach(b => matchParticipants.add(normalizePlayerName(b.player)));
        } else {
          inn.bowling.forEach(bw => matchParticipants.add(normalizePlayerName(bw.bowler)));
        }
      });
    }

    matchParticipants.forEach(playerName => {
      if (!stats[playerName]) {
        stats[playerName] = createEmptyPlayerStat(playerName);
      }
      stats[playerName].matches += 1;
    });

    match.innings.forEach(inn => {
      const isCRC = isCrcTeam(inn);

      if (isCRC) {
        inn.batting.forEach(b => {
          const playerName = normalizePlayerName(b.player);
          if (!stats[playerName]) {
            stats[playerName] = createEmptyPlayerStat(playerName);
          }
          const p = stats[playerName];
          p.innings += 1;
          p.runs += b.runs;
          p.balls += b.balls;
          p.fours += b.fours;
          p.sixes += b.sixes;

          const isNotOut = b.dismissal.toLowerCase().includes('not out');
          if (isNotOut) p.notOuts += 1;

          if (b.runs > p.highestScore || (b.runs === p.highestScore && isNotOut)) {
            p.highestScore = b.runs;
            p.isNotOutHighest = isNotOut;
          }

          p.recentScores.push({ score: b.runs, isNotOut, matchId: match.id, opp: getOppositionName(match) });

          p.mvpPoints += (b.runs * MVP_WEIGHTS.RUN) + (b.fours * MVP_WEIGHTS.FOUR) + (b.sixes * MVP_WEIGHTS.SIX);
          if (b.runs >= 25) p.mvpPoints += MVP_WEIGHTS.MILESTONE_25;
        });
      } else {
        inn.bowling.forEach(bw => {
          const bowlerName = normalizePlayerName(bw.bowler);
          if (!stats[bowlerName]) {
            stats[bowlerName] = createEmptyPlayerStat(bowlerName);
          }
          const p = stats[bowlerName];

          p.ballsBowled = (p.ballsBowled || 0) + oversToBalls(bw.overs);
          p.maidens += bw.maidens || 0;
          p.runsConceded += bw.runs;
          p.wickets += bw.wickets;
          p.dots += bw.dots || 0;

          if (bw.wickets > p.bestBowling.wkts || (bw.wickets === p.bestBowling.wkts && bw.runs < p.bestBowling.runs)) {
            p.bestBowling = { wkts: bw.wickets, runs: bw.runs };
          }

          p.mvpPoints += (bw.wickets * MVP_WEIGHTS.WICKET) +
                         (bw.maidens * MVP_WEIGHTS.MAIDEN) +
                         (bw.dots * MVP_WEIGHTS.DOT_BALL);

          if (bw.overs >= 1 && (bw.runs / bw.overs) <= 6.0) {
            p.mvpPoints += MVP_WEIGHTS.ECONOMY_BONUS;
          }
        });

        inn.batting.forEach(b => {
          const d = b.dismissal;
          if (d.includes('c ') && !d.includes('c & b')) {
            const fielderMatch = d.match(/c ([^b]+) b /);
            if (fielderMatch && fielderMatch[1]) {
              const fielder = normalizePlayerName(fielderMatch[1].trim());
              if (stats[fielder]) {
                stats[fielder].catches += 1;
                stats[fielder].mvpPoints += MVP_WEIGHTS.CATCH;
              }
            }
          }
          if (d.includes('c & b ')) {
            const bowler = normalizePlayerName(d.replace('c & b ', '').trim());
            if (stats[bowler]) {
              stats[bowler].catches += 1;
              stats[bowler].mvpPoints += MVP_WEIGHTS.CATCH;
            }
          }
          if (d.includes('runout')) {
            const roFielder = d.match(/runout\s*\(([^)]+)\)/);
            if (roFielder && roFielder[1]) {
              const names = roFielder[1].split('/');
              names.forEach(n => {
                const cleanN = normalizePlayerName(n.trim());
                if (stats[cleanN]) {
                  stats[cleanN].runouts += 1;
                  stats[cleanN].mvpPoints += MVP_WEIGHTS.RUNOUT;
                }
              });
            }
          }
        });
      }
    });
  });

  Object.values(stats).forEach(p => {
    const outs = p.innings - p.notOuts;
    p.battingAvgNum = outs > 0 ? (p.runs / outs) : (p.runs > 0 ? p.runs : 0);
    p.battingAvg = outs > 0 ? (p.runs / outs).toFixed(1) : (p.runs > 0 ? `${p.runs}.0*` : '-');
    p.strikeRateNum = p.balls > 0 ? ((p.runs / p.balls) * 100) : 0;
    p.strikeRate = p.balls > 0 ? ((p.runs / p.balls) * 100).toFixed(1) : '-';
    
    p.overs = ballsToOvers(p.ballsBowled || 0);
    p.economyNum = p.ballsBowled > 0 ? (p.runsConceded / (p.ballsBowled / 6)) : 999;
    p.economy = p.ballsBowled > 0 ? (p.runsConceded / (p.ballsBowled / 6)).toFixed(2) : '-';
    p.totalFielding = p.catches + p.runouts;
    p.mvpPoints = Math.round(p.mvpPoints);
  });

  return stats;
}

function createEmptyPlayerStat(name) {
  return {
    player: { id: name.toLowerCase().replace(/\s+/g, '_'), name: name, role: 'Player', jerseyNumber: '-' },
    name: name,
    matches: 0,
    innings: 0,
    runs: 0,
    balls: 0,
    fours: 0,
    sixes: 0,
    highestScore: 0,
    isNotOutHighest: false,
    notOuts: 0,
    wickets: 0,
    ballsBowled: 0,
    overs: '0',
    maidens: 0,
    runsConceded: 0,
    dots: 0,
    bestBowling: { wkts: 0, runs: 999 },
    catches: 0,
    runouts: 0,
    potmCount: 0,
    mvpPoints: 0,
    recentScores: [],
    awards: {
      topBatter: 0,
      topBowler: 0,
      topFielder: 0,
      matchMvp: 0,
      total: 0
    }
  };
}

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

  const mvpLeader = [...playerList].sort((a, b) => b.mvpPoints - a.mvpPoints)[0];

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
    document.getElementById('mvp-leader-name').textContent = mvpLeader.name;
    document.getElementById('mvp-leader-points').textContent = `${mvpLeader.mvpPoints} Pts`;
    document.getElementById('mvp-leader-meta').textContent = `${mvpLeader.runs} Runs • ${mvpLeader.wickets} Wkts • ${mvpLeader.totalFielding} Dismissals`;
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
    <div class="sticky top-[64px] md:top-[105px] z-30 bg-slate-950/95 backdrop-blur-md pt-2 pb-3 mb-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 max-w-full">
      <div class="flex items-center gap-2.5 shrink-0">
        <button onclick="backToMatchesList()" class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-semibold transition-all">
          <i data-lucide="arrow-left" class="w-4 h-4 text-amber-400"></i> Back to Matches
        </button>
        <span class="text-xs font-semibold text-slate-300 truncate">${match.matchTitle}</span>
      </div>

      <!-- Sub-Tabs on TOP (Scrollable horizontally inside tab bar only) -->
      <div class="w-full sm:w-auto max-w-full overflow-x-auto custom-scrollbar pb-1 sm:pb-0">
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
              <div class="font-bold text-white text-sm cursor-pointer hover:text-amber-400 truncate" onclick="openPlayerProfileByName('${awards.matchMvpWinner.name}')">
                ${awards.matchMvpWinner.name}
              </div>
              <div class="font-mono text-red-300 text-xs font-bold mt-0.5">
                ${awards.matchMvpWinner.totalPts} MVP Points
              </div>
            </div>
          ` : ''}

          ${awards.topBatterWinner ? `
            <div class="p-3 bg-slate-950/70 border border-amber-500/30 rounded-xl">
              <span class="text-[10px] text-amber-400 uppercase font-bold block mb-0.5">🏏 Top CRC Batter</span>
              <div class="font-bold text-white text-sm cursor-pointer hover:text-amber-400 truncate" onclick="openPlayerProfileByName('${awards.topBatterWinner.name}')">
                ${awards.topBatterWinner.name}
              </div>
              <div class="font-mono text-amber-400 text-xs mt-0.5">
                ${awards.topBatterWinner.runs} runs (${awards.topBatterWinner.balls}b, ${awards.topBatterWinner.sixes}x6)
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
                ${awards.topBowlerWinner.wickets}/${awards.topBowlerWinner.runs} (${awards.topBowlerWinner.overs} ov)
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
        <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div class="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
            <h4 class="font-bold text-white text-sm flex items-center gap-2">
              <i data-lucide="play-circle" class="w-4 h-4 text-amber-400"></i>
              ${inn.team} - Over Progression
            </h4>
            <span class="text-xs font-mono font-bold text-slate-300">${inn.runs}/${inn.wickets} (${inn.overs} ov)</span>
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

  const renderPodiumItem = (place, name, mainStat, subStat, highlightColor = 'amber', isJoint = false) => {
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
      <div class="flex items-center justify-between p-3 rounded-xl border ${ringColor} transition-colors">
        <div class="flex items-center gap-2.5 min-w-0 mr-2">
          <span class="text-xl shrink-0">${medal}</span>
          <div class="min-w-0">
            <div class="font-bold text-white text-xs sm:text-sm flex items-center gap-1.5 flex-wrap">
              <span>${name}</span>
              ${place === 1 ? `<span class="px-1.5 py-0.2 rounded text-[9px] bg-amber-500/20 text-amber-300 font-black border border-amber-500/30 shrink-0">${isJoint ? 'JOINT WINNER' : 'WINNER'}</span>` : ''}
            </div>
          </div>
        </div>
        <div class="text-right shrink-0">
          <div class="font-mono font-bold text-xs sm:text-sm text-${highlightColor}-400">${mainStat}</div>
          <div class="text-[10px] text-slate-400 font-mono">${subStat}</div>
        </div>
      </div>
    `;
  };

  const getPodiumRanking = (list, tieFn) => {
    return list.slice(0, 3).map((item, idx, arr) => {
      let place = idx + 1;
      let isJoint = false;
      if (idx === 0 && arr.length > 1 && tieFn(arr[0], arr[1])) {
        isJoint = true;
      } else if (idx === 1 && tieFn(arr[0], arr[1])) {
        place = 1;
        isJoint = true;
      }
      return { item, place, isJoint };
    });
  };

  return `
    <div class="space-y-6">
      <!-- 1. Match Honors Spotlight Banner (Match MVP First!) -->
      <div class="bg-gradient-to-r from-amber-950/60 via-slate-900 to-slate-900 border border-amber-500/40 rounded-2xl p-5 shadow-xl">
        <div class="flex flex-wrap justify-between items-center gap-2 mb-3 pb-2 border-b border-amber-500/20">
          <div class="flex items-center gap-2">
            <span class="text-xl">🏆</span>
            <div>
              <h3 class="font-black text-white text-base">Match Honors & Accolades (CRC)</h3>
              <p class="text-xs text-slate-400">Top individual match achievements for Cork Royal Challengers</p>
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
            <div class="font-bold text-white text-sm truncate" title="${awards.matchMvpWinner ? awards.matchMvpWinner.name : 'N/A'}">${awards.matchMvpWinner ? awards.matchMvpWinner.name : 'N/A'}</div>
            <div class="text-xs font-mono text-red-300 font-bold mt-0.5">
              ${awards.matchMvpWinner ? `${awards.matchMvpWinner.totalPts} MVP Points` : '-'}
            </div>
          </div>

          <!-- Top Batter Card -->
          <div class="p-3 bg-slate-950/70 border border-amber-500/30 rounded-xl">
            <span class="text-[10px] text-amber-400 font-bold uppercase tracking-wider block mb-1">🏏 Top Batter</span>
            <div class="font-bold text-white text-sm truncate" title="${awards.topBatterWinner ? awards.topBatterWinner.name : 'N/A'}">${awards.topBatterWinner ? awards.topBatterWinner.name : 'N/A'}</div>
            <div class="text-xs font-mono text-amber-300 font-semibold mt-0.5">
              ${awards.topBatterWinner ? `${awards.topBatterWinner.runs} runs (${awards.topBatterWinner.balls}b)` : '-'}
            </div>
          </div>

          <!-- Top Bowler Card -->
          <div class="p-3 bg-slate-950/70 border border-purple-500/30 rounded-xl">
            <span class="text-[10px] text-purple-400 font-bold uppercase tracking-wider block mb-1">🎯 Top Bowler</span>
            <div class="font-bold text-white text-sm truncate" title="${awards.topBowlerWinner ? awards.topBowlerWinner.name : 'N/A'}">${awards.topBowlerWinner ? awards.topBowlerWinner.name : 'N/A'}</div>
            <div class="text-xs font-mono text-purple-300 font-semibold mt-0.5">
              ${awards.topBowlerWinner ? `${awards.topBowlerWinner.wickets}/${awards.topBowlerWinner.runs} (${awards.topBowlerWinner.overs} ov)` : '-'}
            </div>
          </div>

          <!-- Top Fielder Card -->
          <div class="p-3 bg-slate-950/70 border border-sky-500/30 rounded-xl">
            <span class="text-[10px] text-sky-400 font-bold uppercase tracking-wider block mb-1">🧤 Top Fielder</span>
            <div class="font-bold text-white text-sm truncate" title="${awards.topFielderWinner ? awards.topFielderWinner.name : 'None'}">${awards.topFielderWinner ? awards.topFielderWinner.name : 'None'}</div>
            <div class="text-xs font-mono text-sky-300 font-semibold mt-0.5">
              ${awards.topFielderWinner ? `${awards.topFielderWinner.total} dis (${awards.topFielderWinner.catches}c, ${awards.topFielderWinner.runouts}ro)` : '0 dismissals'}
            </div>
          </div>
        </div>
      </div>

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
              getPodiumRanking(awards.mvps, (a, b) => a.totalPts === b.totalPts).map(({ item: p, place, isJoint }) =>
                renderPodiumItem(
                  place,
                  p.name,
                  `${p.totalPts} MVP Pts`,
                  `Bat: +${Math.round(p.batPts)} • Bowl: +${Math.round(p.bowlPts)} • Fld: +${Math.round(p.fieldPts)}${p.potmPts ? ' • POTM: +20' : ''}`,
                  'red',
                  isJoint
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
            <span class="text-[11px] text-slate-400">Ranked by Runs & SR</span>
          </div>
          <div class="space-y-2">
            ${awards.batters.length === 0 ? '<div class="text-xs text-slate-500 py-3 text-center">No batting data recorded</div>' :
              getPodiumRanking(awards.batters, (a, b) => a.runs === b.runs).map(({ item: b, place, isJoint }) =>
                renderPodiumItem(
                  place,
                  b.name,
                  `${b.runs} Runs (${b.balls}b)`,
                  `SR ${b.sr} • ${b.sixes}x6, ${b.fours}x4 • ${b.isNotOut ? 'Not Out' : 'Out'}`,
                  'amber',
                  isJoint
                )
              ).join('')
            }
          </div>
        </div>

        <!-- Category 3: Top Bowlers (Top 3 with Joint Winners Support) -->
        <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
          <div class="flex justify-between items-center pb-2 border-b border-slate-800">
            <h4 class="font-bold text-white text-sm flex items-center gap-2">
              <span class="text-base">🎯</span> Top CRC Bowlers (Top 3)
            </h4>
            <span class="text-[11px] text-slate-400">Ranked by Wkts & Economy</span>
          </div>
          <div class="space-y-2">
            ${awards.bowlers.length === 0 ? '<div class="text-xs text-slate-500 py-3 text-center">No bowling data recorded</div>' :
              getPodiumRanking(awards.bowlers, (a, b) => a.wickets === b.wickets && a.runs === b.runs).map(({ item: bw, place, isJoint }) =>
                renderPodiumItem(
                  place,
                  bw.name,
                  `${bw.wickets}/${bw.runs} (${bw.overs} ov)`,
                  `Econ ${bw.economy} • ${bw.maidens} Mdns • ${bw.dots} Dots`,
                  'purple',
                  isJoint
                )
              ).join('')
            }
          </div>
        </div>

        <!-- Category 4: Top Fielders (Top 3 with Joint Winners Support) -->
        <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
          <div class="flex justify-between items-center pb-2 border-b border-slate-800">
            <h4 class="font-bold text-white text-sm flex items-center gap-2">
              <span class="text-base">🧤</span> Top CRC Fielders (Top 3)
            </h4>
            <span class="text-[11px] text-slate-400">Catches, Run-outs & Stumpings</span>
          </div>
          <div class="space-y-2">
            ${awards.fielders.length === 0 ? '<div class="text-xs text-slate-500 py-3 text-center">No fielding dismissals in this innings</div>' :
              getPodiumRanking(awards.fielders, (a, b) => a.total === b.total && a.catches === b.catches && a.runouts === b.runouts).map(({ item: f, place, isJoint }) =>
                renderPodiumItem(
                  place,
                  f.name,
                  `${f.total} Dismissal${f.total > 1 ? 's' : ''}`,
                  `${f.catches} Catches • ${f.runouts} Run-outs${f.stumpings ? ' • ' + f.stumpings + ' St' : ''}`,
                  'sky',
                  isJoint
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
  container.innerHTML = match.innings.map((inn, idx) => renderInningsScorecard(inn, idx + 1)).join('');

  if (window.lucide) window.lucide.createIcons();
}

function renderInningsScorecard(inn, inningsNum) {
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

      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead>
            <tr class="bg-slate-950/60 text-slate-400 border-b border-slate-800">
              <th class="py-2.5 px-4 font-semibold">Batter</th>
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
                  <td class="py-2.5 px-4 font-medium text-white flex items-center gap-1.5">
                    <span class="cursor-pointer hover:text-amber-400" onclick="openPlayerProfileByName('${cleanPlayer}')">${cleanPlayer}</span>
                    ${b.dismissal.toLowerCase().includes('not out') ? '<span class="text-emerald-400 text-[10px]">*</span>' : ''}
                  </td>
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
              <td class="py-2 px-4" colspan="2">Extras (${formatExtras(inn.extras)})</td>
              <td class="py-2 px-3 text-right font-bold font-mono text-white">${inn.extras?.total || 0}</td>
              <td colspan="4" class="py-2 px-4 text-right text-slate-400 text-[11px]">(Overs: ${inn.overs}, RR: ${inn.runRate})</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="border-t border-slate-800 overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead>
            <tr class="bg-slate-950/60 text-slate-400 border-b border-slate-800">
              <th class="py-2.5 px-4 font-semibold">Bowler</th>
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
                  <td class="py-2.5 px-4 font-medium text-white cursor-pointer hover:text-amber-400" onclick="openPlayerProfileByName('${cleanBowler}')">
                    ${cleanBowler}
                  </td>
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

  const labels = ['0', 'Ov 1', 'Ov 2', 'Ov 3', 'Ov 4', 'Ov 5'];

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

  const overLabels = ['Over 1', 'Over 2', 'Over 3', 'Over 4', 'Over 5'];
  const crcOverRuns = [0, 0, 0, 0, 0];
  if (crcInnings?.overProgression) {
    crcInnings.overProgression.forEach((o, i) => { if (i < 5) crcOverRuns[i] = o.runs; });
  }

  const oppOverRuns = [0, 0, 0, 0, 0];
  if (oppInnings?.overProgression) {
    oppInnings.overProgression.forEach((o, i) => { if (i < 5) oppOverRuns[i] = o.runs; });
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

  const bowlingList = [...playerList].filter(p => p.overs > 0);
  bowlingList.sort((a, b) => {
    let valA = a[bowlingSort.col];
    let valB = b[bowlingSort.col];
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

  const mvpList = [...playerList];
  mvpList.sort((a, b) => {
    let valA = a[mvpSort.col];
    let valB = b[mvpSort.col];
    if (typeof valA === 'string') return mvpSort.asc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    return mvpSort.asc ? valA - valB : valB - valA;
  });

  const mvpTbody = document.getElementById('leaderboard-mvp-body');
  if (mvpTbody) {
    mvpTbody.innerHTML = mvpList.map((p, idx) => `
      <tr class="hover:bg-slate-800/40 transition-colors border-l-4 ${idx === 0 ? 'border-amber-400 bg-amber-500/10' : 'border-transparent'}">
        <td class="py-3 px-4 font-mono font-bold ${idx === 0 ? 'text-amber-400' : 'text-slate-400'}">
          ${idx + 1}
        </td>
        <td class="py-3 px-4 font-semibold text-white cursor-pointer hover:text-amber-400" onclick="openPlayerProfileByName('${p.name}')">
          ${p.name}
        </td>
        <td class="py-3 px-3 text-right font-mono font-black text-amber-400 text-sm">${p.mvpPoints}</td>
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
          ${p.mvpPoints}
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
  const mvpLeader = [...mvpList].sort((a, b) => b.mvpPoints - a.mvpPoints)[0];
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
    mvpPill.textContent = `MVP Leader: ${mvpLeader.name} (${mvpLeader.mvpPoints} Pts)`;
  }
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
            <span class="font-bold text-slate-200 font-mono">${p.mvpPoints}</span>
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
    historyList.innerHTML = matchesData.map(match => {
      const crcInnings = match.innings.find(i => isCrcTeam(i));
      const oppInnings = match.innings.find(i => !isCrcTeam(i));

      const batRecord = crcInnings?.batting.find(b => normalizePlayerName(b.player) === p.name);
      const bowlRecord = oppInnings?.bowling.find(bw => normalizePlayerName(bw.bowler) === p.name);

      const isParticipant = (match.crcPlayingXI && match.crcPlayingXI.some(n => normalizePlayerName(n) === p.name))
        || !!batRecord || !!bowlRecord;

      if (!isParticipant) return '';

      const awards = getMatchCrcAwards(match);
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
              ${batRecord ? `<div class="font-mono font-bold text-amber-400">Bat: ${batRecord.runs} (${batRecord.balls}b, ${batRecord.sixes}x6)</div>` : (!bowlRecord ? `<div class="font-mono text-slate-400 text-[11px]">Did Not Bat</div>` : '')}
              ${bowlRecord ? `<div class="font-mono text-sky-400">Bowl: ${bowlRecord.overs} ov, ${bowlRecord.wickets}-${bowlRecord.runs}</div>` : ''}
            </div>
          </div>
          ${(isPotm || isMatchMvp || isTopBatter || isTopBowler || isTopFielder) ? `
            <div class="flex flex-wrap gap-1 pt-1.5 border-t border-slate-800/80">
              ${isPotm ? `<span class="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 font-black border border-amber-500/40">🏆 POTM</span>` : ''}
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

