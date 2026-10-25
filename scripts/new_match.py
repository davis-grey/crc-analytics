"""Create an UNVALIDATED scorecard draft for AI-assisted extraction and manual review.

Examples:
    python scripts/new_match.py --id club-cup-m1 --tournament nemo-cc-2026-s2 --date 2026-11-01

Drafts are deliberately written outside data/matches, and never deployed. Only
move a completed, checked JSON draft into data/matches/.
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from data_pipeline import DATA, ROOT, read_json


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--id', required=True, help='Unique match ID, letters/numbers/hyphens')
    parser.add_argument('--tournament', required=True, help='ID defined in data/tournaments.json')
    parser.add_argument('--date', required=True, help='YYYY-MM-DD')
    args = parser.parse_args()
    if not re.fullmatch(r'[a-z0-9][a-z0-9_-]*', args.id):
        parser.error('Match IDs must contain only lowercase letters, digits, _ and -')
    if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', args.date):
        parser.error('Date must use YYYY-MM-DD')
    tournaments = read_json(DATA/'tournaments.json')
    t = next((v for v in tournaments if v['id'] == args.tournament), None)
    if not t:
        parser.error('Unknown tournament ID: add it to data/tournaments.json first')
    draft_path = ROOT/'_drafts'/f'{args.id}.json'
    draft_path.parent.mkdir(exist_ok=True)
    if draft_path.exists() or any(m['id'] == args.id for m in [read_json(p) for p in (DATA/'matches').glob('*.json')]):
        parser.error('Draft or published match with this ID already exists')
    empty_innings = lambda team, short: {
        'team': team, 'shortName': short, 'runs': None, 'wickets': None, 'overs': None,
        'runRate': None, 'extras': {'wd': 0, 'nb': 0, 'total': None},
        'batting': [], 'fallOfWickets': [], 'bowling': [], 'overProgression': []
    }
    draft = {
        'id': args.id, 'tournamentId': t['id'], 'tournament': t['name'],
        'stage': '', 'matchTitle': '', 'season': t['season'],
        'environment': t.get('environment', ''), 'pitchType': t.get('pitchType', ''),
        'format': '', 'venue': t['venue'], 'date': args.date, 'time': '',
        'toss': '', 'scorer': '', 'result': '', 'outcome': '', 'playerOfTheMatch': '',
        'crcBattingFirst': None, 'crcPlayingXI': [],
        'innings': [empty_innings('CORK ROYAL CHALLENGERS', 'CRC'), empty_innings('Opponent team name', 'OPP')]
    }
    draft_path.write_text(json.dumps(draft, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print(f'Created unvalidated scorecard: {draft_path.relative_to(ROOT)}')
    print('Use scorecard screenshots/PDF to fill every field; verify figures and names.')
    print('Then move to data/matches/, run: python scripts/build_data.py')


if __name__ == '__main__':
    main()
