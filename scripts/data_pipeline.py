"""Canonical match-data loading, cricket checks and deterministic client bundle generation.

The ONLY editable match records are data/matches/*.json. Never edit data.js or
all_matches.json: both are derived outputs and are checked by `--check`.
"""
from __future__ import annotations

import argparse
import json
import re
from datetime import date
import sys
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'data'


@dataclass(frozen=True)
class Finding:
    severity: str
    where: str
    explanation: str

    def __str__(self):
        return f'{self.severity}: {self.where}: {self.explanation}'


def read_json(path: Path):
    with path.open(encoding='utf-8') as stream:
        return json.load(stream)


def overs_to_balls(value):
    """Cricket 3.4 means 22 deliveries, NOT 3.4 decimal overs."""
    if isinstance(value, bool) or not isinstance(value, (str, int, float)):
        raise ValueError(f'Invalid overs: {value!r}')
    representation = str(value).strip()
    if not re.fullmatch(r'\d+(?:\.[0-5])?', representation):
        raise ValueError(f'Invalid cricket overs: {value!r}; fractional part must be 0–5 balls')
    full, _, partial = representation.partition('.')
    return int(full) * 6 + int(partial or 0)


def canonical_name_lookup(players):
    names = {}
    for p in players:
        for name in [p['name'], *(p.get('aliases') or [])]:
            key = name.casefold().strip()
            if key in names and names[key] != p['id']:
                raise ValueError(f'Ambiguous roster alias: {name!r}')
            names[key] = p['id']
    return names


def check_all(team, players, tournaments, matches):
    findings = []

    def error(where, msg): findings.append(Finding('ERROR', where, msg))
    def warn(where, msg): findings.append(Finding('WARNING', where, msg))

    tids = set()
    tournament_by_id = {t.get("id"): t for t in tournaments}
    for t in tournaments:
        tid = t.get('id')
        if not tid or tid in tids:
            error('tournaments.json', f'Missing/duplicate tournament ID: {tid!r}')
        tids.add(tid)
        for key in ('name', 'season', 'venue', 'date', 'placement'):
            if not t.get(key):
                error(f'tournament {tid}', f'Missing {key}')

    pids = set()
    for p in players:
        if not p.get('id') or p['id'] in pids:
            error('players.json', f'Missing/duplicate player ID: {p.get("id")!r}')
        pids.add(p.get('id'))
    try:
        aliases = canonical_name_lookup(players)
    except ValueError as exc:
        error('players.json', str(exc))
        aliases = {}

    mids = set()
    for match in matches:
        mid = match.get('id', '<missing>')
        if mid in mids or mid == '<missing>':
            error('matches', f'Missing/duplicate match ID: {mid}')
        mids.add(mid)
        location = f'match {mid}'
        if not isinstance(mid, str) or not re.fullmatch(r'[a-z0-9][a-z0-9_-]*', mid):
            error(location, 'Match ID must be a lowercase slug (letters, numbers, _ and -)')
        if match.get('tournamentId') not in tids:
            error(location, f'Unknown tournamentId {match.get("tournamentId")!r}')
        tournament = tournament_by_id.get(match.get('tournamentId'))
        if tournament:
            if match.get('tournament') != tournament['name']:
                error(location, 'Match tournament name disagrees with data/tournaments.json')
            if match.get('season') != tournament['season']:
                error(location, 'Match season disagrees with data/tournaments.json')
        for field in ('matchTitle', 'date', 'format', 'outcome', 'result', 'tournamentId'):
            if not match.get(field):
                error(location, f'Missing {field}')
        try:
            date.fromisoformat(match.get('date', ''))
        except (ValueError, TypeError):
            error(location, f'Invalid ISO date {match.get("date")!r}')
        if match.get('outcome') not in ('WIN', 'LOSS', 'TIE', 'NO RESULT'):
            error(location, f'Invalid outcome {match.get("outcome")!r}')
        xi = match.get('crcPlayingXI')
        if not isinstance(xi, list):
            error(location, 'crcPlayingXI must be a list')
            xi = []
        seen_players = set()
        for name in xi:
            lookup = re.sub(r'\s*\((?:C|WK)\)', '', name, flags=re.I).casefold().strip()
            if lookup not in aliases:
                error(location, f'Unrecognized CRC player in crcPlayingXI: {name!r}; add to players.json')
            else:
                if aliases[lookup] in seen_players:
                    error(location, f'Duplicate CRC participant: {name!r}')
                seen_players.add(aliases[lookup])
        format_count = re.search(r'(\d+)\s*-\s*a\s*-\s*side', match.get('format') or '', re.I)
        if format_count and len(xi) != int(format_count.group(1)):
            warn(location, f'{len(xi)} CRC participants in {format_count.group(1)}-a-side fixture; check recorded participants and substitutes')

        innings = match.get('innings')
        if not isinstance(innings, list) or len(innings) != 2:
            error(location, 'Expected exactly two innings')
            continue
        crc_innings = [i for i in innings if i.get('shortName') == team.get('shortName', 'CRC')]
        if len(crc_innings) != 1:
            error(location, 'Expected exactly one CRC innings (shortName CRC)')
        for inning in innings:
            iloc = f'{location}, innings {inning.get("shortName", "?")}'
            for field in ('runs', 'wickets', 'overs', 'batting', 'bowling', 'overProgression', 'extras'):
                if field not in inning:
                    error(iloc, f'Missing {field}')
            try:
                legal = overs_to_balls(inning['overs'])
            except (KeyError, ValueError) as exc:
                error(iloc, str(exc))
                continue
            batting = inning.get('batting') or []
            bowling = inning.get('bowling') or []
            for bat in batting:
                for field in ('runs', 'balls', 'fours', 'sixes'):
                    if not isinstance(bat.get(field), int) or bat[field] < 0:
                        error(iloc, f'Invalid batting {field} for {bat.get("player", "?")}')
                if inning.get('shortName') == 'CRC' and bat.get('player', '').casefold() not in aliases:
                    error(iloc, f'Unknown CRC batter {bat.get("player")!r}')
            for bowl in bowling:
                try:
                    overs_to_balls(bowl['overs'])
                except (KeyError, ValueError) as exc:
                    error(iloc, f'Invalid bowler {bowl.get("bowler", "?")}: {exc}')
                if inning.get('shortName') != 'CRC' and bowl.get('bowler', '').casefold() not in aliases:
                    error(iloc, f'Unknown CRC bowler {bowl.get("bowler")!r}')
            if not all(isinstance(b.get('runs'), int) for b in batting):
                continue
            scored = sum(b['runs'] for b in batting) + (inning.get('extras') or {}).get('total', 0)
            if scored != inning.get('runs'):
                error(iloc, f'Bat runs + extras = {scored}, innings runs = {inning.get("runs")}')
            ball_total = sum(b.get('balls', 0) for b in batting)
            # Some scoring apps credit no-ball deliveries to batters' balls faced.
            # They never count as legal deliveries. Allow the range (legal .. legal + NB)
            # rather than incorrectly flagging properly scored no-balls.
            no_balls = (inning.get('extras') or {}).get('nb', 0)
            if ball_total < legal or ball_total > legal + no_balls:
                warn(iloc, f'Batter deliveries {ball_total} outside {legal}–{legal + no_balls} (legal balls plus no-balls); check batting entries and extras')
            bowler_balls = 0
            for b in bowling:
                try: bowler_balls += overs_to_balls(b['overs'])
                except (ValueError, KeyError): pass
            if bowler_balls != legal:
                warn(iloc, f'Bowler legal balls {bowler_balls} != innings legal balls {legal}')
            prog = inning.get('overProgression') or []
            if prog:
                accumulated = 0
                for over in prog:
                    accumulated += over.get('runs', 0)
                    if accumulated != over.get('cumulativeRuns'):
                        error(iloc, f'Over {over.get("over", "?")} cumulative runs do not match sum of overs')
            if prog and prog[-1].get('cumulativeRuns') != inning.get('runs'):
                error(iloc, 'Final over progression does not match innings score')
            if prog and prog[-1].get('cumulativeWickets') != inning.get('wickets'):
                error(iloc, 'Final over progression does not match wickets')
            if bowling and sum(b.get('runs', 0) for b in bowling) != inning.get('runs'):
                warn(iloc, 'Bowler runs conceded do not equal innings runs (possible byes/leg-byes)')
    return findings


