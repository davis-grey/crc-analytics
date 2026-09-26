"""
Stumps PDF / Text to CRC Match JSON Converter
Cork Royal Challengers Cricket Club
"""

import json
import re
import sys

def parse_stumps_summary(raw_text):
    """
    Helper to extract metadata and stats from Stumps report text.
    """
    match_data = {
        "id": "match_" + str(abs(hash(raw_text)) % 100000),
        "tournament": "Nemo Cricket Club Tournament 2026 S2",
        "matchTitle": "Club Match",
        "format": "Club Cricket (7-a-side, 5 overs)",
        "venue": "Nemo Rangers, Cork",
        "date": "2026-09-26",
        "time": "12:00 PM",
        "toss": "",
        "scorer": "",
        "result": "",
        "outcome": "WIN",
        "playerOfTheMatch": "",
        "crcBattingFirst": False,
        "innings": []
    }
    return match_data

if __name__ == "__main__":
    print("Stumps Match Ingestion Utility ready.")
