/**
 * Insurgency Wargame Application
 * A two-faction wargame management tool
 */

// ================================
// State Management
// ================================

// Maps will be loaded dynamically from manifest.json
let availableMaps = [];

const RESOURCE_LABELS = {
  oil: 'Oil/Gas Fields',
  water: 'Water Sources',
  border: 'Border Crossing',
  airport: 'Seaport/Airport',
  highway: 'Major Highway',
  urban: 'Urban Center',
  religious: 'Religious/Cultural Site',
  agriculture: 'Agricultural Land',
  mining: 'Mining Operations',
  telecom: 'Telecommunications Hub'
};

const TERRAIN_LABELS = {
  mountain: 'Mountains',
  forest: 'Forest',
  plain: 'Plain'
};

const DENSITY_LABELS = {
  high: 'High',
  moderate: 'Moderate',
  sparse: 'Sparse'
};

let state = {
  version: '3.0',
  phase: 'setup',
  setup: {
    step: 1,
    selectedTemplate: null,
    templateData: null,
    capitalProvinceId: null,
    currentProvinceIndex: 0,
    configuredProvinces: {}
  },
  game: {
    turnNumber: 1,
    activeFaction: 'government',
    forces: {
      government: 1000,
      jihadist: 500
    }
  },
  map: {
    templateId: null,
    provinces: []
  },
  actionLog: [],
  turnHistory: [],
  history: []
};

let selectedProvinceId = null;
let tooltipTimeout = null;
let pendingImportData = null;
let adjustingFaction = null;

// ================================
// Utility Functions
// ================================

function generateId() {
  return 'id-' + Math.random().toString(36).substr(2, 9);
}

function formatNumber(num) {
  return num.toLocaleString();
}

function getTimestamp() {
  return new Date().toISOString();
}

function capitalizeFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function coordsToPath(coords) {
  if (!coords || coords.length === 0) return '';
  return `M ${coords[0][0]},${coords[0][1]} ` +
    coords.slice(1).map(p => `L ${p[0]},${p[1]}`).join(' ') + ' Z';
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ================================
// Template Loading
// ================================

async function loadManifest() {
  try {
    const response = await fetch('maps/manifest.json');
    if (!response.ok) throw new Error('Failed to load manifest');
    const manifest = await response.json();
    availableMaps = manifest.maps || [];
    return availableMaps;
  } catch (error) {
    console.error('Error loading manifest:', error);
    showToast('Failed to load map list. Check maps/manifest.json', 'error');
    return [];
  }
}

async function loadTemplate(filename) {
  try {
    const response = await fetch(`maps/${filename}`);
    if (!response.ok) throw new Error('Failed to load template');
    const data = await response.json();
    // Store the filename for reference
    data.filename = filename;
    return data;
  } catch (error) {
    console.error(`Error loading template ${filename}:`, error);
    return null;
  }
}

function createTemplatePreview(templateData) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', templateData.viewBox);

  templateData.provinces.forEach(province => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', coordsToPath(province.coordinates));
    path.setAttribute('fill', 'rgba(113, 128, 150, 0.3)');
    path.setAttribute('stroke', '#4A5568');
    path.setAttribute('stroke-width', '1');
    svg.appendChild(path);
  });

  return svg;
}

async function renderTemplateCards() {
  const grid = document.getElementById('template-grid');
  grid.innerHTML = '<div class="loading">Loading maps...</div>';

  // Load manifest first
  const mapFiles = await loadManifest();

  if (mapFiles.length === 0) {
    grid.innerHTML = '<div class="empty-state">No maps available. Add map files to the maps folder and update manifest.json</div>';
    return;
  }

  grid.innerHTML = '';

  // Load and display each map
  for (const filename of mapFiles) {
    const data = await loadTemplate(filename);
    if (!data) continue;

    const card = document.createElement('div');
    card.className = 'template-card';
    card.dataset.filename = filename;

    const preview = document.createElement('div');
    preview.className = 'template-preview';
    preview.appendChild(createTemplatePreview(data));

    const label = document.createElement('span');
    label.className = 'template-label';
    // Use the name from JSON, or generate from filename, or show province count
    label.textContent = data.name || `${data.provinceCount || data.provinces?.length || '?'} Provinces`;

    card.appendChild(preview);
    card.appendChild(label);

    card.addEventListener('click', () => selectTemplate(filename, data));

    grid.appendChild(card);
  }
}

// ================================
// Setup Phase Functions
// ================================

async function selectTemplate(filename, data) {
  state.setup.selectedTemplate = filename;
  state.setup.templateData = data;

  // Initialize configured provinces
  data.provinces.forEach(p => {
    state.setup.configuredProvinces[p.id] = {
      control: null,
      density: null,
      sentiment: 0,
      terrain: null,
      resources: []
    };
  });

  renderSetupMap();
  goToStep(2);
}

