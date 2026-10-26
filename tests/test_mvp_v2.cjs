/** Formula tests plus an independent exact-arithmetic audit of canonical JSON. */
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const matches = JSON.parse(read('data/all_matches.json'));
const context = { console, window: {}, document: { addEventListener() {}, getElementById() { return null; } } };
vm.createContext(context);
vm.runInContext(read('stats.js') + '\n' + read('app.js'), context);
context.__matches = matches;
context.__players = JSON.parse(read('data/players.json'));
vm.runInContext('matchesData=__matches; playersData=__players;', context);
const run = code => vm.runInContext(code, context);
const json = code => JSON.parse(run(`JSON.stringify(${code})`));
const near = (actual, expected, label) => assert.ok(Math.abs(actual-expected) < 1e-10, `${label}: ${actual} != ${expected}`);
let checks = 0;
function test(name, fn) { fn(); checks++; console.log(`PASS: ${name}`); }

test('all seven matches agree with independent Fraction audit, all disciplines and participants', () => {
  const oracle = JSON.parse(execFileSync(process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3'), [path.join(__dirname, 'mvp_v2_audit.py')], { encoding:'utf8' }));
  assert.equal(oracle.matches.length, matches.length);
  for (const expected of oracle.matches) {
    context.__id=expected.id;
    const actual=json('getMatchCrcAwards(matchesData.find(m=>m.id===__id))');
    near(actual.baseline.rpb, expected.rpb, expected.id+' RPB');
    assert.equal(actual.baseline.legalBalls, expected.legalBalls);
    assert.equal(actual.baseline.scheduledOvers, expected.scheduledOvers);
    assert.deepEqual(actual.mvps.map(p=>p.name).sort(), expected.rankings.map(p=>p.name).sort());
    for (const score of expected.rankings) {
      const p=actual.mvps.find(p=>p.name===score.name);
      for (const key of ['batPts','bowlPts','fieldPts','totalPts']) near(p[key],score[key],expected.id+' '+p.name+' '+key);
    }
    for (const [category,key] of [['batters','batPts'],['bowlers','bowlPts'],['fielders','fieldPts'],['mvps','totalPts']]) {
      for(let i=1;i<actual[category].length;i++) assert.ok(actual[category][i-1][key] >= actual[category][i][key]-1e-12);
    }
  }
  const season=json('calculateSeasonStats()');
  for (const p of oracle.season) {
    near(season[p.name].mvpPoints,p.points,'Season '+p.name);
    for(const key of ['battingImpact','bowlingImpact','fieldingImpact']) near(season[p.name][key],p[key],'Season '+p.name+' '+key);
    assert.equal(season[p.name].matches,p.matches);
    assert.equal(season[p.name].potmCount,p.potm);
  }
});

test('user regression references, Macroom includes recorded Jenson run-out', () => {
  const refs=[['hvup2795','Jenson',54.4],['idha0741','Jenson',30.1],['krfk8788','Davison',27.5],['csk-s3-m1-waterford','Jenson',57.0],['csk-s3-m2-bdtigers','Davison',52.8],['csk-s3-m3-corkindians','Srikanth',30.8],['csk-s3-m4-ashbourne','Yash',21.0]];
  for (const [id,name,points] of refs) {
    context.__id=id;
    const p=json('getMatchCrcAwards(matchesData.find(m=>m.id===__id)).mvps[0]');
    assert.equal(p.name,name); assert.equal(Number(p.totalPts.toFixed(1)),points);
    if(id==='hvup2795') {near(p.bowlPts,42.38461538461539,'Macroom bowling'); assert.equal(p.fieldPts,12);}
  }
});

test('milestones at exact scheduled 3x and 5x thresholds, additive to strike impact', () => {
  for (const [overs,runs,points] of [[5,14,18],[5,15,25],[5,24,43],[5,25,50],[4,11,12],[4,12,19],[4,20,40]]) {
    context.__input={runs,balls:10,fours:0,sixes:0}; context.__base={scheduledOvers:overs,rpb:1};
    near(run('calculateBattingImpact(__input,__base).batPts'),points,`${overs} overs ${runs} runs`);
  }
  near(run('calculateBattingImpact({runs:10,balls:6,fours:1,sixes:1},{scheduledOvers:5,rpb:1}).batPts'),17,'boundary bonuses');
});

test('legal balls, charged extras, maidens and multiple overs have no multiplier or economy bonus', () => {
  near(run('calculateBowlingImpact({overs:2,runs:16,wickets:1,dots:5,maidens:0},{rpb:1}).bowlPts'),19,'two overs');
  near(run('calculateBowlingImpact({overs:"1.4",runs:10,wickets:1,dots:3,maidens:1},{rpb:1.2}).bowlPts'),38,'ten legal balls');
  near(run('calculateBowlingImpact({overs:"0.1",runs:6,wickets:0,dots:0,maidens:0},{rpb:2}).bowlPts'),-6,'one legal ball');
  // Charged no-ball / wide runs stay in runs conceded; their deliveries are not added to overs.
  near(run('calculateBowlingImpact({overs:1,runs:8,wickets:0,dots:2,maidens:0,wd:1,nb:1},{rpb:1}).bowlPts'),-1,'extras');
});

test('official POTM has zero effect, season is sum of unrounded match scores', () => {
  const fixture=structuredClone(matches[0]);fixture.playerOfTheMatch='Davison';context.__fixture=fixture;
  assert.deepEqual(json('getMatchCrcAwards(__fixture)'),json('getMatchCrcAwards(matchesData[0])'));
  const scores=json('calculateSeasonStats()');
  for(const p of Object.values(scores)) {
    context.__name=p.name;
    near(p.mvpPoints,run('matchesData.reduce((sum,m)=>sum+(getMatchCrcAwards(m).mvps.find(p=>p.name===__name)?.totalPts||0),0)'),p.name);
  }
  assert.ok(scores.Jenson.mvpPoints !== Number(scores.Jenson.mvpPoints.toFixed(1)));
});

test('discipline negatives, all-negative winners and season totals remain negative', () => {
  const fixture=structuredClone(matches[0]);fixture.crcPlayingXI=['Jenson','Savio'];
  const crc=fixture.innings.find(i=>i.shortName==='CRC'),opp=fixture.innings.find(i=>i.shortName!=='CRC');
  crc.runs=50;crc.overs='5.0';opp.runs=50;opp.overs='5.0';
  crc.batting=['Jenson','Savio'].map(player=>({player,runs:0,balls:10,fours:0,sixes:0,dismissal:'not out'}));
  opp.batting=[];opp.bowling=['Jenson','Savio'].map(bowler=>({bowler,overs:1,runs:25,wickets:0,maidens:0,dots:0}));
  context.__negative=fixture;
  const awards=json('getMatchCrcAwards(__negative)');
  assert.ok(awards.mvps.every(p=>p.batPts<0 && p.bowlPts<0 && p.totalPts<0));
  assert.deepEqual(awards.matchMvpWinners.map(p=>p.name),['Jenson','Savio']);
  assert.deepEqual(awards.topBatterWinners.map(p=>p.name),['Jenson','Savio']);
  assert.deepEqual(awards.topBowlerWinners.map(p=>p.name),['Jenson','Savio']);
  const markup=run('renderMatchAwardsSubTab(__negative)');
  assert.match(markup,/Bat: -16\.7 • Bowl: -22\.5 • Fld: \+0\.0/);
  assert.match(markup,/-39\.2 MVP Pts/);assert.doesNotMatch(markup,/\+-|JOINT WINNER/);
  run('matchesData=[__negative];');assert.ok(json('calculateSeasonStats()').Jenson.mvpPoints<0);
  run('matchesData=__matches;');
});

test('ties include every tied third place; full precision separates rounded lookalikes', () => {
  const rows=json('getCompetitionRanking(rankByPoints([{name:"A",points:12},{name:"B",points:10.04},{name:"C",points:10.03},{name:"D",points:10.03}],"points"),"points",3)');
  assert.deepEqual(rows.map(r=>r.place),[1,2,3,3]);
  assert.equal(run('formatMvpPoints(10.04)'),run('formatMvpPoints(10.03)'));
  assert.equal(run('sameMvpPoints(10.04,10.03)'),false);
  assert.equal(run('sameMvpPoints(0.1+0.2,0.3)'),true);
  assert.equal(run('formatMvpPoints(-0.0001)'),'0.0');
});

test('wickets from bowler figures, caught-and-bowled and fielders containing b parsed correctly', () => {
  assert.equal(run('calculateFieldingImpact({catches:1,runouts:1,stumpings:1})'),32);
  const fixture=structuredClone(matches[0]);fixture.innings.find(i=>i.shortName!=='CRC').batting=[
    {dismissal:'c Savio Lobo b Davison'}, {dismissal:'st Savio Lobo b Davison'},
    {dismissal:'c & b Srikanth'}, {dismissal:'runout (Rifaz/Jenson)',runoutFielder:'Rifaz'}];
  context.__fixture=fixture;
  const awards=json('getMatchCrcAwards(__fixture)');
  assert.equal(awards.fielders.find(p=>p.name==='Savio Lobo').fieldPts,20);
  assert.equal(awards.fielders.find(p=>p.name==='Srikanth').catches,1);
  assert.equal(awards.fielders.find(p=>p.name==='Rifaz').runouts,1);
  assert.equal(awards.bowlers.find(p=>p.name==='Davison').wickets,1,'do not infer extra bowler wickets from dismissals');
});

test('Cork Indians exact baseline and statistical podium, official POTM independent', () => {
  const m=matches.find(m=>m.id==='csk-s3-m3-corkindians'); context.__fixture=m;
  const a=json('getMatchCrcAwards(__fixture)');
  assert.equal(a.baseline.runs,59); assert.equal(a.baseline.legalBalls,52);
  near(a.baseline.rpb,59/52,'RPB');near(a.baseline.rpo,59/52*6,'RPO');
  assert.deepEqual(a.mvps.slice(0,3).map(p=>p.name),['Srikanth','Davison','Savio']);
  const sri=a.mvps[0],dav=a.mvps[1],sav=a.mvps[2];
  near(sri.batPts,21-7*59/52,'Srikanth batting');
  near(sri.bowlPts,21+1.5*(6*59/52-9),'Srikanth bowling');
  near(dav.bowlPts,23+1.5*(6*59/52-3),'Davison bowling');
  near(sav.bowlPts,22+1.5*(6*59/52-3),'Savio bowling');
  assert.deepEqual(a.mvps.slice(0,3).map(p=>p.totalPts.toFixed(1)),['30.8','28.7','27.7']);
  assert.equal(dav.batPts,0);assert.equal(sav.batPts,0);assert.equal(m.playerOfTheMatch,'Davison');
});

test('run-out receives one full credit, no inferred primary or missing assists', () => {
  const m=structuredClone(matches[0]), opp=m.innings.find(i=>i.shortName!=='CRC');
  opp.batting=[{dismissal:'runout (Rifaz/Jenson)'},{dismissal:'run out'}, {dismissal:'runout (Rifaz)',runoutFielder:'Rifaz'}];
  context.__fixture=m;
  let a=json('getMatchCrcAwards(__fixture)');
  assert.equal(a.fielders.length,1);assert.equal(a.fielders[0].runouts,1);assert.equal(a.fielders[0].fieldPts,12);
  opp.batting[0].runoutFielder='Jenson';
  a=json('getMatchCrcAwards(__fixture)');
  assert.equal(a.fielders.reduce((n,f)=>n+f.runouts,0),2);
  assert.equal(a.fielders.find(f=>f.name==='Jenson').fieldPts,12);
  assert.equal(a.fielders.find(f=>f.name==='Rifaz').fieldPts,12);
  assert.equal(run('getRunoutFielder({dismissal:"run out"})'),null);
});

test('two/three wicket hauls and multi-wicket overs receive no extra bonuses', () => {
  // The same economic context and dot/maiden counts give exactly +20 per additional wicket.
  for(const wickets of [0,1,2,3,4]) {
    context.__wickets=wickets;
    near(run('calculateBowlingImpact({overs:1,runs:6,wickets:__wickets,dots:0,maidens:0},{rpb:1}).bowlPts'),20*wickets,'wicket count '+wickets);
  }
});

test('Impact columns retain raw statistics and sort signed numbers numerically', () => {
  const elements=new Map();
  context.document.querySelectorAll=()=>[];
  context.document.getElementById=id=>{
    if(!elements.has(id))elements.set(id,{textContent:'',innerHTML:'',classList:{add(){},remove(){}}});
    return elements.get(id);
  };
  run('matchesData=__matches;selectedEnvironment="ALL";selectedTournament="ALL";');
  run('sortLeaderboard("batting","battingImpact");sortLeaderboard("bowling","bowlingImpact");');
  const season=json('calculateSeasonStats()');
  for(const [discipline,key,body] of [['batting','battingImpact','leaderboard-batting-body'],['bowling','bowlingImpact','leaderboard-bowling-body']]) {
    const expected=Object.values(season).filter(p=>discipline==='batting'?p.innings>0:p.ballsBowled>0).sort((a,b)=>b[key]-a[key]);
    // Reset to a known descending sort and verify names in rendered row order.
    run(`${discipline==='batting'?'battingSort':'bowlingSort'}={col:'${key}',asc:false};renderLeaderboardTab();`);
    const rows=[...elements.get(body).innerHTML.matchAll(/openPlayerProfileByName\('([^']+)'\)/g)].map(m=>m[1]);
    assert.deepEqual(rows,expected.map(p=>p.name));
    run(`sortLeaderboard('${discipline}','${key}');`);
    const ascending=[...elements.get(body).innerHTML.matchAll(/openPlayerProfileByName\('([^']+)'\)/g)].map(m=>m[1]);
    assert.deepEqual(ascending,expected.toReversed().map(p=>p.name));
  }
  assert.match(elements.get('leaderboard-orange-pill').textContent,/Jenson \(80 Runs\)/);
  assert.match(elements.get('leaderboard-purple-pill').textContent,/Davison \(5 Wkts\)/);
  const markup=run('renderInningsScorecard(matchesData[0].innings[0],1,getMatchMvpContext(matchesData[0]))');
  assert.equal((markup.match(/>Impact<\/th>/g)||[]).length,2);
  assert.match(markup,/Bowling Impact/);assert.match(markup,/Batting Impact/);
  assert.match(markup,/42\.4/,'Macroom Jenson bowling remains 42.4 before fielding');
});

test('scheduled overs never inferred from actual chase length; missing schedule rejected', () => {
  assert.equal(json('getMatchCrcAwards(matchesData.find(m=>m.id==="csk-s3-m4-ashbourne")).baseline').scheduledOvers,4);
  context.__fixture={...matches[0],format:'Club Cricket'};
  assert.throws(()=>run('getMatchMvpContext(__fixture)'),/scheduled overs/);
  context.__fixture.scheduledOvers=10;
  assert.equal(run('getMatchMvpContext(__fixture).scheduledOvers'),10);
});
test('season honour, table and profile UI use v2, shared ranks and separate official awards', () => {
  const elements = new Map();
  context.document.querySelectorAll = () => [];
  context.document.getElementById = id => {
    if (!elements.has(id)) elements.set(id, { textContent:'', innerHTML:'', classList:{remove(){},add(){}} });
    return elements.get(id);
  };
  run('selectedEnvironment="ALL"; selectedTournament="ALL";');
  run('renderCapsShowcase(); renderLeaderboardTab(); openPlayerProfileByName("Davison");');
  const expected=json('calculateSeasonStats()');
  const leader=Object.values(expected).sort((a,b)=>b.mvpPoints-a.mvpPoints)[0];
  assert.equal(elements.get('mvp-leader-points').textContent, `${leader.mvpPoints.toFixed(1)} Pts`);
  assert.equal(elements.get('modal-stat-mvp').textContent,expected.Davison.mvpPoints.toFixed(1));
  assert.equal(elements.get('modal-stat-potm').textContent,expected.Davison.potmCount);
  assert.match(elements.get('modal-match-history').innerHTML,/Statistical MVP: 28\.7 pts/);
  assert.match(elements.get('modal-match-history').innerHTML,/Official POTM/);
  assert.equal(elements.get('modal-stat-batting-impact').textContent,expected.Davison.battingImpact.toFixed(1));
  assert.equal(elements.get('modal-stat-bowling-impact').textContent,expected.Davison.bowlingImpact.toFixed(1));
  assert.equal(elements.get('modal-stat-fielding-impact').textContent,expected.Davison.fieldingImpact.toFixed(1));
  run("sortLeaderboard('batting','battingImpact'); sortLeaderboard('bowling','bowlingImpact');");
  assert.match(elements.get('leaderboard-orange-pill').textContent,/Jenson \(80 Runs\)/);
  assert.match(elements.get('leaderboard-purple-pill').textContent,/Davison \(5 Wkts\)/);
  const fixture = structuredClone(context.__negative);
  context.__fixture=fixture;
  run('matchesData=[__fixture]; renderCapsShowcase(); renderLeaderboardTab();');
  assert.equal(elements.get('mvp-leader-name').textContent,'Jenson & Savio');
  assert.equal(elements.get('mvp-leader-points').textContent,'-39.2 Pts');
  assert.match(elements.get('leaderboard-batting-body').innerHTML,/-16\.7/);
  assert.match(elements.get('leaderboard-bowling-body').innerHTML,/-22\.5/);
  const table=elements.get('leaderboard-mvp-body').innerHTML;
  assert.equal((table.match(/-39\.2/g)||[]).length,2);
  assert.doesNotMatch(table,/Davison/,'unused players cannot lead negative seasons');
  assert.equal((table.match(/border-amber-400 bg-amber-500\/10/g)||[]).length,2,'both equal first places highlighted');
  run('matchesData=__matches;');
});
console.log(`PASS: ${checks} MVP v2 test groups (including independent audit of every player in all seven matches)`);
