#!/usr/bin/env node
// Test script that simulates browser rendering logic against real data
// to catch TypeError, undefined access, and other runtime errors.

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
let errors = 0;
let warnings = 0;

function log(msg) { console.log(`  ${msg}`); }
function pass(msg) { console.log(`  ✓ ${msg}`); }
function fail(msg) { errors++; console.error(`  ✗ ERROR: ${msg}`); }
function warn(msg) { warnings++; console.warn(`  ⚠ WARN: ${msg}`); }

// === Load data ===
function loadJSON(filename) {
    const filepath = path.join(DATA_DIR, filename);
    if (!fs.existsSync(filepath)) {
        fail(`Missing data file: ${filename}`);
        return null;
    }
    try {
        return JSON.parse(fs.readFileSync(filepath, 'utf8'));
    } catch (e) {
        fail(`Invalid JSON in ${filename}: ${e.message}`);
        return null;
    }
}

// === Replicate app.js functions ===
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    const s = String(str);
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

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

// === Test each section rendering ===

console.log('\n=== ISRO Dashboard App.js Test Suite ===\n');

// Load all data
console.log('1. Loading data files...');
const spacecraftData = loadJSON('spacecrafts.json');
const launcherData = loadJSON('launchers.json');
const missionData = loadJSON('spacecraft_missions.json');
const customerData = loadJSON('customer_satellites.json');
const centreData = loadJSON('centres.json');

const allSpacecraft = spacecraftData ? (spacecraftData.spacecrafts || []) : [];
const allLaunchers = launcherData ? (launcherData.launchers || []) : [];
const allMissions = missionData ? (missionData.spacecraft_missions || []) : [];
const allCustomerSats = customerData ? (customerData.customer_satellites || []) : [];
const allCentres = centreData ? (centreData.centres || []) : [];

log(`Spacecraft: ${allSpacecraft.length}, Launchers: ${allLaunchers.length}, Missions: ${allMissions.length}, CustomerSats: ${allCustomerSats.length}, Centres: ${allCentres.length}`);

if (allSpacecraft.length === 0) fail('No spacecraft loaded');
if (allLaunchers.length === 0) fail('No launchers loaded');
if (allMissions.length === 0) fail('No missions loaded');
if (allCustomerSats.length === 0) fail('No customer satellites loaded');
if (allCentres.length === 0) fail('No centres loaded');

// Test mergeSpacecraftData
console.log('\n2. Testing mergeSpacecraftData...');
const missionMap = {};
allMissions.forEach(m => {
    if (!m.name) { warn(`Mission id=${m.id} has no name`); return; }
    missionMap[m.name.toLowerCase().trim()] = m;
});

const mergedSpacecraft = allSpacecraft.map(sc => {
    if (!sc.name) { warn(`Spacecraft id=${sc.id} has no name`); return sc; }
    const key = sc.name.toLowerCase().trim();
    const mission = missionMap[key];
    if (mission) {
        return { ...sc, ...mission, name: sc.name, id: sc.id };
    }
    return sc;
});
pass(`Merged ${mergedSpacecraft.length} spacecraft with mission data`);

// Test buildStats
console.log('\n3. Testing buildStats...');
try {
    const totalSpacecraft = mergedSpacecraft.length;
    const active = mergedSpacecraft.filter(s => getStatusClass(s.status) === 'active').length;
    const totalLaunches = allLaunchers.length;
    const customerSats = allCustomerSats.length;
    const firstYear = mergedSpacecraft.reduce((min, s) => {
        const y = getYear(s.launch_date);
        return y && y < min ? y : min;
    }, 9999);
    const span = new Date().getFullYear() - firstYear;
    const uniqueCountries = new Set(allCustomerSats.map(c => c.country).filter(Boolean)).size;

    log(`Total: ${totalSpacecraft}, Active: ${active}, Launches: ${totalLaunches}, CustomerSats: ${customerSats}, Countries: ${uniqueCountries}, Years: ${span}+`);
    pass('buildStats OK');
} catch (e) {
    fail(`buildStats crashed: ${e.message}`);
}