function renderSetupMap() {
  const svg = document.getElementById('setup-map-svg');
  const data = state.setup.templateData;

  if (!data) return;

  svg.innerHTML = '';
  svg.setAttribute('viewBox', data.viewBox);
  svg.classList.remove('hidden');
  document.querySelector('.map-placeholder').classList.add('hidden');

  // Create province group
  const provincesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  provincesGroup.id = 'provinces-group';

  data.provinces.forEach(province => {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.id = `province-${province.id}`;
    group.classList.add('province-group');

    // Province path
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', coordsToPath(province.coordinates));
    path.classList.add('province');
    path.dataset.id = province.id;

    // Determine fill color based on state
    const config = state.setup.configuredProvinces[province.id];
    if (province.id === state.setup.capitalProvinceId) {
      path.classList.add('government');
    } else if (config && config.control) {
      path.classList.add(config.control);
    } else {
      path.classList.add('neutral');
    }

    // Highlight current province in step 3
    if (state.setup.step === 3) {
      const sortedProvinces = [...data.provinces].sort((a, b) => a.id.localeCompare(b.id));
      const currentProvince = sortedProvinces[state.setup.currentProvinceIndex];
      if (currentProvince && province.id === currentProvince.id) {
        path.classList.add('current');
      }
    }

    path.setAttribute('stroke', '#3D4559');
    path.setAttribute('stroke-width', '1.5');

    group.appendChild(path);

    // Province label
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', province.centroid[0]);
    text.setAttribute('y', province.centroid[1]);
    text.classList.add('province-label');
    text.textContent = province.id;
    group.appendChild(text);

    // Capital star
    if (province.id === state.setup.capitalProvinceId) {
      const star = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      star.setAttribute('x', province.centroid[0]);
      star.setAttribute('y', province.centroid[1] - 20);
      star.setAttribute('text-anchor', 'middle');
      star.setAttribute('fill', '#F6AD55');
      star.setAttribute('font-size', '24');
      star.textContent = '★';
      group.appendChild(star);
    }

    // Coastal anchor
    if (province.isCoastal && state.setup.step >= 3 && config && config.terrain) {
      const anchor = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      const bounds = getProvinceBounds(province.coordinates);
      anchor.setAttribute('x', bounds.maxX - 15);
      anchor.setAttribute('y', bounds.maxY - 10);
      anchor.setAttribute('text-anchor', 'middle');
      anchor.setAttribute('fill', '#4FD1C5');
      anchor.setAttribute('font-size', '16');
      anchor.textContent = '⚓';
      group.appendChild(anchor);
    }

    // Terrain icon
    if (config && config.terrain) {
      const terrainIcon = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      const bounds = getProvinceBounds(province.coordinates);
      terrainIcon.setAttribute('x', bounds.minX + 15);
      terrainIcon.setAttribute('y', bounds.minY + 20);
      terrainIcon.setAttribute('text-anchor', 'middle');
      terrainIcon.setAttribute('fill', 'white');
      terrainIcon.setAttribute('font-size', '14');
      terrainIcon.textContent = getTerrainEmoji(config.terrain);
      group.appendChild(terrainIcon);
    }

    // Event listeners
    if (state.setup.step === 2) {
      path.addEventListener('click', () => selectCapital(province.id));
    }

    provincesGroup.appendChild(group);
  });

  svg.appendChild(provincesGroup);
}

function getProvinceBounds(coords) {
  const xs = coords.map(c => c[0]);
  const ys = coords.map(c => c[1]);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys)
  };
}

function getTerrainEmoji(terrain) {
  const emojis = { mountain: '⛰️', forest: '🌲', plain: '━' };
  return emojis[terrain] || '';
}

function selectCapital(provinceId) {
  state.setup.capitalProvinceId = provinceId;
  state.setup.configuredProvinces[provinceId].control = 'government';

  document.getElementById('capital-selection').textContent = `Province ${provinceId}`;
  document.getElementById('confirm-capital-btn').disabled = false;

  renderSetupMap();
}

function confirmCapital() {
  goToStep(3);
}

function backToTemplates() {
  // Reset state
  state.setup.selectedTemplate = null;
  state.setup.templateData = null;
  state.setup.capitalProvinceId = null;
  state.setup.configuredProvinces = {};

  // Reset UI
  document.getElementById('capital-selection').textContent = 'None';
  document.getElementById('confirm-capital-btn').disabled = true;

  // Hide map and show placeholder
  document.getElementById('setup-map-svg').classList.add('hidden');
  document.getElementById('setup-map-svg').innerHTML = '';
  document.querySelector('.map-placeholder').classList.remove('hidden');

  goToStep(1);
}

