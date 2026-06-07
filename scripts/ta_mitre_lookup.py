"""
ta_mitre_lookup.py — MITRE ATT&CK lookup for CIPHER.

Usage:
    python ta_mitre_lookup.py techniques <query>
    python ta_mitre_lookup.py mitigations <query>
    python ta_mitre_lookup.py technique-mitigations <technique_id>

Outputs JSON to stdout: { "results": [...], "error": "..." }
"""

import sys
import json
import logging

logging.basicConfig(level=logging.ERROR)
logging.getLogger("chatbot").setLevel(logging.ERROR)


def _safe_str(v, limit=500):
    return str(v)[:limit] if v else ""


def main():
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: ta_mitre_lookup.py <mode> <query>", "results": []}))
        return

    mode = sys.argv[1]
    query = sys.argv[2]

    try:
        from chatbot.modules.mitre import get_mitre_helper
        mitre = get_mitre_helper()
    except Exception as e:
        print(json.dumps({"error": f"MITRE data unavailable: {e}", "results": []}))
        return

    try:
        if mode == "techniques":
            q = query.strip()
            # Exact technique ID lookup
            if q.upper().startswith("T") and q[1:].replace(".", "").isdigit():
                t = mitre.get_technique(q.upper())
                if t:
                    results = [{
                        "id": t.id,
                        "name": _safe_str(t.name),
                        "description": _safe_str(t.description),
                        "tactics": [tac.shortname for tac in (t.tactics or [])],
                        "mitigations": [{"id": m.id, "name": _safe_str(m.name)} for m in (t.mitigations or [])],
                    }]
                else:
                    results = []
            else:
                # Keyword search
                all_techs = mitre.get_techniques() or []
                ql = q.lower()
                results = []
                for t in all_techs:
                    if ql in str(t.id).lower() or ql in str(t.name).lower() or ql in str(t.description).lower()[:300]:
                        results.append({
                            "id": t.id,
                            "name": _safe_str(t.name),
                            "description": _safe_str(t.description, 300),
                            "tactics": [tac.shortname for tac in (t.tactics or [])],
                        })
                        if len(results) >= 25:
                            break

        elif mode == "mitigations":
            ql = query.lower()
            all_mitigations = mitre.get_mitigations() or []
            results = []
            for m in all_mitigations:
                if ql in str(m.id).lower() or ql in str(m.name).lower() or ql in str(m.description).lower()[:300]:
                    results.append({
                        "id": m.id,
                        "name": _safe_str(m.name),
                        "description": _safe_str(m.description),
                    })
                    if len(results) >= 25:
                        break

        elif mode == "technique-mitigations":
            t = mitre.get_technique(query.upper())
            if t and hasattr(t, "mitigations"):
                results = [{"id": m.id, "name": _safe_str(m.name), "description": _safe_str(m.description, 300)}
                           for m in (t.mitigations or [])]
            else:
                results = []

        else:
            print(json.dumps({"error": f"Unknown mode: {mode}", "results": []}))
            return

        print(json.dumps({"results": results}))

    except Exception as e:
        print(json.dumps({"error": str(e), "results": []}))


if __name__ == "__main__":
    main()
