"""
Data merger — combines all scraper outputs into a single master_data.json.

Reads JSON outputs from:
  - nomis_data.json      (M33, M35, M36, M37, M40)
  - overpass_data.json   (M22, M23, M24, M25)
  - flood_risk_data.json (M58)

Applies:
  1. Validation bounds (flags out-of-range values as REVIEW_NEEDED)
  2. Source priority hierarchy (government API > manual > regional proxy)
  3. Deduplication (keeps highest-priority source per market+metric)

Outputs:
  - public/data/master_data.json (consumed by React app)
  - scrapers/output/merged_data.json (full audit trail)

Usage:
  python scrapers/data_merger.py
"""

import json
import sys
from pathlib import Path
from datetime import date

# ─── Config ────────────────────────────────────────────────────────────────────

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
OUTPUT_DIR = SCRIPT_DIR / "output"
PUBLIC_DATA_DIR = PROJECT_ROOT / "public" / "data"

# Input files (all optional — merger skips missing files)
INPUT_FILES = [
    OUTPUT_DIR / "nomis_data.json",
    OUTPUT_DIR / "overpass_data.json",
    OUTPUT_DIR / "flood_risk_data.json",
    OUTPUT_DIR / "sepa_flood_data.json",
]

# Metric ID string → numeric ID mapping (used by React app)
METRIC_ID_MAP = {
    "M1": 1, "M2": 2, "M3": 3, "M4": 4, "M5": 5,
    "M6": 6, "M7": 7, "M8": 8, "M9": 9, "M10": 10,
    "M11": 11, "M12": 12, "M13": 13, "M14": 14, "M15": 15,
    "M16": 16, "M17": 17, "M18": 18, "M19": 19, "M20": 20,
    "M21": 21, "M22": 22, "M23": 23, "M24": 24, "M25": 25,
    "M26": 26, "M27": 27, "M28": 28, "M29": 29, "M30": 30,
    "M31": 31, "M32": 32, "M33": 33, "M34": 34, "M35": 35,
    "M36": 36, "M37": 37, "M38": 38, "M39": 39, "M40": 40,
    "M41": 41, "M42": 42, "M43": 43, "M44": 44, "M45": 45,
    "M46": 46, "M47": 47, "M48": 48, "M49": 49, "M50": 50,
    "M51": 51, "M52": 52, "M53": 53, "M54": 54, "M55": 55,
    "M56": 56, "M57": 57, "M58": 58, "M59": 59, "M60": 60,
}

# Validation bounds per metric (min, max)
# Values outside these bounds are flagged as REVIEW_NEEDED
VALIDATION_RULES: dict[str, dict] = {
    "M22": {"min": 0, "max": 100, "unit": "km"},
    "M23": {"min": 0, "max": 200, "unit": "km"},
    "M24": {"min": 0, "max": 500, "unit": "km"},
    "M25": {"min": 0, "max": 500, "unit": "km"},
    "M33": {"min": -20, "max": 50, "unit": "%"},
    "M35": {"min": 40, "max": 80, "unit": "%"},
    "M36": {"min": 0, "max": 25, "unit": "%"},
    "M37": {"min": 50, "max": 95, "unit": "%"},
    "M40": {"min": 0, "max": 60, "unit": "%"},
    "M58": {"min": 1, "max": 5, "unit": "score"},
}

# Source priority (lower number = higher priority)
STATUS_PRIORITY = {
    "VERIFIED": 1,
    "ESTIMATED": 2,
    "REGIONAL_PROXY": 3,
    "REVIEW_NEEDED": 4,
    "MISSING": 5,
}


# ─── Helpers ───────────────────────────────────────────────────────────────────

def validate_record(record: dict) -> dict:
    """Check a record's value against validation bounds."""
    metric_id = record.get("metric_id", "")
    value = record.get("value")
    rule = VALIDATION_RULES.get(metric_id)

    if value is None or rule is None:
        return record

    if value < rule["min"] or value > rule["max"]:
        record = {**record}
        record["status"] = "REVIEW_NEEDED"
        record["validation_note"] = (
            f"Value {value} outside expected range [{rule['min']}, {rule['max']}] {rule['unit']}"
        )
    return record


def load_scraper_output(path: Path) -> list[dict]:
    """Load records from a scraper output file."""
    if not path.exists():
        print(f"  Skipping (not found): {path.name}")
        return []
    with open(path) as f:
        data = json.load(f)
    records = data.get("records", [])
    print(f"  Loaded {len(records)} records from {path.name}")
    return records