function goToStep(step) {
  state.setup.step = step;

  // Hide all steps
  document.querySelectorAll('.config-step').forEach(el => el.classList.add('hidden'));

  // Show current step
  const stepIds = ['', 'step-template', 'step-capital', 'step-provinces', 'step-forces'];
  document.getElementById(stepIds[step]).classList.remove('hidden');

  if (step === 3) {
    state.setup.currentProvinceIndex = 0;
    loadProvinceConfig();
  }

  renderSetupMap();
}

function loadProvinceConfig() {
  const data = state.setup.templateData;
  const sortedProvinces = [...data.provinces].sort((a, b) => a.id.localeCompare(b.id));
  const province = sortedProvinces[state.setup.currentProvinceIndex];

  if (!province) return;

  const config = state.setup.configuredProvinces[province.id];
  const isCapital = province.id === state.setup.capitalProvinceId;

  // Update header
  document.getElementById('current-province-label').textContent = province.id;
  document.getElementById('province-progress').textContent =
    `${state.setup.currentProvinceIndex + 1}/${sortedProvinces.length}`;

  // Control section
  const controlSection = document.getElementById('control-section');
  const controlRadios = document.getElementById('control-radios');
  const capitalNote = document.getElementById('capital-note');

  if (isCapital) {
    controlRadios.classList.add('hidden');
    capitalNote.classList.remove('hidden');
  } else {
    controlRadios.classList.remove('hidden');
    capitalNote.classList.add('hidden');

    // Reset and set control radios
    document.querySelectorAll('input[name="control"]').forEach(radio => {
      radio.checked = radio.value === config.control;
    });
  }

  // Population density
  document.getElementById('density-select').value = config.density || '';

  // Sentiment
  document.getElementById('sentiment-slider').value = config.sentiment;
  document.getElementById('sentiment-value').textContent = config.sentiment;

  // Terrain
  document.querySelectorAll('input[name="terrain"]').forEach(radio => {
    radio.checked = radio.value === config.terrain;
  });

  // Resources
  document.querySelectorAll('input[name="resources"]').forEach(checkbox => {
    checkbox.checked = config.resources.includes(checkbox.value);
  });

  // Navigation buttons
  const prevBtn = document.getElementById('prev-province-btn');
  prevBtn.disabled = false; // Always enabled
  if (state.setup.currentProvinceIndex === 0) {
    prevBtn.textContent = '< Back';
  } else {
    prevBtn.textContent = '< Previous';
  }

  const nextBtn = document.getElementById('next-province-btn');
  if (state.setup.currentProvinceIndex === sortedProvinces.length - 1) {
    nextBtn.textContent = 'Finish Configuration';
  } else {
    nextBtn.textContent = 'Next Province >';
  }

  validateProvinceConfig();
  renderSetupMap();
}

function saveCurrentProvinceConfig() {
  const data = state.setup.templateData;
  const sortedProvinces = [...data.provinces].sort((a, b) => a.id.localeCompare(b.id));
  const province = sortedProvinces[state.setup.currentProvinceIndex];
  const isCapital = province.id === state.setup.capitalProvinceId;

  const config = state.setup.configuredProvinces[province.id];

  if (!isCapital) {
    const controlRadio = document.querySelector('input[name="control"]:checked');
    config.control = controlRadio ? controlRadio.value : null;
  }

  config.density = document.getElementById('density-select').value || null;
  config.sentiment = parseInt(document.getElementById('sentiment-slider').value);

  const terrainRadio = document.querySelector('input[name="terrain"]:checked');
  config.terrain = terrainRadio ? terrainRadio.value : null;

  config.resources = Array.from(document.querySelectorAll('input[name="resources"]:checked'))
    .map(cb => cb.value);
}

function validateProvinceConfig() {
  const data = state.setup.templateData;
  const sortedProvinces = [...data.provinces].sort((a, b) => a.id.localeCompare(b.id));
  const province = sortedProvinces[state.setup.currentProvinceIndex];
  const isCapital = province.id === state.setup.capitalProvinceId;

  const hasControl = isCapital || document.querySelector('input[name="control"]:checked');
  const hasTerrain = document.querySelector('input[name="terrain"]:checked');

  document.getElementById('next-province-btn').disabled = !(hasControl && hasTerrain);
}

function nextProvince() {
  saveCurrentProvinceConfig();

  const data = state.setup.templateData;
  const sortedProvinces = [...data.provinces].sort((a, b) => a.id.localeCompare(b.id));

  if (state.setup.currentProvinceIndex < sortedProvinces.length - 1) {
    state.setup.currentProvinceIndex++;
    loadProvinceConfig();
  } else {
    goToStep(4);
  }
}

function prevProvince() {
  saveCurrentProvinceConfig();

  if (state.setup.currentProvinceIndex > 0) {
    state.setup.currentProvinceIndex--;
    loadProvinceConfig();
  } else {
    // On first province, go back to capital selection
    goToStep(2);
  }
}

