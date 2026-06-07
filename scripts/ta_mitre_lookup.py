"""
ta_mitre_lookup.py — MITRE ATT&CK lookup for CIPHER.

Usage:
    python ta_mitre_lookup.py techniques <query>
    python ta_mitre_lookup.py mitigations <query>
    python ta_mitre_lookup.py technique-mitigations <technique_id>
    python ta_mitre_lookup.py status

Outputs JSON to stdout: { "results": [...], "error": "...", "dataAvailable": bool }
"""

import sys
import json
import logging

logging.basicConfig(level=logging.ERROR)
logging.getLogger("chatbot").setLevel(logging.ERROR)


def _safe_str(v, limit=500):
    return str(v)[:limit] if v else ""


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: ta_mitre_lookup.py <mode> [query]", "results": [], "dataAvailable": False}))
        return

    mode = sys.argv[1]

    # Status check — just verify data availability
    if mode == "status":
        try:
            from chatbot.modules.mitre import get_mitre_helper
            m = get_mitre_helper()
            techs = m.get_techniques() or []
            mits = m.get_mitigations() or []
            print(json.dumps({
                "dataAvailable": len(techs) > 0,
                "techniqueCount": len(techs),
                "mitigationCount": len(mits),
                "results": []
            }))
        except Exception as e:
            print(json.dumps({"dataAvailable": False, "error": str(e), "results": []}))
        return

    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: ta_mitre_lookup.py <mode> <query>", "results": [], "dataAvailable": False}))
        return

    query = sys.argv[2]

    try:
        from chatbot.modules.mitre import get_mitre_helper
        m = get_mitre_helper()
    except Exception as e:
        print(json.dumps({"error": f"MITRE data unavailable: {e}", "results": [], "dataAvailable": False}))
        return

    # Verify data is loaded
    all_techs = m.get_techniques() or []
    if not all_techs:
        print(json.dumps({
            "error": "MITRE ATT&CK data not loaded. enterprise-attack.json is missing.",
            "results": [],
            "dataAvailable": False,
            "setupHint": "Run: python3 -c \"from chatbot.modules.mitre import MitreHelper; m = MitreHelper(); m.update_data()\""
        }))
        return

    try:
        if mode == "techniques":
            q = query.strip()
            is_id = q.upper().startswith("T") and q[1:].replace(".", "").isdigit()

            if is_id:
                # Use find_technique for ID lookup
                t = m.find_technique(q.upper())
                if t:
                    results = [{
                        "id": getattr(t, "external_id", q.upper()),
                        "name": _safe_str(getattr(t, "name", "")),
                        "description": _safe_str(getattr(t, "description", "")),
                        "tactics": [getattr(tac, "shortname", str(tac)) for tac in (getattr(t, "tactics", None) or [])],
                        "mitigations": [{"id": getattr(mi, "external_id", ""), "name": _safe_str(getattr(mi, "name", ""))}
                                        for mi in (m.get_technique_mitigations(q.upper()) or [])],
                    }]
                else:
                    results = []
            else:
                # Keyword search over all techniques
                ql = q.lower()
                results = []
                for t in all_techs:
                    name = str(getattr(t, "name", ""))
                    ext_id = str(getattr(t, "external_id", ""))
                    desc = str(getattr(t, "description", ""))[:300]
                    if ql in name.lower() or ql in ext_id.lower() or ql in desc.lower():
                        results.append({
                            "id": ext_id,
                            "name": _safe_str(name),
                            "description": _safe_str(desc, 300),
                            "tactics": [getattr(tac, "shortname", str(tac)) for tac in (getattr(t, "tactics", None) or [])],
                        })
                        if len(results) >= 25:
                            break

        elif mode == "mitigations":
            ql = query.lower()
            all_mits = m.get_mitigations() or []
            results = []
            for mit in all_mits:
                mid = str(getattr(mit, "external_id", ""))
                mname = str(getattr(mit, "name", ""))
                mdesc = str(getattr(mit, "description", ""))[:300]
                if ql in mid.lower() or ql in mname.lower() or ql in mdesc.lower():
                    results.append({
                        "id": mid,
                        "name": _safe_str(mname),
                        "description": _safe_str(mdesc),
                    })
                    if len(results) >= 25:
                        break

        elif mode == "technique-mitigations":
            mits = m.get_technique_mitigations(query.upper()) or []
            results = [{"id": getattr(mi, "external_id", ""), "name": _safe_str(getattr(mi, "name", "")),
                        "description": _safe_str(getattr(mi, "description", ""), 300)} for mi in mits]

        else:
            print(json.dumps({"error": f"Unknown mode: {mode}", "results": [], "dataAvailable": False}))
            return

        print(json.dumps({"results": results, "dataAvailable": True}))

    except Exception as e:
        print(json.dumps({"error": str(e), "results": [], "dataAvailable": True}))


if __name__ == "__main__":
    main()
