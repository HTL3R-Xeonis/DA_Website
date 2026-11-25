/* Rackplan: drehbares 3D-Rack mit klickbaren Geräten (keine Bibliothek, keine Hover-Effekte) */
(function () {
    'use strict';

    const stage = document.getElementById('rackStage');
    const rack = document.getElementById('rack3d');
    const list = document.getElementById('rackList');
    if (!stage || !rack || !list) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* Geometrie des Bildes (930 x 2977 px): Mitte von HE 42 und HE 1, daraus die Höhe einer HE */
    const IMG_H = 2977;
    const U42_CENTER = 128.4;
    const U1_CENTER = 2793;
    const PER_U = (U1_CENTER - U42_CENTER) / 41;

    /* Geräte laut Rackplan (HE von oben gezählt wie im Rack; ranges = [oberste HE, unterste HE]) */
    const DEVICES = [
        {
            id: 'catalyst',
            name: 'Cisco Catalyst 4948',
            ranges: [[40, 40]],
            text: ['Switch des Racks (1 HE) für die Anbindung der Server.']
        },
        {
            id: 'dl160',
            name: 'HPE ProLiant DL160 Gen9',
            ranges: [[39, 39]],
            text: ['Server (1 HE). Gehört zu den weiteren Servern des Racks für internen Speicher, Services und das lokale LLM.']
        },
        {
            id: 'vnx-dae',
            name: 'EMC VNX DAE',
            count: '4 Stück',
            ranges: [[37, 35], [34, 32], [31, 29], [11, 9]],
            text: [
                'Disk Array Enclosures (je 3 HE): zusätzliche Festplatten für den EMC-VNX-Speicher.',
                'Der zusätzliche Speicher der Blade-Server kommt per Fibre Channel vom EMC VNX.'
            ]
        },
        {
            id: 'vnx-dpe',
            name: 'EMC VNX5200 DPE',
            count: '2 Stück',
            ranges: [[28, 26], [14, 12]],
            text: ['Disk Processor Enclosures (je 3 HE): die Steuereinheiten des EMC-VNX-Speichersystems.']
        },
        {
            id: 'blende',
            name: 'Rack-Blende',
            ranges: [[24, 24]],
            text: ['Blende (1 HE) zwischen Speicher und Servern für Luftführung und Optik.']
        },
        {
            id: 'dl385',
            name: 'HP ProLiant DL385 G7',
            ranges: [[23, 22]],
            text: ['Server (2 HE) mit sechs Einschüben an der Vorderseite.']
        },
        {
            id: 'r730',
            name: 'Dell PowerEdge R730',
            ranges: [[21, 20]],
            text: ['Server (2 HE) für Speicher, Services und das lokale LLM.']
        },
        {
            id: 'powervault',
            name: 'Dell PowerVault',
            count: '5 Disk-Schubladen',
            ranges: [[19, 15]],
            text: ['Disk-Gehäuse (JBOD, 5 HE) mit fünf ausziehbaren Schubladen für viele Festplatten.']
        },
        {
            id: 'ucs-fi',
            name: 'Cisco UCS 6248UP',
            count: '2 Stück',
            ranges: [[8, 8], [7, 7]],
            text: ['Fabric Interconnects (je 1 HE): verbinden das Blade-Chassis mit Netzwerk und Speicher. Hier läuft der UCS-Manager.']
        },
        {
            id: 'ucs-chassis',
            name: 'Cisco UCS 5108 mit 8× B200 M2',
            ranges: [[6, 1]],
            text: [
                'Blade-Chassis (6 HE) mit 8 Servern. Sie werden über den UCS-Manager mit Service-Profiles konfiguriert und als ESXi-Testumgebungen bereitgestellt.'
            ]
        }
    ];

    /* ---------- Hilfsfunktionen ---------- */
    function heLabel(range) {
        return range[0] === range[1] ? 'HE ' + range[0] : 'HE ' + range[1] + '–' + range[0];
    }

    function heTotal(device) {
        return device.ranges.reduce((sum, r) => sum + (r[0] - r[1] + 1), 0);
    }

    function band(range) {
        const top = (U42_CENTER + (42 - range[0]) * PER_U - PER_U / 2) / IMG_H;
        const height = ((range[0] - range[1] + 1) * PER_U) / IMG_H;
        return { top: (top * 100).toFixed(3) + '%', height: (height * 100).toFixed(3) + '%' };
    }

    /* ---------- Liste und klickbare Flächen aufbauen ---------- */
    const hitsById = {};
    const itemsById = {};

    DEVICES.forEach((device) => {
        hitsById[device.id] = [];

        const li = document.createElement('li');
        li.className = 'rack-item';
        li.dataset.device = device.id;

        const button = document.createElement('button');
        button.type = 'button';
        button.setAttribute('aria-expanded', 'false');
        button.innerHTML =
            '<span class="rack-item-name"></span><span class="rack-item-he"></span>';
        button.querySelector('.rack-item-name').textContent = device.name;
        button.querySelector('.rack-item-he').textContent = device.count || heTotal(device) + ' HE';

        const body = document.createElement('div');
        body.className = 'rack-item-body';
        device.text.forEach((paragraph) => {
            const p = document.createElement('p');
            p.textContent = paragraph;
            body.appendChild(p);
        });
        const pos = document.createElement('p');
        pos.className = 'rack-item-pos';
        pos.textContent = 'Einbau: ' + device.ranges.map(heLabel).join(', ') + ' (von 42 HE)';
        body.appendChild(pos);

        li.append(button, body);
        list.appendChild(li);
        itemsById[device.id] = li;

        button.addEventListener('click', () => select(device.id, true));

        ['front', 'back'].forEach((side) => {
            const face = rack.querySelector('.rack-face--' + side);
            device.ranges.forEach((range) => {
                const hit = document.createElement('button');
                hit.type = 'button';
                hit.className = 'rack-hit';
                hit.tabIndex = -1;
                hit.setAttribute('aria-label', device.name + ' auswählen');
                const b = band(range);
                hit.style.top = b.top;
                hit.style.height = b.height;
                hit.addEventListener('click', () => {
                    if (dragMoved) return;
                    select(device.id, false);
                });
                face.appendChild(hit);
                hitsById[device.id].push(hit);
            });
        });
    });

    let activeId = null;

    function select(id, fromList) {
        const same = activeId === id;
        activeId = same && !fromList ? null : id;
        Object.keys(itemsById).forEach((key) => {
            const on = key === activeId;
            itemsById[key].classList.toggle('is-active', on);
            itemsById[key].querySelector('button').setAttribute('aria-expanded', String(on));
            hitsById[key].forEach((hit) => hit.classList.toggle('is-active', on));
        });
        if (activeId && !fromList) {
            itemsById[activeId].scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
        }
    }

    /* ---------- Drehen: Ziehen, Pfeiltasten, Voreinstellungen ---------- */
    let ry = -14;
    let rx = 4;
    let userTouched = false;
    let tween = null;

    function render(extraRy) {
        rack.style.setProperty('--ry', (ry + (extraRy || 0)).toFixed(2) + 'deg');
        rack.style.setProperty('--rx', rx.toFixed(2) + 'deg');
    }

    function animateTo(targetRy, targetRx) {
        userTouched = true;
        if (reduceMotion) {
            ry = targetRy;
            rx = targetRx;
            render();
            return;
        }
        let delta = (targetRy - ry) % 360;
        if (delta > 180) delta -= 360;
        if (delta <= -180) delta += 360;
        const fromRy = ry;
        const fromRx = rx;
        const start = performance.now();
        const duration = 800;
        tween = start;
        function step(now) {
            if (tween !== start) return; /* durch Ziehen oder neue Voreinstellung abgelöst */
            const t = Math.min(1, (now - start) / duration);
            const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
            ry = fromRy + delta * e;
            rx = fromRx + (targetRx - fromRx) * e;
            render();
            if (t < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
    }

    const presets = {
        front: [-14, 4],
        side: [-64, 6],
        back: [166, 4]
    };
    const controls = document.querySelectorAll('.rack-controls button');
    function setPressed(name) {
        controls.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === name)));
    }
    controls.forEach((button) => {
        button.addEventListener('click', () => {
            const p = presets[button.dataset.view];
            animateTo(p[0], p[1]);
            setPressed(button.dataset.view);
        });
    });

    let dragging = false;
    let dragMoved = false;
    let lastX = 0;
    let lastY = 0;
    let startX = 0;
    let startY = 0;

    stage.addEventListener('pointerdown', (event) => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        dragging = true;
        dragMoved = false;
        startX = lastX = event.clientX;
        startY = lastY = event.clientY;
    });

    stage.addEventListener('pointermove', (event) => {
        if (!dragging) return;
        if (!dragMoved && Math.hypot(event.clientX - startX, event.clientY - startY) < 5) return;
        if (!dragMoved) {
            dragMoved = true;
            userTouched = true;
            tween = null;
            stage.classList.add('is-dragging');
            try {
                stage.setPointerCapture(event.pointerId);
            } catch (e) {
                /* ältere Browser: ohne Capture weiter */
            }
        }
        ry += (event.clientX - lastX) * 0.45;
        rx = Math.max(0, Math.min(22, rx - (event.clientY - lastY) * 0.2));
        lastX = event.clientX;
        lastY = event.clientY;
        setPressed('');
        render();
    });

    function endDrag() {
        dragging = false;
        stage.classList.remove('is-dragging');
        /* der folgende click-Event soll nach dem Ziehen kein Gerät auswählen */
        setTimeout(() => {
            dragMoved = false;
        }, 0);
    }
    stage.addEventListener('pointerup', endDrag);
    stage.addEventListener('pointercancel', endDrag);

    stage.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowLeft') ry -= 10;
        else if (event.key === 'ArrowRight') ry += 10;
        else if (event.key === 'ArrowUp') rx = Math.min(22, rx + 4);
        else if (event.key === 'ArrowDown') rx = Math.max(0, rx - 4);
        else return;
        event.preventDefault();
        userTouched = true;
        tween = null;
        setPressed('');
        render();
    });

    /* leichtes Pendeln, bis jemand das Rack anfasst (nicht bei „weniger Bewegung") */
    if (!reduceMotion) {
        const t0 = performance.now();
        (function sway(now) {
            if (userTouched) return;
            render(Math.sin((now - t0) / 1800) * 7);
            requestAnimationFrame(sway);
        })(t0);
    }

    setPressed('front');
    render();
})();
