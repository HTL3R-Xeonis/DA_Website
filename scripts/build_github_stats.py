#!/usr/bin/env python3
"""Zahlen zu den öffentlichen Repositories der Organisation für die Startseite (data/github-stats.json).

Gezählt werden nur öffentliche Repositories (ohne Forks und archivierte). Es werden nur Summen veröffentlicht,
keine Namen von Personen. Aufruf: python3 scripts/build_github_stats.py [Ausgabedatei]

Token: Umgebungsvariable GITHUB_TOKEN (in der GitHub Action vorhanden); lokal wird ersatzweise `gh auth token` genutzt.
"""

from __future__ import annotations

import datetime
import json
import os
import re
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request
from collections import Counter
from pathlib import Path

ORG = "HTL3R-Xeonis"
API = "https://api.github.com"

# Entwicklungszweig, wenn er nicht der Standardzweig ist (TopologyBuilder entwickelt auf Mjonyr, main bleibt unverändert)
BRANCH_OVERRIDES = {"TopologyBuilder": "Mjonyr"}

# Dateiendung -> Sprache (nur Quellcode wird als Codezeilen gezählt)
LANGUAGES = {
    ".py": "Python",
    ".js": "JavaScript",
    ".mjs": "JavaScript",
    ".ts": "TypeScript",
    ".tsx": "TypeScript",
    ".jsx": "JavaScript",
    ".html": "HTML",
    ".css": "CSS",
    ".scss": "CSS",
    ".sh": "Shell",
    ".bash": "Shell",
    ".ps1": "PowerShell",
    ".sql": "SQL",
    ".go": "Go",
}

SKIP_DIRS = {"node_modules", "vendor", "dist", "build", ".venv", "venv", "__pycache__", ".git", "site-packages"}
MAX_FILE_BYTES = 1_000_000


def token() -> str | None:
    value = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    if value:
        return value
    try:
        return subprocess.run(["gh", "auth", "token"], capture_output=True, text=True, check=True).stdout.strip() or None
    except (OSError, subprocess.CalledProcessError):
        return None


def request(path: str, tok: str | None):
    headers = {"Accept": "application/vnd.github+json", "User-Agent": "xeonis-site-stats"}
    if tok:
        headers["Authorization"] = "Bearer " + tok
    req = urllib.request.Request(API + path, headers=headers)
    with urllib.request.urlopen(req, timeout=30) as response:
        return json.loads(response.read().decode("utf-8")), response.headers


def count_via_link(path: str, tok: str | None) -> int:
    """Anzahl der Einträge einer Liste: mit per_page=1 steht sie in der letzten Seite des Link-Headers."""
    try:
        data, headers = request(path + ("&" if "?" in path else "?") + "per_page=1", tok)
    except urllib.error.HTTPError as error:
        if error.code in (404, 409):  # leeres Repository
            return 0
        raise
    link = headers.get("Link", "")
    match = re.search(r'[?&]page=(\d+)>; rel="last"', link)
    if match:
        return int(match.group(1))
    return len(data)


def contributors(repo: str, tok: str | None) -> set[str]:
    try:
        data, _ = request(f"/repos/{ORG}/{repo}/contributors?per_page=100", tok)
    except urllib.error.HTTPError:
        return set()
    return {c["login"] for c in data if c.get("type") != "Bot" and not c["login"].endswith("[bot]")}


def is_test(path: str) -> bool:
    parts = path.split("/")
    name = parts[-1]
    return "tests" in parts[:-1] or "test" in parts[:-1] or name.startswith("test_") or ".test." in name or ".spec." in name


def count_lines(repo_dir: Path) -> tuple[Counter, int]:
    """(Zeilen je Sprache, davon Testzeilen); leere Zeilen zählen nicht."""
    by_language: Counter = Counter()
    test_lines = 0
    files = subprocess.run(["git", "ls-files", "-z"], cwd=repo_dir, capture_output=True, check=True).stdout.split(b"\0")
    for raw in files:
        if not raw:
            continue
        rel = raw.decode("utf-8", "replace")
        if any(part in SKIP_DIRS for part in rel.split("/")[:-1]) or rel.endswith((".min.js", ".min.css")):
            continue
        language = LANGUAGES.get(Path(rel).suffix.lower())
        if not language:
            continue
        path = repo_dir / rel
        try:
            if not path.is_file() or path.stat().st_size > MAX_FILE_BYTES:
                continue
            text = path.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        lines = sum(1 for line in text.splitlines() if line.strip())
        by_language[language] += lines
        if is_test(rel):
            test_lines += lines
    return by_language, test_lines


def clone(repo: str, branch: str | None, target: Path) -> None:
    command = ["git", "clone", "--quiet", "--depth", "1"]
    if branch:
        command += ["--branch", branch]
    command += [f"https://github.com/{ORG}/{repo}.git", str(target)]
    subprocess.run(command, check=True, env={**os.environ, "GIT_TERMINAL_PROMPT": "0"})


def main() -> int:
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent / "data" / "github-stats.json"
    tok = token()
    repos, _ = request(f"/orgs/{ORG}/repos?type=public&per_page=100", tok)
    repos = [r for r in repos if not r["fork"] and not r["archived"] and r["visibility"] == "public"]

    totals = {"repos": 0, "commits": 0, "releases": 0, "code_lines": 0, "test_lines": 0}
    languages: Counter = Counter()
    people: set[str] = set()
    per_repo = []

    with tempfile.TemporaryDirectory() as tmp:
        for repo in sorted(repos, key=lambda r: r["name"].lower()):
            name = repo["name"]
            branch = BRANCH_OVERRIDES.get(name, repo["default_branch"])
            commits = count_via_link(f"/repos/{ORG}/{name}/commits?sha={branch}", tok)
            releases = count_via_link(f"/repos/{ORG}/{name}/releases", tok)
            people |= contributors(name, tok)
            target = Path(tmp) / name
            by_language, test_lines = {}, 0
            try:
                clone(name, branch, target)
                by_language, test_lines = count_lines(target)
            except subprocess.CalledProcessError:
                print(f"Warnung: {name} konnte nicht gezählt werden", file=sys.stderr)
            code = sum(by_language.values())
            languages.update(by_language)
            totals["repos"] += 1
            totals["commits"] += commits
            totals["releases"] += releases
            totals["code_lines"] += code
            totals["test_lines"] += test_lines
            per_repo.append({"name": name, "branch": branch, "commits": commits, "releases": releases, "code_lines": code})
            print(f"{name:24} {branch:8} commits {commits:5}  releases {releases:3}  code {code:7}  tests {test_lines:6}")

    result = {
        "generated_at": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "org": ORG,
        "totals": {**totals, "contributors": len(people)},
        "languages": [{"name": n, "lines": c} for n, c in languages.most_common()],
        "repos": per_repo,
    }
    out.parent.mkdir(parents=True, exist_ok=True)
    if out.exists():
        # unveränderte Zahlen: Datei nicht anfassen, damit die Action keinen leeren Commit macht
        try:
            previous = json.loads(out.read_text(encoding="utf-8"))
            if {k: v for k, v in previous.items() if k != "generated_at"} == {k: v for k, v in result.items() if k != "generated_at"}:
                print("Zahlen unverändert, Datei bleibt.")
                return 0
        except (OSError, ValueError):
            pass
    out.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print("->", out, json.dumps(result["totals"]))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
