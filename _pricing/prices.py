"""Public commodity lookup. No check-in or location is sent to the price source."""

import copy
import json
import re
from datetime import date, datetime, timedelta, timezone
from html.parser import HTMLParser
from importlib.resources import files
from urllib.request import Request, urlopen

PRICE_URL = "https://fcainfoweb.nic.in/Reports/DB/DBprices.aspx"


def india_today() -> date:
    return datetime.now(timezone(timedelta(hours=5, minutes=30))).date()


def load_catalog() -> dict:
    return json.loads(files(__package__).joinpath("catalog.json").read_text(encoding="utf-8"))


class RetailTable(HTMLParser):
    def __init__(self):
        super().__init__()
        self.rows, self.row, self.cell, self.text = [], [], None, []

    def handle_starttag(self, tag, attrs):
        if tag == "tr":
            self.row = []
        if tag in ("td", "th"):
            self.cell = []

    def handle_data(self, data):
        self.text.append(data)
        if self.cell is not None:
            self.cell.append(data)

    def handle_endtag(self, tag):
        if tag in ("td", "th") and self.cell is not None:
            self.row.append(" ".join(" ".join(self.cell).split()))
            self.cell = None
        if tag == "tr" and self.row:
            self.rows.append(self.row)


def parse_prices(document: str, catalog: dict, today: date | None = None) -> dict:
    parser = RetailTable()
    parser.feed(document)
    match = re.search(r"Date\s*:\s*(\d{2}/\d{2}/\d{4})", " ".join(parser.text))
    if not match:
        raise ValueError("The price report has no valid date.")
    day, month, year = map(int, match[1].split("/"))
    as_of = date(year, month, day)
    if as_of > (today or india_today()) or as_of < date.fromisoformat(catalog["price_date"]):
        raise ValueError("The price report date is out of range.")
    updated = copy.deepcopy(catalog)
    rows = {row[0].casefold(): row for row in parser.rows if len(row) >= 3}
    for item in updated["ingredients"].values():
        row = rows.get(item["name"].casefold())
        if not row:
            raise ValueError("The price report is missing a required ingredient.")
        unit = row[1].lower().replace(" ", "")
        expected = {
            "g": {"1000": "1kg", "100": "100gm", "50": "50gm"},
            "ml": {"1000": "1ltr"},
            "egg": {"12": "1dozen"},
        }
        if unit != expected[item["unit"]][str(item["base_quantity"])]:
            raise ValueError("Unexpected retail unit; preserving the last verified prices.")
        if not re.fullmatch(r"\d+(?:\.\d{1,2})?", row[2]):
            raise ValueError("Invalid retail price.")
        value = round(float(row[2]) * 100)
        if not 0 < value <= 1000000:
            raise ValueError("Retail price is out of range.")
        item["price_paise"] = value
    updated["price_date"] = as_of.isoformat()
    return updated


def refresh_prices(catalog: dict) -> tuple[dict, str]:
    try:
        request = Request(PRICE_URL, headers={"User-Agent": "Flose/1.0 (public price lookup)"})
        with urlopen(request, timeout=5) as response:
            body = response.read(1_000_001)
        if len(body) > 1_000_000:
            raise ValueError("Price report exceeds the size limit.")
        return parse_prices(body.decode("utf-8"), catalog), "Retail prices checked successfully."
    except (OSError, ValueError, KeyError, UnicodeError):
        return catalog, "Price lookup unavailable. Using the dated retail snapshot shown below."
