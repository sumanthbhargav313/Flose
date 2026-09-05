"""Build-time lookup only; visitors' check-ins never reach the price provider."""

import json
from pathlib import Path

from prices import refresh_prices

ROOT = Path(__file__).resolve().parent

if __name__ == "__main__":
    original = json.loads((ROOT / "catalog.json").read_text(encoding="utf-8"))
    catalog, status = refresh_prices(original)
    print(status)
    if catalog != original:
        (ROOT / "catalog.json").write_text(
            json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        (ROOT.parent / "catalog.js").write_text(
            "// Refreshed from the public retail report at build time.\nwindow.FLOSE_CATALOG = "
            + json.dumps(catalog, ensure_ascii=False)
            + ";\n",
            encoding="utf-8",
        )
    print(f"Publishing retail snapshot dated {catalog['price_date']}.")