// Test buildTimeline
console.log('\n4. Testing buildTimeline (template generation)...');
try {
    const items = [...mergedSpacecraft].sort((a, b) => {
        const da = new Date(a.launch_date || '9999');
        const db = new Date(b.launch_date || '9999');
        return da - db;
    });

    items.forEach((s, i) => {
        try {
            const statusCls = getStatusClass(s.status);
            const year = getYear(s.launch_date);
            // Simulate template - this is where errors would occur
            const html = `
                <div class="timeline-item status-${statusCls}" data-decade="${year ? Math.floor(year / 10) * 10 : ''}">
                    <div class="timeline-date">${formatDate(s.launch_date)}</div>
                    <div class="timeline-name">${escapeHtml(s.name)}</div>
                    ${s.orbit_type ? `<span>${escapeHtml(s.orbit_type)}</span>` : ''}
                    ${s.launch_vehicle ? `<span>${escapeHtml(s.launch_vehicle)}</span>` : ''}
                    <span class="${statusCls}">${statusCls}</span>
                </div>`;
        } catch (e) {
            fail(`buildTimeline item ${i} (${s.name || s.id}): ${e.message}`);
        }
    });
    pass(`buildTimeline OK - ${items.length} items rendered`);
} catch (e) {
    fail(`buildTimeline crashed: ${e.message}`);
}

// Test buildSpacecraftCatalog
console.log('\n5. Testing buildSpacecraftCatalog (card generation)...');
try {
    mergedSpacecraft.forEach((s, i) => {
        try {
            const statusCls = getStatusClass(s.status);
            const statusStyle = `background: ${getStatusColor(s.status)}22; color: ${getStatusColor(s.status)};`;
            const html = `
                <div class="spacecraft-card">
                    <div>${escapeHtml(s.name)}</div>
                    <span style="${statusStyle}">${statusCls}</span>
                    <div>${formatDate(s.launch_date)}</div>
                    ${s.orbit_type ? `<span>${escapeHtml(s.orbit_type)}</span>` : ''}
                    ${s.launch_vehicle ? `<span>${escapeHtml(s.launch_vehicle)}</span>` : ''}
                    ${s.mass_kg ? `<span>${s.mass_kg.toLocaleString()} kg</span>` : ''}
                    ${s.mission_life ? `<span>${escapeHtml(s.mission_life)}</span>` : ''}
                    ${s.mission_type ? `<span>${escapeHtml(s.mission_type.length > 30 ? s.mission_type.substring(0, 30) + '...' : s.mission_type)}</span>` : ''}
                </div>`;
        } catch (e) {
            fail(`Catalog card ${i} (${s.name || s.id}): ${e.message}`);
        }
    });
    pass(`buildSpacecraftCatalog OK - ${mergedSpacecraft.length} cards rendered`);
} catch (e) {
    fail(`buildSpacecraftCatalog crashed: ${e.message}`);
}

// Test openModal
console.log('\n6. Testing openModal (modal generation)...');
try {
    mergedSpacecraft.forEach((sc, i) => {
        try {
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

            const html = `
                <h2>${escapeHtml(sc.name)}</h2>
                <p>${escapeHtml(sc.mission_type || 'ISRO Spacecraft')}</p>
                ${fields.map(f => `<div>${f.label}: ${escapeHtml(String(f.value))}</div>`).join('')}
                ${sc.payloads ? `<p>${escapeHtml(sc.payloads)}</p>` : ''}
                ${sc.stabilization ? `<p>${escapeHtml(sc.stabilization)}</p>` : ''}
                ${sc.propulsion ? `<p>${escapeHtml(sc.propulsion)}</p>` : ''}
            `;
        } catch (e) {
            fail(`Modal ${i} (${sc.name || sc.id}): ${e.message}`);
        }
    });
    pass(`openModal OK - ${mergedSpacecraft.length} modals rendered`);
} catch (e) {
    fail(`openModal crashed: ${e.message}`);
}