def load_dataset():
    paths = sorted((DATA / 'matches').glob('*.json'))
    if not paths:
        raise ValueError('No match JSON files in data/matches/')
    matches = [read_json(p) for p in paths]
    team = read_json(DATA / 'team.json')
    players = read_json(DATA / 'players.json')
    tournaments = read_json(DATA / 'tournaments.json')
    return {'team': team, 'players': players, 'tournaments': tournaments, 'matches': matches}


def generated_artifacts(dataset):
    matches = dataset['matches']
    # JavaScript JSON literal is valid JS. Also escape < to prevent HTML script injection.
    payload = json.dumps(dataset, ensure_ascii=False, indent=2).replace('<', r'\u003c')
    return {
        ROOT / 'data.js': '// GENERATED by python scripts/build_data.py. DO NOT EDIT.\nwindow.CRC_DATA = ' + payload + ';\n',
        DATA / 'all_matches.json': json.dumps(matches, ensure_ascii=False, indent=2) + '\n',
    }


def run(check=False, quiet=False):
    data = load_dataset()
    findings = check_all(**data)
    if not quiet:
        for finding in findings:
            print(finding)
    errors = [finding for finding in findings if finding.severity == 'ERROR']
    if errors:
        print(f'{len(errors)} validation error(s): refusing to build', file=sys.stderr)
        return 1
    generated = generated_artifacts(data)
    if check:
        differences = [str(path.relative_to(ROOT)) for path, contents in generated.items()
                       if not path.is_file() or path.read_text(encoding='utf-8') != contents]
        if differences:
            print('Outdated generated files: ' + ', '.join(differences), file=sys.stderr)
            print('Run: python scripts/build_data.py', file=sys.stderr)
            return 1
    else:
        for path, contents in generated.items():
            path.write_text(contents, encoding='utf-8')
    if not quiet:
        print(f'{len(data["matches"])} validated match(es); '
              f'{len([f for f in findings if f.severity == "WARNING"])} warning(s); '
              + ('generated files verified' if check else 'generated data.js & data/all_matches.json'))
    return 0


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Verify generated artifacts are current (CI mode)')
    args = parser.parse_args()
    sys.exit(run(check=args.check))