function startGame() {
  // Get force values
  const govForces = parseInt(document.getElementById('gov-forces-input').value) || 0;
  const jihForces = parseInt(document.getElementById('jih-forces-input').value) || 0;

  // Build final province state
  const data = state.setup.templateData;
  state.map.templateId = state.setup.selectedTemplate;
  state.map.provinces = data.provinces.map(p => {
    const config = state.setup.configuredProvinces[p.id];
    return {
      id: p.id,
      control: config.control,
      sentiment: config.sentiment,
      populationDensity: config.density,
      terrain: config.terrain,
      resources: config.resources,
      isCapital: p.id === state.setup.capitalProvinceId,
      isCoastal: p.isCoastal,
      coordinates: p.coordinates,
      centroid: p.centroid,
      neighbors: p.neighbors,
      statusFlags: {
        underSiege: false,
        blockaded: false,
        contested: false
      }
    };
  });

  // Set game state
  state.game.forces.government = govForces;
  state.game.forces.jihadist = jihForces;
  state.game.turnNumber = 1;
  state.game.activeFaction = 'government';
  state.turnHistory = [{ turn: 1, faction: 'government' }];

  // Switch to play phase
  state.phase = 'play';
  document.getElementById('setup-phase').classList.add('hidden');
  document.getElementById('play-phase').classList.remove('hidden');

  renderPlayPhase();
}

// ================================
// Play Phase Functions
// ================================

function renderPlayPhase() {
  renderPlayMap();
  updateTurnIndicator();
  updateForceDisplay();
  renderActionLog();
  renderTurnHistory();
}

function renderPlayMap() {
  const svg = document.getElementById('play-map-svg');
  const data = state.setup.templateData;

  if (!data) return;

  svg.innerHTML = '';
  svg.setAttribute('viewBox', data.viewBox);

  state.map.provinces.forEach(province => {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.id = `play-province-${province.id}`;

    // Province path
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', coordsToPath(province.coordinates));
    path.classList.add('province');
    path.classList.add(province.control);
    path.dataset.id = province.id;

    if (selectedProvinceId === province.id) {
      path.classList.add('selected');
    }

    path.setAttribute('stroke', '#3D4559');
    path.setAttribute('stroke-width', '1.5');

    // Event listeners
    path.addEventListener('click', () => selectProvince(province.id));
    path.addEventListener('mouseenter', (e) => showProvinceTooltip(e, province));
    path.addEventListener('mousemove', (e) => moveProvinceTooltip(e));
    path.addEventListener('mouseleave', hideProvinceTooltip);

    group.appendChild(path);

    // Province label (or capital star)
    if (province.isCapital) {
      const star = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      star.setAttribute('x', province.centroid[0]);
      star.setAttribute('y', province.centroid[1] + 5);
      star.setAttribute('text-anchor', 'middle');
      star.setAttribute('fill', '#F6AD55');
      star.setAttribute('font-size', '28');
      star.classList.add('province-icon');
      star.textContent = '★';
      group.appendChild(star);
    } else {
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', province.centroid[0]);
      text.setAttribute('y', province.centroid[1] + 7);
      text.classList.add('province-label');
      text.textContent = province.id;
      group.appendChild(text);
    }

    // Coastal anchor
    if (province.isCoastal) {
      const bounds = getProvinceBounds(province.coordinates);
      const anchor = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      anchor.setAttribute('x', bounds.maxX - 15);
      anchor.setAttribute('y', bounds.maxY - 10);
      anchor.setAttribute('text-anchor', 'middle');
      anchor.setAttribute('fill', '#4FD1C5');
      anchor.setAttribute('font-size', '16');
      anchor.classList.add('province-icon');
      anchor.textContent = '⚓';
      group.appendChild(anchor);
    }

    // Terrain icon
    if (province.terrain) {
      const bounds = getProvinceBounds(province.coordinates);
      const terrainIcon = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      terrainIcon.setAttribute('x', bounds.minX + 15);
      terrainIcon.setAttribute('y', bounds.minY + 20);
      terrainIcon.setAttribute('text-anchor', 'middle');
      terrainIcon.setAttribute('fill', 'white');
      terrainIcon.setAttribute('font-size', '14');
      terrainIcon.classList.add('province-icon');
      terrainIcon.textContent = getTerrainEmoji(province.terrain);
      group.appendChild(terrainIcon);
    }

    svg.appendChild(group);
  });
}

