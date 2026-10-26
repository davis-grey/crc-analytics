/** Browserless regression tests for statistics, filters and tournament templates. */
const fs = require('fs');
const vm = require('vm');
const assert = require('node:assert/strict');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const data = JSON.parse(read('data/all_matches.json'));
const players = JSON.parse(read('data/players.json'));
const tournaments = JSON.parse(read('data/tournaments.json'));
const baseline = JSON.parse(read('tests/legacy_stats_snapshot.json'));
let html = '';
const container = { set innerHTML(value) { html = value; }, get innerHTML() { return html; }, onclick: null };
const context = { console, window: {}, document: {
  addEventListener() {},
  getElementById(id) { return id === 'tournaments-list' ? container : null; }
}};
vm.createContext(context);
vm.runInContext(read('stats.js'), context);
vm.runInContext(read('app.js'), context);
context.__data = data;
context.__players = players;
context.__tour = tournaments;
vm.runInContext('matchesData=__data; playersData=__players; tournamentsData=__tour;', context);
const evalJson = expr => JSON.parse(vm.runInContext(`JSON.stringify(${expr})`, context));

// Verify that the original seven matches and season statistics are unchanged.
// Compare only the original seven source match IDs. New tournament fixtures
// must be allowed without regenerating a historical snapshot or editing tests.
const historicalMatchIds = baseline.awards.map(a => a.id);
context.__historicalIds = historicalMatchIds;
vm.runInContext('matchesData=__data.filter(m=>__historicalIds.includes(m.id));', context);
assert.equal(evalJson('matchesData.length'), 7);
const result = evalJson(`Object.fromEntries(Object.entries(calculateSeasonStats()).map(([name,p])=>[name,{
    matches:p.matches,runs:p.runs,wickets:p.wickets,potmCount:p.potmCount
  }]))`);
const historicalRawStats = Object.fromEntries(Object.entries(baseline.stats).map(([name, {mvpPoints, ...raw}]) => [name, raw]));
assert.deepEqual(result, historicalRawStats, 'Historical scorecard stats or official POTM counts changed');
// v1 MVP values are archived, not an assertion for the intentionally changed v2 formula.
vm.runInContext('matchesData=__data;', context);
// Corrected tournament appearances: 8 participants in each CSK match.
const cskCounts = evalJson(`(() => { const mm=matchesData.filter(m => m.tournamentId==='csk-indoor-2026-s3');
  return Object.fromEntries(['Jenson','Srikanth','Savio','Joyvin','Yash','Avinash','Davison','Joy D','Rifaz'].map(
    name=>[name,mm.filter(m=>m.crcPlayingXI.includes(name)).length])); })()`);
for (const name of ['Jenson','Srikanth','Savio','Joyvin','Yash','Avinash','Davison']) assert.equal(cskCounts[name],4,name);
assert.equal(cskCounts['Joy D'],3);
assert.equal(cskCounts['Rifaz'],1);
assert.equal(evalJson('oversToBalls("1.4")'), 10);
assert.equal(evalJson('oversToBalls(3.5)'), 23);
assert.equal(evalJson('normalizePlayerName("Savio Rodrigues")'), 'Savio');
assert.equal(evalJson('normalizePlayerName("Savio Lobo")'), 'Savio Lobo');
assert.equal(evalJson('normalizePlayerName("Savio")'), 'Savio');
const economy = evalJson(`(() => { const m=JSON.parse(JSON.stringify(matchesData.find(x=>x.id==='krfk8788')));
  const opp=m.innings.find(i=>i.shortName!=='CRC');
  opp.bowling[0].overs='1.4'; opp.bowling[0].runs=10;
  return getMatchCrcAwards(m).bowlers.find(b=>b.name==='Yash').economy;
})()`);
assert.equal(economy, '6.00', '1.4 cricket overs must equal 10 balls, 10 runs = 6.00 economy');
// A caught-and-bowled wicket and a recorded runout must credit fielding points.
const fielderAwards = evalJson(`getMatchCrcAwards(matchesData.find(m=>m.id==='hvup2795')).fielders`);
assert.ok(fielderAwards.some(f => f.name === 'Srikanth' && f.catches >= 1));
assert.ok(fielderAwards.some(f => f.name === 'Rifaz' && f.runouts >= 1));

// Synthetic stumping verifies match/season fielding scoring stay in sync.
const stumpMatch = JSON.parse(JSON.stringify(data.find(m => m.id === 'krfk8788')));
stumpMatch.id = 'synthetic-stumping';
stumpMatch.crcPlayingXI.push('Joy D');
stumpMatch.innings.find(i=>i.shortName!=='CRC').batting[0].dismissal = 'st Joy D b Davison';
context.__stumpMatch=stumpMatch;
vm.runInContext('matchesData=[__stumpMatch];',context);
const stumping = evalJson(`({match: getMatchCrcAwards(matchesData[0]).fielders.find(f=>f.name==='Joy D'),
    season: calculateSeasonStats()['Joy D']})`);
