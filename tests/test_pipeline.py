"""Offline tests: python -m unittest discover -s tests -v"""
import copy
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from data_pipeline import check_all, generated_artifacts, load_dataset, overs_to_balls, ROOT


class PipelineTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.dataset = load_dataset()

    def findings(self, data):
        return check_all(**data)

    def errors(self, data):
        return [str(f) for f in self.findings(data) if f.severity == 'ERROR']

    def test_overs_are_balls_not_decimal(self):
        for overs, balls in [('0.0', 0), ('0.5', 5), ('1.4', 10), ('3.5', 23), (4, 24), (1.2, 8)]:
            self.assertEqual(overs_to_balls(overs), balls)
        for invalid in ['1.6', '2.9', '-1', '1.04', 'abc', None]:
            with self.assertRaises(ValueError):
                overs_to_balls(invalid)

    def test_existing_data_has_no_blocking_errors(self):
        self.assertEqual(self.errors(self.dataset), [])
        historical_ids = {'krfk8788', 'idha0741', 'hvup2795',
                          'csk-s3-m1-waterford', 'csk-s3-m2-bdtigers',
                          'csk-s3-m3-corkindians', 'csk-s3-m4-ashbourne'}
        self.assertTrue(historical_ids.issubset({m['id'] for m in self.dataset['matches']}))
        # Confirmed 8-a-side lineups and no-ball records must not create false warnings.
        warnings = [str(f) for f in self.findings(self.dataset) if f.severity == 'WARNING']
        self.assertEqual(warnings, [])

    def test_eight_a_side_all_four_csk_fixtures(self):
        csk = [m for m in self.dataset['matches'] if m['tournamentId'] == 'csk-indoor-2026-s3']
        self.assertEqual(len(csk), 4)
        for match in csk:
            self.assertIn('8-a-side', match['format'])
            self.assertEqual(len(match['crcPlayingXI']), 8, match['id'])
        for player in ['Jenson', 'Srikanth', 'Savio', 'Joyvin', 'Yash', 'Avinash', 'Davison']:
            self.assertEqual(sum(player in m['crcPlayingXI'] for m in csk), 4, player)
        self.assertEqual(sum('Joy D' in m['crcPlayingXI'] for m in csk), 3)
        self.assertEqual(sum('Rifaz' in m['crcPlayingXI'] for m in csk), 1)
        self.assertIn('Rifaz', next(m for m in csk if m['id'] == 'csk-s3-m1-waterford')['crcPlayingXI'])

    def test_bad_no_ball_batter_delivery_totals_still_warn(self):
        data = copy.deepcopy(self.dataset)
        match = next(m for m in data['matches'] if m['id'] == 'hvup2795')
        self.assertEqual(match['innings'][0]['extras']['nb'], 2)
        # Currently valid: 28 legal + 2 possible no-ball batter deliveries = 30.
        match['innings'][0]['batting'][0]['balls'] += 1
        self.assertTrue(any('Batter deliveries' in str(f) for f in self.findings(data)))

    def test_participant_mismatch_warns_even_if_fewer_players(self):
        data = copy.deepcopy(self.dataset)
        match = next(m for m in data['matches'] if m['id'] == 'csk-s3-m1-waterford')
        match['crcPlayingXI'].remove('Rifaz')
        self.assertTrue(any('CRC participants in 8-a-side' in str(f) for f in self.findings(data)))

    def test_score_corruption_is_rejected(self):
        data = copy.deepcopy(self.dataset)
        data['matches'][0]['innings'][0]['runs'] += 1
        self.assertTrue(any('Bat runs + extras' in x for x in self.errors(data)))

    def test_invalid_bowler_overs_rejected(self):
        data = copy.deepcopy(self.dataset)
        data['matches'][0]['innings'][0]['bowling'][0]['overs'] = '0.6'
        self.assertTrue(any('Invalid bowler' in x for x in self.errors(data)))

    def test_unknown_crc_player_rejected(self):
        data = copy.deepcopy(self.dataset)
        data['matches'][0]['crcPlayingXI'][0] = 'Not A CRC Player'
        self.assertTrue(any('Unrecognized CRC player' in x for x in self.errors(data)))

    def test_duplicate_match_id_rejected(self):
        data = copy.deepcopy(self.dataset)
        data['matches'][1]['id'] = data['matches'][0]['id']
        self.assertTrue(any('duplicate match ID' in x for x in self.errors(data)))

    def test_unknown_tournament_rejected(self):
        data = copy.deepcopy(self.dataset)
        data['matches'][0]['tournamentId'] = 'not-yet-registered'
        self.assertTrue(any('Unknown tournamentId' in x for x in self.errors(data)))

    def test_generated_files_are_current(self):
        for path, body in generated_artifacts(self.dataset).items():
            self.assertEqual(path.read_text(encoding='utf-8'), body, str(path.relative_to(ROOT)))


if __name__ == '__main__':
    unittest.main()