function showProvinceTooltip(e, province) {
  clearTimeout(tooltipTimeout);

  tooltipTimeout = setTimeout(() => {
    const tooltip = document.getElementById('province-tooltip');

    let statusHtml = '';
    const activeFlags = Object.entries(province.statusFlags)
      .filter(([_, active]) => active)
      .map(([flag]) => {
        const labels = { underSiege: 'Under Siege', blockaded: 'Blockaded', contested: 'Contested' };
        return `<span class="status-badge">${labels[flag]}</span>`;
      });

    if (activeFlags.length > 0) {
      statusHtml = `
        <div class="tooltip-status">
          <div class="label">Status:</div>
          <div>${activeFlags.join('')}</div>
        </div>
      `;
    }

    let resourcesHtml = '';
    if (province.resources && province.resources.length > 0) {
      resourcesHtml = `
        <div class="tooltip-resources">
          <div class="label">Resources:</div>
          <ul>
            ${province.resources.map(r => `<li>${RESOURCE_LABELS[r] || r}</li>`).join('')}
          </ul>
        </div>
      `;
    }

    tooltip.innerHTML = `
      <div class="tooltip-title">Province ${province.id}</div>
      <div class="tooltip-row">
        <span class="label">Control:</span>
        <span class="value">${capitalizeFirst(province.control)}</span>
      </div>
      <div class="tooltip-row">
        <span class="label">Population:</span>
        <span class="value">${DENSITY_LABELS[province.populationDensity] || '-'}</span>
      </div>
      <div class="tooltip-row">
        <span class="label">Sentiment:</span>
        <span class="value">${province.sentiment > 0 ? '+' : ''}${province.sentiment}</span>
      </div>
      <div class="tooltip-row">
        <span class="label">Terrain:</span>
        <span class="value">${TERRAIN_LABELS[province.terrain] || '-'}</span>
      </div>
      ${resourcesHtml}
      ${statusHtml}
    `;

    positionTooltip(e, tooltip);
    tooltip.classList.remove('hidden');
    tooltip.classList.add('visible');
  }, 200);
}

function moveProvinceTooltip(e) {
  const tooltip = document.getElementById('province-tooltip');
  if (tooltip.classList.contains('visible')) {
    positionTooltip(e, tooltip);
  }
}

function positionTooltip(e, tooltip) {
  const padding = 12;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  // Get tooltip dimensions (need to make it visible briefly to measure)
  tooltip.style.visibility = 'hidden';
  tooltip.style.display = 'block';
  const tooltipWidth = tooltip.offsetWidth;
  const tooltipHeight = tooltip.offsetHeight;
  tooltip.style.visibility = '';
  tooltip.style.display = '';

  let x = e.clientX + padding;
  let y = e.clientY + padding;

  // Keep tooltip within viewport horizontally
  if (x + tooltipWidth > viewportWidth - padding) {
    x = e.clientX - tooltipWidth - padding;
  }
  if (x < padding) {
    x = padding;
  }

  // Keep tooltip within viewport vertically
  if (y + tooltipHeight > viewportHeight - padding) {
    y = e.clientY - tooltipHeight - padding;
  }
  if (y < padding) {
    y = padding;
  }

  tooltip.style.left = x + 'px';
  tooltip.style.top = y + 'px';
}

function hideProvinceTooltip() {
  clearTimeout(tooltipTimeout);
  const tooltip = document.getElementById('province-tooltip');
  tooltip.classList.remove('visible');
  tooltip.classList.add('hidden');
}

function selectProvince(provinceId) {
  selectedProvinceId = provinceId;
  renderPlayMap();
  showProvinceDetails(provinceId);
}

function showProvinceDetails(provinceId) {
  const province = state.map.provinces.find(p => p.id === provinceId);
  if (!province) return;

  const panel = document.getElementById('province-details-panel');
  panel.classList.remove('hidden');

  document.getElementById('detail-province-id').textContent = provinceId;

  // Control
  document.querySelectorAll('input[name="detail-control"]').forEach(radio => {
    radio.checked = radio.value === province.control;
  });

  // Sentiment
  document.getElementById('detail-sentiment-slider').value = province.sentiment;
  document.getElementById('detail-sentiment-value').textContent = province.sentiment;

  // Status flags
  document.querySelectorAll('input[name="status"]').forEach(checkbox => {
    checkbox.checked = province.statusFlags[checkbox.value];
  });

  // Fixed attributes
  document.getElementById('detail-population').textContent =
    DENSITY_LABELS[province.populationDensity] || '-';
  document.getElementById('detail-terrain').textContent =
    TERRAIN_LABELS[province.terrain] || '-';
  document.getElementById('detail-resources').textContent =
    province.resources.map(r => RESOURCE_LABELS[r]).join(', ') || 'None';

  const capitalStatus = document.getElementById('detail-capital-status');
  if (province.isCapital) {
    capitalStatus.classList.remove('hidden');
  } else {
    capitalStatus.classList.add('hidden');
  }

  const coastalStatus = document.getElementById('detail-coastal-status');
  if (province.isCoastal) {
    coastalStatus.classList.remove('hidden');
  } else {
    coastalStatus.classList.add('hidden');
  }
}