assert.equal(stumping.match.stumpings, 1);
assert.equal(stumping.season.stumpings, 1);
assert.equal(stumping.season.mvpPoints, 12);
vm.runInContext('matchesData=__data;', context);

// Each existing tournament renders via the SAME template.
vm.runInContext('renderTournamentsTab()', context);
assert.match(html, /CSK Indoor Tournament Season 3/);
assert.match(html, /Nemo Cricket Club Tournament 2026 S2/);
assert.match(html, /Jenson \(73 runs/);
assert.match(html, /View Tournament Matches \(4\)/);

// New tournament AND match appear with no edits to UI code.
const demo = JSON.parse(JSON.stringify(data.find(x=>x.id==='krfk8788')));
demo.id='future-sample';
demo.tournamentId='new-club-cup';
demo.tournament='November Cup';
demo.date='2026-11-08';
const tour={ id:'new-club-cup', name:'November Cup', season:'2026-27', date:'2026-11-08', sequence:3, venue:'Cork', environment:'Outdoor', pitchType:'Astro', placement:'Group', stageNote:'Group' };
context.__futureMatch=demo;
context.__futureTournament=tour;
vm.runInContext('matchesData.push(__futureMatch); tournamentsData.push(__futureTournament);renderTournamentsTab()', context);
assert.match(html,/November Cup/);
assert.match(html,/View Tournament Matches \(1\)/);
assert.match(html,/data-tournament-id="new-club-cup"/);
const xss = evalJson(`escapeHtml('<img src=x onerror=alert(1)>')`);
assert.equal(xss, '&lt;img src=x onerror=alert(1)&gt;');
vm.runInContext('selectedTournament="new-club-cup";',context);
assert.equal(evalJson('getFilteredMatches().length'),1);
assert.equal(evalJson('Object.values(calculateSeasonStats()).filter(p=>p.matches>0).length'),7);
vm.runInContext('selectedEnvironment="Outdoor";',context);
assert.equal(evalJson('getFilteredMatches().length'),0);
// Winner tags use a shared podium template in all four award categories and
// must not collide with the stat breakdown on mobile. This covers ALL matches,
// not only the quarter-final shown in the user's screenshot.
vm.runInContext('matchesData=__data;', context);
const renderedAwardHtml = data.map(m => { context.__match = m; return vm.runInContext('renderMatchAwardsSubTab(__match)', context); });
for (const awardHtml of renderedAwardHtml) {
  assert.doesNotMatch(awardHtml, /JOINT WINNER|\(Joint Winners\)/i);
  assert.match(awardHtml, /podium-entry grid grid-cols-1/);
  assert.match(awardHtml, /podium-stats min-w-0/);
  assert.doesNotMatch(awardHtml, /text-sm truncate/);
}
const quarterFinal = renderedAwardHtml[data.findIndex(m => m.id === 'csk-s3-m3-corkindians')];
assert.match(quarterFinal, /Davison<\/span>\s*<span[^>]*>WINNER<\/span>/);
assert.doesNotMatch(quarterFinal, /Savio<\/span>\s*<span[^>]*>WINNER<\/span>/);
assert.ok((quarterFinal.match(/>WINNER<\/span>/g) || []).length >= 4, 'Quarter-final should show discipline and statistical winners');
const quarterAwards = evalJson('getMatchCrcAwards(matchesData.find(m=>m.id==="csk-s3-m3-corkindians"))');
assert.ok(quarterAwards.topBowlerWinners.some(p=>p.name==='Davison'));
assert.equal(quarterAwards.topBowlerWinners.length, 1, 'Extra dot makes Davison the sole v2 bowling leader');
assert.equal(quarterAwards.topBowlerWinner.name, 'Davison');
assert.equal(quarterAwards.matchMvpWinner.name, 'Srikanth');
assert.equal(quarterAwards.topFielderWinner.name, 'Avinash & Joy D');
assert.match(quarterFinal, /30\.8 MVP Pts/);
assert.match(quarterFinal, /Avinash &amp; Joy D|Avinash & Joy D/);
// Spotlight cards must show the full names of tied winners without ellipses.
assert.doesNotMatch(quarterFinal, /class="font-bold text-white text-sm truncate"/);
// The actual UI markup for a tied award must have two separately labelled winners.
const winnerRows = [...quarterFinal.matchAll(/<div class="podium-entry[\s\S]*?<\/div>\s*<\/div>/g)].map(x=>x[0]);
assert.ok(winnerRows.some(row=>row.includes('Davison')&&row.includes('WINNER')));
assert.ok(winnerRows.some(row=>row.includes('Joy D')&&row.includes('WINNER')));

console.log('PASS: historical raw stats, MVP v2, cricket overs, identities, new tournaments, filters, HTML escaping, responsive winner tags');
