#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-only
"""Fail if a forbidden term appears anywhere in the repository text files.

Medical-claim terms are allowed only inside an explicit negation (allowed phrases). A line passes
if, after removing every allowed phrase, no banned pattern matches. LICENSE (the verbatim AGPL
text) and this file (which must list the patterns) are excluded.
"""
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
EXCLUDE = {"LICENSE", "tests/forbidden_terms.py"}

# Explicit negations / safety wording that may mention otherwise-banned words.
ALLOWED = [
    r"not for diagnosis, treatment, or clinical decision-making",
    r"not be used for diagnosis, treatment, patient care, or any clinical decision-making",
    r"not for treatment,? (or )?patient care,? (or )?(clinical decision-making)?",
    r"not for treatment or patient care",
    r"not a medical device",
    r"not a medical assessment",
    r"not diagnostic",
    r"not clinically validated",
    r"lab,? or medical organi[sz]ation",
    r"do not use it with real patient data",
]
# Case-insensitive patterns: medical claims and out-of-scope claims.
BANNED_I = [
    r"\bdiagnos",                      # diagnoses, diagnosis, diagnostic
    r"clinical(ly)?[ -]valid",         # clinically validated, clinical validity
    r"clinically (proven|tested|approved)",
    r"m[ée]dical", r"\bpatients?\b", r"\btreatment", r"\bcures?\b", r"health ?care",
    r"\bFDA\b", r"\bCE[- ]mark", r"\bcertified\b", r"\bapproved (device|for)",
    r"\bNASA\b", r"quantum", r"\bqubits?\b", r"conscious",
]
# Case-sensitive third-party company / organization names (GitHub is the hosting platform).
BANNED_CS = [
    r"\b(Neuralink|Medtronic|Philips|Siemens|GE Healthcare|Abbott|Boston Scientific|Johnson ?& ?Johnson"
    r"|Apple|Google|Alphabet|Microsoft|Amazon|Meta|OpenAI|Anthropic|DeepMind|xAI|Nvidia|NVIDIA|IBM|Samsung"
    r"|Fitbit|Garmin|Oura|Whoop|Emotiv|Natus|Masimo|Dexcom|Mayo Clinic|Cleveland Clinic|Kaiser)\b",
]
allowed_re = [re.compile(p, re.I) for p in ALLOWED]
banned_re = [re.compile(p, re.I) for p in BANNED_I] + [re.compile(p) for p in BANNED_CS]

proc = subprocess.run(["git", "ls-files"], cwd=ROOT, capture_output=True, text=True)
files = proc.stdout.splitlines() if proc.returncode == 0 else []
if not files:  # not yet committed: scan the working tree
    files = [str(p.relative_to(ROOT)) for p in ROOT.rglob("*") if p.is_file() and ".git" not in p.parts]
hits = 0
for rel in sorted(files):
    if rel in EXCLUDE:
        continue
    p = ROOT / rel
    try:
        text = p.read_text(encoding="utf-8")
    except (UnicodeDecodeError, FileNotFoundError, IsADirectoryError):
        continue  # binary (PNG) or missing
    for n, line in enumerate(text.splitlines(), 1):
        cleaned = line
        for a in allowed_re:
            cleaned = a.sub(" ", cleaned)
        for b in banned_re:
            m = b.search(cleaned)
            if m:
                hits += 1
                print(f"{rel}:{n}: banned pattern {b.pattern[:60]!r} -> {m.group(0)!r}")
print(f"forbidden-terms scan: {hits} hit(s) in {len(files)} file(s)")
sys.exit(1 if hits else 0)
