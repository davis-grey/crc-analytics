"""Validate authoring JSON and verify generated outputs are up to date."""
from data_pipeline import run

if __name__ == '__main__':
    raise SystemExit(run(check=True))
