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
    const decommissioned = allSpacecraft.filter(s => getStatusClass(s.status) === 'decommissioned').length;
    const failed = allSpacecraft.filter(s => getStatusClass(s.status) === 'failed').length;
    const totalLaunches = allLaunchers.length;
    const customerSats = allCustomerSats.length;
    const firstYear = allSpacecraft.reduce((min, s) => {
        const y = getYear(s.launch_date);
        return y && y < min ? y : min;
    }, 9999);
    const span = firstYear < 9999 ? new Date().getFullYear() - firstYear : 0;
    const uniqueCountries = new Set(allCustomerSats.map(c => c.country).filter(Boolean)).size;
    const centresCount = allCentres.length;
    const countOrbit = (o) => allSpacecraft.filter(s => s.orbit_type === o).length;
    const leo = countOrbit('LEO');
    const geo = countOrbit('GEO');
    const sso = countOrbit('SSO');
    const lunar = countOrbit('Lunar');
    const interplanetary = countOrbit('Interplanetary');

    // Key stats — prominent cards
    const keyStats = [
        { icon: '🛰️', number: totalSpacecraft, label: 'Spacecraft' },
        { icon: '✅', number: active, label: 'Active Now' },
        { icon: '🚀', number: totalLaunches, label: 'Launches' },
        { icon: '🌍', number: customerSats, label: 'Foreign Sats Launched' },
        { icon: '🏛️', number: centresCount, label: 'Centres' },
        { icon: '📅', number: span > 0 ? `${span}+` : '—', label: 'Years in Space' },
    ];

    // Detail stats — collapsed by default
    const detailStats = [
        { icon: '📴', number: decommissioned, label: 'Decommissioned' },
        { icon: '⚠️', number: failed, label: 'Failed' },
        { icon: '🏳️', number: uniqueCountries, label: 'Countries Served' },
        { icon: '🛸', number: leo, label: 'LEO' },
        { icon: '📡', number: geo, label: 'GEO' },
        { icon: '🌐', number: sso, label: 'SSO' },
        { icon: '🌙', number: lunar, label: 'Lunar' },
        { icon: '☄️', number: interplanetary, label: 'Deep Space' },
    ];

    const grid = document.getElementById('stats-grid');
    grid.innerHTML = `
        <div class="stats-key-grid">
            ${keyStats.map((s, i) => `
                <div class="stat-card stat-card-key">
                    <div class="stat-icon">${s.icon}</div>
                    <div class="stat-number" data-target="${s.number}" id="stat-${i}">0</div>
                    <div class="stat-label">${s.label}</div>
                </div>
            `).join('')}
        </div>
        <button class="stats-expand-btn" id="stats-expand-btn" aria-expanded="false">
            <span>Orbit breakdown & more</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
        </button>
        <div class="stats-detail-grid" id="stats-detail-grid">
            ${detailStats.map((s, i) => `
                <div class="stat-card stat-card-detail">
                    <div class="stat-icon">${s.icon}</div>
                    <div class="stat-number" data-target="${s.number}" id="stat-d-${i}">0</div>
                    <div class="stat-label">${s.label}</div>
                </div>
            `).join('')}
        </div>
    `;

    // Toggle expand
    document.getElementById('stats-expand-btn').addEventListener('click', function() {
        const detail = document.getElementById('stats-detail-grid');
        const expanded = this.getAttribute('aria-expanded') === 'true';
        this.setAttribute('aria-expanded', String(!expanded));
        detail.classList.toggle('open');
        this.querySelector('span').textContent = expanded ? 'Orbit breakdown & more' : 'Show less';
        if (!expanded) {
            detailStats.forEach((s, i) => {
                const el = document.getElementById(`stat-d-${i}`);
                if (el) animateCounter(el, s.number, 800);
            });
        }
    });

    // Animate key counters when visible
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                keyStats.forEach((s, i) => {
                    const el = document.getElementById(`stat-${i}`);
                    if (el) animateCounter(el, s.number, 1200 + i * 150);
                });
                observer.disconnect();
            }
        });
    }, { threshold: 0.2 });
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
        <div class="modal-header-row">
            <div class="modal-header-text">
                <h2 class="modal-title">${escapeHtml(sc.name)}</h2>
                <p class="modal-subtitle">${escapeHtml(sc.mission_type || 'ISRO Spacecraft')}</p>
            </div>
            <div class="modal-thumb" id="modal-thumb"></div>
        </div>
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
    const thumbDiv = document.getElementById('modal-thumb');
    const wiki = await fetchWikiSummary(sc.name);
    if (wiki) {
        if (wiki.thumbnail && thumbDiv) {
            thumbDiv.innerHTML = `<img src="${wiki.thumbnail.source}" alt="${escapeHtml(sc.name)}">`;
        }
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
const LAUNCHER_WIKI_TITLES = {
    'SLV': 'Satellite_Launch_Vehicle',
    'ASLV': 'Augmented_Satellite_Launch_Vehicle',
    'PSLV': 'Polar_Satellite_Launch_Vehicle',
    'GSLV': 'Geosynchronous_Satellite_Launch_Vehicle',
    'GSLV Mk III': 'LVM3',
    'LVM-3': 'LVM3',
    'RLV': 'RLV-TD',
};

async function fetchLauncherImage(family) {
    const title = LAUNCHER_WIKI_TITLES[family];
    if (!title) return null;
    try {
        const res = await fetch(`${WIKI_API}/${title}`);
        if (res.ok) {
            const data = await res.json();
            if (data.thumbnail && data.thumbnail.source) {
                return data.thumbnail.source;
            }
        }
    } catch { /* ignore */ }
    return null;
}

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
        const wikiTitle = LAUNCHER_WIKI_TITLES[family] || family.replace(/ /g, '_');
        return `
        <div class="launcher-family">
            <div class="launcher-family-top">
                <div class="launcher-family-img" id="launcher-img-${family.replace(/\s+/g, '-')}"></div>
                <div class="launcher-family-info">
                    <div class="launcher-family-header">
                        <h3 class="launcher-family-name">${escapeHtml(family)}</h3>
                        <span class="launcher-family-count">${launchers.length} mission${launchers.length !== 1 ? 's' : ''}</span>
                    </div>
                    <p class="launcher-family-desc">${familyDescriptions[family] || `The ${family} family of launch vehicles.`}</p>
                </div>
            </div>
            <div class="launcher-list">
                ${launchers.map(l => `
                    <span class="launcher-chip ${l.customer_satellites_launched ? 'has-customers' : ''}"
                          title="${l.customer_satellites_launched ? 'Carried: ' + l.customer_satellites_launched.join(', ') : l.id}">
                        ${escapeHtml(l.id)}
                        ${l.customer_satellites_launched ? ` (${l.customer_satellites_launched.length} foreign)` : ''}
                    </span>
                `).join('')}
            </div>
            <a href="https://en.wikipedia.org/wiki/${wikiTitle}" target="_blank" rel="noopener" class="launcher-wiki-link">
                📖 Learn more on Wikipedia
            </a>
        </div>`;
    }).join('');

    // Load images async
    sorted.forEach(([family]) => {
        fetchLauncherImage(family).then(url => {
            const imgContainer = document.getElementById(`launcher-img-${family.replace(/\s+/g, '-')}`);
            if (url && imgContainer) {
                imgContainer.innerHTML = `<img src="${url}" alt="${escapeHtml(family)}" loading="lazy">`;
            }
        });
    });
}