// Test buildLaunchers
console.log('\n7. Testing buildLaunchers...');
try {
    const families = {};
    allLaunchers.forEach(l => {
        const family = l.vehicle_family || 'Other';
        if (!families[family]) families[family] = [];
        families[family].push(l);
    });

    Object.entries(families).forEach(([family, launchers]) => {
        try {
            const html = `
                <div>
                    <h3>${escapeHtml(family)}</h3>
                    <span>${launchers.length} missions</span>
                    ${launchers.map(l => `
                        <span title="${l.customer_satellites_launched ? 'Carried: ' + l.customer_satellites_launched.join(', ') : l.id}">
                            ${escapeHtml(l.id)}
                            ${l.customer_satellites_launched ? ` (${l.customer_satellites_launched.length} foreign)` : ''}
                        </span>
                    `).join('')}
                </div>`;
        } catch (e) {
            fail(`Launcher family ${family}: ${e.message}`);
        }
    });
    pass(`buildLaunchers OK - ${Object.keys(families).length} families`);
} catch (e) {
    fail(`buildLaunchers crashed: ${e.message}`);
}

// Test buildCustomerSatellites
console.log('\n8. Testing buildCustomerSatellites...');
try {
    const countries = {};
    allCustomerSats.forEach(c => {
        const country = c.country || 'Unknown';
        if (!countries[country]) countries[country] = [];
        countries[country].push(c);
    });

    allCustomerSats.forEach((c, i) => {
        try {
            const html = `
                <div>
                    <div>${escapeHtml(c.id || c.name || 'Unknown')}</div>
                    <div>
                        ${c.launch_date ? `Launched: ${formatDate(c.launch_date)}` : ''}
                        ${c.launcher ? ` · ${escapeHtml(c.launcher)}` : ''}
                        ${c.mass_kg ? ` · ${c.mass_kg} kg` : ''}
                    </div>
                    ${c.country ? `<div>${escapeHtml(c.country)}</div>` : ''}
                </div>`;
        } catch (e) {
            fail(`Customer sat ${i} (${c.id}): ${e.message}`);
        }
    });
    pass(`buildCustomerSatellites OK - ${allCustomerSats.length} sats, ${Object.keys(countries).length} countries`);
} catch (e) {
    fail(`buildCustomerSatellites crashed: ${e.message}`);
}

// Test buildCentres
console.log('\n9. Testing buildCentres...');
try {
    allCentres.forEach((c, i) => {
        try {
            const html = `
                <div class="centre-card">
                    <div class="centre-name">${escapeHtml(c.name)}</div>
                    <div class="centre-location">
                        📍 ${escapeHtml(c.place || '')}${c.state ? `, ${escapeHtml(c.state)}` : ''}
                    </div>
                </div>`;
        } catch (e) {
            fail(`Centre ${i} (id=${c.id}): ${e.message}`);
        }
    });
    pass(`buildCentres OK - ${allCentres.length} centres`);
} catch (e) {
    fail(`buildCentres crashed: ${e.message}`);
}

// Test orbit visualization data
console.log('\n10. Testing orbit visualization data...');
try {
    const orbitGroups = {};
    mergedSpacecraft.forEach(sc => {
        const orbit = sc.orbit_type || 'Unknown';
        if (orbit === 'Failed') return;
        if (!orbitGroups[orbit]) orbitGroups[orbit] = [];
        orbitGroups[orbit].push(sc);
    });

    Object.entries(orbitGroups).forEach(([orbit, sats]) => {
        sats.forEach((sc, i) => {
            try {
                const isActive = getStatusClass(sc.status) === 'active';
                const color = getOrbitColor(orbit);
                // Simulate tooltip
                const tooltip = `<strong>${escapeHtml(sc.name)}</strong><br>${orbit} · ${getStatusClass(sc.status)}`;
            } catch (e) {
                fail(`Orbit viz satellite ${i} in ${orbit} (${sc.name}): ${e.message}`);
            }
        });
    });
    pass(`Orbit visualization OK - ${Object.keys(orbitGroups).length} orbit types`);
} catch (e) {
    fail(`Orbit visualization crashed: ${e.message}`);
}

// === Summary ===
console.log('\n=== RESULTS ===');
if (errors === 0) {
    console.log(`\n✓ ALL TESTS PASSED (${warnings} warnings)\n`);
    process.exit(0);
} else {
    console.log(`\n✗ ${errors} ERRORS, ${warnings} warnings\n`);
    process.exit(1);
}
