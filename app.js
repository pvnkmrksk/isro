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

// ===== Country Flags =====
const COUNTRY_FLAGS = {
    'Germany': '🇩🇪', 'South Korea': '🇰🇷', 'Belgium': '🇧🇪', 'Indonesia': '🇮🇩',
    'Argentina': '🇦🇷', 'Italy': '🇮🇹', 'Israel': '🇮🇱', 'Canada': '🇨🇦',
    'Japan': '🇯🇵', 'Netherlands': '🇳🇱', 'Denmark': '🇩🇰', 'Turkey': '🇹🇷',
    'Switzerland': '🇨🇭', 'Algeria': '🇩🇿', 'Norway': '🇳🇴', 'Singapore': '🇸🇬',
    'Luxembourg': '🇱🇺', 'France': '🇫🇷', 'Austria': '🇦🇹', 'Brazil': '🇧🇷',
    'United Kingdom': '🇬🇧', 'United States': '🇺🇸', 'India': '🇮🇳',
    'Sri Lanka': '🇱🇰', 'Spain': '🇪🇸', 'Finland': '🇫🇮', 'Malaysia': '🇲🇾',
    'Australia': '🇦🇺', 'Chile': '🇨🇱', 'Colombia': '🇨🇴', 'Kazakhstan': '🇰🇿',
    'Lithuania': '🇱🇹', 'Latvia': '🇱🇻', 'Czech Republic': '🇨🇿', 'Slovakia': '🇸🇰',
    'Mongolia': '🇲🇳', 'Nigeria': '🇳🇬', 'Philippines': '🇵🇭', 'Thailand': '🇹🇭',
    'UAE': '🇦🇪', 'United Arab Emirates': '🇦🇪',
};

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
                // Force canvas resize when switching to interactive view
                const canvas = document.getElementById('orbit-canvas');
                if (canvas) {
                    requestAnimationFrame(() => {
                        window.dispatchEvent(new Event('resize'));
                    });
                }
            }
        });
    });
}

