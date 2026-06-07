"""
ta_analyze.py — CIPHER helper for deterministic ThreatAssessor analysis.

Calls generate_ground_truth(use_llm=False) directly, bypassing the
ThreatAnalyst agent framework which requires an LLM API key.

Usage:
    python ta_analyze.py <path/to/arch.mmd> [ssp_profile]

Outputs:
    Saves report to vendor/threatassessor/report/<arch_name>/ground_truth.json
    Prints the JSON to stdout on success.
    Exits with code 1 and prints error to stderr on failure.
"""

import sys
import json
import logging
from pathlib import Path

# Silence noisy info logs so only errors reach the caller
logging.basicConfig(level=logging.ERROR)
logging.getLogger("chatbot").setLevel(logging.ERROR)

def main():
    if len(sys.argv) < 2:
        print("Usage: ta_analyze.py <arch.mmd> [ssp_profile]", file=sys.stderr)
        sys.exit(1)

    mmd_path   = sys.argv[1]
    ssp_profile = sys.argv[2] if len(sys.argv) > 2 else "medium_risk_cloud"

    try:
        from chatbot.modules.ground_truth_generator import generate_ground_truth
    except ImportError as e:
        print(f"Import error: {e}", file=sys.stderr)
        sys.exit(1)

    try:
        result = generate_ground_truth(
            mmd_file_path=mmd_path,
            use_llm=False,
            ssp_profile=ssp_profile,
            enable_ssp=True,
        )
    except Exception as e:
        print(f"Analysis error: {e}", file=sys.stderr)
        sys.exit(1)

    # Save to report directory so the reports list can find it
    arch_name  = Path(mmd_path).stem
    report_dir = Path(__file__).parent.parent / "vendor" / "threatassessor" / "report" / arch_name
    report_dir.mkdir(parents=True, exist_ok=True)
    gt_path = report_dir / "ground_truth.json"
    gt_path.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")

    # Print JSON to stdout for the API route to read
    print(json.dumps(result, ensure_ascii=False))

if __name__ == "__main__":
    main()
