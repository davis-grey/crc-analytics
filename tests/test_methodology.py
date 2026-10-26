"""Protect publication of the approved guide without changing scoring logic."""
from html.parser import HTMLParser
from pathlib import Path
import re
import subprocess
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]


class Document(HTMLParser):
    def __init__(self):
        super().__init__()
        self.text, self.ids, self.anchors = [], set(), []
        self.tables = self.details = 0

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if 'id' in attrs:
            self.ids.add(attrs['id'])
        if tag == 'a':
            self.anchors.append(attrs.get('href', ''))
        self.tables += tag == 'table'
        self.details += tag == 'details'

    def handle_data(self, data):
        self.text.append(data)


class MethodologyTests(unittest.TestCase):
    def test_approved_source_is_fully_published_and_current(self):
        subprocess.run([sys.executable, str(ROOT / 'scripts/build_methodology.py'), '--check'], check=True)
        page = Document()
        page.feed((ROOT / 'methodology.html').read_text())
        text = ' '.join(''.join(page.text).split())
        source = (ROOT / 'docs/CRC_MVP_v2_Methodology_ASD_STE100_Style.md').read_text()
        for line in source.splitlines():
            if not line.strip() or line == '---' or line.startswith('|'):
                continue
            content = re.sub(r'^(#{1,3} |[-] |> )', '', line).replace('**', '')
            self.assertIn(content, text)
        self.assertGreaterEqual(page.tables, 7)
        self.assertGreaterEqual(page.details, 4)
        for href in page.anchors:
            if href.startswith('#'):
                self.assertIn(href[1:], page.ids)

    def test_page_version_matches_approved_source_and_calculation_version(self):
        engine = re.search(r'CRC MVP v([0-9.]+):', (ROOT / 'stats.js').read_text())[1]
        source = re.search(r'Version ([0-9.]+)', (ROOT / 'docs/CRC_MVP_v2_Methodology_ASD_STE100_Style.md').read_text())[1]
        page = re.search(r'name="crc-mvp-version" content="([0-9.]+)"', (ROOT / 'methodology.html').read_text())[1]
        self.assertEqual(engine, source)
        self.assertEqual(engine, page)

    def test_navigation_and_return_links_exist(self):
        index = (ROOT / 'index.html').read_text()
        self.assertEqual(index.count('href="methodology.html"'), 4)
        self.assertIn('href="methodology.html"', (ROOT / 'app.js').read_text())
        self.assertIn('href="index.html#leaderboard"', (ROOT / 'methodology.html').read_text())