function buildOrbitScaleView() {
    const track = document.getElementById('orbit-scale-track');
    const scroll = document.getElementById('orbit-scale-scroll');
    if (!track || !scroll) return;

    const maxAlt = 45000;
    const trackWidth = 4000;
    track.style.width = trackWidth + 'px';

    function altToX(alt) { return 40 + (Math.sqrt(alt) / Math.sqrt(maxAlt)) * (trackWidth - 60); }

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
        if (rect.width === 0 || rect.height === 0) return; // Skip if not visible
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

    document.getElementById('customer-grid').innerHTML = allCustomerSats.map(c => {
        const flag = COUNTRY_FLAGS[c.country] || '';
        const satName = c.id || c.name || 'Unknown';
        const wikiUrl = `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(satName + ' satellite')}`;
        return `
        <div class="customer-card">
            <div class="customer-card-header-row">
                ${flag ? `<span class="customer-flag">${flag}</span>` : ''}
                <div class="customer-card-name">${escapeHtml(satName)}</div>
            </div>
            <div class="customer-card-info">
                ${c.launch_date ? `Launched: ${formatDate(c.launch_date)}` : ''}
                ${c.launcher ? ` · ${escapeHtml(c.launcher)}` : ''}
                ${c.mass_kg ? ` · ${c.mass_kg} kg` : ''}
            </div>
            ${c.country ? `<div class="customer-card-country">${flag} ${escapeHtml(c.country)}</div>` : ''}
            <a href="${wikiUrl}" target="_blank" rel="noopener" class="customer-wiki-link">📖 Wiki</a>
        </div>`;
    }).join('');
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
const INDIA_COORDS = [[77.519, 35.486], [77.688, 35.453], [77.815, 35.522], [77.911, 35.462], [77.938, 35.559], [78.157, 35.551], [78.244, 35.725], [78.8, 35.87], [78.856, 35.974], [79.028, 35.914], [79.343, 35.988], [79.442, 35.968], [79.489, 35.849], [79.572, 35.897], [79.704, 35.639], [79.999, 35.602], [80.055, 35.423], [80.205, 35.575], [80.412, 35.477], [80.286, 35.354], [80.205, 34.891], [80.074, 34.706], [79.787, 34.627], [79.794, 34.48], [79.509, 34.454], [79.607, 34.238], [79.491, 34.191], [79.403, 34.002], [78.995, 34.037], [78.887, 33.973], [79.09, 33.637], [78.907, 33.62], [78.94, 33.38], [79.107, 33.2], [79.408, 33.189], [79.331, 33.001], [79.557, 32.759], [79.548, 32.677], [79.413, 32.52], [79.276, 32.556], [78.968, 32.336], [78.779, 32.479], [78.74, 32.696], [78.395, 32.53], [78.488, 32.276], [78.78, 31.994], [78.702, 31.807], [78.847, 31.609], [78.72, 31.509], [78.797, 31.444], [78.778, 31.312], [78.9, 31.29], [79.099, 31.455], [79.427, 31.023], [79.603, 30.94], [79.866, 30.972], [80.239, 30.762], [80.218, 30.58], [81.031, 30.247], [80.997, 30.186], [80.91, 30.223], [80.747, 30.006], [80.366, 29.748], [80.408, 29.596], [80.243, 29.444], [80.297, 29.205], [80.145, 29.104], [80.075, 28.824], [80.517, 28.552], [80.504, 28.665], [80.569, 28.688], [81.211, 28.361], [81.318, 28.134], [81.447, 28.161], [81.885, 27.857], [82.07, 27.924], [82.449, 27.679], [82.708, 27.723], [82.736, 27.502], [83.188, 27.454], [83.317, 27.33], [83.388, 27.48], [83.614, 27.469], [83.864, 27.346], [83.847, 27.445], [84.024, 27.433], [84.151, 27.517], [84.292, 27.385], [84.62, 27.339], [84.689, 27.221], [84.643, 27.046], [84.963, 26.961], [85.024, 26.854], [85.191, 26.87], [85.211, 26.758], [85.627, 26.873], [85.852, 26.568], [86.027, 26.667], [86.333, 26.619], [86.731, 26.423], [87.072, 26.586], [87.091, 26.45], [87.341, 26.347], [87.466, 26.44], [87.605, 26.381], [87.888, 26.487], [88.008, 26.361], [88.186, 26.738], [88.135, 26.985], [87.987, 27.119], [88.044, 27.496], [88.197, 27.791], [88.118, 27.918], [88.637, 28.118], [88.836, 28.015], [88.888, 27.856], [88.763, 27.566], [88.915, 27.291], [88.746, 27.142], [88.872, 27.109], [88.875, 26.943], [88.921, 26.994], [89.134, 26.807], [89.379, 26.862], [89.65, 26.777], [89.626, 26.723], [89.861, 26.702], [90.194, 26.774], [90.356, 26.901], [90.717, 26.77], [91.69, 26.807], [91.892, 26.921], [92.056, 26.847], [92.121, 26.961], [92.031, 27.08], [92.038, 27.258], [92.123, 27.287], [92.017, 27.481], [91.652, 27.483], [91.562, 27.631], [91.643, 27.761], [91.924, 27.717], [92.244, 27.888], [92.319, 27.797], [92.456, 27.793], [92.73, 27.978], [92.677, 28.151], [92.922, 28.201], [93.426, 28.662], [93.712, 28.665], [94.261, 28.932], [94.366, 29.026], [94.293, 29.152], [94.626, 29.296], [94.697, 29.315], [94.807, 29.165], [95.263, 29.068], [95.434, 29.193], [95.504, 29.126], [95.606, 29.236], [95.709, 29.204], [95.812, 29.348], [96.054, 29.383], [96.303, 29.192], [96.187, 29.037], [96.33, 29.113], [96.632, 28.734], [96.406, 28.506], [96.498, 28.429], [96.493, 28.542], [96.712, 28.611], [96.925, 28.353], [97.126, 28.362], [97.36, 28.205], [97.312, 28.062], [97.395, 28.012], [97.366, 27.877], [97.247, 27.9], [96.89, 27.606], [96.903, 27.453], [97.138, 27.091], [96.868, 27.185], [96.884, 27.26], [96.704, 27.372], [96.229, 27.279], [95.431, 26.7], [95.149, 26.616], [95.062, 26.45], [95.132, 26.378], [95.118, 26.101], [95.186, 26.073], [95.012, 25.898], [95.049, 25.76], [94.898, 25.566], [94.635, 25.395], [94.576, 25.214], [94.741, 25.127], [94.714, 24.935], [94.398, 24.482], [94.157, 23.848], [93.808, 23.927], [93.754, 24.006], [93.505, 23.942], [93.328, 24.081], [93.438, 23.687], [93.355, 23.353], [93.385, 23.135], [93.294, 23.007], [93.127, 23.044], [93.106, 22.527], [93.202, 22.264], [93.151, 22.176], [93.038, 22.195], [93.005, 21.987], [92.951, 22.03], [92.906, 21.941], [92.863, 22.063], [92.7, 22.155], [92.68, 22.012], [92.603, 21.978], [92.517, 22.722], [92.371, 22.936], [92.347, 23.236], [92.404, 23.241], [92.28, 23.719], [92.215, 23.652], [92.148, 23.736], [92.047, 23.646], [91.957, 23.734], [91.97, 23.478], [91.762, 23.3], [91.836, 23.092], [91.619, 22.937], [91.412, 23.284], [91.417, 23.065], [91.347, 23.102], [91.32, 23.36], [91.16, 23.611], [91.233, 23.927], [91.379, 23.975], [91.374, 24.108], [91.586, 24.073], [91.666, 24.234], [91.763, 24.142], [91.745, 24.247], [91.902, 24.137], [91.92, 24.337], [92.164, 24.419], [92.296, 24.737], [92.232, 24.9], [92.498, 24.876], [92.425, 25.03], [92.062, 25.188], [91.638, 25.123], [91.268, 25.207], [90.441, 25.145], [89.838, 25.293], [89.882, 25.617], [89.816, 25.815], [89.887, 25.945], [89.825, 25.945], [89.871, 25.981], [89.679, 26.238], [89.591, 26.157], [89.65, 26.063], [89.577, 25.969], [89.424, 26.048], [89.356, 26.008], [89.155, 26.138], [89.087, 26.398], [88.957, 26.46], [88.905, 26.409], [89.051, 26.242], [88.898, 26.289], [88.842, 26.231], [88.793, 26.31], [88.666, 26.263], [88.745, 26.348], [88.399, 26.627], [88.332, 26.482], [88.485, 26.46], [88.524, 26.359], [88.177, 26.148], [88.107, 25.815], [88.269, 25.808], [88.54, 25.508], [88.81, 25.523], [88.841, 25.364], [89.008, 25.264], [88.923, 25.165], [88.442, 25.21], [88.399, 24.945], [88.33, 24.87], [88.224, 24.962], [88.138, 24.936], [88.175, 24.86], [88.009, 24.668], [88.334, 24.382], [88.735, 24.279], [88.699, 24.121], [88.769, 23.982], [88.575, 23.862], [88.558, 23.649], [88.801, 23.497], [88.719, 23.255], [88.996, 23.215], [88.845, 23.009], [88.969, 22.845], [88.938, 22.56], [89.098, 22.155], [89.064, 21.937], [89.019, 21.976], [88.986, 21.896], [89.1, 21.637], [88.92, 21.63], [88.86, 21.777], [88.849, 21.616], [88.723, 21.678], [88.7, 21.857], [88.779, 22.014], [88.639, 22.076], [88.555, 21.815], [88.518, 21.948], [88.458, 21.896], [88.451, 21.612], [88.424, 21.719], [88.397, 21.591], [88.402, 21.72], [88.275, 21.734], [88.31, 21.579], [88.247, 21.561], [88.156, 21.956], [88.209, 22.149], [88.02, 22.223], [88.19, 22.104], [87.804, 21.696], [87.092, 21.537], [86.912, 21.338], [86.827, 21.137], [86.975, 20.821], [86.868, 20.775], [86.996, 20.77], [86.964, 20.695], [87.07, 20.721], [86.732, 20.535], [86.708, 20.409], [86.788, 20.377], [86.674, 20.294], [86.799, 20.347], [86.521, 20.185], [86.423, 20.002], [86.315, 19.988], [86.372, 19.952], [85.54, 19.696], [85.592, 19.703], [85.038, 19.392], [84.129, 18.31], [83.556, 18.026], [83.215, 17.59], [82.602, 17.284], [82.306, 17.038], [82.251, 16.875], [82.36, 16.825], [82.333, 16.989], [82.371, 16.909], [82.342, 16.736], [82.269, 16.707], [82.37, 16.724], [82.309, 16.597], [82.258, 16.689], [82.305, 16.56], [81.719, 16.309], [81.717, 16.365], [81.71, 16.305], [81.553, 16.372], [81.267, 16.293], [81.152, 15.972], [80.938, 15.71], [80.832, 15.701], [80.805, 15.842], [80.677, 15.89], [80.264, 15.672], [80.048, 15.074], [80.185, 14.597], [80.14, 14.565], [80.196, 14.578], [80.126, 14.066], [80.346, 13.283], [80.156, 12.462], [79.873, 12.04], [79.759, 11.672], [79.832, 11.361], [79.761, 11.379], [79.839, 11.352], [79.857, 11.196], [79.881, 10.311], [79.793, 10.273], [79.639, 10.365], [79.294, 10.26], [79.268, 10.04], [78.9, 9.487], [78.959, 9.34], [79.189, 9.28], [78.861, 9.251], [78.266, 9.018], [78.125, 8.762], [78.201, 8.785], [78.07, 8.374], [77.55, 8.074], [77.317, 8.123], [77.012, 8.35], [76.546, 8.9], [76.666, 8.994], [76.539, 8.934], [76.496, 9.168], [76.357, 9.365], [76.27, 10.033], [76.241, 9.973], [75.958, 10.817], [75.912, 10.785], [75.87, 11.124], [75.543, 11.711], [75.201, 12.004], [74.825, 12.838], [74.695, 13.343], [74.666, 13.631], [74.722, 13.638], [74.65, 13.664], [74.427, 14.278], [74.517, 14.242], [74.422, 14.286], [74.284, 14.712], [74.118, 14.771], [74.165, 14.859], [73.913, 15.083], [73.898, 15.328], [73.785, 15.408], [73.885, 15.428], [73.734, 15.588], [73.79, 15.652], [73.734, 15.615], [73.457, 16.053], [73.428, 16.372], [73.367, 16.379], [73.469, 16.413], [73.37, 16.395], [73.317, 16.511], [73.337, 16.56], [73.362, 16.478], [73.444, 16.5], [73.319, 16.598], [73.402, 16.616], [73.333, 16.619], [73.307, 16.728], [73.33, 16.968], [73.257, 17.048], [73.325, 17.04], [73.191, 17.297], [73.3, 17.292], [73.172, 17.399], [73.14, 17.558], [73.217, 17.589], [73.138, 17.61], [73.13, 17.834], [73.031, 17.949], [73.091, 17.99], [73.02, 17.991], [72.933, 18.217], [72.967, 18.279], [73.102, 18.142], [73.086, 18.319], [73.03, 18.263], [72.921, 18.347], [72.907, 18.54], [73.006, 18.467], [72.857, 18.694], [72.939, 18.825], [73.016, 18.715], [72.989, 18.865], [72.909, 18.897], [73.067, 19.021], [73.001, 19.004], [72.986, 19.19], [72.958, 19.037], [72.806, 18.893], [72.831, 19.18], [72.78, 19.154], [72.841, 19.254], [72.783, 19.192], [72.786, 19.305], [72.912, 19.288], [72.777, 19.348], [72.745, 19.46], [72.889, 19.524], [72.73, 19.529], [72.655, 19.833], [72.666, 19.934], [72.746, 19.942], [72.754, 20.29], [72.9, 20.53], [72.845, 20.744], [72.93, 20.759], [72.826, 20.794], [72.783, 20.919], [72.85, 20.972], [72.758, 20.929], [72.734, 20.998], [72.728, 21.054], [72.849, 21.032], [72.707, 21.087], [72.789, 21.18], [72.64, 21.08], [72.638, 21.207], [72.742, 21.198], [72.598, 21.298], [72.699, 21.463], [72.762, 21.448], [72.646, 21.446], [72.68, 21.501], [72.928, 21.676], [72.537, 21.663], [72.619, 21.906], [72.75, 21.973], [72.537, 21.896], [72.508, 21.976], [72.586, 22.205], [72.761, 22.174], [72.912, 22.265], [72.748, 22.231], [72.535, 22.305], [72.431, 22.205], [72.38, 22.337], [72.326, 22.308], [72.299, 22.103], [72.182, 22.022], [72.247, 21.924], [72.163, 21.96], [72.25, 21.911], [72.25, 21.81], [72.166, 21.81], [72.306, 21.627], [72.089, 21.315], [72.111, 21.199], [71.442, 20.868], [70.822, 20.691], [70.156, 21.055], [68.935, 22.307], [69.068, 22.479], [69.035, 22.39], [69.192, 22.418], [69.157, 22.31], [69.227, 22.256], [69.48, 22.332], [69.51, 22.425], [69.574, 22.322], [69.668, 22.323], [69.728, 22.475], [69.808, 22.398], [69.986, 22.545], [70.174, 22.542], [70.448, 22.97], [70.287, 22.945], [70.219, 23.055], [70.224, 22.953], [70.132, 22.996], [70.1, 22.908], [69.885, 22.913], [69.711, 22.738], [69.452, 22.775], [69.362, 22.881], [69.35, 22.818], [69.196, 22.836], [68.632, 23.169], [68.717, 23.125], [68.579, 23.227], [68.679, 23.302], [68.449, 23.48], [68.469, 23.551], [68.425, 23.509], [68.548, 23.714], [68.811, 23.879], [68.514, 23.745], [68.434, 23.736], [68.427, 23.819], [68.35, 23.582], [68.172, 23.617], [68.35, 23.73], [68.246, 23.671], [68.19, 23.727], [68.357, 23.974], [68.753, 23.971], [68.808, 24.313], [68.866, 24.212], [68.945, 24.303], [69.003, 24.223], [69.594, 24.292], [69.732, 24.171], [70.025, 24.171], [70.11, 24.295], [70.561, 24.421], [70.571, 24.252], [70.714, 24.216], [71.12, 24.402], [70.999, 24.444], [70.986, 24.596], [71.096, 24.689], [70.888, 25.148], [70.665, 25.397], [70.66, 25.702], [70.269, 25.714], [70.1, 25.938], [70.174, 26.551], [69.823, 26.589], [69.51, 26.744], [69.587, 27.183], [70.026, 27.563], [70.133, 27.806], [70.372, 28.012], [70.589, 28.01], [70.74, 27.742], [70.872, 27.706], [71.898, 27.961], [71.927, 28.122], [72.207, 28.395], [72.39, 28.77], [72.946, 29.028], [73.282, 29.572], [73.397, 29.946], [73.807, 30.068], [73.973, 30.198], [73.88, 30.36], [73.974, 30.444], [73.935, 30.49], [74.072, 30.523], [74.416, 30.94], [74.696, 31.074], [74.51, 31.132], [74.552, 31.364], [74.655, 31.426], [74.487, 31.715], [74.607, 31.89], [74.819, 31.959], [74.879, 32.054], [75.24, 32.091], [75.372, 32.226], [75.322, 32.344], [75.102, 32.477], [74.681, 32.493], [74.638, 32.615], [74.705, 32.842], [74.638, 32.751], [74.372, 32.77], [73.926, 33.034], [73.634, 33.093], [73.595, 33.892], [73.398, 34.378], [73.453, 34.569], [73.657, 34.563], [73.728, 34.764], [74.045, 34.89], [74.132, 35.119], [73.75, 35.221], [73.693, 35.349], [73.786, 35.524], [73.405, 35.529], [73.331, 35.663], [73.126, 35.721], [73.178, 35.86], [72.569, 35.852], [72.51, 35.902], [72.549, 36.233], [72.967, 36.477], [73.062, 36.697], [73.861, 36.725], [73.67, 36.922], [74.041, 36.834], [74.424, 37.007], [74.563, 36.971], [74.689, 37.096], [74.841, 37.066], [74.902, 36.941], [75.146, 37.034], [75.418, 36.959], [75.46, 36.73], [75.736, 36.753], [75.941, 36.606], [76.028, 36.44], [76.719, 36.16], [76.839, 35.86], [77.349, 35.72], [77.469, 35.652], [77.519, 35.486]];
const INDIA_ISLANDS = [[[93.846, 7.245], [93.963, 7.003], [93.842, 6.753], [93.66, 7.128], [93.846, 7.245]], [[93.537, 8.236], [93.512, 7.998], [93.549, 8.066], [93.463, 8.167], [93.537, 8.236]], [[92.549, 10.88], [92.622, 10.762], [92.578, 10.568], [92.387, 10.527], [92.385, 10.791], [92.549, 10.88]], [[92.71, 12.227], [92.764, 12.172], [92.712, 12.049], [92.798, 12.051], [92.723, 11.923], [92.8, 11.897], [92.763, 11.697], [92.672, 11.647], [92.763, 11.658], [92.719, 11.473], [92.521, 11.843], [92.572, 11.94], [92.615, 11.847], [92.71, 12.227]], [[92.827, 12.303], [92.889, 12.193], [92.773, 12.059], [92.75, 12.247], [92.827, 12.303]], [[92.91, 12.911], [92.979, 12.488], [92.922, 12.402], [92.81, 12.457], [92.897, 12.321], [92.747, 12.296], [92.694, 12.612], [92.796, 12.701], [92.743, 12.669], [92.73, 12.822], [92.91, 12.911]], [[93.049, 13.546], [93.015, 13.427], [93.096, 13.328], [92.963, 13.342], [93.073, 13.263], [93.041, 13.057], [92.97, 13.007], [92.897, 13.089], [92.947, 12.967], [92.812, 12.896], [92.852, 13.4], [92.929, 13.532], [93.049, 13.546]], [[88.169, 21.786], [88.149, 21.634], [88.052, 21.64], [88.137, 21.875], [88.169, 21.786]]];

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

// Mercator projection for India, fitting into SVG viewBox 0 0 500 600
function geoToSvg(lat, lon) {
    const minLon = 67, maxLon = 98, minLat = 6, maxLat = 38;
    const padding = 25;
    const w = 500 - padding * 2, h = 600 - padding * 2;
    const x = padding + ((lon - minLon) / (maxLon - minLon)) * w;
    const latRad = lat * Math.PI / 180;
    const minLatRad = minLat * Math.PI / 180;
    const maxLatRad = maxLat * Math.PI / 180;
    const mercY = Math.log(Math.tan(Math.PI / 4 + latRad / 2));
    const mercMin = Math.log(Math.tan(Math.PI / 4 + minLatRad / 2));
    const mercMax = Math.log(Math.tan(Math.PI / 4 + maxLatRad / 2));
    const y = padding + (1 - (mercY - mercMin) / (mercMax - mercMin)) * h;
    return { x, y };
}

function coordsToPathD(coords) {
    return coords.map((c, i) => {
        const { x, y } = geoToSvg(c[1], c[0]);
        return (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1);
    }).join(' ') + ' Z';
}

function indiaPathD() {
    let d = coordsToPathD(INDIA_COORDS);
    if (typeof INDIA_ISLANDS !== 'undefined') {
        INDIA_ISLANDS.forEach(island => { d += ' ' + coordsToPathD(island); });
    }
    return d;
}

function buildIndiaMap() {
    const container = document.getElementById('globe-container');
    if (!container || allCentres.length === 0) return;

    // Group centres by city
    const byCity = {};
    allCentres.forEach(c => {
        const city = c.place || 'Unknown';
        if (!byCity[city]) byCity[city] = [];
        byCity[city].push(c);
    });

    // Prepare points data — bigger cities sort last so they render on top
    const pointsData = Object.entries(byCity)
        .map(([city, centres]) => {
            const coords = CENTRE_COORDS[city];
            if (!coords) return null;
            const isLaunchPad = city === 'Sriharikota';
            const isHQ = city === 'Bengaluru';
            const count = centres.length;
            return {
                lat: coords[0], lng: coords[1], city,
                state: centres[0]?.state || '', centres, count,
                size: Math.max(0.15, Math.log(count + 1) * 0.2),
                color: isLaunchPad ? '#ef4444' : isHQ ? '#06b6d4' : '#3b82f6',
                isLaunchPad, isHQ,
            };
        })
        .filter(Boolean)
        .sort((a, b) => a.count - b.count);

    // Build India GeoJSON polygon from existing coordinate data
    const indiaGeoJSON = {
        type: 'Feature', properties: { name: 'India' },
        geometry: { type: 'Polygon', coordinates: [INDIA_COORDS.map(c => [c[0], c[1]])] }
    };
    const islandFeatures = INDIA_ISLANDS.map(island => ({
        type: 'Feature', properties: { name: 'India' },
        geometry: { type: 'Polygon', coordinates: [island.map(c => [c[0], c[1]])] }
    }));

    const globe = Globe()
        .globeImageUrl('//unpkg.com/three-globe/example/img/earth-blue-marble.jpg')
        .bumpImageUrl('//unpkg.com/three-globe/example/img/earth-topology.png')
        .backgroundColor('rgba(0,0,0,0)')
        .atmosphereColor('#3b82f6')
        .atmosphereAltitude(0.15)
        .showGraticules(true)
        .width(container.offsetWidth)
        .height(Math.min(600, window.innerHeight * 0.7))
        .pointOfView({ lat: 20.5937, lng: 78.9629, altitude: 1.8 })
        // India boundary — blue line with haze gradient fill
        .polygonsData([indiaGeoJSON, ...islandFeatures])
        .polygonCapColor(() => 'rgba(59, 130, 246, 0.08)')
        .polygonSideColor(() => 'rgba(59, 130, 246, 0.05)')
        .polygonStrokeColor(() => '#3b82f6')
        .polygonAltitude(0.006)
        // ISRO centres as 3D points
        .pointsData(pointsData)
        .pointLat('lat')
        .pointLng('lng')
        .pointColor('color')
        .pointAltitude(d => d.size * 0.06)
        .pointRadius(d => d.size * 0.5)
        // Hover tooltip — each site name IS the Google Maps link (no separate button)
        .pointLabel(d => {
            const items = d.centres.map(c => {
                const url = `https://www.google.com/maps/search/${encodeURIComponent(c.name + ' ' + d.city)}/@${d.lat},${d.lng},14z`;
                return `<a href="${url}" target="_blank" rel="noopener" style="display:block;padding:4px 0;color:#06b6d4;text-decoration:none;font-size:13px;border-bottom:1px solid rgba(255,255,255,0.08);transition:color 0.2s;" onmouseover="this.style.color='#3b82f6'" onmouseout="this.style.color='#06b6d4'">${escapeHtml(c.name)}</a>`;
            }).join('');
            return `<div style="background:rgba(17,24,39,0.95);backdrop-filter:blur(12px);border:1px solid rgba(59,130,246,0.3);border-radius:12px;padding:14px 18px;min-width:200px;max-width:300px;box-shadow:0 8px 32px rgba(0,0,0,0.5);">
                <div style="font-family:'Space Grotesk',sans-serif;font-size:15px;font-weight:700;color:#06b6d4;margin-bottom:4px;">${escapeHtml(d.city)}, ${escapeHtml(d.state)}</div>
                <div style="font-size:11px;color:#64748b;margin-bottom:8px;">${d.count} centre${d.count > 1 ? 's' : ''}</div>
                <div>${items}</div>
            </div>`;
        })
        // Labels for bigger cities (like Google Maps labels — fade when small)
        .labelsData(pointsData.filter(d => d.count >= 2 || d.isLaunchPad))
        .labelLat('lat')
        .labelLng('lng')
        .labelText('city')
        .labelSize(d => 0.6 + d.count * 0.08)
        .labelDotRadius(d => d.size * 0.4)
        .labelColor(() => 'rgba(240, 244, 255, 0.85)')
        .labelResolution(2)
        .labelAltitude(d => d.size * 0.06 + 0.007)
        (container);

    // Smooth auto-rotate
    globe.controls().autoRotate = true;
    globe.controls().autoRotateSpeed = 0.3;
    globe.controls().enableDamping = true;
    globe.controls().dampingFactor = 0.1;

    // Pause auto-rotate on interaction, resume after 5s
    let resumeTimer;
    const pauseRotation = () => { globe.controls().autoRotate = false; };
    const scheduleResume = () => {
        clearTimeout(resumeTimer);
        resumeTimer = setTimeout(() => { globe.controls().autoRotate = true; }, 5000);
    };
    container.addEventListener('mousedown', pauseRotation);
    container.addEventListener('touchstart', pauseRotation);
    container.addEventListener('mouseup', scheduleResume);
    container.addEventListener('touchend', scheduleResume);

    // Responsive resize
    window.addEventListener('resize', () => {
        globe.width(container.offsetWidth);
        globe.height(Math.min(600, window.innerHeight * 0.7));
    });

    // Sidebar — click to fly to location
    const sidebar = document.getElementById('map-sidebar-list');
    if (sidebar) {
        const sorted = [...pointsData].sort((a, b) => b.count - a.count || a.city.localeCompare(b.city));
        sidebar.innerHTML = '';
        sorted.forEach(d => {
            const item = document.createElement('div');
            item.className = 'map-sidebar-item';
            item.innerHTML = `
                <div class="map-sidebar-city">${escapeHtml(d.city)}</div>
                <div class="map-sidebar-count">${d.count}</div>
            `;
            item.addEventListener('click', () => {
                globe.pointOfView({ lat: d.lat, lng: d.lng, altitude: 0.8 }, 1000);
                pauseRotation();
                scheduleResume();
            });
            sidebar.appendChild(item);
        });
    }
}

// ===== Altitude / Scale of Space =====
const ALTITUDE_REFERENCES = [
    { alt: 0, label: 'Sea Level', icon: '🌍', highlight: true },
    { alt: 0.83, label: 'Burj Khalifa (828 m)', icon: '🏗️' },
    { alt: 8.85, label: 'Mount Everest', icon: '🏔️' },
    { alt: 11, label: 'Airplane cruise', icon: '✈️' },
    { alt: 35, label: 'Weather balloon max', icon: '🎈' },
    { alt: 100, label: 'Karman Line — Edge of Space', icon: '🌌', highlight: true },
    { alt: 160, label: 'LEO begins', icon: '🛸', zone: true },
    { alt: 408, label: 'ISS orbit', icon: '🛰️' },
    { alt: 2000, label: 'LEO ends', icon: '🛸', zone: true },
    { alt: 20200, label: 'GPS satellites (MEO)', icon: '📡' },
    { alt: 35786, label: 'Geostationary orbit (GEO)', icon: '📡', highlight: true },
    { alt: 384400, label: 'The Moon', icon: '🌕', highlight: true },
];

function buildAltitudeSection() {
    const track = document.getElementById('altitude-track');
    const scrollContainer = document.getElementById('altitude-scroll');
    const labelEl = document.getElementById('altitude-current-label');
    const infoPanel = document.getElementById('altitude-info-panel');

    if (!track || !scrollContainer) return;

    // Full altitude range using log scale
    const maxAlt = 400000;
    const trackHeight = 6000;
    track.style.height = trackHeight + 'px';

    // Logarithmic mapping: alt -> y position
    function altToY(alt) {
        if (alt <= 0) return 0;
        return (Math.log10(alt + 1) / Math.log10(maxAlt + 1)) * trackHeight;
    }
    function yToAlt(y) {
        if (y <= 0) return 0;
        return Math.pow(maxAlt + 1, y / trackHeight) - 1;
    }

    // Fixed Earth surface bar at the top of the scroll container (sticky)
    const earthBar = document.createElement('div');
    earthBar.className = 'altitude-earth-bar';
    earthBar.innerHTML = `<span class="altitude-earth-bar-label">🌍 Earth Surface</span>`;
    scrollContainer.insertBefore(earthBar, track);

    // Render reference markers on the track
    ALTITUDE_REFERENCES.forEach(ref => {
        if (ref.alt === 0) return;
        const y = altToY(ref.alt);
        const marker = document.createElement('div');
        marker.className = `altitude-marker ${ref.highlight ? 'altitude-marker-highlight' : ''} ${ref.zone ? 'altitude-marker-zone' : ''}`;
        marker.style.top = y + 'px';
        marker.innerHTML = `
            <span class="altitude-marker-icon">${ref.icon}</span>
            <span class="altitude-marker-label">${ref.label}</span>
            <span class="altitude-marker-alt">${ref.alt >= 1000 ? (ref.alt / 1000).toLocaleString() + 'k' : ref.alt} km</span>
        `;
        track.appendChild(marker);
    });

    // ISRO spacecraft at real altitudes
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
        el.className = `altitude-sat ${isActive ? 'altitude-sat-active' : ''}`;
        el.style.top = y + 'px';
        el.style.setProperty('--sat-color', color);
        el.style.cursor = 'pointer';

        if (sats.length === 1) {
            el.innerHTML = `<span class="altitude-sat-name">${escapeHtml(sats[0].name)}</span>
                <span class="altitude-sat-alt">${representative.altitude_km.toLocaleString()} km</span>`;
            el.addEventListener('click', () => openModal(sats[0].id));
        } else {
            el.innerHTML = `<span class="altitude-sat-name">${sats.length} spacecraft</span>
                <span class="altitude-sat-alt">~${representative.altitude_km.toLocaleString()} km</span>`;
            el.title = sats.map(s => s.name).join(', ');
        }
        track.appendChild(el);
    });

    // Update altitude label and info panel on scroll
    scrollContainer.addEventListener('scroll', () => {
        const scrollTop = scrollContainer.scrollTop;
        const alt = yToAlt(scrollTop);

        if (alt < 1) labelEl.textContent = Math.round(alt * 1000) + ' m';
        else if (alt < 1000) labelEl.textContent = Math.round(alt) + ' km';
        else labelEl.textContent = Math.round(alt).toLocaleString() + ' km';

        // Info panel — nearest reference
        if (infoPanel) {
            const nearest = ALTITUDE_REFERENCES.reduce((best, ref) =>
                Math.abs(ref.alt - alt) < Math.abs(best.alt - alt) ? ref : best
            );
            const titleEl = infoPanel.querySelector('.altitude-info-title');
            const descEl = infoPanel.querySelector('.altitude-info-desc');
            if (titleEl) titleEl.textContent = nearest.icon + ' ' + nearest.label;
            if (descEl) descEl.textContent = nearest.alt >= 1000
                ? (nearest.alt / 1000).toLocaleString() + 'k km altitude'
                : nearest.alt + ' km altitude';
        }
    });
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

    // Active nav link — bidirectional highlight (works scrolling up and down)
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-links a');

    // Use a narrow rootMargin band so only the section crossing ~30% from top gets highlighted
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const link = document.querySelector(`.nav-links a[href="#${entry.target.id}"]`);
            if (link) {
                if (entry.isIntersecting) {
                    navLinks.forEach(l => l.classList.remove('active'));
                    link.classList.add('active');
                }
            }
        });
    }, { threshold: 0, rootMargin: '-25% 0px -70% 0px' });

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