function saveProvinceDetails() {
  if (!selectedProvinceId) return;

  const province = state.map.provinces.find(p => p.id === selectedProvinceId);
  if (!province) return;

  const controlRadio = document.querySelector('input[name="detail-control"]:checked');
  province.control = controlRadio ? controlRadio.value : province.control;

  province.sentiment = parseInt(document.getElementById('detail-sentiment-slider').value);

  document.querySelectorAll('input[name="status"]').forEach(checkbox => {
    province.statusFlags[checkbox.value] = checkbox.checked;
  });

  closeProvinceDetails();
  renderPlayMap();
}

function closeProvinceDetails() {
  document.getElementById('province-details-panel').classList.add('hidden');
  selectedProvinceId = null;
  renderPlayMap();
}

function updateTurnIndicator() {
  document.getElementById('turn-number').textContent = state.game.turnNumber;

  const badge = document.getElementById('faction-badge');
  badge.textContent = state.game.activeFaction.toUpperCase();
  badge.className = 'faction-badge ' + state.game.activeFaction;
}

function updateForceDisplay() {
  document.getElementById('gov-force-value').textContent = formatNumber(state.game.forces.government);
  document.getElementById('jih-force-value').textContent = formatNumber(state.game.forces.jihadist);
}

function endTurn() {
  state.game.turnNumber++;
  state.game.activeFaction = state.game.activeFaction === 'government' ? 'jihadist' : 'government';

  state.turnHistory.push({
    turn: state.game.turnNumber,
    faction: state.game.activeFaction
  });

  // Animate turn change
  const turnNum = document.getElementById('turn-number');
  turnNum.classList.add('changing');
  setTimeout(() => turnNum.classList.remove('changing'), 500);

  updateTurnIndicator();
  renderTurnHistory();
}

function renderTurnHistory() {
  const container = document.getElementById('turn-badges');
  container.innerHTML = '';

  const recentHistory = state.turnHistory.slice(-5);

  recentHistory.forEach(item => {
    const badge = document.createElement('span');
    badge.className = `turn-badge ${item.faction}`;
    badge.textContent = `T${item.turn}-${item.faction === 'government' ? 'Gov' : 'Jih'}`;
    container.appendChild(badge);
  });
}

// ================================
// Action Log Functions
// ================================

function renderActionLog() {
  const container = document.getElementById('action-log');
  const countEl = document.getElementById('log-count');

  countEl.textContent = state.actionLog.length;

  if (state.actionLog.length === 0) {
    container.innerHTML = '<div class="empty-log">No actions recorded yet</div>';
    return;
  }

  container.innerHTML = '';

  // Sort by most recent first
  const sortedLog = [...state.actionLog].reverse();

  sortedLog.forEach(entry => {
    const div = document.createElement('div');
    div.className = `log-entry ${entry.faction}`;

    const time = new Date(entry.timestamp).toLocaleTimeString();

    div.innerHTML = `
      <div class="log-entry-header">
        <span class="log-turn">Turn ${entry.turnNumber} • ${capitalizeFirst(entry.faction)}</span>
        <span class="log-category">${entry.category}</span>
      </div>
      <span class="log-outcome ${entry.outcome}">${capitalizeFirst(entry.outcome)}</span>
      ${entry.provinceIds.length > 0 ? `<div class="log-provinces">Provinces: ${entry.provinceIds.join(', ')}</div>` : ''}
      <div class="log-description">${entry.description}</div>
      <div class="log-timestamp">${time}</div>
    `;

    container.appendChild(div);
  });
}

function openAddLogModal() {
  showModal('add-log-modal');

  // Populate provinces checkboxes
  const container = document.getElementById('log-provinces');
  container.innerHTML = '';

  state.map.provinces.forEach(p => {
    const label = document.createElement('label');
    label.className = 'checkbox-label';
    label.innerHTML = `
      <input type="checkbox" name="log-province" value="${p.id}">
      <span>Province ${p.id}</span>
    `;
    container.appendChild(label);
  });

  // Default to active faction
  const factionRadio = document.querySelector(`input[name="log-faction"][value="${state.game.activeFaction}"]`);
  if (factionRadio) factionRadio.checked = true;

  // Default outcome to success
  const successRadio = document.querySelector('input[name="log-outcome"][value="success"]');
  if (successRadio) successRadio.checked = true;

  // Reset other fields
  document.getElementById('log-category').value = 'military';
  document.getElementById('log-description').value = '';
  document.getElementById('log-gov-adjust').value = '0';
  document.getElementById('log-jih-adjust').value = '0';
}