def merge_records(all_records: list[dict]) -> dict[str, dict]:
    """
    Deduplicate records by (market_id, metric_id), keeping the
    highest-priority source for each combination.
    Returns {f"{market_id}|{metric_id}": record}.
    """
    merged: dict[str, dict] = {}
    for record in all_records:
        key = f"{record['market_id']}|{record['metric_id']}"
        status = record.get("status", "MISSING")
        priority = STATUS_PRIORITY.get(status, 5)

        if key not in merged:
            merged[key] = record
        else:
            existing_status = merged[key].get("status", "MISSING")
            existing_priority = STATUS_PRIORITY.get(existing_status, 5)
            # Keep higher-priority (lower number) source
            if priority < existing_priority:
                merged[key] = record
            # If same priority, keep the one with a non-null value
            elif priority == existing_priority and record.get("value") is not None and merged[key].get("value") is None:
                merged[key] = record

    return merged


# ─── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("=== Data Merger ===\n")

    # Load all scraper outputs
    print("Loading scraper outputs:")
    all_records: list[dict] = []
    for path in INPUT_FILES:
        records = load_scraper_output(path)
        all_records.extend(records)

    if not all_records:
        print("\nNo records found. Run the scrapers first.")
        return 1

    # Filter out records with no value and MISSING status
    records_with_data = [r for r in all_records if r.get("value") is not None]
    print(f"\nTotal records loaded: {len(all_records)}")
    print(f"Records with values: {len(records_with_data)}")

    # Validate
    print("\nValidating records...")
    validated = [validate_record(r) for r in all_records]
    review_count = sum(1 for r in validated if r.get("status") == "REVIEW_NEEDED" and r.get("validation_note"))
    print(f"  Flagged as REVIEW_NEEDED: {review_count}")

    # Merge (deduplicate by market+metric)
    print("\nMerging (deduplicating by market+metric)...")
    merged = merge_records(validated)
    print(f"  Unique market+metric pairs: {len(merged)}")

    # Build output structures
    # 1. Full audit trail for scrapers/output/
    merged_records = list(merged.values())
    merged_records.sort(key=lambda r: (r["market_id"], r["metric_id"]))

    # 2. Master data for React app (public/data/master_data.json)
    # Format: { markets: { market_id: { metrics: { numeric_id: { value, source, status } } } } }
    master: dict = {
        "generated_at": date.today().isoformat(),
        "version": 1,
        "metrics": {},
        "markets": {},
    }

    # Build metrics coverage summary
    metrics_seen: set[str] = set()
    for record in merged_records:
        mid = record["market_id"]
        metric_str = record["metric_id"]
        metric_num = METRIC_ID_MAP.get(metric_str)
        if metric_num is None:
            continue

        metrics_seen.add(metric_str)

        if mid not in master["markets"]:
            master["markets"][mid] = {
                "name": record["market"],
                "region": record["region"],
                "metrics": {},
            }

        if record.get("value") is not None:
            master["markets"][mid]["metrics"][str(metric_num)] = {
                "value": record["value"],
                "source_name": record.get("source_name", ""),
                "source_url": record.get("source_url", ""),
                "source_date": record.get("source_date", ""),
                "status": record.get("status", "VERIFIED"),
                "geographic_level": record.get("geographic_level", "market"),
            }

    master["metrics"] = sorted(list(metrics_seen))

    # Summary
    total_values = sum(
        len(m["metrics"]) for m in master["markets"].values()
    )
    markets_with_data = sum(
        1 for m in master["markets"].values() if len(m["metrics"]) > 0
    )

    summary = {
        "total_records": len(merged_records),
        "records_with_value": sum(1 for r in merged_records if r["value"] is not None),
        "records_missing": sum(1 for r in merged_records if r["value"] is None),
        "review_needed": sum(1 for r in merged_records if r.get("status") == "REVIEW_NEEDED"),
        "metrics_covered": sorted(list(metrics_seen)),
        "markets_with_data": markets_with_data,
        "total_metric_values": total_values,
    }

    # Write full audit trail
    audit_output = {
        "generated_at": date.today().isoformat(),
        "summary": summary,
        "records": merged_records,
    }
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    audit_path = OUTPUT_DIR / "merged_data.json"
    with open(audit_path, "w") as f:
        json.dump(audit_output, f, indent=2)
    print(f"\nAudit trail: {audit_path}")

    # Write master_data.json for React app
    PUBLIC_DATA_DIR.mkdir(parents=True, exist_ok=True)
    master_path = PUBLIC_DATA_DIR / "master_data.json"
    with open(master_path, "w") as f:
        json.dump(master, f, indent=2)
    print(f"Master data: {master_path}")

    # Print summary
    print(f"\n=== Summary ===")
    print(f"  Metrics covered: {', '.join(summary['metrics_covered'])}")
    print(f"  Markets with data: {summary['markets_with_data']}/76")
    print(f"  Total metric values: {summary['total_metric_values']}")
    print(f"  Review needed: {summary['review_needed']}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
