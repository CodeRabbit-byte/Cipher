"""
ta_analyze.py — CIPHER helper for deterministic ThreatAssessor analysis.

Usage:
    python ta_analyze.py <arch.mmd> [ssp_profile] [--generate-reports]

Output (stdout, JSON):
    { "ground_truth": {...}, "generated_files": ["ground_truth.json", ...] }

Exits with code 1 on failure.
"""

import sys
import json
import shutil
import logging
from pathlib import Path

logging.basicConfig(level=logging.ERROR)
logging.getLogger("chatbot").setLevel(logging.ERROR)


def main():
    if len(sys.argv) < 2:
        print("Usage: ta_analyze.py <arch.mmd> [ssp_profile] [--generate-reports]", file=sys.stderr)
        sys.exit(1)

    mmd_path = sys.argv[1]
    generate_reports = "--generate-reports" in sys.argv
    ssp_profile = next(
        (a for a in sys.argv[2:] if not a.startswith("--")),
        "medium_risk_cloud",
    )

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

    arch_name = Path(mmd_path).stem
    base_dir = Path(__file__).parent.parent / "vendor" / "threatassessor"
    report_dir = base_dir / "report" / arch_name
    report_dir.mkdir(parents=True, exist_ok=True)

    # Always save ground truth
    (report_dir / "ground_truth.json").write_text(
        json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    # Copy original diagram as before.mmd
    try:
        shutil.copy2(mmd_path, str(report_dir / "before.mmd"))
    except Exception:
        pass

    generated_files = ["ground_truth.json"]

    if generate_reports:
        report_output_dir = str(base_dir / "report")

        # Try the all-in-one package generator first
        try:
            from chatbot.modules.threat_report import generate_report_package
            files = generate_report_package(
                original_mmd_path=mmd_path,
                ground_truth=result,
                output_dir=report_output_dir,
            )
            generated_files = list({
                Path(p).name for p in files.values() if Path(p).exists()
            } | {"ground_truth.json"})
        except Exception as pkg_err:
            print(f"Warning: generate_report_package failed ({pkg_err}), falling back to individual generators", file=sys.stderr)

            # Fall back to individual generators
            try:
                from chatbot.modules.threat_report import (
                    generate_executive_summary,
                    generate_technical_report,
                    generate_action_plan,
                    generate_threat_model_report,
                    generate_adr_report,
                    generate_final_diagram,
                )
                for fname, fn in [
                    ("01_executive_summary.md", generate_executive_summary),
                    ("02_technical_report.md", generate_technical_report),
                    ("03_action_plan.md", generate_action_plan),
                    ("09_threat_model.md", generate_threat_model_report),
                    ("10_adr_report.md", generate_adr_report),
                ]:
                    try:
                        (report_dir / fname).write_text(fn(result), encoding="utf-8")
                        generated_files.append(fname)
                    except Exception as e:
                        print(f"Warning: {fname}: {e}", file=sys.stderr)

                try:
                    after_mmd = generate_final_diagram(result)
                    (report_dir / "after.mmd").write_text(after_mmd, encoding="utf-8")
                    generated_files.append("after.mmd")
                except Exception as e:
                    print(f"Warning: after.mmd: {e}", file=sys.stderr)

            except ImportError as e:
                print(f"Warning: individual generators unavailable: {e}", file=sys.stderr)

    print(json.dumps({"ground_truth": result, "generated_files": generated_files}, ensure_ascii=False))


if __name__ == "__main__":
    main()