// ===== Orbit Mode Toggle =====
function setupOrbitModeToggle() {
    const btns = document.querySelectorAll('.orbit-mode-btn');
    const scaleView = document.getElementById('orbit-scale-view');
    const cartoonView = document.getElementById('orbit-cartoon-view');

    btns.forEach(btn => {
        btn.addEventListener('click', () => {
            btns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            if (btn.dataset.mode === 'scale') {
                scaleView.style.display = '';
                cartoonView.style.display = 'none';
            } else {
                scaleView.style.display = 'none';
                cartoonView.style.display = '';
            }
        });
    });
}

function buildOrbitScaleView() {
    const track = document.getElementById('orbit-scale-track');
    const scroll = document.getElementById('orbit-scale-scroll');
    if (!track || !scroll) return;

    const maxAlt = 45000;
    const trackWidth = 6000;
    track.style.width = trackWidth + 'px';

    function altToX(alt) { return (Math.sqrt(alt) / Math.sqrt(maxAlt)) * trackWidth; }

    // Earth at left edge
    const earthEl = document.createElement('div');
    earthEl.className = 'orbit-scale-earth';
    earthEl.innerHTML = '<span>Earth Surface</span>';
    track.appendChild(earthEl);

    // Reference zones
    [
        { start: 160, end: 2000, label: 'LEO', color: '#3b82f6' },
        { start: 2000, end: 20000, label: 'MEO', color: '#8b5cf6' },
        { start: 35000, end: 36500, label: 'GEO Belt', color: '#f59e0b' },
    ].forEach(z => {
        const el = document.createElement('div');
        el.className = 'orbit-scale-zone';
        el.style.left = altToX(z.start) + 'px';
        el.style.width = (altToX(z.end) - altToX(z.start)) + 'px';
        el.style.background = z.color + '15';
        el.style.borderLeft = `2px solid ${z.color}40`;
        el.style.borderRight = `2px solid ${z.color}40`;
        el.innerHTML = `<span class="orbit-scale-zone-label" style="color:${z.color}">${z.label}</span>`;
        track.appendChild(el);
    });

    // Place satellites
    const spacecraftWithAlt = allSpacecraft.filter(s => s.altitude_km && s.altitude_km > 0 && s.altitude_km <= maxAlt && s.orbit_type !== 'Failed');
    const groups = {};
    spacecraftWithAlt.forEach(sc => {
        const x = Math.round(altToX(sc.altitude_km) / 30) * 30;
        if (!groups[x]) groups[x] = [];
        groups[x].push(sc);
    });

    // Stagger satellites vertically to avoid overlap
    const usedRows = {};
    Object.entries(groups).forEach(([xBucket, sats]) => {
        const representative = sats[0];
        const x = altToX(representative.altitude_km);
        const color = getOrbitColor(representative.orbit_type);
        const isActive = sats.some(s => getStatusClass(s.status) === 'active');

        // Find a free vertical row
        let row = 0;
        const xKey = Math.round(x / 80);
        if (!usedRows[xKey]) usedRows[xKey] = 0;
        row = usedRows[xKey]++ % 3;

        const el = document.createElement('div');
        el.className = `orbit-scale-sat ${isActive ? 'orbit-scale-sat-active' : ''}`;
        el.style.left = x + 'px';
        el.style.top = `${25 + row * 65}px`;
        el.style.transform = 'none';

        const label = sats.length === 1 ? escapeHtml(sats[0].name) : `${sats.length} spacecraft`;
        el.innerHTML = `
            <div class="orbit-scale-sat-dot" style="background:${color}"></div>
            <div class="orbit-scale-sat-label">${label}</div>
            <div class="orbit-scale-sat-alt">${representative.altitude_km.toLocaleString()} km</div>
        `;
        el.title = sats.map(s => `${s.name} (${s.altitude_km} km)`).join('\n');
        if (sats.length === 1) el.addEventListener('click', () => openModal(sats[0].id));
        else el.addEventListener('click', () => { /* could expand group */ });
        el.style.cursor = 'pointer';
        track.appendChild(el);
    });

    // Tick marks
    [100, 200, 400, 600, 1000, 2000, 5000, 10000, 20000, 35786].forEach(alt => {
        const tick = document.createElement('div');
        tick.className = 'orbit-scale-tick';
        tick.style.left = altToX(alt) + 'px';
        tick.innerHTML = `<span>${alt >= 1000 ? (alt/1000) + 'k' : alt} km</span>`;
        track.appendChild(tick);
    });

    // Altitude readout on scroll
    const readout = document.createElement('div');
    readout.className = 'orbit-scale-readout';
    scroll.appendChild(readout);
    scroll.addEventListener('scroll', () => {
        const frac = scroll.scrollLeft / (trackWidth - scroll.clientWidth);
        const alt = Math.round(frac * frac * maxAlt);
        readout.textContent = `${alt.toLocaleString()} km`;
    });
}