function createLogEntry() {
  const factionRadio = document.querySelector('input[name="log-faction"]:checked');
  const outcomeRadio = document.querySelector('input[name="log-outcome"]:checked');
  const description = document.getElementById('log-description').value.trim();

  if (!factionRadio || !outcomeRadio || !description) {
    showToast('Please fill in all required fields', 'error');
    return;
  }

  const provinceIds = Array.from(document.querySelectorAll('input[name="log-province"]:checked'))
    .map(cb => cb.value);

  const govAdjust = parseInt(document.getElementById('log-gov-adjust').value) || 0;
  const jihAdjust = parseInt(document.getElementById('log-jih-adjust').value) || 0;

  const entry = {
    id: generateId(),
    turnNumber: state.game.turnNumber,
    timestamp: getTimestamp(),
    faction: factionRadio.value,
    category: document.getElementById('log-category').value,
    outcome: outcomeRadio.value,
    provinceIds,
    description,
    forceChanges: {
      government: govAdjust,
      jihadist: jihAdjust
    }
  };

  state.actionLog.push(entry);

  // Apply force changes
  state.game.forces.government += govAdjust;
  state.game.forces.jihadist += jihAdjust;

  closeModal();
  renderActionLog();
  updateForceDisplay();

  // Highlight new entry
  setTimeout(() => {
    const firstEntry = document.querySelector('.log-entry');
    if (firstEntry) {
      firstEntry.classList.add('new');
      setTimeout(() => firstEntry.classList.remove('new'), 1000);
    }
  }, 50);
}

// ================================
// Force Adjustment
// ================================

function openForceAdjustModal(faction, direction) {
  adjustingFaction = faction;

  document.getElementById('adjust-faction-label').textContent = capitalizeFirst(faction);
  document.getElementById('force-adjust-amount').value = direction === 'plus' ? '100' : '-100';
  document.getElementById('force-adjust-desc').value = '';

  showModal('force-adjust-modal');
}

function confirmForceAdjust() {
  const amount = parseInt(document.getElementById('force-adjust-amount').value) || 0;
  const desc = document.getElementById('force-adjust-desc').value.trim() || 'Manual adjustment';

  state.game.forces[adjustingFaction] += amount;
  if (state.game.forces[adjustingFaction] < 0) {
    state.game.forces[adjustingFaction] = 0;
  }

  // Create log entry
  const entry = {
    id: generateId(),
    turnNumber: state.game.turnNumber,
    timestamp: getTimestamp(),
    faction: adjustingFaction,
    category: 'other',
    outcome: 'success',
    provinceIds: [],
    description: `Force adjustment: ${amount > 0 ? '+' : ''}${amount} - ${desc}`,
    forceChanges: {
      government: adjustingFaction === 'government' ? amount : 0,
      jihadist: adjustingFaction === 'jihadist' ? amount : 0
    }
  };

  state.actionLog.push(entry);

  closeModal();
  updateForceDisplay();
  renderActionLog();

  // Animate force value
  const valueEl = document.getElementById(adjustingFaction === 'government' ? 'gov-force-value' : 'jih-force-value');
  valueEl.classList.add('animating');
  setTimeout(() => valueEl.classList.remove('animating'), 500);
}

// ================================
// Export/Import
// ================================

