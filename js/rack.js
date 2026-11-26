/* Rackplan: drehbares 3D-Rack, jedes Gerät mit eigener Tiefe (keine Bibliothek, keine Hover-Effekte) */
(function () {
    'use strict';

    const stage = document.getElementById('rackStage');
    const rack = document.getElementById('rack3d');
    const list = document.getElementById('rackList');
    if (!stage || !rack || !list) return;

    const layout = rack.closest('.rack-layout');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* Rack-Maße in mm: Standard-Rack 600 x 1000, vordere und hintere Montageschienen je 45 mm von der Kante */
    const RACK_DEPTH = 1000;
    const MOUNT_FRONT = 45;
    const MOUNT_BACK = 45;
    layout.style.setProperty('--rack-depth-mm', String(RACK_DEPTH));
    const Z_FRONT = RACK_DEPTH / 2 - MOUNT_FRONT; /* Ebene der Gerätefronten */

    /* Geometrie des Rack-Bildes (930 x 2977 px): Mitte von HE 42 und HE 1, daraus die Höhe einer HE */
    const IMG_H = 2977;
    const U42_CENTER = 128.4;
    const U1_CENTER = 2793;
    const PER_U = (U1_CENTER - U42_CENTER) / 41;

    /* Geräte laut Rackplan. ranges = [oberste HE, unterste HE] (HE wie auf den Schienen, 42 oben).
       depth = Gerätetiefe in mm, GESCHÄTZT nach Herstellerangaben und gerundet - bitte am echten Gerät nachmessen. */
    const DEVICES = [
        {
            id: 'catalyst',
            name: 'Cisco Catalyst 4948',
            role: 'Switch',
            depth: 410,
            ranges: [[40, 40]]
        },
        {
            id: 'dl160',
            name: 'HPE ProLiant DL160 Gen9',
            role: 'Server',
            depth: 620,
            ranges: [[39, 39]]
        },
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
        {
            id: 'dl385',
            name: 'HP ProLiant DL385 G7',
            role: 'Server',
            depth: 700,
            ranges: [[23, 22]]
        },
        {
            id: 'r730',
            name: 'Dell PowerEdge R730',
            role: 'Server',
            depth: 700,
            ranges: [[21, 20]]
        },
        {
            id: 'powervault',
            name: 'Dell PowerVault',
            role: 'Disk-Gehäuse, 5 Schubladen',
            depth: 820,
            ranges: [[19, 15]]
        },
        {
            id: 'ucs-fi',
            name: 'Cisco UCS 6248UP',
            role: 'Fabric Interconnect',
            count: '2 Stück',
            depth: 760,
            ranges: [[8, 8], [7, 7]]
        },
        {
            id: 'ucs-chassis',
            name: 'Cisco UCS 5108',
            role: 'Blade-Chassis, 8 Server',
            depth: 810,
            ranges: [[6, 1]]
        }
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

    function mm(value) {
        return 'calc(' + value + ' * var(--mm))';
    }

    /* ---------- Liste und Auswahl (sofort, damit die Seite nicht springt) ---------- */
    const boxesById = {};
    const itemsById = {};
    let activeId = null;
    let dragMoved = false;

    DEVICES.forEach((device) => {
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

    /* Die 3D-Szene wird erst gebaut, wenn der Abschnitt in die Nähe des Bildschirms kommt (spart Ladezeit) */
    let built = false;
    function buildScene() {
        if (built) return;
        built = true;
        /* ---------- Szene: Boden, Schatten, Wände, Rahmen, Schienen, Füße ---------- */
        rack.appendChild(el('div', 'rack-floor3d'));
        rack.appendChild(el('div', 'rack-shadow'));
        ['left', 'right', 'top'].forEach((side) => rack.appendChild(el('div', 'rack-wall-' + side)));
        ['front', 'back'].forEach((side) => rack.appendChild(el('div', 'rack-ring rack-ring--' + side)));
        ['fl', 'fr', 'bl', 'br'].forEach((pos) => rack.appendChild(el('div', 'rack-rail rack-rail--' + pos)));

        /* Körper aus fünf Flächen (Füße, Steckdosenleisten): Position in Prozent des Racks, Maße als CSS-Ausdruck */
        function solid(className, opts) {
            const box = el('div', 'solid ' + className);
            box.style.left = opts.left;
            box.style.top = opts.top;
            box.style.setProperty('--bw', opts.bw);
            box.style.setProperty('--bh', opts.bh);
            box.style.setProperty('--bd', opts.bd);
            box.style.transform = 'translateZ(' + mm(opts.z) + ')';
            ['front', 'back', 'left', 'right', 'top'].forEach((side) => {
                const face = el('i', 's-' + side);
                if (opts.sockets === side) face.classList.add('pdu-sockets');
                box.appendChild(face);
            });
            rack.appendChild(box);
            return box;
        }

        [
            ['3%', Z_FRONT + 10],
            ['89%', Z_FRONT + 10],
            ['3%', -RACK_DEPTH / 2 + MOUNT_BACK + 20],
            ['89%', -RACK_DEPTH / 2 + MOUNT_BACK + 20]
        ].forEach(([left, z]) => {
            solid('solid--foot', {
                left: left,
                top: 'calc(100% - var(--foot-h))',
                bw: 'calc(var(--rack-w) * 0.08)',
                bh: 'var(--foot-h)',
                bd: mm(80),
                z: z - 30
            });
        });

        /* Steckdosenleisten hinten links und rechts (senkrecht), Steckplätze zur Rackmitte */
        const PDU_Z = -RACK_DEPTH / 2 + 60;
        solid('solid--pdu', { left: '0.8%', top: '36%', bw: 'calc(var(--rack-w) * 0.04)', bh: 'calc(var(--rack-h) * 0.56)', bd: mm(45), z: PDU_Z, sockets: 'right' });
        solid('solid--pdu', { left: '95.2%', top: '36%', bw: 'calc(var(--rack-w) * 0.04)', bh: 'calc(var(--rack-h) * 0.56)', bd: mm(45), z: PDU_Z, sockets: 'left' });

        /* ---------- Geräte als Körper und Liste ---------- */
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
        });

        if (activeId) applyActive();
        render();
    }

    function applyActive() {
        Object.keys(itemsById).forEach((key) => {
            const on = key === activeId;
            itemsById[key].classList.toggle('is-active', on);
            (boxesById[key] || []).forEach((box) => box.classList.toggle('is-active', on));
        });
    }

    function select(id, fromList) {
        activeId = activeId === id && !fromList ? null : id;
        applyActive();
        if (activeId && !fromList) {
            itemsById[activeId].scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
        }
    }

    /* ---------- Beleuchtung: Helligkeit der Flächen nach Drehwinkel ---------- */
    const LIGHT = (function () {
        const v = [-0.5, -0.7, 0.55];
        const l = Math.hypot(v[0], v[1], v[2]);
        return [v[0] / l, v[1] / l, v[2] / l];
    })();
    const NORMALS = { f: [0, 0, 1], b: [0, 0, -1], l: [-1, 0, 0], r: [1, 0, 0], t: [0, -1, 0] };

    function applyLight() {
        const a = (ry * Math.PI) / 180;
        const b = (rx * Math.PI) / 180;
        Object.keys(NORMALS).forEach((key) => {
            const n = NORMALS[key];
            /* wie die CSS-Drehung: erst um Y, dann um X */
            const x = n[0] * Math.cos(a) + n[2] * Math.sin(a);
            const z = -n[0] * Math.sin(a) + n[2] * Math.cos(a);
            const y2 = n[1] * Math.cos(b) - z * Math.sin(b);
            const z2 = n[1] * Math.sin(b) + z * Math.cos(b);
            const diffuse = Math.max(0, x * LIGHT[0] + y2 * LIGHT[1] + z2 * LIGHT[2]);
            rack.style.setProperty('--sh-' + key, (0.4 * (1 - diffuse)).toFixed(3));
            rack.style.setProperty('--hi-' + key, (0.14 * diffuse * diffuse).toFixed(3));
        });
    }

    /* ---------- Drehen: Ziehen, Pfeiltasten ---------- */
    let ry = -14;
    let rx = 10;
    let userTouched = false;

    function render(extraRy) {
        rack.style.setProperty('--ry', (ry + (extraRy || 0)).toFixed(2) + 'deg');
        rack.style.setProperty('--rx', rx.toFixed(2) + 'deg');
        applyLight();
        if (Math.cos((ry * Math.PI) / 180) < 0.4) rack.classList.add('show-back');
    }

    function markUsed() {
        userTouched = true;
        stage.classList.add('is-used');
        rack.classList.add('show-back'); /* Rückseitenbild erst jetzt laden, wenn jemand dreht */
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
            markUsed();
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
        markUsed();
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

    if ('IntersectionObserver' in window) {
        const watcher = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) {
                    buildScene();
                    watcher.disconnect();
                }
            },
            { rootMargin: '800px 0px' }
        );
        watcher.observe(stage);
    } else {
        buildScene();
    }

    render();
})();
