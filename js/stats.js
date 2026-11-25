/* Projektstatus: liest data/github-stats.json (wird täglich von einer GitHub Action erzeugt) */
(function () {
    'use strict';

    const grid = document.getElementById('statsGrid');
    if (!grid) return;
    const hardware = document.getElementById('hwGrid');

    const COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#a855f7', '#ef4444', '#64748b'];
    const number = new Intl.NumberFormat('de-AT');

    /* Hardware: von Hand gepflegt (data/hardware.json); nicht eingetragene Zahlen (null) bleiben ausgeblendet */
    if (hardware) {
        fetch('data/hardware.json', { cache: 'no-cache' })
            .then((response) => (response.ok ? response.json() : Promise.reject(new Error('keine Daten'))))
            .then((data) => {
                hardware.querySelectorAll('[data-hw]').forEach((node) => {
                    const value = data[node.dataset.hw];
                    if (typeof value !== 'number') return;
                    const text =
                        node.dataset.hw === 'storage_tb'
                            ? new Intl.NumberFormat('de-AT', { maximumFractionDigits: 1 }).format(value)
                            : number.format(value);
                    /* *_plus = Untergrenze, wird mit „+“ gezeigt */
                    node.textContent = text + (data[node.dataset.hw + '_plus'] === true ? '+' : '');
                    node.parentElement.hidden = false;
                });
            })
            .catch(() => {});
    }

    fetch('data/github-stats.json', { cache: 'no-cache' })
        .then((response) => {
            if (!response.ok) throw new Error('keine Daten');
            return response.json();
        })
        .then((data) => {
            const totals = data.totals || {};
            grid.querySelectorAll('[data-stat]').forEach((node) => {
                const value = totals[node.dataset.stat];
                if (typeof value === 'number') node.textContent = number.format(value);
            });

            const bar = document.getElementById('langBar');
            const legend = document.getElementById('langLegend');
            const languages = Array.isArray(data.languages) ? data.languages : [];
            const sum = languages.reduce((acc, item) => acc + item.lines, 0);
            if (bar && legend && sum > 0) {
                languages.forEach((item, index) => {
                    const share = (item.lines / sum) * 100;
                    const color = COLORS[index % COLORS.length];

                    const segment = document.createElement('span');
                    segment.style.width = share + '%';
                    segment.style.background = color;
                    bar.appendChild(segment);

                    const entry = document.createElement('li');
                    entry.style.setProperty('--dot', color);
                    entry.textContent = item.name + ' ' + (share < 1 ? '<1' : Math.round(share)) + ' %';
                    legend.appendChild(entry);
                });
            }

            const stamp = document.getElementById('statsDate');
            if (stamp && data.generated_at) {
                const date = new Date(data.generated_at);
                if (!Number.isNaN(date.getTime())) {
                    stamp.textContent = date.toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' });
                }
            }
        })
        .catch(() => {
            /* ohne Daten bleiben die Platzhalter „–“ stehen */
        });
})();