function exportGame() {
  const exportData = {
    version: state.version,
    phase: state.phase,
    setup: state.setup,
    game: state.game,
    map: state.map,
    actionLog: state.actionLog,
    turnHistory: state.turnHistory
  };

  const json = JSON.stringify(exportData, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `wargame-save-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();

  URL.revokeObjectURL(url);
  showToast('Game exported successfully', 'success');
}

function triggerImport() {
  document.getElementById('import-file-input').click();
}

function handleImportFile(e) {
  const file = e.target.files[0];
  if (!file) return;

  const isFromSetup = e.target.id === 'setup-import-input';

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      pendingImportData = JSON.parse(event.target.result);

      // Validate
      if (!pendingImportData.version || !pendingImportData.phase) {
        throw new Error('Invalid save file');
      }

      // If loading from setup phase, directly import without confirmation
      if (isFromSetup) {
        confirmImport();
      } else {
        showModal('import-modal');
      }
    } catch (error) {
      showToast('Invalid save file', 'error');
    }
  };
  reader.onerror = () => {
    showToast('Error reading file', 'error');
  };
  reader.readAsText(file);

  // Reset input
  e.target.value = '';
}

function confirmImport() {
  if (!pendingImportData) return;

  // Restore state
  state.version = pendingImportData.version;
  state.phase = pendingImportData.phase;
  state.setup = pendingImportData.setup;
  state.game = pendingImportData.game;
  state.map = pendingImportData.map;
  state.actionLog = pendingImportData.actionLog || [];
  state.turnHistory = pendingImportData.turnHistory || [];

  pendingImportData = null;
  closeModal();

  // Show appropriate phase
  if (state.phase === 'play') {
    document.getElementById('setup-phase').classList.add('hidden');
    document.getElementById('play-phase').classList.remove('hidden');
    renderPlayPhase();
  } else {
    document.getElementById('setup-phase').classList.remove('hidden');
    document.getElementById('play-phase').classList.add('hidden');
    renderSetupMap();
  }

  showToast('Game imported successfully', 'success');
}

// ================================
// New Game
// ================================

function openNewGameModal() {
  showModal('new-game-modal');
}

function exportAndReset() {
  exportGame();
  resetGame();
}

function resetGame() {
  closeModal();

  // Reset state
  state = {
    version: '3.0',
    phase: 'setup',
    setup: {
      step: 1,
      selectedTemplate: null,
      templateData: null,
      capitalProvinceId: null,
      currentProvinceIndex: 0,
      configuredProvinces: {}
    },
    game: {
      turnNumber: 1,
      activeFaction: 'government',
      forces: {
        government: 1000,
        jihadist: 500
      }
    },
    map: {
      templateId: null,
      provinces: []
    },
    actionLog: [],
    turnHistory: [],
    history: []
  };

  selectedProvinceId = null;

  // Show setup phase
  document.getElementById('play-phase').classList.add('hidden');
  document.getElementById('setup-phase').classList.remove('hidden');

  // Reset setup UI
  document.querySelector('.map-placeholder').classList.remove('hidden');
  document.getElementById('setup-map-svg').classList.add('hidden');
  document.getElementById('setup-map-svg').innerHTML = '';

  goToStep(1);
  renderTemplateCards();
}

// ================================
// Modal Functions
// ================================

function showModal(modalId) {
  const overlay = document.getElementById('modal-overlay');
  const modal = document.getElementById(modalId);

  // Hide all modals
  document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));

  // Show overlay and specific modal
  overlay.classList.remove('hidden');
  modal.classList.remove('hidden');

  // Animate in
  requestAnimationFrame(() => {
    overlay.classList.add('visible');
  });
}

function closeModal() {
  const overlay = document.getElementById('modal-overlay');

  overlay.classList.remove('visible');

  setTimeout(() => {
    overlay.classList.add('hidden');
    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
  }, 250);
}

// ================================
// Event Listeners
// ================================

function initEventListeners() {
  // Setup phase
  document.getElementById('confirm-capital-btn').addEventListener('click', confirmCapital);
  document.getElementById('back-to-templates-btn').addEventListener('click', backToTemplates);
  document.getElementById('prev-province-btn').addEventListener('click', prevProvince);
  document.getElementById('next-province-btn').addEventListener('click', nextProvince);
  document.getElementById('start-game-btn').addEventListener('click', startGame);

  // Province config validation
  document.querySelectorAll('input[name="control"], input[name="terrain"]').forEach(input => {
    input.addEventListener('change', validateProvinceConfig);
  });

  // Sentiment slider
  document.getElementById('sentiment-slider').addEventListener('input', (e) => {
    document.getElementById('sentiment-value').textContent = e.target.value;
  });

  // Play phase
  document.getElementById('end-turn-btn').addEventListener('click', endTurn);
  document.getElementById('add-log-btn').addEventListener('click', openAddLogModal);

  // Province details
  document.getElementById('close-details-btn').addEventListener('click', closeProvinceDetails);
  document.getElementById('save-details-btn').addEventListener('click', saveProvinceDetails);
  document.getElementById('cancel-details-btn').addEventListener('click', closeProvinceDetails);

  document.getElementById('detail-sentiment-slider').addEventListener('input', (e) => {
    document.getElementById('detail-sentiment-value').textContent = e.target.value;
  });

  // Force adjustments
  document.getElementById('gov-plus').addEventListener('click', () => openForceAdjustModal('government', 'plus'));
  document.getElementById('gov-minus').addEventListener('click', () => openForceAdjustModal('government', 'minus'));
  document.getElementById('jih-plus').addEventListener('click', () => openForceAdjustModal('jihadist', 'plus'));
  document.getElementById('jih-minus').addEventListener('click', () => openForceAdjustModal('jihadist', 'minus'));
  document.getElementById('confirm-adjust-btn').addEventListener('click', confirmForceAdjust);

  // Game controls
  document.getElementById('export-btn').addEventListener('click', exportGame);
  document.getElementById('import-btn').addEventListener('click', triggerImport);
  document.getElementById('setup-import-input').addEventListener('change', handleImportFile);
  document.getElementById('import-file-input').addEventListener('change', handleImportFile);
  document.getElementById('new-game-btn').addEventListener('click', openNewGameModal);

  // Modal actions
  document.getElementById('create-log-btn').addEventListener('click', createLogEntry);
  document.getElementById('export-reset-btn').addEventListener('click', exportAndReset);
  document.getElementById('reset-btn').addEventListener('click', resetGame);
  document.getElementById('confirm-import-btn').addEventListener('click', confirmImport);

  // Close modal buttons
  document.querySelectorAll('.modal-close-btn').forEach(btn => {
    btn.addEventListener('click', closeModal);
  });

  // Close modal on overlay click
  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'modal-overlay') {
      closeModal();
    }
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
      closeProvinceDetails();
    }
  });
}

// ================================
// Initialization
// ================================

async function init() {
  initEventListeners();
  await renderTemplateCards();
}

// Start the app
document.addEventListener('DOMContentLoaded', init);