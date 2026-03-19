// ===== ISRO Space Dashboard — Main Application =====

// Data sourced from local JSON files (bundled), with fallback to GitHub raw
const DATA_LOCAL = 'data';
const DATA_REMOTE = 'https://raw.githubusercontent.com/AdityaAsopa/isro_api/dev/data';
const WIKI_API = 'https://en.wikipedia.org/api/rest_v1/page/summary';

// ===== State =====
let allSpacecraft = [];
let allMissions = [];
let allLaunchers = [];
let allCustomerSats = [];
let allCentres = [];
let currentFilter = 'all';
let wikiCache = {};

// ===== Data Fetching =====
async function fetchJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch ${url}`);
    return res.json();
}

async function fetchWithFallback(filename) {
    try {
        return await fetchJSON(`${DATA_LOCAL}/${filename}`);
    } catch {
        return await fetchJSON(`${DATA_REMOTE}/${filename}`);
    }
}

async function loadAllData() {
    const [spacecraftData, launcherData, missionData, customerData, centreData] = await Promise.allSettled([
        fetchWithFallback('spacecrafts.json'),
        fetchWithFallback('launchers.json'),
        fetchWithFallback('spacecraft_missions.json'),
        fetchWithFallback('customer_satellites.json'),
        fetchWithFallback('centres.json'),
    ]);

    allSpacecraft = spacecraftData.status === 'fulfilled' ? (spacecraftData.value.spacecrafts || []) : [];
    allLaunchers = launcherData.status === 'fulfilled' ? (launcherData.value.launchers || []) : [];
    allMissions = missionData.status === 'fulfilled' ? (missionData.value.spacecraft_missions || []) : [];
    allCustomerSats = customerData.status === 'fulfilled' ? (customerData.value.customer_satellites || []) : [];
    allCentres = centreData.status === 'fulfilled' ? (centreData.value.centres || []) : [];

    // Merge mission data into spacecraft for richer info
    mergeSpacecraftData();
}

function mergeSpacecraftData() {
    const missionMap = {};
    allMissions.forEach(m => { missionMap[m.name.toLowerCase().trim()] = m; });

    allSpacecraft = allSpacecraft.map(sc => {
        const key = sc.name.toLowerCase().trim();
        const mission = missionMap[key];
        if (mission) {
            return { ...sc, ...mission, name: sc.name, id: sc.id };
        }
        return sc;
    });
}

// ===== Wikipedia Integration =====
async function fetchWikiSummary(title) {
    if (wikiCache[title]) return wikiCache[title];

    // Try different search terms
    const searches = [title, title.replace(/-/g, ' '), title.split('(')[0].trim()];
    for (const term of searches) {
        try {
            const encoded = encodeURIComponent(term.replace(/ /g, '_'));
            const res = await fetch(`${WIKI_API}/${encoded}`);
            if (res.ok) {
                const data = await res.json();
                if (data.extract && data.extract.length > 30) {
                    const result = { extract: data.extract, url: data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encoded}`, title: data.title, thumbnail: data.thumbnail };
                    wikiCache[title] = result;
                    return result;
                }
            }
        } catch { /* continue */ }
    }

    // Try with "satellite" or "spacecraft" appended
    for (const suffix of ['satellite', 'spacecraft', 'ISRO']) {
        try {
            const encoded = encodeURIComponent(`${title} ${suffix}`.replace(/ /g, '_'));
            const res = await fetch(`${WIKI_API}/${encoded}`);
            if (res.ok) {
                const data = await res.json();
                if (data.extract && data.extract.length > 30) {
                    const result = { extract: data.extract, url: data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encoded}`, title: data.title, thumbnail: data.thumbnail };
                    wikiCache[title] = result;
                    return result;
                }
            }
        } catch { /* continue */ }
    }

    return null;
}

// ===== Utility Functions =====
function formatDate(dateStr) {
    if (!dateStr) return 'Unknown';
    try {
        const d = new Date(dateStr);
        if (isNaN(d)) return dateStr;
        return d.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch { return dateStr; }
}

function getYear(dateStr) {
    if (!dateStr) return null;
    const match = dateStr.match(/(\d{4})/);
    return match ? parseInt(match[1]) : null;
}

function getStatusClass(status) {
    if (!status) return 'unknown';
    const s = status.toLowerCase();
    if (s.includes('active')) return 'active';
    if (s.includes('decommission')) return 'decommissioned';
    if (s.includes('fail')) return 'failed';
    return 'unknown';
}

function getStatusColor(status) {
    const cls = getStatusClass(status);
    switch (cls) {
        case 'active': return 'var(--accent-green)';
        case 'decommissioned': return 'var(--text-muted)';
        case 'failed': return 'var(--accent-red)';
        default: return 'var(--accent-orange)';
    }
}

function getOrbitColor(orbit) {
    switch (orbit) {
        case 'LEO': return '#3b82f6';
        case 'GEO': return '#f59e0b';
        case 'SSO': return '#10b981';
        case 'Lunar': return '#8b5cf6';
        case 'Interplanetary': return '#ec4899';
        case 'Failed': return '#ef4444';
        default: return '#64748b';
    }
}

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    const s = String(str);
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ===== Animated Counter =====
function animateCounter(el, target, duration = 1500) {
    const isStr = typeof target === 'string';
    const num = isStr ? parseInt(target) : target;
    if (isNaN(num)) { el.textContent = target; return; }
    const suffix = isStr ? target.replace(/\d+/, '') : '';
    let start = 0;
    const startTime = performance.now();
    function tick(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
        const current = Math.round(eased * num);
        el.textContent = current + suffix;
        if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}

// ===== Build Stats Section =====
function buildStats() {
    const totalSpacecraft = allSpacecraft.length;
    const active = allSpacecraft.filter(s => getStatusClass(s.status) === 'active').length;
    const totalLaunches = allLaunchers.length;
    const customerSats = allCustomerSats.length;
    const firstYear = allSpacecraft.reduce((min, s) => {
        const y = getYear(s.launch_date);
        return y && y < min ? y : min;
    }, 9999);
    const span = new Date().getFullYear() - firstYear;
    const uniqueCountries = new Set(allCustomerSats.map(c => c.country).filter(Boolean)).size;

    const stats = [
        { icon: '🛰️', number: totalSpacecraft, label: 'Spacecraft' },
        { icon: '✅', number: active, label: 'Active Now' },
        { icon: '🚀', number: totalLaunches, label: 'Launches' },
        { icon: '🌍', number: customerSats, label: 'Customer Sats' },
        { icon: '🏳️', number: uniqueCountries, label: 'Countries Served' },
        { icon: '📅', number: `${span}+`, label: 'Years in Space' },
    ];

    const grid = document.getElementById('stats-grid');
    grid.innerHTML = stats.map((s, i) => `
        <div class="stat-card">
            <div class="stat-icon">${s.icon}</div>
            <div class="stat-number" data-target="${s.number}" id="stat-${i}">0</div>
            <div class="stat-label">${s.label}</div>
        </div>
    `).join('');

    // Animate counters when visible
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                stats.forEach((s, i) => {
                    const el = document.getElementById(`stat-${i}`);
                    if (el) animateCounter(el, s.number, 1200 + i * 200);
                });
                observer.disconnect();
            }
        });
    }, { threshold: 0.3 });
    observer.observe(grid);
}

// ===== Build Timeline =====
function buildTimeline(filter = 'all') {
    const container = document.getElementById('timeline-items');
    let items = [...allSpacecraft].sort((a, b) => {
        const da = new Date(a.launch_date || '9999');
        const db = new Date(b.launch_date || '9999');
        return da - db;
    });

    if (filter !== 'all') {
        items = items.filter(s => getStatusClass(s.status) === filter);
    }

    // Build decade nav
    const decades = [...new Set(items.map(s => {
        const y = getYear(s.launch_date);
        return y ? Math.floor(y / 10) * 10 : null;
    }).filter(Boolean))].sort();

    const decadeNav = document.getElementById('decade-nav');
    decadeNav.innerHTML = decades.map(d => `<button class="decade-btn" onclick="scrollToDecade(${d})">${d}s</button>`).join('');

    container.innerHTML = items.map((s, i) => {
        const statusCls = getStatusClass(s.status);
        const year = getYear(s.launch_date);
        return `
        <div class="timeline-item status-${statusCls}" data-decade="${year ? Math.floor(year / 10) * 10 : ''}" style="animation-delay: ${Math.min(i * 0.03, 1)}s" onclick="openModal(${s.id})">
            <div class="timeline-card">
                <div class="timeline-date">${formatDate(s.launch_date)}</div>
                <div class="timeline-name">${escapeHtml(s.name)}</div>
                <div class="timeline-meta">
                    ${s.orbit_type ? `<span class="timeline-tag tag-orbit">${escapeHtml(s.orbit_type)}</span>` : ''}
                    ${s.launch_vehicle ? `<span class="timeline-tag tag-vehicle">${escapeHtml(s.launch_vehicle)}</span>` : ''}
                    <span class="timeline-tag tag-status ${statusCls}">${statusCls}</span>
                </div>
            </div>
        </div>`;
    }).join('');
}

function scrollToDecade(decade) {
    const item = document.querySelector(`.timeline-item[data-decade="${decade}"]`);
    if (item) item.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ===== Build Spacecraft Catalog =====
function buildSpacecraftCatalog() {
    const searchEl = document.getElementById('spacecraft-search');
    const orbitEl = document.getElementById('orbit-filter');
    const statusEl = document.getElementById('status-filter');
    const missionEl = document.getElementById('mission-filter');
    const sortEl = document.getElementById('sort-by');

    // Populate mission types
    const missionTypes = [...new Set(allSpacecraft.map(s => s.mission_type).filter(Boolean))].sort();
    missionEl.innerHTML = '<option value="all">All Missions</option>' +
        missionTypes.map(m => `<option value="${escapeHtml(m)}">${escapeHtml(m.length > 40 ? m.substring(0, 40) + '...' : m)}</option>`).join('');

    const render = () => {
        const search = searchEl.value.toLowerCase();
        const orbit = orbitEl.value;
        const status = statusEl.value;
        const mission = missionEl.value;
        const sort = sortEl.value;

        let filtered = allSpacecraft.filter(s => {
            if (search && !s.name.toLowerCase().includes(search) && !(s.mission_type || '').toLowerCase().includes(search)) return false;
            if (orbit !== 'all' && s.orbit_type !== orbit) return false;
            if (status !== 'all' && getStatusClass(s.status) !== status) return false;
            if (mission !== 'all' && s.mission_type !== mission) return false;
            return true;
        });

        switch (sort) {
            case 'date-asc': filtered.sort((a, b) => new Date(a.launch_date || '9999') - new Date(b.launch_date || '9999')); break;
            case 'date-desc': filtered.sort((a, b) => new Date(b.launch_date || '0000') - new Date(a.launch_date || '0000')); break;
            case 'name': filtered.sort((a, b) => a.name.localeCompare(b.name)); break;
            case 'mass': filtered.sort((a, b) => (b.mass_kg || 0) - (a.mass_kg || 0)); break;
        }

        document.getElementById('catalog-stats').textContent = `Showing ${filtered.length} of ${allSpacecraft.length} spacecraft`;

        const grid = document.getElementById('spacecraft-grid');
        if (filtered.length === 0) {
            grid.innerHTML = '<div class="no-results"><p>No spacecraft match your filters.</p></div>';
            return;
        }

        grid.innerHTML = filtered.map(s => {
            const statusCls = getStatusClass(s.status);
            const statusStyle = `background: ${getStatusColor(s.status)}22; color: ${getStatusColor(s.status)};`;
            return `
            <div class="spacecraft-card" onclick="openModal(${s.id})">
                <div class="spacecraft-card-header">
                    <div class="spacecraft-card-name">${escapeHtml(s.name)}</div>
                    <span class="spacecraft-card-status" style="${statusStyle}">${statusCls}</span>
                </div>
                <div class="spacecraft-card-date">${formatDate(s.launch_date)}</div>
                <div class="spacecraft-card-details">
                    ${s.orbit_type ? `<div class="spacecraft-detail"><span class="spacecraft-detail-label">Orbit</span><span class="spacecraft-detail-value">${escapeHtml(s.orbit_type)}</span></div>` : ''}
                    ${s.launch_vehicle ? `<div class="spacecraft-detail"><span class="spacecraft-detail-label">Vehicle</span><span class="spacecraft-detail-value">${escapeHtml(s.launch_vehicle)}</span></div>` : ''}
                    ${s.mass_kg ? `<div class="spacecraft-detail"><span class="spacecraft-detail-label">Mass</span><span class="spacecraft-detail-value">${s.mass_kg.toLocaleString()} kg</span></div>` : ''}
                    ${s.mission_life ? `<div class="spacecraft-detail"><span class="spacecraft-detail-label">Mission Life</span><span class="spacecraft-detail-value">${escapeHtml(s.mission_life)}</span></div>` : ''}
                </div>
                <div class="spacecraft-card-tags">
                    ${s.orbit_type ? `<span class="timeline-tag tag-orbit">${escapeHtml(s.orbit_type)}</span>` : ''}
                    ${s.mission_type ? `<span class="timeline-tag tag-vehicle">${escapeHtml(s.mission_type.length > 30 ? s.mission_type.substring(0, 30) + '...' : s.mission_type)}</span>` : ''}
                </div>
            </div>`;
        }).join('');
    };

    searchEl.addEventListener('input', render);
    orbitEl.addEventListener('change', render);
    statusEl.addEventListener('change', render);
    missionEl.addEventListener('change', render);
    sortEl.addEventListener('change', render);

    render();
}

// ===== Modal =====
async function openModal(id) {
    const sc = allSpacecraft.find(s => s.id === id);
    if (!sc) return;

    const modal = document.getElementById('spacecraft-modal');
    const body = document.getElementById('modal-body');
    const statusCls = getStatusClass(sc.status);

    const fields = [
        { label: 'Launch Date', value: formatDate(sc.launch_date) },
        { label: 'Launch Vehicle', value: sc.launch_vehicle },
        { label: 'Launch Site', value: sc.launch_site },
        { label: 'Orbit Type', value: sc.orbit_type },
        { label: 'Orbit', value: sc.orbit },
        { label: 'Altitude', value: sc.altitude_km ? `${sc.altitude_km.toLocaleString()} km` : null },
        { label: 'Inclination', value: sc.inclination_deg ? `${sc.inclination_deg}°` : null },
        { label: 'Mass', value: sc.mass_kg ? `${sc.mass_kg.toLocaleString()} kg` : null },
        { label: 'Power', value: sc.power_watts ? `${sc.power_watts.toLocaleString()} W` : null },
        { label: 'Mission Life', value: sc.mission_life },
        { label: 'Status', value: statusCls },
        { label: 'Mission Type', value: sc.mission_type },
    ].filter(f => f.value);

    body.innerHTML = `
        <h2 class="modal-title">${escapeHtml(sc.name)}</h2>
        <p class="modal-subtitle">${escapeHtml(sc.mission_type || 'ISRO Spacecraft')}</p>
        <div class="modal-grid">
            ${fields.map(f => `
                <div class="modal-field">
                    <div class="modal-field-label">${f.label}</div>
                    <div class="modal-field-value">${escapeHtml(String(f.value))}</div>
                </div>
            `).join('')}
        </div>
        ${sc.payloads ? `
            <h3 class="modal-section-title">Payloads</h3>
            <p class="modal-text">${escapeHtml(sc.payloads)}</p>
        ` : ''}
        ${sc.stabilization ? `
            <h3 class="modal-section-title">Stabilization</h3>
            <p class="modal-text">${escapeHtml(sc.stabilization)}</p>
        ` : ''}
        ${sc.propulsion ? `
            <h3 class="modal-section-title">Propulsion</h3>
            <p class="modal-text">${escapeHtml(sc.propulsion)}</p>
        ` : ''}
        <h3 class="modal-section-title">From Wikipedia</h3>
        <div id="wiki-content" class="modal-wiki-snippet">
            <span class="modal-wiki-loading">Loading Wikipedia summary...</span>
        </div>
        ${sc.orbit_type !== 'Failed' && sc.orbit_type !== 'GEO' ? `
            <h3 class="modal-section-title">Track This Satellite</h3>
            <p class="modal-text">Try spotting <strong>${escapeHtml(sc.name)}</strong> in the sky!</p>
            <a href="https://www.n2yo.com/?s=${encodeURIComponent(sc.name)}" target="_blank" rel="noopener" class="modal-wiki-link">🔭 Track on N2YO.com</a>
        ` : ''}
    `;

    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    // Load Wikipedia content
    const wikiDiv = document.getElementById('wiki-content');
    const wiki = await fetchWikiSummary(sc.name);
    if (wiki) {
        wikiDiv.innerHTML = `
            <p>${escapeHtml(wiki.extract)}</p>
            <a href="${wiki.url}" target="_blank" rel="noopener" class="modal-wiki-link">📖 Read more on Wikipedia</a>
        `;
    } else {
        const wikiSearch = encodeURIComponent(sc.name);
        wikiDiv.innerHTML = `
            <p style="color: var(--text-muted);">No Wikipedia summary found for this spacecraft.</p>
            <a href="https://en.wikipedia.org/wiki/Special:Search?search=${wikiSearch}" target="_blank" rel="noopener" class="modal-wiki-link">🔍 Search Wikipedia</a>
        `;
    }
}

function closeModal() {
    const modal = document.getElementById('spacecraft-modal');
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
}

// ===== Launch Vehicles =====
function buildLaunchers() {
    const families = {};
    allLaunchers.forEach(l => {
        const family = l.vehicle_family || 'Other';
        if (!families[family]) families[family] = [];
        families[family].push(l);
    });

    const familyDescriptions = {
        'SLV': 'The Satellite Launch Vehicle was India\'s first experimental satellite launch vehicle, developed in the 1970s-80s. It could place 40 kg payloads into Low Earth Orbit.',
        'ASLV': 'The Augmented Satellite Launch Vehicle was a stepping stone between SLV and PSLV, designed to place 150 kg into LEO. It had a mixed success record.',
        'PSLV': 'The Polar Satellite Launch Vehicle is ISRO\'s most reliable workhorse with 50+ consecutive successes. It can place 1,750 kg into SSO. It launched Chandrayaan-1 and Mars Orbiter Mission.',
        'GSLV': 'The Geosynchronous Satellite Launch Vehicle places heavy satellites into GTO. India became the 6th nation to develop cryogenic technology for GSLV Mk II.',
        'GSLV Mk III': 'India\'s heaviest launch vehicle (also called LVM-3) can place 4,000 kg into GTO. It launched Chandrayaan-2 and is being human-rated for Gaganyaan.',
        'LVM-3': 'Launch Vehicle Mark-3 (formerly GSLV Mk III) is India\'s most powerful rocket, capable of placing 10,000 kg into LEO or 4,000 kg into GTO.',
        'RLV': 'The Reusable Launch Vehicle Technology Demonstrator tests technologies for a future fully reusable two-stage-to-orbit vehicle.',
    };

    const familyOrder = ['SLV', 'ASLV', 'PSLV', 'GSLV', 'GSLV Mk III', 'LVM-3', 'RLV'];
    const sorted = Object.entries(families).sort((a, b) => {
        const ai = familyOrder.indexOf(a[0]);
        const bi = familyOrder.indexOf(b[0]);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

    const container = document.getElementById('launcher-families');
    container.innerHTML = sorted.map(([family, launchers]) => {
        const wikiName = family.replace(/ /g, '_');
        return `
        <div class="launcher-family">
            <div class="launcher-family-header">
                <h3 class="launcher-family-name">${escapeHtml(family)}</h3>
                <span class="launcher-family-count">${launchers.length} mission${launchers.length !== 1 ? 's' : ''}</span>
            </div>
            <p class="launcher-family-desc">${familyDescriptions[family] || `The ${family} family of launch vehicles.`}</p>
            <div class="launcher-list">
                ${launchers.map(l => `
                    <span class="launcher-chip ${l.customer_satellites_launched ? 'has-customers' : ''}"
                          title="${l.customer_satellites_launched ? 'Carried: ' + l.customer_satellites_launched.join(', ') : l.id}">
                        ${escapeHtml(l.id)}
                        ${l.customer_satellites_launched ? ` (${l.customer_satellites_launched.length} foreign)` : ''}
                    </span>
                `).join('')}
            </div>
            <a href="https://en.wikipedia.org/wiki/${wikiName}" target="_blank" rel="noopener" class="launcher-wiki-link">
                📖 Learn more on Wikipedia
            </a>
        </div>`;
    }).join('');
}

// ===== Orbital Visualization =====
function buildOrbitVisualization() {
    const canvas = document.getElementById('orbit-canvas');
    const ctx = canvas.getContext('2d');
    const container = canvas.parentElement;

    const resize = () => {
        const rect = container.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
        draw();
    };

    // Categorize spacecraft by orbit
    const orbitGroups = {};
    allSpacecraft.forEach(sc => {
        const orbit = sc.orbit_type || 'Unknown';
        if (orbit === 'Failed') return;
        if (!orbitGroups[orbit]) orbitGroups[orbit] = [];
        orbitGroups[orbit].push(sc);
    });

    // Build orbit legend
    const legend = document.getElementById('orbit-legend');
    legend.innerHTML = Object.entries(orbitGroups).map(([orbit, sats]) => `
        <div class="orbit-legend-item">
            <div class="orbit-legend-dot" style="background: ${getOrbitColor(orbit)};"></div>
            <span>${orbit} (${sats.length})</span>
        </div>
    `).join('');

    // Build orbit stats
    const statsGrid = document.getElementById('orbit-stats');
    statsGrid.innerHTML = Object.entries(orbitGroups).map(([orbit, sats]) => `
        <div class="orbit-stat-card">
            <div class="orbit-stat-number" style="color: ${getOrbitColor(orbit)};">${sats.length}</div>
            <div class="orbit-stat-label">${orbit} Orbit</div>
        </div>
    `).join('');

    // Store satellite positions for tooltip
    let satPositions = [];

    function draw() {
        const w = canvas.width / (window.devicePixelRatio || 1);
        const h = canvas.height / (window.devicePixelRatio || 1);
        const cx = w / 2;
        const cy = h / 2;
        const maxR = Math.min(w, h) / 2 - 20;

        ctx.clearRect(0, 0, w, h);
        satPositions = [];

        // Draw Earth
        const earthR = maxR * 0.12;
        const earthGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, earthR);
        earthGrad.addColorStop(0, '#4ade80');
        earthGrad.addColorStop(0.6, '#2563eb');
        earthGrad.addColorStop(1, '#1e3a5f');
        ctx.beginPath();
        ctx.arc(cx, cy, earthR, 0, Math.PI * 2);
        ctx.fillStyle = earthGrad;
        ctx.fill();

        // Draw "Earth" label
        ctx.fillStyle = '#fff';
        ctx.font = '11px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Earth', cx, cy + 4);

        // Orbit ring radii
        const orbitRadii = {
            'LEO': earthR + maxR * 0.15,
            'SSO': earthR + maxR * 0.28,
            'Lunar': maxR * 0.85,
            'Interplanetary': maxR * 0.95,
            'GEO': earthR + maxR * 0.55,
            'Unknown': earthR + maxR * 0.42,
        };

        // Draw orbit rings
        Object.entries(orbitRadii).forEach(([orbit, r]) => {
            if (!orbitGroups[orbit]) return;
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.strokeStyle = getOrbitColor(orbit) + '30';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Label
            ctx.fillStyle = getOrbitColor(orbit) + '80';
            ctx.font = '10px Inter, sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(orbit, cx + r + 5, cy);
        });

        // Place satellites on orbit rings
        const time = Date.now() / 50000;
        Object.entries(orbitGroups).forEach(([orbit, sats]) => {
            const r = orbitRadii[orbit] || earthR + maxR * 0.4;
            const color = getOrbitColor(orbit);

            sats.forEach((sc, i) => {
                const angle = (i / sats.length) * Math.PI * 2 + time * (orbit === 'LEO' ? 2 : orbit === 'SSO' ? 1.5 : 0.5);
                const x = cx + r * Math.cos(angle);
                const y = cy + r * Math.sin(angle);

                // Satellite dot
                const isActive = getStatusClass(sc.status) === 'active';
                ctx.beginPath();
                ctx.arc(x, y, isActive ? 4 : 3, 0, Math.PI * 2);
                ctx.fillStyle = color;
                ctx.globalAlpha = isActive ? 1 : 0.5;
                ctx.fill();
                ctx.globalAlpha = 1;

                // Glow for active
                if (isActive) {
                    ctx.beginPath();
                    ctx.arc(x, y, 8, 0, Math.PI * 2);
                    ctx.fillStyle = color + '20';
                    ctx.fill();
                }

                satPositions.push({ x, y, name: sc.name, orbit, status: sc.status, r: isActive ? 6 : 4 });
            });
        });
    }

    // Animation loop
    let animFrame;
    function animate() {
        draw();
        animFrame = requestAnimationFrame(animate);
    }

    // Tooltip on hover
    const tooltip = document.getElementById('orbit-tooltip');
    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const hit = satPositions.find(s => Math.hypot(s.x - x, s.y - y) < s.r + 4);
        if (hit) {
            tooltip.style.display = 'block';
            tooltip.style.left = (x + 15) + 'px';
            tooltip.style.top = (y - 10) + 'px';
            tooltip.innerHTML = `<strong>${escapeHtml(hit.name)}</strong><br>${hit.orbit} · ${getStatusClass(hit.status)}`;
        } else {
            tooltip.style.display = 'none';
        }
    });

    canvas.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });

    window.addEventListener('resize', resize);
    resize();

    // Only animate when visible
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                animate();
            } else {
                cancelAnimationFrame(animFrame);
            }
        });
    });
    observer.observe(canvas);
}

// ===== Customer Satellites =====
function buildCustomerSatellites() {
    if (allCustomerSats.length === 0) return;

    const countries = {};
    allCustomerSats.forEach(c => {
        const country = c.country || 'Unknown';
        if (!countries[country]) countries[country] = [];
        countries[country].push(c);
    });

    const uniqueCountries = Object.keys(countries).length;
    const totalSats = allCustomerSats.length;

    document.getElementById('customer-stats').innerHTML = `
        <div class="customer-stat"><div class="customer-stat-num">${totalSats}</div><div class="customer-stat-label">Foreign Satellites Launched</div></div>
        <div class="customer-stat"><div class="customer-stat-num">${uniqueCountries}</div><div class="customer-stat-label">Countries Served</div></div>
    `;

    document.getElementById('customer-grid').innerHTML = allCustomerSats.map(c => `
        <div class="customer-card">
            <div class="customer-card-name">${escapeHtml(c.id || c.name || 'Unknown')}</div>
            <div class="customer-card-info">
                ${c.launch_date ? `Launched: ${formatDate(c.launch_date)}` : ''}
                ${c.launcher ? ` · ${escapeHtml(c.launcher)}` : ''}
                ${c.mass_kg ? ` · ${c.mass_kg} kg` : ''}
            </div>
            ${c.country ? `<div class="customer-card-country"><span>${escapeHtml(c.country)}</span></div>` : ''}
        </div>
    `).join('');
}

// ===== Centres =====
function buildCentres() {
    if (allCentres.length === 0) return;

    document.getElementById('centres-grid').innerHTML = allCentres.map(c => `
        <div class="centre-card">
            <div class="centre-name">${escapeHtml(c.name)}</div>
            <div class="centre-location">
                📍 ${escapeHtml(c.place || '')}${c.state ? `, ${escapeHtml(c.state)}` : ''}
            </div>
        </div>
    `).join('');
}

// ===== Navigation =====
function setupNavigation() {
    // Scroll handler for navbar
    window.addEventListener('scroll', () => {
        document.getElementById('navbar').classList.toggle('scrolled', window.scrollY > 50);
    });

    // Active nav link
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-links a');

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                navLinks.forEach(link => {
                    link.classList.toggle('active', link.getAttribute('href') === '#' + entry.target.id);
                });
            }
        });
    }, { threshold: 0.3 });

    sections.forEach(s => observer.observe(s));

    // Mobile toggle
    document.querySelector('.nav-toggle').addEventListener('click', () => {
        document.querySelector('.nav-links').classList.toggle('open');
    });

    // Close mobile menu on link click
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            document.querySelector('.nav-links').classList.remove('open');
        });
    });

    // Modal close handlers
    document.querySelector('.modal-close').addEventListener('click', closeModal);
    document.querySelector('.modal-backdrop').addEventListener('click', closeModal);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

    // Timeline filter buttons
    document.querySelectorAll('.timeline-filters .filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.timeline-filters .filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            buildTimeline(btn.dataset.filter);
        });
    });
}

// ===== Hero Orbit Animation =====
function setupHeroAnimation() {
    const viz = document.getElementById('hero-orbit-viz');
    // Create CSS orbit rings
    const rings = [200, 280, 360, 440, 520];
    rings.forEach((size, i) => {
        const ring = document.createElement('div');
        ring.style.cssText = `
            position: absolute; width: ${size}px; height: ${size}px;
            border: 1px solid rgba(59,130,246,${0.15 - i * 0.02});
            border-radius: 50%; top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            animation: spin ${20 + i * 10}s linear infinite;
        `;

        // Add a dot satellite
        const dot = document.createElement('div');
        dot.style.cssText = `
            position: absolute; width: ${6 - i}px; height: ${6 - i}px;
            background: ${['#3b82f6', '#8b5cf6', '#06b6d4', '#f59e0b', '#10b981'][i]};
            border-radius: 50%; top: -3px; left: 50%;
            box-shadow: 0 0 10px ${['#3b82f6', '#8b5cf6', '#06b6d4', '#f59e0b', '#10b981'][i]}80;
        `;
        ring.appendChild(dot);
        viz.appendChild(ring);
    });

    // Add spin animation
    const style = document.createElement('style');
    style.textContent = `@keyframes spin { to { transform: translate(-50%, -50%) rotate(360deg); } }`;
    document.head.appendChild(style);
}

// ===== Initialize =====
async function init() {
    setupHeroAnimation();
    setupNavigation();

    try {
        await loadAllData();
    } catch (err) {
        console.error('Failed to load data:', err);
    }

    buildStats();
    buildTimeline();
    buildSpacecraftCatalog();
    buildLaunchers();
    buildOrbitVisualization();
    buildCustomerSatellites();
    buildCentres();

    setupSectionObserver();

    // Hide loading
    setTimeout(() => {
        document.getElementById('loading-overlay').classList.add('hidden');
    }, 500);
}

// ===== Section fade-in observer =====
function setupSectionObserver() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('section').forEach(s => observer.observe(s));
}

// Start
document.addEventListener('DOMContentLoaded', init);
