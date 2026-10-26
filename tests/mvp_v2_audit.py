"""Independent test/audit oracle, not application code. Exact rational arithmetic.

Reads canonical JSON directly. This implementation exists only to independently
verify production stats.js; it is never imported by the website or data build.
Run: python tests/mvp_v2_audit.py
"""
import json
import re
from fractions import Fraction as Q
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def audit():
    roster = json.loads((ROOT / 'data/players.json').read_text())
    aliases = {alias.casefold(): p['name'] for p in roster for alias in [p['name'], *p.get('aliases', [])]}

    def name(raw):
        clean = re.sub(r'\s*\((?:c|wk)\)', '', raw, flags=re.I).strip()
        return aliases.get(clean.casefold(), clean)

    season = {p['name']: dict(matches=0, points=Q(0), potm=0) for p in roster}
    matches = []
    for path in sorted((ROOT / 'data/matches').glob('*.json')):
        m = json.loads(path.read_text())
        limit = Q(str(m.get('scheduledOvers') or re.search(r'(\d+(?:\.\d+)?)\s*overs?', m['format'], re.I)[1]))

        def balls(overs):
            whole, _, part = str(overs).partition('.')
            return int(whole) * 6 + int(part or '0')

        total_runs = sum(i['runs'] for i in m['innings'])
        total_balls = sum(balls(i['overs']) for i in m['innings'])
        rpb = Q(total_runs, total_balls)
        scores = {name(n): dict(name=name(n), batPts=Q(0), bowlPts=Q(0), fieldPts=Q(0)) for n in m['crcPlayingXI']}
        crc, opp = next(i for i in m['innings'] if i['shortName'] == 'CRC'), next(i for i in m['innings'] if i['shortName'] != 'CRC')

        def record(raw):
            n = name(raw)
            return scores.setdefault(n, dict(name=n, batPts=Q(0), bowlPts=Q(0), fieldPts=Q(0)))

        for b in crc['batting']:
            value = 2*b['runs'] + b['fours'] + 2*b['sixes'] - b['balls']*rpb
            value += 5 * (int(b['runs'] >= limit*3) + int(b['runs'] >= limit*5))
            record(b['player'])['batPts'] += value
        for b in opp['bowling']:
            value = 20*b['wickets'] + b.get('dots', 0) + 12*b.get('maidens', 0)
            value += Q(3, 2) * (balls(b['overs'])*rpb - b['runs'])
            record(b['bowler'])['bowlPts'] += value
        for b in opp['batting']:
            d = b.get('dismissal', '')
            if found := re.fullmatch(r'c & b (.+)', d, re.I):
                record(found[1])['fieldPts'] += 10
            elif found := re.match(r'^c (.+?) b ', d, re.I):
                record(found[1])['fieldPts'] += 10
            if found := re.search(r'run\s?out\s*\(([^)]+)\)', d, re.I):
                for fielder in found[1].split('/'):
                    record(fielder)['fieldPts'] += 15
            if found := re.match(r'^st (.+?) b ', d, re.I):
                record(found[1])['fieldPts'] += 12
        for p in scores.values():
            p['totalPts'] = p['batPts'] + p['bowlPts'] + p['fieldPts']
            season[p['name']]['points'] += p['totalPts']
        for n in set(map(name, m['crcPlayingXI'])):
            season[n]['matches'] += 1
        if m.get('playerOfTheMatch') and name(m['playerOfTheMatch']) in season:
            season[name(m['playerOfTheMatch'])]['potm'] += 1
        matches.append(dict(id=m['id'], title=m['matchTitle'], runs=total_runs, legalBalls=total_balls,
                            scheduledOvers=limit, rpb=rpb, rpo=rpb*6,
                            rankings=sorted(scores.values(), key=lambda p: (-p['totalPts'], p['name']))))
    return dict(matches=matches, season=sorted([dict(name=n, **s) for n,s in season.items() if s['matches']],
                                              key=lambda s: (-s['points'], s['name'])))


if __name__ == '__main__':
    print(json.dumps(audit(), default=float, indent=2))