// ===== Orbital Visualization (Canvas) =====
function buildOrbitVisualization() {
    const canvas = document.getElementById('orbit-canvas');
    const ctx = canvas.getContext('2d');
    const container = canvas.parentElement;

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
        <div class="orbit-legend-item" data-orbit="${orbit}">
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

    // Interactive state
    let zoom = 1;
    let panX = 0, panY = 0;
    let isDragging = false, dragStartX = 0, dragStartY = 0, panStartX = 0, panStartY = 0;
    let highlightOrbit = null;
    let selectedSat = null;
    let satPositions = [];

    // Legend click to filter
    legend.querySelectorAll('.orbit-legend-item').forEach(item => {
        item.style.cursor = 'pointer';
        item.addEventListener('click', () => {
            const orbit = item.dataset.orbit;
            if (highlightOrbit === orbit) { highlightOrbit = null; item.classList.remove('orbit-legend-active'); }
            else {
                legend.querySelectorAll('.orbit-legend-item').forEach(i => i.classList.remove('orbit-legend-active'));
                highlightOrbit = orbit; item.classList.add('orbit-legend-active');
            }
        });
    });

    const resize = () => {
        const rect = container.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    function draw() {
        const w = canvas.width / (window.devicePixelRatio || 1);
        const h = canvas.height / (window.devicePixelRatio || 1);
        const cx = w / 2 + panX;
        const cy = h / 2 + panY;
        const maxR = (Math.min(w, h) / 2 - 20) * zoom;

        ctx.clearRect(0, 0, w, h);
        satPositions = [];

        // Starfield dots
        ctx.save();
        for (let i = 0; i < 60; i++) {
            const sx = ((i * 137.508) % w);
            const sy = ((i * 97.31 + 50) % h);
            ctx.beginPath();
            ctx.arc(sx, sy, 0.5 + (i % 3) * 0.3, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,255,255,${0.1 + (i % 5) * 0.06})`;
            ctx.fill();
        }
        ctx.restore();

        // Draw Earth with atmosphere glow
        const earthR = maxR * 0.12;
        // Atmosphere glow
        const atmosGrad = ctx.createRadialGradient(cx, cy, earthR, cx, cy, earthR * 1.6);
        atmosGrad.addColorStop(0, 'rgba(59, 130, 246, 0.15)');
        atmosGrad.addColorStop(1, 'transparent');
        ctx.beginPath();
        ctx.arc(cx, cy, earthR * 1.6, 0, Math.PI * 2);
        ctx.fillStyle = atmosGrad;
        ctx.fill();

        // Earth sphere
        const earthGrad = ctx.createRadialGradient(cx - earthR * 0.3, cy - earthR * 0.3, 0, cx, cy, earthR);
        earthGrad.addColorStop(0, '#5ee8a0');
        earthGrad.addColorStop(0.3, '#4ade80');
        earthGrad.addColorStop(0.6, '#2563eb');
        earthGrad.addColorStop(1, '#1a365d');
        ctx.beginPath();
        ctx.arc(cx, cy, earthR, 0, Math.PI * 2);
        ctx.fillStyle = earthGrad;
        ctx.fill();

        // Earth label
        ctx.fillStyle = '#fff';
        ctx.font = `${Math.max(9, earthR * 0.35)}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Earth', cx, cy);

        // Orbit ring radii
        const orbitRadii = {
            'LEO': earthR + maxR * 0.15,
            'SSO': earthR + maxR * 0.28,
            'GEO': earthR + maxR * 0.55,
            'Unknown': earthR + maxR * 0.42,
            'Lunar': maxR * 0.82,
            'Interplanetary': maxR * 0.93,
        };

        // Draw orbit rings (with dashed style for outer orbits)
        Object.entries(orbitRadii).forEach(([orbit, r]) => {
            if (!orbitGroups[orbit]) return;
            const isHighlighted = !highlightOrbit || highlightOrbit === orbit;
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.strokeStyle = getOrbitColor(orbit) + (isHighlighted ? '40' : '12');
            ctx.lineWidth = isHighlighted ? 1.5 : 0.5;
            if (orbit === 'Lunar' || orbit === 'Interplanetary') ctx.setLineDash([4, 6]);
            else ctx.setLineDash([]);
            ctx.stroke();
            ctx.setLineDash([]);

            // Orbit label on ring
            const labelAngle = -Math.PI / 4;
            const lx = cx + (r + 12) * Math.cos(labelAngle);
            const ly = cy + (r + 12) * Math.sin(labelAngle);
            ctx.fillStyle = getOrbitColor(orbit) + (isHighlighted ? 'a0' : '40');
            ctx.font = `${Math.max(9, 10 * zoom)}px Inter, sans-serif`;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${orbit} (${orbitGroups[orbit].length})`, lx, ly);
        });

        // Place satellites
        const time = Date.now() / 40000;
        const speeds = { 'LEO': 3, 'SSO': 2.5, 'GEO': 0.3, 'Unknown': 1, 'Lunar': 0.15, 'Interplanetary': 0.08 };

        Object.entries(orbitGroups).forEach(([orbit, sats]) => {
            const r = orbitRadii[orbit] || earthR + maxR * 0.4;
            const color = getOrbitColor(orbit);
            const speed = speeds[orbit] || 1;
            const isHighlighted = !highlightOrbit || highlightOrbit === orbit;

            sats.forEach((sc, i) => {
                // Spread satellites with slight radial variation
                const radialJitter = (i % 3 - 1) * maxR * 0.015;
                const effectiveR = r + radialJitter;
                const angle = (i / sats.length) * Math.PI * 2 + time * speed;
                const x = cx + effectiveR * Math.cos(angle);
                const y = cy + effectiveR * Math.sin(angle);

                const isActive = getStatusClass(sc.status) === 'active';
                const isSel = selectedSat === sc.id;
                const alpha = isHighlighted ? (isActive ? 1 : 0.6) : 0.12;
                const dotR = (isActive ? 4 : 3) * (isSel ? 1.8 : 1) * Math.max(0.7, zoom * 0.8);

                // Trail for active satellites
                if (isActive && isHighlighted) {
                    const trailLen = 6;
                    for (let t = 1; t <= trailLen; t++) {
                        const ta = angle - t * 0.03 * speed;
                        const tx = cx + effectiveR * Math.cos(ta);
                        const ty = cy + effectiveR * Math.sin(ta);
                        ctx.beginPath();
                        ctx.arc(tx, ty, dotR * 0.5, 0, Math.PI * 2);
                        ctx.fillStyle = color;
                        ctx.globalAlpha = alpha * (1 - t / trailLen) * 0.3;
                        ctx.fill();
                    }
                    ctx.globalAlpha = 1;
                }

                // Glow
                if (isActive && isHighlighted) {
                    ctx.beginPath();
                    ctx.arc(x, y, dotR + 4, 0, Math.PI * 2);
                    ctx.fillStyle = color + '18';
                    ctx.fill();
                }

                // Satellite dot
                ctx.beginPath();
                ctx.arc(x, y, dotR, 0, Math.PI * 2);
                ctx.fillStyle = color;
                ctx.globalAlpha = alpha;
                ctx.fill();
                ctx.globalAlpha = 1;

                // Label for selected satellite
                if (isSel) {
                    ctx.fillStyle = '#fff';
                    ctx.font = '11px Inter, sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText(sc.name, x, y - dotR - 8);
                }

                satPositions.push({ x, y, name: sc.name, orbit, status: sc.status, id: sc.id, r: dotR + 3, altitude_km: sc.altitude_km });
            });
        });
    }

    // Animation loop
    let animFrame;
    function animate() { draw(); animFrame = requestAnimationFrame(animate); }

    // Mouse interactions
    const tooltip = document.getElementById('orbit-tooltip');

    canvas.addEventListener('mousemove', (e) => {
        if (isDragging) {
            panX = panStartX + (e.clientX - dragStartX);
            panY = panStartY + (e.clientY - dragStartY);
            canvas.style.cursor = 'grabbing';
            return;
        }
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const hit = satPositions.find(s => Math.hypot(s.x - x, s.y - y) < s.r + 2);
        if (hit) {
            canvas.style.cursor = 'pointer';
            tooltip.style.display = 'block';
            tooltip.style.left = Math.min(x + 15, container.offsetWidth - 180) + 'px';
            tooltip.style.top = (y - 10) + 'px';
            tooltip.innerHTML = `<strong>${escapeHtml(hit.name)}</strong><br>${hit.orbit}${hit.altitude_km ? ' · ' + hit.altitude_km.toLocaleString() + ' km' : ''}<br><span style="color:${getStatusColor(hit.status)}">${getStatusClass(hit.status)}</span>`;
        } else {
            canvas.style.cursor = isDragging ? 'grabbing' : 'grab';
            tooltip.style.display = 'none';
        }
    });

    canvas.addEventListener('mousedown', (e) => {
        isDragging = true; dragStartX = e.clientX; dragStartY = e.clientY;
        panStartX = panX; panStartY = panY;
    });
    canvas.addEventListener('mouseup', (e) => {
        const moved = Math.hypot(e.clientX - dragStartX, e.clientY - dragStartY);
        isDragging = false; canvas.style.cursor = 'grab';
        // If barely moved, treat as click
        if (moved < 5) {
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left, y = e.clientY - rect.top;
            const hit = satPositions.find(s => Math.hypot(s.x - x, s.y - y) < s.r + 2);
            if (hit) { selectedSat = selectedSat === hit.id ? null : hit.id; openModal(hit.id); }
            else selectedSat = null;
        }
    });
    canvas.addEventListener('mouseleave', () => { isDragging = false; tooltip.style.display = 'none'; canvas.style.cursor = 'grab'; });

    // Zoom with scroll wheel
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        zoom = Math.max(0.3, Math.min(4, zoom * delta));
    }, { passive: false });

    // Touch support
    let lastTouchDist = 0;
    canvas.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            isDragging = true; dragStartX = e.touches[0].clientX; dragStartY = e.touches[0].clientY;
            panStartX = panX; panStartY = panY;
        } else if (e.touches.length === 2) {
            lastTouchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        }
    });
    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (e.touches.length === 1 && isDragging) {
            panX = panStartX + (e.touches[0].clientX - dragStartX);
            panY = panStartY + (e.touches[0].clientY - dragStartY);
        } else if (e.touches.length === 2) {
            const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
            if (lastTouchDist > 0) zoom = Math.max(0.3, Math.min(4, zoom * (dist / lastTouchDist)));
            lastTouchDist = dist;
        }
    }, { passive: false });
    canvas.addEventListener('touchend', () => { isDragging = false; lastTouchDist = 0; });

    window.addEventListener('resize', resize);
    resize();
    canvas.style.cursor = 'grab';

    // Only animate when visible
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) animate();
            else cancelAnimationFrame(animFrame);
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

    document.getElementById('centres-grid').innerHTML = allCentres.map(c => {
        const coords = CENTRE_COORDS[c.place];
        const gmapsUrl = coords
            ? `https://www.google.com/maps/search/${encodeURIComponent(c.name + ' ' + c.place)}/@${coords[0]},${coords[1]},14z`
            : `https://www.google.com/maps/search/${encodeURIComponent(c.name + ' ' + (c.place || '') + ' India')}`;
        return `
        <div class="centre-card">
            <div class="centre-name">${escapeHtml(c.name)}</div>
            <div class="centre-location">
                📍 ${escapeHtml(c.place || '')}${c.state ? `, ${escapeHtml(c.state)}` : ''}
            </div>
            <a href="${gmapsUrl}" target="_blank" rel="noopener" class="centre-gmaps-link">View on Google Maps</a>
        </div>`;
    }).join('');
}

// ===== India Map (real GeoJSON coordinates) =====
const INDIA_COORDS = [[77.837451,35.49401],[78.912269,34.321936],[78.811086,33.506198],[79.208892,32.994395],[79.176129,32.48378],[78.458446,32.618164],[78.738894,31.515906],[79.721367,30.882715],[81.111256,30.183481],[80.476721,29.729865],[80.088425,28.79447],[81.057203,28.416095],[81.999987,27.925479],[83.304249,27.364506],[84.675018,27.234901],[85.251779,26.726198],[86.024393,26.630985],[87.227472,26.397898],[88.060238,26.414615],[88.174804,26.810405],[88.043133,27.445819],[88.120441,27.876542],[88.730326,28.086865],[88.814248,27.299316],[88.835643,27.098966],[89.744528,26.719403],[90.373275,26.875724],[91.217513,26.808648],[92.033484,26.83831],[92.103712,27.452614],[91.696657,27.771742],[92.503119,27.896876],[93.413348,28.640629],[94.56599,29.277438],[95.404802,29.031717],[96.117679,29.452802],[96.586591,28.83098],[96.248833,28.411031],[97.327114,28.261583],[97.402561,27.882536],[97.051989,27.699059],[97.133999,27.083774],[96.419366,27.264589],[95.124768,26.573572],[95.155153,26.001307],[94.603249,25.162495],[94.552658,24.675238],[94.106742,23.850741],[93.325188,24.078556],[93.286327,23.043658],[93.060294,22.703111],[93.166128,22.27846],[92.672721,22.041239],[92.146035,23.627499],[91.869928,23.624346],[91.706475,22.985264],[91.158963,23.503527],[91.46773,24.072639],[91.915093,24.130414],[92.376202,24.976693],[91.799596,25.147432],[90.872211,25.132601],[89.920693,25.26975],[89.832481,25.965082],[89.355094,26.014407],[88.563049,26.446526],[88.209789,25.768066],[88.931554,25.238692],[88.306373,24.866079],[88.084422,24.501657],[88.69994,24.233715],[88.52977,23.631142],[88.876312,22.879146],[89.031961,22.055708],[88.888766,21.690588],[88.208497,21.703172],[86.975704,21.495562],[87.033169,20.743308],[86.499351,20.151638],[85.060266,19.478579],[83.941006,18.30201],[83.189217,17.671221],[82.192792,17.016636],[82.191242,16.556664],[81.692719,16.310219],[80.791999,15.951972],[80.324896,15.899185],[80.025069,15.136415],[80.233274,13.835771],[80.286294,13.006261],[79.862547,12.056215],[79.857999,10.357275],[79.340512,10.308854],[78.885345,9.546136],[79.18972,9.216544],[78.277941,8.933047],[77.941165,8.252959],[77.539898,7.965535],[76.592979,8.899276],[76.130061,10.29963],[75.746467,11.308251],[75.396101,11.781245],[74.864816,12.741936],[74.616717,13.992583],[74.443859,14.617222],[73.534199,15.990652],[73.119909,17.92857],[72.820909,19.208234],[72.824475,20.419503],[72.630533,21.356009],[71.175273,20.757441],[70.470459,20.877331],[69.16413,22.089298],[69.644928,22.450775],[69.349597,22.84318],[68.176645,23.691965],[68.842599,24.359134],[71.04324,24.356524],[70.844699,25.215102],[70.282873,25.722229],[70.168927,26.491872],[69.514393,26.940966],[70.616496,27.989196],[71.777666,27.91318],[72.823752,28.961592],[73.450638,29.976413],[74.42138,30.979815],[74.405929,31.692639],[75.258642,32.271105],[74.451559,32.7649],[74.104294,33.441473],[73.749948,34.317699],[74.240203,34.748887],[75.757061,34.504923],[76.871722,34.653544],[77.837451,35.49401]];

const CENTRE_COORDS = {
    'Chandigarh': [30.7046, 76.7179],
    'Jodhpur': [26.2389, 73.0243],
    'Udaipur': [24.5854, 73.7125],
    'Ahmedabad': [23.0395, 72.5113],
    'Mt.Abu': [24.5926, 72.7156],
    'Bhopal': [23.2599, 77.4126],
    'Mumbai': [19.0760, 72.8777],
    'Byalalu': [12.9018, 77.3682],
    'Hassan': [13.0068, 76.1004],
    'Aluva': [10.1004, 76.3570],
    'Bengaluru': [12.9716, 77.5946],
    'New Delhi': [28.6139, 77.2090],
    'Dehradun': [30.3165, 78.0322],
    'Lucknow': [26.8467, 80.9462],
    'Kolkata': [22.5726, 88.3639],
    'Shillong': [25.5788, 91.8933],
    'Nagpur': [21.1458, 79.0882],
    'Hyderabad': [17.4677, 78.4487],
    'Tirupati': [13.6288, 79.4192],
    'Port Blair': [11.6234, 92.7265],
    'Sriharikota': [13.7330, 80.2350],
    'Mahendragiri': [8.2825, 77.5659],
    'Thiruvananthapuram': [8.5241, 76.9366],
};

// Mercator projection for India, fitting into SVG viewBox 0 0 500 550
function geoToSvg(lat, lon) {
    const minLon = 67, maxLon = 98, minLat = 6, maxLat = 37;
    const padding = 30;
    const w = 500 - padding * 2, h = 550 - padding * 2;
    const x = padding + ((lon - minLon) / (maxLon - minLon)) * w;
    // Mercator Y
    const latRad = lat * Math.PI / 180;
    const minLatRad = minLat * Math.PI / 180;
    const maxLatRad = maxLat * Math.PI / 180;
    const mercY = Math.log(Math.tan(Math.PI / 4 + latRad / 2));
    const mercMin = Math.log(Math.tan(Math.PI / 4 + minLatRad / 2));
    const mercMax = Math.log(Math.tan(Math.PI / 4 + maxLatRad / 2));
    const y = padding + (1 - (mercY - mercMin) / (mercMax - mercMin)) * h;
    return { x, y };
}

function indiaPathD() {
    return INDIA_COORDS.map((c, i) => {
        const { x, y } = geoToSvg(c[1], c[0]);
        return (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1);
    }).join(' ') + ' Z';
}

function buildIndiaMap() {
    if (allCentres.length === 0) return;

    const svg = document.getElementById('india-svg');
    const outline = document.getElementById('india-outline');
    const dotsGroup = document.getElementById('map-dots');
    const sidebar = document.getElementById('map-sidebar-list');
    const popup = document.getElementById('map-popup');
    const popupContent = document.getElementById('map-popup-content');

    // Set real India path from GeoJSON
    svg.setAttribute('viewBox', '0 0 500 550');
    outline.setAttribute('d', indiaPathD());

    // Remove Sri Lanka ellipse if present
    const sri = svg.querySelector('.sri-lanka');
    if (sri) sri.remove();

    // Group centres by city
    const byCity = {};
    allCentres.forEach(c => {
        const city = c.place || 'Unknown';
        if (!byCity[city]) byCity[city] = [];
        byCity[city].push(c);
    });

    const cityEntries = Object.entries(byCity).sort((a, b) => a[0].localeCompare(b[0]));
    let hideTimeout;

    cityEntries.forEach(([city, centres]) => {
        const coords = CENTRE_COORDS[city];
        if (!coords) return;

        const { x, y } = geoToSvg(coords[0], coords[1]);
        const isLaunchPad = city === 'Sriharikota';
        const isHQ = city === 'Bengaluru';
        // Proportional radius: log-scaled by number of sites, with min/max caps
        const count = centres.length;
        const minR = 3.5, maxR = 10;
        const logR = minR + (Math.log(count + 1) / Math.log(10)) * (maxR - minR);
        const r = Math.min(maxR, Math.max(minR, isLaunchPad ? Math.max(logR, 6) : isHQ ? Math.max(logR, 5) : logR));
        const color = isLaunchPad ? 'var(--accent-red)' : isHQ ? 'var(--accent-cyan)' : 'var(--accent-blue)';

        // Glow circle
        const glow = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        glow.setAttribute('cx', x); glow.setAttribute('cy', y);
        glow.setAttribute('r', r + 4); glow.setAttribute('fill', color);
        glow.setAttribute('opacity', '0.2'); glow.setAttribute('class', 'map-dot-glow');
        dotsGroup.appendChild(glow);

        // Main dot
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', x); circle.setAttribute('cy', y);
        circle.setAttribute('r', r); circle.setAttribute('fill', color);
        circle.setAttribute('class', 'map-dot'); circle.setAttribute('data-city', city);
        dotsGroup.appendChild(circle);

        // Hover interactions on dot
        const gmapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(centres[0].name + ' ' + city)}/@${coords[0]},${coords[1]},14z`;

        const showPopup = () => {
            clearTimeout(hideTimeout);
            popupContent.innerHTML = `
                <h4 class="map-popup-city">${escapeHtml(city)}, ${escapeHtml(centres[0]?.state || '')}</h4>
                <div class="map-popup-list">
                    ${centres.map(c => `<div class="map-popup-centre">${escapeHtml(c.name)}</div>`).join('')}
                </div>
                <a href="${gmapsUrl}" target="_blank" rel="noopener" class="map-popup-gmaps">Open in Google Maps</a>
            `;
            const svgRect = svg.getBoundingClientRect();
            const scaleX = svgRect.width / 500;
            const scaleY = svgRect.height / 550;
            let left = x * scaleX + 15;
            let top = y * scaleY - 10;
            const containerW = svgRect.width;
            if (left > containerW * 0.55) left = x * scaleX - 230;
            if (top > svgRect.height * 0.7) top = y * scaleY - 80;
            popup.style.left = Math.max(0, left) + 'px';
            popup.style.top = Math.max(0, top) + 'px';
            popup.classList.remove('hidden');
        };
        const scheduleHide = () => { hideTimeout = setTimeout(() => popup.classList.add('hidden'), 200); };

        circle.addEventListener('mouseenter', showPopup);
        circle.addEventListener('mouseleave', scheduleHide);
        glow.addEventListener('mouseenter', showPopup);
        glow.addEventListener('mouseleave', scheduleHide);

        // Sidebar entry
        const item = document.createElement('div');
        item.className = 'map-sidebar-item';
        item.innerHTML = `
            <div class="map-sidebar-city">${escapeHtml(city)}</div>
            <div class="map-sidebar-count">${centres.length}</div>
        `;
        item.addEventListener('mouseenter', () => { showPopup(); circle.setAttribute('r', r + 3); });
        item.addEventListener('mouseleave', () => { scheduleHide(); circle.setAttribute('r', r); });
        sidebar.appendChild(item);
    });

    // Keep popup visible when hovering over it
    popup.addEventListener('mouseenter', () => clearTimeout(hideTimeout));
    popup.addEventListener('mouseleave', () => { hideTimeout = setTimeout(() => popup.classList.add('hidden'), 200); });
}

function closeMapPopup() {
    document.getElementById('map-popup').classList.add('hidden');
}

// ===== Altitude / Scale of Space =====
const ALTITUDE_REFERENCES = [
    { alt: 0, label: 'Sea Level — Earth Surface', icon: '🌍', type: 'ref', highlight: true },
    { alt: 0.83, label: 'Burj Khalifa (828 m)', icon: '🏗️', type: 'ref' },
    { alt: 8.85, label: 'Mount Everest', icon: '🏔️', type: 'ref' },
    { alt: 11, label: 'Airplane cruise altitude', icon: '✈️', type: 'ref' },
    { alt: 35, label: 'Weather balloon max', icon: '🎈', type: 'ref' },
    { alt: 100, label: 'Karman Line — Edge of Space', icon: '🌌', type: 'ref', highlight: true },
    { alt: 160, label: 'LEO begins', icon: '🛸', type: 'zone' },
    { alt: 408, label: 'International Space Station', icon: '🛰️', type: 'ref' },
    { alt: 2000, label: 'LEO ends', icon: '🛸', type: 'zone' },
    { alt: 20200, label: 'GPS satellites (MEO)', icon: '📡', type: 'ref' },
    { alt: 35786, label: 'Geostationary orbit (GEO)', icon: '📡', type: 'ref', highlight: true },
    { alt: 384400, label: 'The Moon', icon: '🌕', type: 'ref', highlight: true },
];

function buildAltitudeSection() {
    const track = document.getElementById('altitude-track');
    const scrollContainer = document.getElementById('altitude-scroll');
    const labelEl = document.getElementById('altitude-current-label');
    const infoPanel = document.getElementById('altitude-info-panel');

    if (!track || !scrollContainer) return;

    // Logarithmic scale with an Earth surface header zone
    const maxAlt = 400000;
    const earthZoneH = 80; // px reserved for Earth surface at top
    const trackHeight = 8000;
    track.style.height = trackHeight + 'px';

    function altToY(alt) {
        if (alt <= 0) return earthZoneH / 2;
        return earthZoneH + (Math.log10(alt + 1) / Math.log10(maxAlt)) * (trackHeight - earthZoneH);
    }

    function yToAlt(y) {
        if (y <= earthZoneH) return 0;
        const frac = (y - earthZoneH) / (trackHeight - earthZoneH);
        return Math.pow(maxAlt, frac) - 1;
    }

    // Earth surface banner at very top
    const earthBanner = document.createElement('div');
    earthBanner.className = 'altitude-earth-surface';
    earthBanner.innerHTML = '🌍 Earth Surface — 0 km';
    earthBanner.style.height = earthZoneH + 'px';
    track.appendChild(earthBanner);

    // Render reference markers
    ALTITUDE_REFERENCES.forEach(ref => {
        if (ref.alt === 0) return; // handled by banner
        const y = altToY(ref.alt);
        const marker = document.createElement('div');
        marker.className = `altitude-marker ${ref.highlight ? 'altitude-marker-highlight' : ''} ${ref.type === 'zone' ? 'altitude-marker-zone' : ''}`;
        marker.style.top = y + 'px';
        marker.innerHTML = `
            <span class="altitude-marker-icon">${ref.icon}</span>
            <span class="altitude-marker-label">${ref.label}</span>
            <span class="altitude-marker-alt">${ref.alt >= 1000 ? (ref.alt / 1000).toLocaleString() + 'k' : ref.alt} km</span>
        `;
        track.appendChild(marker);
    });

    // Render ISRO spacecraft at their altitudes
    const spacecraftWithAlt = allSpacecraft.filter(s => s.altitude_km && s.altitude_km > 0 && s.orbit_type !== 'Failed');

    const altGroups = {};
    spacecraftWithAlt.forEach(sc => {
        const bucket = Math.round(altToY(sc.altitude_km) / 20) * 20;
        if (!altGroups[bucket]) altGroups[bucket] = [];
        altGroups[bucket].push(sc);
    });

    Object.entries(altGroups).forEach(([bucket, sats]) => {
        const representative = sats[0];
        const y = altToY(representative.altitude_km);
        const isActive = sats.some(s => getStatusClass(s.status) === 'active');
        const color = getOrbitColor(representative.orbit_type);

        const el = document.createElement('div');
        el.className = 'altitude-sat';
        el.style.top = y + 'px';
        el.style.setProperty('--sat-color', color);

        if (sats.length === 1) {
            el.innerHTML = `<span class="altitude-sat-name">${escapeHtml(sats[0].name)}</span>
                <span class="altitude-sat-alt">${representative.altitude_km.toLocaleString()} km</span>`;
        } else {
            el.innerHTML = `<span class="altitude-sat-name">${sats.length} spacecraft</span>
                <span class="altitude-sat-alt">~${representative.altitude_km.toLocaleString()} km</span>`;
            el.title = sats.map(s => s.name).join(', ');
        }

        if (isActive) el.classList.add('altitude-sat-active');
        track.appendChild(el);
    });

    // Update altitude label on scroll
    scrollContainer.addEventListener('scroll', () => {
        const scrollTop = scrollContainer.scrollTop;
        const alt = yToAlt(scrollTop);
        if (alt < 1) {
            labelEl.textContent = Math.round(alt * 1000) + ' m';
        } else if (alt < 1000) {
            labelEl.textContent = Math.round(alt) + ' km';
        } else {
            labelEl.textContent = Math.round(alt).toLocaleString() + ' km';
        }

        // Update info panel with nearest reference
        const nearest = ALTITUDE_REFERENCES.reduce((best, ref) => {
            return Math.abs(ref.alt - alt) < Math.abs(best.alt - alt) ? ref : best;
        });
        infoPanel.querySelector('.altitude-info-title').textContent = nearest.icon + ' ' + nearest.label;
        infoPanel.querySelector('.altitude-info-desc').textContent = nearest.alt >= 1000
            ? (nearest.alt / 1000).toLocaleString() + 'k km altitude'
            : nearest.alt + ' km altitude';
    });

    // Scroll starts at Earth surface (top = 0), no action needed
    scrollContainer.scrollTop = 0;
}

// ===== Earth Perspective — "You Are Here" =====
function buildEarthPerspective() {
    const container = document.getElementById('earth-perspective');
    if (!container) return;

    // Earth radius = 6371 km, GEO = 35786 km from surface = 42157 km from center
    // Moon = 384400 km from surface
    // Show Earth as a circle and GEO / LEO as tiny rings
    const earthR = 6371;
    const leoAlt = 400;
    const geoAlt = 35786;
    const moonDist = 384400;

    // Scale: 1px = 100 km, Earth = 63.7px radius
    const scale = 100;
    const earthPx = earthR / scale;
    const leoPx = (earthR + leoAlt) / scale;
    const geoPx = (earthR + geoAlt) / scale;
    const canvasSize = (geoPx + 30) * 2;

    const totalActiveSats = allSpacecraft.filter(s => getStatusClass(s.status) === 'active').length;

    container.innerHTML = `
        <div class="perspective-viz" style="width:${canvasSize}px; height:${canvasSize}px;">
            <div class="perspective-earth" style="width:${earthPx*2}px; height:${earthPx*2}px;">
                <span>Earth</span>
                <span class="perspective-earth-r">${earthR.toLocaleString()} km radius</span>
            </div>
            <div class="perspective-ring perspective-leo" style="width:${leoPx*2}px; height:${leoPx*2}px;" title="LEO ~400 km">
                <span class="perspective-ring-label" style="top:-18px;">LEO (${leoAlt} km)</span>
            </div>
            <div class="perspective-ring perspective-geo" style="width:${geoPx*2}px; height:${geoPx*2}px;" title="GEO 35,786 km">
                <span class="perspective-ring-label" style="top:-18px;">GEO (${geoAlt.toLocaleString()} km)</span>
            </div>
        </div>
        <div class="perspective-caption">
            <p>Earth is <strong>${earthR.toLocaleString()} km</strong> in radius. Low Earth Orbit (where most ISRO satellites live) is only <strong>${leoAlt} km</strong> above the surface — barely a thin shell.</p>
            <p>Geostationary orbit is <strong>${geoAlt.toLocaleString()} km</strong> up — about 5.6 Earth radii from center. The Moon? It's <strong>${moonDist.toLocaleString()} km</strong> away — off this diagram entirely, about <strong>${Math.round(moonDist / (geoPx * scale))}x</strong> further than the edge of this view.</p>
            <p class="perspective-stat">${totalActiveSats} ISRO spacecraft are currently active across these orbits.</p>
        </div>
    `;
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

    // Orbit mode toggle
    setupOrbitModeToggle();

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

    if (allSpacecraft.length === 0) {
        const banner = document.getElementById('data-load-banner');
        if (banner) {
            banner.classList.remove('hidden');
            banner.textContent = 'Could not load spacecraft data (network or blocked request). Serve this folder over HTTP, e.g. python3 -m http.server 8000, then open http://localhost:8000';
        }
    }

    const builders = [buildStats, buildIndiaMap, buildAltitudeSection, buildEarthPerspective, buildTimeline, buildSpacecraftCatalog, buildLaunchers, buildOrbitScaleView, buildOrbitVisualization, buildCustomerSatellites, buildCentres];
    builders.forEach(fn => { try { fn(); } catch (err) { console.error(`${fn.name} failed:`, err); } });

    // Section fade-in observer
    const fadeObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) entry.target.classList.add('visible');
        });
    }, { threshold: 0.02, rootMargin: '0px 0px 50px 0px' });
    document.querySelectorAll('section').forEach(s => fadeObserver.observe(s));
    // Fallback: make all sections visible after 2s
    setTimeout(() => document.querySelectorAll('section').forEach(s => s.classList.add('visible')), 2000);

    // Hide loading
    setTimeout(() => {
        document.getElementById('loading-overlay').classList.add('hidden');
    }, 500);
}

// Start
document.addEventListener('DOMContentLoaded', init);
