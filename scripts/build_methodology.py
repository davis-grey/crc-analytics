"""Render the approved methodology with Python's standard library only.

Edit the approved Markdown source, then run this script. --check rejects stale HTML.
This renderer supports only the Markdown constructs used in this document.
"""
import argparse
import html
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'docs/CRC_MVP_v2_Methodology_ASD_STE100_Style.md'
TARGET = ROOT / 'methodology.html'


def inline(text):
    return re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', html.escape(text))


def render(source):
    lines = source.splitlines()
    output, contents = [], []
    i = 0
    example_level = None
    while i < len(lines):
        line = lines[i]
        if not line.strip():
            i += 1
            continue
        heading = re.match(r'^(#{1,3}) (.*)', line)
        if heading:
            level, title = len(heading[1]), heading[2]
            if example_level and level <= example_level:
                output.append('</details>')
                example_level = None
            slug = re.sub(r'[^a-z0-9]+', '-', title.lower()).strip('-')
            if level == 2:
                contents.append(f'<a href="#{slug}">{inline(title)}</a>')
            if level == 3 and 'Real example:' in title:
                output.append(f'<details class="example" id="{slug}"><summary>{inline(title)}</summary>')
                example_level = level
            else:
                output.append(f'<h{level} id="{slug}">{inline(title)}</h{level}>')
                if level == 2 and title.startswith('7.'):
                    output.append('<details class="example"><summary>Read the Cork Indians example</summary>')
                    example_level = 2
            i += 1
        elif line.startswith('|'):
            rows = []
            while i < len(lines) and lines[i].startswith('|'):
                rows.append([cell.strip() for cell in lines[i].strip('|').split('|')])
                i += 1
            title = re.sub('<[^>]+>', '', rows[0][0])
            output.append(f'<div class="table-scroll" role="region" aria-label="{html.escape(title)} table. Scroll for all columns." tabindex="0"><table style="min-width:{max(440, len(rows[0]) * 110)}px"><thead><tr>')
            output.extend(f'<th scope="col">{inline(cell)}</th>' for cell in rows[0])
            output.append('</tr></thead><tbody>')
            for row in rows[2:]:
                output.append('<tr>' + ''.join(f'<td>{inline(cell)}</td>' for cell in row) + '</tr>')
            output.append('</tbody></table></div>')
        elif line.startswith('- '):
            output.append('<ul>')
            while i < len(lines) and lines[i].startswith('- '):
                output.append(f'<li>{inline(lines[i][2:])}</li>')
                i += 1
            output.append('</ul>')
        elif line.startswith('> '):
            output.append(f'<aside class="note">{inline(line[2:])}</aside>')
            i += 1
        elif line == '---':
            output.append('<hr>')
            i += 1
        elif line == '**Example: CRC against Cork Indians CC**':
            output.append('<details class="example"><summary>Example: CRC against Cork Indians CC</summary>')
            example_level = 3
            i += 1
        else:
            paragraph = [line]
            i += 1
            while i < len(lines) and lines[i].strip() and not re.match(r'^(#|\||- |>|---)', lines[i]):
                paragraph.append(lines[i])
                i += 1
            text = ' '.join(paragraph)
            css = ' class="formula"' if text.startswith('**') and (' = ' in text or '** =' in text) else ''
            output.append(f'<p{css}>{inline(text)}</p>')
    if example_level:
        output.append('</details>')
    glossary = {
        'Baseline': 'The combined match scoring rate. Use the same rate for both teams.',
        'RPB': 'Runs per ball. Divide combined innings runs by combined legal deliveries.',
        'RPO': 'Runs per over. Multiply match RPB by six.',
        'Legal delivery': 'A delivery that counts in an over. A wide or no-ball does not count.',
        'Scheduled overs': 'The agreed number of overs per innings. Do not use a shorter chase.',
        'SR impact': 'Batter runs minus batter balls faced multiplied by match RPB.',
        'Runs saved impact': 'The signed bowling adjustment from the match baseline.',
        'Bowler-credited wicket': 'A wicket assigned to the bowler in the scorecard. A run-out is not a bowler wicket.',
        'Dot ball': 'A dot recorded in the bowling figures.',
        'Maiden over': 'Six legal deliveries with no run charged to the bowler.',
        'Primary fielder': 'The identified fielder who receives the full run-out credit.',
        'POTM': 'Official Player of the Match. This award adds zero MVP points.',
        'Statistical MVP': 'The sum of batting, bowling and fielding impact.',
        'Signed value': 'A number that can be positive, zero or negative.',
    }
    glossary_html = '<section aria-labelledby="glossary"><h2 id="glossary">Glossary</h2><dl>' + ''.join(
        f'<dt>{inline(term)}</dt><dd>{inline(definition)}</dd>' for term, definition in glossary.items()) + '</dl></section>'
    template = (ROOT / 'docs/methodology-shell.html').read_text()
    return template.replace('{{CONTENTS}}', '\n'.join(contents)).replace('{{BODY}}', '\n'.join(output)).replace('{{GLOSSARY}}', glossary_html)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    result = render(SOURCE.read_text())
    if args.check:
        if not TARGET.exists() or TARGET.read_text() != result:
            raise SystemExit('Methodology page is stale. Run python scripts/build_methodology.py')
        print('Approved methodology page is current')
    else:
        TARGET.write_text(result)
        print('Built methodology.html from approved Markdown')


if __name__ == '__main__':
    main()
