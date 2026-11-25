/* Rackplan: drehbares 3D-Rack, jedes Gerät mit eigener Tiefe (keine Bibliothek, keine Hover-Effekte) */
(function () {
    'use strict';

    const stage = document.getElementById('rackStage');
    const rack = document.getElementById('rack3d');
    const list = document.getElementById('rackList');
    if (!stage || !rack || !list) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* Geometrie des Rack-Bildes (930 x 2977 px): Mitte von HE 42 und HE 1, daraus die Höhe einer HE */
    const IMG_H = 2977;
    const U42_CENTER = 128.4;
    const U1_CENTER = 2793;
    const PER_U = (U1_CENTER - U42_CENTER) / 41;

    /* Geräte laut Rackplan. ranges = [oberste HE, unterste HE] (HE wie auf den Schienen, 42 oben).
       depth = Gerätetiefe in mm, GESCHÄTZT nach Herstellerangaben und gerundet - bitte am echten Gerät nachmessen. */
    const DEVICES = [
        { id: 'catalyst', name: 'Cisco Catalyst 4948', role: 'Switch', depth: 410, ranges: [[40, 40]] },
        { id: 'dl160', name: 'HPE ProLiant DL160 Gen9', role: 'Server', depth: 620, ranges: [[39, 39]] },
        {
            id: 'vnx-dae',
            name: 'EMC VNX DAE',
            role: 'Speicher-Erweiterung',
            count: '4 Stück',
            depth: 360,
            ranges: [[37, 35], [34, 32], [31, 29], [11, 9]]
        },
        {
            id: 'vnx-dpe',
            name: 'EMC VNX5200 DPE',
            role: 'Speicher-Controller',
            count: '2 Stück',
            depth: 610,
            ranges: [[28, 26], [14, 12]]
        },
        { id: 'blende', name: 'Rack-Blende', role: 'Blende', depth: 20, ranges: [[24, 24]] },
        { id: 'dl385', name: 'HP ProLiant DL385 G7', role: 'Server', depth: 700, ranges: [[23, 22]] },
        { id: 'r730', name: 'Dell PowerEdge R730', role: 'Server', depth: 700, ranges: [[21, 20]] },
        { id: 'powervault', name: 'Dell PowerVault', role: 'Disk-Gehäuse, 5 Schubladen', depth: 820, ranges: [[19, 15]] },
        {
            id: 'ucs-fi',
            name: 'Cisco UCS 6248UP',
            role: 'Fabric Interconnect',
            count: '2 Stück',
            depth: 760,
            ranges: [[8, 8], [7, 7]]
        },
        { id: 'ucs-chassis', name: 'Cisco UCS 5108', role: 'Blade-Chassis, 8 Server', depth: 810, ranges: [[6, 1]] }
    ];

    function heLabel(range) {
        return range[0] === range[1] ? '' + range[0] : range[1] + '–' + range[0];
    }

    function heTotal(device) {
        return device.ranges.reduce((sum, r) => sum + (r[0] - r[1] + 1), 0);
    }

    function el(tag, className) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        return node;
    }

    /* ---------- Gehäuse: Seitenwände, Deckel, Schienen ---------- */
    ['left', 'right', 'top'].forEach((side) => rack.appendChild(el('div', 'rack-wall-' + side)));
    ['fl', 'fr', 'bl', 'br'].forEach((pos) => rack.appendChild(el('div', 'rack-rail rack-rail--' + pos)));

    /* ---------- Geräte als Körper und Liste ---------- */
    const boxesById = {};
    const itemsById = {};
    let activeId = null;
    let dragMoved = false;

    DEVICES.forEach((device) => {
        boxesById[device.id] = [];

        device.ranges.forEach((range) => {
            const box = el('div', 'dev');
            const top = (U42_CENTER + (42 - range[0]) * PER_U - PER_U / 2) / IMG_H;
            const height = ((range[0] - range[1] + 1) * PER_U) / IMG_H;
            box.style.setProperty('--t', top.toFixed(5));
            box.style.setProperty('--h', height.toFixed(5));
            box.style.setProperty('--dm', String(device.depth));

            ['front', 'back'].forEach((side) => {
                const face = el('button', 'dev-' + side);
                face.type = 'button';
                face.tabIndex = -1;
                face.setAttribute('aria-label', device.name + ' auswählen');
                face.addEventListener('click', () => {
                    if (dragMoved) return;
                    select(device.id, false);
                });
                box.appendChild(face);
            });
            ['left', 'right', 'top'].forEach((side) => box.appendChild(el('div', 'dev-' + side)));

            rack.appendChild(box);
            boxesById[device.id].push(box);
        });

        const li = el('li', 'rack-item');
        const button = el('button');
        button.type = 'button';

        const text = el('span');
        const name = el('span', 'rack-item-name');
        name.textContent = device.name;
        const meta = el('span', 'rack-item-meta');
        meta.textContent = device.role;
        text.append(name, meta);

        const badge = el('span', 'rack-item-he');
        badge.textContent = (device.count ? device.count + ' · ' : '') + 'HE ' + device.ranges.map(heLabel).join(', ');

        button.append(text, badge);
        li.appendChild(button);
        list.appendChild(li);
        itemsById[device.id] = li;

        button.addEventListener('click', () => select(device.id, true));
    });

    function select(id, fromList) {
        activeId = activeId === id && !fromList ? null : id;
        Object.keys(itemsById).forEach((key) => {
            const on = key === activeId;
            itemsById[key].classList.toggle('is-active', on);
            boxesById[key].forEach((box) => box.classList.toggle('is-active', on));
        });
        if (activeId && !fromList) {
            itemsById[activeId].scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
        }
    }

    /* ---------- Drehen: Ziehen, Pfeiltasten ---------- */
    let ry = -14;
    let rx = 4;
    let userTouched = false;

    function render(extraRy) {
        rack.style.setProperty('--ry', (ry + (extraRy || 0)).toFixed(2) + 'deg');
        rack.style.setProperty('--rx', rx.toFixed(2) + 'deg');
    }

    let dragging = false;
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

    render();
})();
