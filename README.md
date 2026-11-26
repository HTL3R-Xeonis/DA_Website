# Xeonis Website

Kompakte Landingpage fuer die HTL 3 Rennweg Diplomarbeit **Xeonis**.

## Inhalt
- `index.html`: Startseite mit Hero, Projektzielen, Ergebnis, Projektstatus, Rackplan (3D) und Sponsoren
- `team.html`: Teamvorstellung
- `impressum-kontakt.html`: Impressum und Kontakt
- `css/style.css`: Gesamtes Styling (inkl. responsive Regeln)
- `js/main.js`: Mobile Navigation + Reveal-Animation
- `css/rack.css`, `js/rack.js`: drehbares 3D-Rack (reines CSS 3D, ohne Bibliothek), jedes Gerät als Körper mit eigener Tiefe, dazu schematisch nachgebaut: Doppelboden, Gehäuse mit Füßen, Steckdosenleisten und eine Beleuchtung, die sich mit dem Drehwinkel ändert. Die Geräte stehen im Array `DEVICES` in `js/rack.js` (Name, Rolle, Höheneinheiten, Tiefe in mm; die Tiefen sind geschätzt und gehören nachgemessen), die Rack-Maße in `css/rack.css`
- `assets/rack/`: Vorder- und Rückseite des Racks aus dem Rackplan (`Xeonis_Rackplan_TOFT_Vorder_Rückseite.pdf`), freigestellt und pixelgleich als verlustfreies WebP
- `css/results.css`, `js/stats.js`: Abschnitte „Ergebnis“ (Komponenten mit Links zu GitHub) und „Projektstatus“ (Zahlen)
- `scripts/build_github_stats.py`, `.github/workflows/github-stats.yml`, `data/github-stats.json`: Die Zahlen (Repositories, Commits, Zeilen Code, davon Tests, Releases, Mitwirkende, Sprachen) stammen aus den öffentlichen Repositories der Organisation. Eine GitHub Action erzeugt die Datei täglich und committet sie bei Änderungen; von Hand: `python3 scripts/build_github_stats.py` (braucht `gh` oder `GITHUB_TOKEN`). Codezeilen = nicht leere Zeilen in Quellcode-Dateien (Python, JavaScript, HTML, CSS, Shell, ...) ohne eingebundene Fremdbibliotheken (`vendor`, `node_modules`); bei TopologyBuilder zählt der Entwicklungszweig `Mjonyr`
- `data/hardware.json`: Hardware-Zahlen (Server, TB Speicher, GB Arbeitsspeicher), von Hand gepflegt; Werte mit `null` werden auf der Seite nicht gezeigt
- `favicon.ico`, `favicon-32.png`, `apple-touch-icon.png`, `assets/og-image.png`: Symbole und Vorschaubild für Link-Vorschauen (Open Graph), aus dem Xeonis-Logo erzeugt
- `assets/`: Bilder und Logos (PNG-Bilder liegen als verlustfreies WebP vor, pixelgleich)

