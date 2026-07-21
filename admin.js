// ==========================================
// CONFIGURACIÓN (REEMPLAZAR CON TU URL REAL)
// ==========================================
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxI5aDSlO3c6YOTkhRIDW_jlPdicP3CcOhUUkFjUPzwYJpYGfGkVyKageynWMmdlmAUig/exec"; // ¡IMPORTANTE CAMBIAR ESTO!
const TOKEN_SECRETO = "MiCosmeticaSecretaToken2026_XYZ";

// Session management - persistido en localStorage (sobrevive recargas y cierre de navegador)
const SESSION_STORAGE_KEY = "admin_session_token";
const EXPIRY_STORAGE_KEY = "admin_session_expiry";

function getSession() {
  try {
    const token = localStorage.getItem(SESSION_STORAGE_KEY);
    const expiry = parseInt(localStorage.getItem(EXPIRY_STORAGE_KEY)) || 0;
    if (token && Date.now() < expiry) {
      return { token: token, expiresAt: expiry };
    }
    // Session expired or missing - clean up
    localStorage.removeItem(SESSION_STORAGE_KEY);
    localStorage.removeItem(EXPIRY_STORAGE_KEY);
  } catch(e) {}
  return null;
}

function setSession(token, expiresAt) {
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, token);
    localStorage.setItem(EXPIRY_STORAGE_KEY, String(expiresAt));
  } catch(e) { console.error("Error saving session:", e); }
}

function clearSession() {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    localStorage.removeItem(EXPIRY_STORAGE_KEY);
  } catch(e) { console.error("Error clearing session:", e); }
}

let SESSION_TOKEN = null;
let SESSION_EXPIRES = 0;

// SHA-256 hash function for client-side password hashing
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// DOM Elements
const loginScreen = document.getElementById('loginScreen');
const appContainer = document.getElementById('appContainer');
const btnLogin = document.getElementById('btnLogin');
const adminPassword = document.getElementById('adminPassword');
const btnTogglePassword = document.getElementById('btnTogglePassword');
const loginError = document.getElementById('loginError');
const viewTitle = document.getElementById('viewTitle');
const navItems = document.querySelectorAll('.nav-item');
const views = document.querySelectorAll('.view');
const toastEl = document.getElementById('toast');

// Estado
let isAuthenticated = false;
let currentTratamientos = [];

// ==========================================
// TREATMENT DESCRIPTION EDITOR (JSON Builder)
// ==========================================
let descSections = []; // Array of {title, iconType, items: [{text, iconType}]}

function resetDescEditor() {
  document.getElementById('tratDescripcionCorta').value = '';
  document.getElementById('tratDescIntro').value = '';
  descSections = [];
  renderDescSections();
  updatePreview();
}

function addSection(title = '', iconType = 'check') {
  descSections.push({ title: title, iconType: iconType, items: [{text: '', iconType: 'check'}] });
  renderDescSections();
  updatePreview();
}

function removeSection(idx) {
  descSections.splice(idx, 1);
  renderDescSections();
  updatePreview();
}

function updateSectionTitle(idx, val) {
  descSections[idx].title = val;
  updatePreview();
}

function updateSectionIconType(idx, val) {
  descSections[idx].iconType = val;
  updatePreview();
}

function updateItemText(sectionIdx, itemIdx, val) {
  descSections[sectionIdx].items[itemIdx].text = val;
  updatePreview();
}

function updateItemIconType(sectionIdx, itemIdx, val) {
  descSections[sectionIdx].items[itemIdx].iconType = val;
  renderDescSections();
  updatePreview();
}

function addItem(sectionIdx) {
  descSections[sectionIdx].items.push({text: '', iconType: 'check'});
  renderDescSections();
  updatePreview();
  setTimeout(() => {
    const lastInput = document.querySelector('.desc-item-input');
    if (lastInput) {
      const inputs = lastInput.parentElement.parentElement.querySelectorAll('.desc-item-input');
      const lastEl = inputs[inputs.length - 1];
      if (lastEl) lastEl.focus();
    }
  }, 50);
}

function removeItem(sectionIdx, itemIdx) {
  descSections[sectionIdx].items.splice(itemIdx, 1);
  if (descSections[sectionIdx].items.length === 0) {
    descSections[sectionIdx].items.push({text: '', iconType: 'check'});
  }
  renderDescSections();
  updatePreview();
}

function renderDescSections() {
  const container = document.getElementById('descSectionsContainer');
  if (!container) return;

  let html = '';
  descSections.forEach((sec, sIdx) => {
    const secIconMap = { check: '✓', arrow: '▶', dot: '•' };
    const secIcon = secIconMap[sec.iconType] || '✓';

    html += `<div class="desc-section-card" style="background:white;border:1px solid rgba(196,161,109,0.2);border-radius:10px;padding:14px;margin-bottom:12px">`;

    // Section header row
    html += `<div style="display:flex;gap:8px;align-items:center;margin-bottom:10px;flex-wrap:wrap">`;
    html += `<select class="input-style" style="width:auto;padding:6px 10px;font-size:0.8rem" onchange="updateSectionIconType(${sIdx}, this.value)">`;
    html += `<option value="check" ${sec.iconType === 'check' ? 'selected' : ''}>${secIcon} Sección</option>`;
    html += `<option value="arrow" ${sec.iconType === 'arrow' ? 'selected' : ''}>▶ Sección</option>`;
    html += `<option value="dot" ${sec.iconType === 'dot' ? 'selected' : ''}>• Sección</option>`;
    html += `</select>`;
    html += `<input type="text" class="input-style" placeholder="Título de sección (Ej: BENEFICIOS)" value="${escHtml(sec.title)}" style="flex:1;font-weight:600" oninput="updateSectionTitle(${sIdx}, this.value)">`;
    html += `<button type="button" onclick="removeSection(${sIdx})" style="background:none;border:none;color:#e74c3c;cursor:pointer;font-size:1.1rem;padding:4px 8px" title="Eliminar sección"><i class="fa-solid fa-trash"></i></button>`;
    html += `</div>`;

    // Items - each with its own icon selector
    sec.items.forEach((item, iIdx) => {
      const itemIconMap = { check: '✓', arrow: '▶', dot: '•' };
      const itemIcon = itemIconMap[item.iconType] || '✓';

      html += `<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">`;
      // Icon selector for item
      html += `<select class="input-style" style="width:auto;padding:4px 6px;font-size:0.8rem;flex-shrink:0" onchange="updateItemIconType(${sIdx}, ${iIdx}, this.value)">`;
      html += `<option value="check" ${item.iconType === 'check' ? 'selected' : ''}>✓</option>`;
      html += `<option value="arrow" ${item.iconType === 'arrow' ? 'selected' : ''}>▶</option>`;
      html += `<option value="dot" ${item.iconType === 'dot' ? 'selected' : ''}>•</option>`;
      html += `</select>`;
      // Icon preview
      html += `<span style="color:var(--gold);font-size:0.85rem;min-width:16px;flex-shrink:0">${itemIcon}</span>`;
      // Text input
      html += `<input type="text" class="input-style desc-item-input" placeholder="Escribí el item..." value="${escHtml(item.text)}" style="flex:1" oninput="updateItemText(${sIdx}, ${iIdx}, this.value)">`;
      // Remove button
      html += `<button type="button" onclick="removeItem(${sIdx}, ${iIdx})" style="background:none;border:none;color:#e74c3c;cursor:pointer;font-size:0.85rem;padding:2px 6px;flex-shrink:0"><i class="fa-solid fa-times"></i></button>`;
      html += `</div>`;
    });

    // Add item button
    html += `<button type="button" onclick="addItem(${sIdx})" style="background:none;border:1px dashed rgba(196,161,109,0.4);color:var(--gold-dark);padding:6px 12px;border-radius:6px;cursor:pointer;font-size:0.8rem;margin-top:4px;width:100%"><i class="fa-solid fa-plus"></i> Agregar item</button>`;
    html += `</div>`;
  });

  container.innerHTML = html;
}

function updatePreview() {
  const preview = document.getElementById('descPreview');
  if (!preview) return;

  let html = '';
  const intro = document.getElementById('tratDescIntro').value.trim();
  const iconMap = { check: '✓', arrow: '▶', dot: '•' };

  // Intro
  if (intro) {
    html += `<div style="background:rgba(196,161,109,0.08);border-left:3px solid var(--gold);padding:12px 14px;margin-bottom:16px;border-radius:0 8px 8px 0;font-size:0.9rem;color:var(--dark)">${escHtml(intro)}</div>`;
  }

  // Sections
  descSections.forEach(sec => {
    if (!sec.title && sec.items.every(i => !i.text || !i.text.trim())) return;

    let secIcon = iconMap[sec.iconType] || '✓';

    html += `<div style="margin-bottom:16px">`;
    if (sec.title) {
      html += `<h4 style="font-family:'Inter',sans-serif;font-size:0.9rem;font-weight:700;color:var(--dark);margin-bottom:8px;display:flex;align-items:center;gap:6px;text-transform:uppercase;letter-spacing:0.5px"><span style="color:var(--gold)">${secIcon}</span> ${escHtml(sec.title)}</h4>`;
    }
    sec.items.forEach(item => {
      if (item.text && item.text.trim()) {
        let itemIcon = iconMap[item.iconType] || '✓';
        html += `<div style="padding:6px 0 6px 20px;position:relative;color:#6B6B6B;font-size:0.85rem;line-height:1.5;border-bottom:1px solid rgba(196,161,109,0.08)"><span style="position:absolute;left:0;color:var(--gold);font-weight:700">${itemIcon}</span> ${escHtml(item.text)}</div>`;
      }
    });
    html += `</div>`;
  });

  if (!intro && descSections.length === 0) {
    html = '<p style="color:var(--text-light);text-align:center;padding:20px">Agregá una sección para ver la vista previa...</p>';
  }

  preview.innerHTML = html;
}

function getDescJson() {
  const intro = document.getElementById('tratDescIntro').value.trim();
  const result = { intro: intro, sections: [] };

  descSections.forEach(sec => {
    const filteredItems = sec.items.filter(i => i.text && i.text.trim().length > 0);
    if (sec.title || filteredItems.length > 0) {
      result.sections.push({
        title: sec.title,
        iconType: sec.iconType,
        items: filteredItems.length > 0 ? filteredItems.map(i => ({text: i.text.trim(), iconType: i.iconType})) : [{text: '', iconType: sec.iconType}]
      });
    }
  });

  return JSON.stringify(result);
}

function loadDescJson(jsonStr) {
  if (!jsonStr) {
    resetDescEditor();
    return;
  }

  try {
    const data = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
    document.getElementById('tratDescIntro').value = data.intro || '';

    descSections = [];
    if (data.sections && Array.isArray(data.sections)) {
      data.sections.forEach(sec => {
        // Handle both old format (items as strings) and new format (items as objects)
        let items = [];
        if (sec.items && sec.items.length > 0) {
          items = sec.items.map(i => {
            if (typeof i === 'string') {
              return {text: i, iconType: sec.iconType || 'check'};
            }
            return {text: (i.text || '').trim(), iconType: i.iconType || 'check'};
          });
        }

        descSections.push({
          title: sec.title || '',
          iconType: sec.iconType || 'check',
          items: items.length > 0 ? items : [{text: '', iconType: sec.iconType || 'check'}]
        });
      });
    }

    document.getElementById('tratDescripcionCorta').value = ''; // Will be set separately
    renderDescSections();
    updatePreview();
  } catch (e) {
    console.error('Error parsing description JSON:', e);
    resetDescEditor();
  }
}

function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ==========================================
// AUTO-LOGIN: Restaurar sesión al cargar la página
// ==========================================
function autoLogin() {
  const session = getSession();
  if (session) {
    SESSION_TOKEN = session.token;
    SESSION_EXPIRES = session.expiresAt;
    
    // Show app immediately - trust the saved session
    loginScreen.classList.add('hidden');
    appContainer.classList.remove('hidden');
    isAuthenticated = true;
    const filterDateEl = document.getElementById('filterDate');
    if (filterDateEl) filterDateEl.valueAsDate = new Date();
    loadDailyView();
  } else {
    // No session - show login screen (default state)
    if (loginScreen) loginScreen.classList.remove('hidden');
    if (appContainer) appContainer.classList.add('hidden');
  }
}

// ==========================================
// UTILIDADES
// ==========================================
function showToast(msg, isError = false) {
  const t = toastEl || document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.style.background = isError ? "var(--error)" : "var(--text-dark)";
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 3000);
}

async function apiRequest(action, data = {}, isGet = false) {
  try {
    let url = SCRIPT_URL;
    let options = {};

    if (isGet) {
      url += `?action=${action}&token=${TOKEN_SECRETO}`;
      // For login, send password hash as 'password' param
      if (data.password && action === 'adminLogin') {
        url += `&password=${data.password}`;
      }
      // For all other admin actions, include session token
      if (SESSION_TOKEN) url += `&sessionId=${SESSION_TOKEN}`;
      // Include remaining data params in URL (e.g. duracionFilas, fecha, etc.)
      const excludedKeys = ['password', 'sessionId'];
      Object.keys(data).forEach(key => {
        if (!excludedKeys.includes(key)) {
          url += `&${encodeURIComponent(key)}=${encodeURIComponent(data[key])}`;
        }
      });
      options = { method: 'GET' };
    } else {
      const payload = { action, token: TOKEN_SECRETO, ...data };
      // Include session token for all admin actions
      if (SESSION_TOKEN) payload.sessionId = SESSION_TOKEN;
      // Never send password hash in POST requests
      delete payload.password;
      options = {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      };
    }

    const response = await fetch(url, options);
    const result = await response.json();
    if (!result) throw new Error("Respuesta vacía");
    // Handle 401 - session expired or unauthorized
    if (response.status === 401 || (result.success === false && result.error && result.error.includes("Sesión"))) {
      clearSession();
      isAuthenticated = false;
      loginScreen.classList.remove('hidden');
      appContainer.classList.add('hidden');
      throw new Error("Sesión expirada. Por favor inicia sesión nuevamente.");
    }
    if (result.error && !result.success && result.success !== undefined) throw new Error(result.error);
    return result;
  } catch (error) {
    console.error("API Error:", error);
    showToast(error.message || "Error de conexión", true);
    return null;
  }
}

function formatDateToInput(dateStr) {
  if (!dateStr) return "";
  const parts = dateStr.split('/');
  if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
  return dateStr;
}

function formatDateFromInput(dateStr) {
  if (!dateStr) return "";
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
}

// ==========================================
// LOGIN & NAVEGACIÓN
// ==========================================
if (btnTogglePassword) {
  btnTogglePassword.addEventListener('click', () => {
    if (adminPassword.type === 'password') {
      adminPassword.type = 'text';
      btnTogglePassword.innerHTML = '<i class="fa-solid fa-eye-slash"></i>';
    } else {
      adminPassword.type = 'password';
      btnTogglePassword.innerHTML = '<i class="fa-solid fa-eye"></i>';
    }
  });
}

btnLogin.addEventListener('click', async () => {
  const pwd = adminPassword.value;
  if (!pwd) return;

  btnLogin.textContent = "Verificando...";
  btnLogin.disabled = true;
  loginError.textContent = "";

  try {
    // Hash the password client-side BEFORE sending to server
    const passwordHash = await sha256(pwd);
    
    // Send ONLY the hash (not the plain password) via GET
    const res = await apiRequest('adminLogin', { password: passwordHash }, true);
    
    if (res && res.success) {
      // Store session token persistently in localStorage
      SESSION_TOKEN = res.sessionId;
      SESSION_EXPIRES = res.expiresAt || (Date.now() + 2592000000);
      setSession(SESSION_TOKEN, SESSION_EXPIRES);
      isAuthenticated = true;
      loginScreen.classList.add('hidden');
      appContainer.classList.remove('hidden');
      document.getElementById('filterDate').valueAsDate = new Date();
      loadDailyView();
    } else {
      loginError.textContent = res?.error || "Contraseña incorrecta";
    }
  } catch (e) {
    loginError.textContent = "Error de conexión";
    console.error("Login error:", e);
  }

  btnLogin.textContent = "Ingresar";
  btnLogin.disabled = false;
});

document.getElementById('btnLogout').addEventListener('click', () => {
  isAuthenticated = false;
  clearSession();
  adminPassword.value = "";
  appContainer.classList.add('hidden');
  loginScreen.classList.remove('hidden');
});

navItems.forEach(item => {
  item.addEventListener('click', () => {
    navItems.forEach(nav => nav.classList.remove('active'));
    item.classList.add('active');

    views.forEach(v => v.classList.remove('active'));
    const targetId = item.getAttribute('data-target');
    document.getElementById(targetId).classList.add('active');

    viewTitle.textContent = item.querySelector('span').textContent;

      if (targetId === 'viewAgenda') {
        if (listModeActive) loadAgendaList();
        else loadDailyView();
      }
    if (targetId === 'viewTreatments') loadTreatments();
    if (targetId === 'viewBook') prepareBookForm();
    if (targetId === 'viewReviews') loadReviews();
    if (targetId === 'viewInstagramReels') loadInstagramReels();
    if (targetId === 'viewSettings') loadSettings();
  });
});

// ==========================================
// AGENDA - WITH PAGINATION
// ==========================================
const agendaList = document.getElementById('agendaList');
const paginationControls = document.getElementById('paginationControls');
const btnPrevPage = document.getElementById('btnPrevPage');
const btnNextPage = document.getElementById('btnNextPage');
const pageLabel = document.getElementById('pageLabel');
const btnPrevPageNav = document.getElementById('btnPrevPageNav');
const btnNextPageNav = document.getElementById('btnNextPageNav');

// Pagination state
let listModeActive = false;
let listModeMonthOffset = 0; // 0 = current month, 1 = next month, etc.
let allAgendaData = []; // Store all loaded data for current view

document.getElementById('btnLoadAgenda').addEventListener('click', () => {
  loadDailyView();
});
document.getElementById('btnToday').addEventListener('click', () => {
  document.getElementById('filterDate').valueAsDate = new Date();
  document.getElementById('btnToday').classList.add('active-today');
  loadDailyView();
});
document.getElementById('filterDate').addEventListener('change', () => {
  document.getElementById('btnToday').classList.remove('active-today');
  loadDailyView();
});

function flashBtn(btn) {
  if (!btn || btn.disabled) return;
  btn.classList.add('active-state');
  setTimeout(() => btn.classList.remove('active-state'), 200);
}

function handlePrevClick() {
  flashBtn(btnPrevPageNav);
  if (listModeActive) {
    listModeMonthOffset--;
    loadAgendaList();
  } else {
    const filterDateInput = document.getElementById('filterDate');
    const currentVal = filterDateInput?.value;
    if (currentVal) {
      const current = new Date(currentVal + 'T00:00:00');
      current.setDate(current.getDate() - 1);
      filterDateInput.valueAsDate = current;
    }
    document.getElementById('btnToday').classList.remove('active-today');
    loadDailyView();
  }
}

function handleNextClick() {
  flashBtn(btnNextPageNav);
  if (listModeActive) {
    listModeMonthOffset++;
    loadAgendaList();
  } else {
    const filterDateInput = document.getElementById('filterDate');
    const currentVal = filterDateInput?.value;
    if (currentVal) {
      const current = new Date(currentVal + 'T00:00:00');
      current.setDate(current.getDate() + 1);
      filterDateInput.valueAsDate = current;
    }
    document.getElementById('btnToday').classList.remove('active-today');
    loadDailyView();
  }
}

function handleRefreshClick() {
  if (!btnLoadAgenda || btnLoadAgenda.disabled) return;
  btnLoadAgenda.classList.add('active-state');
  dailyViewOffset = 0;
  const filterDateInput = document.getElementById('filterDate');
  filterDateInput.valueAsDate = new Date();
  loadDailyView().finally(() => {
    btnLoadAgenda.classList.remove('active-state');
  });
}

if (btnPrevPage) btnPrevPage.addEventListener('click', handlePrevClick);
if (btnNextPage) btnNextPage.addEventListener('click', handleNextClick);
if (btnPrevPageNav) btnPrevPageNav.addEventListener('click', handlePrevClick);
if (btnNextPageNav) btnNextPageNav.addEventListener('click', handleNextClick);
if (btnLoadAgenda) btnLoadAgenda.addEventListener('click', handleRefreshClick);

function showPagination(hasPrev, hasNext, label) {
  paginationControls.classList.remove('hidden');
  btnPrevPage.disabled = !hasPrev;
  btnNextPage.disabled = !hasNext;
  pageLabel.textContent = label || '';
  btnPrevPageNav.disabled = !hasPrev;
  btnNextPageNav.disabled = !hasNext;
}

function hidePagination() {
  paginationControls.classList.add('hidden');
  btnPrevPageNav.disabled = false;
  btnNextPageNav.disabled = false;
}

// Clean phone for wa.me: Argentina 1133700730 → 5491133700730
function waPhone(raw) {
  if (!raw) return '';
  let n = raw.replace(/[\s\-\(\)\+]/g, '');
  if (n.startsWith('0') && n.length >= 11) n = n.slice(1); // "011..." → "11..."
  if (n.startsWith('54') && n.length >= 12) return n;      // Ya internacional
  if (n.startsWith('11') && n.length === 10) return '549' + n; // Argentino local
  return n;
}

// Get effective price: stored precioTotal > seña + faltante > current treatment price
function getBookingPrice(t) {
  if (Number(t.precioTotal) > 0) return Number(t.precioTotal);
  const seña = Number(t.montoAbonado) || 0;
  const faltante = Number(t.montoFaltante) || 0;
  const suma = seña + faltante;
  if (suma > 0) return suma;
  if (currentTratamientos.length && t.tratamiento) {
    const tr = currentTratamientos.find(x => x.nombre === t.tratamiento);
    if (tr && Number(tr.precio) > 0) return Number(tr.precio);
  }
  return 0;
}

async function loadDailyView() {
  agendaList.innerHTML = '<div class="loading-spinner"><i class="fa-solid fa-circle-notch fa-spin"></i> Cargando agenda...</div>';

  // Ensure treatments are loaded for price fallback
  if (currentTratamientos.length === 0) {
    const trRes = await apiRequest('obtenerTratamientosAdmin');
    if (trRes && trRes.tratamientos) currentTratamientos = trRes.tratamientos;
  }

  // Ensure list mode is off when loading daily view
  if (listModeActive) {
    listModeActive = false;
    const btnLst = document.getElementById('btnListMode');
    if (btnLst) btnLst.classList.remove('active');
    document.getElementById('viewAgenda').classList.remove('list-mode-active');
  }
  
  // Always hide month label in daily view
  const monthLabel = document.getElementById('listMonthLabel');
  if (monthLabel) monthLabel.classList.add('hidden');
  
  hidePagination();
  updateCurrentMonthButton();
  
  // Read the date directly from the input (already updated by navigation handlers)
  const filterDateInput = document.getElementById('filterDate');
  const inputVal = filterDateInput?.value;
  const targetDate = inputVal ? new Date(inputVal + 'T00:00:00') : new Date();
  
  // Update button label for daily view
  const btn = document.getElementById('btnCurrentMonth');
  if (btn) {
    btn.innerHTML = '<i class="fa-solid fa-calendar-day"></i> Hoy';
    btn.title = 'Volver al dÃ­a actual';
  }
  
  const filterDate = formatDateFromInput(formatDateDisplay(targetDate));

  const res = await apiRequest('obtenerAgenda', { fecha: filterDate });
  if (!res || !res.turnos) return;

  const turnos = res.turnos;
  let senaTotal = 0;
  let faltanteTotal = 0;
  let reservasCount = 0;

  agendaList.innerHTML = '';

  if (turnos.length === 0) {
    agendaList.innerHTML = '<p style="text-align:center; color:var(--text-light); margin-top:20px;">No hay turnos para esta fecha.</p>';
    showPagination(true, true, formatDateDisplay(targetDate));
    return;
  }

  // ========== TURNOS RENDERING ==========
  turnos.forEach(t => {
    if (t.estado === "Reservado") {
      senaTotal += Number(t.montoAbonado) || 0;
      faltanteTotal += Number(t.montoFaltante) || 0;
      reservasCount++;
    }

    const div = document.createElement('div');
    div.className = `turn-card status-${t.estado.replace(/\s+/g, '')}`;

    let actions = '';
    if (t.estado === "Reservado" || t.estado === "Reservado Temporal") {
      actions = `
        <button class="btn-small btn-secondary" onclick="liberarTurno('${t.id}')">Liberar</button>
        <button class="btn-small btn-primary" onclick="bloquearTurno('${t.id}')">Bloquear</button>
      `;
    } else if (t.estado === "Disponible" || t.estado === "Vencido Sin Confirmar") {
      actions = `<button class="btn-small btn-primary" onclick="bloquearTurno('${t.id}')">Bloquear</button>`;
    } else if (t.estado === "Bloqueado") {
      actions = `<button class="btn-small btn-secondary" onclick="liberarTurno('${t.id}')">Desbloquear</button>`;
    }

    const origenBadge = t.origenReserva === 'admin'
      ? '<span class="source-badge source-admin"><i class="fa-solid fa-user-gear"></i> Admin</span>'
      : (t.origenReserva === 'admin_bloqueo'
        ? '<span class="source-badge source-admin-lock"><i class="fa-solid fa-lock"></i> Bloq. Admin</span>'
        : '<span class="source-badge source-web"><i class="fa-solid fa-globe"></i> Web</span>');

    const precioFinanzaSection = t.estado === "Reservado" ? `
        <div class="turn-finances-integrated">
          <div class="fin-total-row">
            <span class="lbl">Precio Total</span>
            <span class="val total-price">$${getBookingPrice(t).toLocaleString('es-AR')}</span>
          </div>
          <div class="fin-split-row">
            <div class="fin-item"><span class="lbl">Seña</span><span class="val green">$${Number(t.montoAbonado || 0).toLocaleString('es-AR')}</span></div>
            <div class="fin-item"><span class="lbl">A cobrar</span><span class="val orange">$${Number(t.montoFaltante || 0).toLocaleString('es-AR')}</span></div>
          </div>
        </div>
      ` : '';

    const esBloqueadoPorDuracion = t.estado === "Bloqueado" && t.idBloqueado && t.idBloqueado.toString().trim() !== "";
    const clientSection = t.clienteNombre
      ? `<div class="turn-client-row">
          <span class="turn-client-name">${t.clienteNombre}</span>
          ${t.clienteTelefono ? `<a href="https://wa.me/${waPhone(t.clienteTelefono)}" target="_blank" class="whatsapp-link"><i class="fa-brands fa-whatsapp"></i></a><span style="font-size:0.75rem;color:#999;font-style:italic;margin-left:4px">${t.clienteTelefono}</span>` : ''}
          ${origenBadge}
        </div>`
      : (esBloqueadoPorDuracion
        ? `<div class="turn-client-status" style="color:#e65100;font-weight:600">🔒 Bloqueado por turno ${t.idBloqueado}</div>`
        : `<div class="turn-client-status">Libre</div>`);

    let estadoBadgeClass = '';
    let estadoBadgeText = t.estado;
    if (t.estado === "Reservado") {
      estadoBadgeClass = 'status-reservado';
    } else if (t.estado === "Reservado Temporal") {
      estadoBadgeClass = 'status-reservado-temporal';
    } else if (t.estado === "Disponible") {
      estadoBadgeClass = 'status-disponible';
    } else if (t.estado === "Vencido Sin Confirmar") {
      estadoBadgeClass = 'status-vencido-sin-confirmar';
    } else if (t.estado === "Bloqueado") {
      estadoBadgeClass = 'status-bloqueado';
    }
    const estadoBadge = `<div class="status-badge ${estadoBadgeClass}">${estadoBadgeText}</div>`;

    const displayId = t.id;

    div.innerHTML = `
      <div class="turn-header">
        <div class="turn-time">${t.horaInicio} - ${t.horaFin}</div>
        <span class="turn-id" title="ID del turno">${displayId}</span>
        ${estadoBadge}
      </div>
      ${clientSection}
      <div class="turn-treatment">
        ${t.tratamiento || (esBloqueadoPorDuracion ? 'Bloqueado por duracion del turno ' + t.idBloqueado : 'Sin tratamiento asignado')}
        ${t.duracionTexto ? '<span class="turn-duration">' + t.duracionTexto + '</span>' : ''}
      </div>
      ${precioFinanzaSection}
      ${t.notasCliente && !esBloqueadoPorDuracion ? `<div class="turn-notes"><i class="fa-solid fa-comment-dots"></i> "${t.notasCliente}"</div>` : ''}
      <div class="turn-actions">
        ${actions}
      </div>
    `;
    agendaList.appendChild(div);
  });

  document.getElementById('statReservados').textContent = reservasCount;
  document.getElementById('statFaltante').textContent = '$' + Number(faltanteTotal).toLocaleString('es-AR');
  document.getElementById('statSena').textContent = '$' + Number(senaTotal).toLocaleString('es-AR');

  // Show pagination
  const today = new Date();
  today.setHours(0,0,0,0);
  const targetDisplay = formatDateDisplay(targetDate);
  const isToday = targetDate.toDateString() === today.toDateString();
  const label = isToday ? `📍 Hoy - ${targetDisplay}` : targetDisplay;
  showPagination(true, true, label);
}

window.liberarTurno = async (id) => {
  if (!confirm("¿Seguro que deseas liberar este turno?")) return;
  const res = await apiRequest('liberarTurno', { idTurno: id });
  if (res && res.success) {
    showToast("Turno liberado");
    if (listModeActive) loadAgendaList();
    else loadDailyView();
  }
};

window.bloquearTurno = async (id) => {
  const notas = prompt("Motivo del bloqueo:", "Bloqueado por admin");
  if (notas === null) return;
  const res = await apiRequest('bloquearTurnos', { idsTurnos: [id], notas });
  if (res && res.success) {
    showToast("Turno bloqueado");
    if (listModeActive) loadAgendaList();
    else loadDailyView();
  }
};

// ==========================================
// AGENDA LIST MODE - Multi-day compact view WITH PAGINATION
// ==========================================
const btnListMode = document.getElementById('btnListMode');

if (btnListMode) {
  btnListMode.addEventListener('click', () => {
    if (listModeActive) {
      // Disable list mode
      listModeActive = false;
      listModeMonthOffset = 0;
      btnListMode.classList.remove('active');
      document.getElementById('viewAgenda').classList.remove('list-mode-active');
      document.getElementById('listMonthLabel').classList.add('hidden');
      document.getElementById('btnToday').classList.remove('active-today');
      hidePagination();
      loadDailyView();
    } else {
      // Enable list mode
      listModeActive = true;
      listModeMonthOffset = 0;
      btnListMode.classList.add('active');
      document.getElementById('viewAgenda').classList.add('list-mode-active');
      document.getElementById('listMonthLabel').classList.remove('hidden');
      document.getElementById('btnToday').classList.remove('active-today');
      updateListMonthLabel();
      loadAgendaList();
    }
  });
}

function getBusinessDaysInMonth(year, month) {
  // Get ALL days for a given month (including weekends)
  const days = [];
  let date = new Date(year, month, 1);
  while (date.getMonth() === month) {
    // Create a NEW Date object for each day to avoid reference issues
    days.push(new Date(date.getFullYear(), date.getMonth(), date.getDate()));
    date.setDate(date.getDate() + 1);
  }
  return days;
}

async function loadAgendaList() {
  agendaList.innerHTML = '<div class="loading-spinner"><i class="fa-solid fa-circle-notch fa-spin"></i> Cargando próximos días...</div>';
  hidePagination();
  updateCurrentMonthButton();

  // Ensure treatments are loaded for price fallback
  if (currentTratamientos.length === 0) {
    const trRes = await apiRequest('obtenerTratamientosAdmin');
    if (trRes && trRes.tratamientos) currentTratamientos = trRes.tratamientos;
  }
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Calculate target month based on offset
  let targetMonth = today.getMonth() + listModeMonthOffset;
  let targetYear = today.getFullYear();
  while (targetMonth >= 12) {
    targetMonth -= 12;
    targetYear++;
  }
  while (targetMonth < 0) {
    targetMonth += 12;
    targetYear--;
  }
  
  // Get all business days for the target month
  const allBusinessDays = getBusinessDaysInMonth(targetYear, targetMonth);
  
  // If offset is 0, only include today and future days (no past days of current month)
  let filteredDays = allBusinessDays;
  if (listModeMonthOffset === 0) {
    filteredDays = allBusinessDays.filter(d => d >= today);
  }
  
  // Load data for these days in parallel
  const allDaysData = [];
  const dateRequests = [];
  
  filteredDays.forEach(dayDate => {
    const fechaStr = formatDateDisplay(dayDate);
    const fechaInput = formatDateFromInput(fechaStr);
    
    dateRequests.push(async () => {
      try {
        const res = await apiRequest('obtenerAgenda', { fecha: fechaInput });
        if (res && res.turnos && res.turnos.length > 0) {
          return { date: fechaStr, dateObj: dayDate, turnos: res.turnos };
        }
      } catch(e) {}
      return null;
    });
  });
  
  // Execute all requests in parallel for speed
  const results = await Promise.allSettled(dateRequests.map(fn => fn()));
  results.forEach(r => {
    if (r.status === 'fulfilled' && r.value) {
      allDaysData.push(r.value);
    }
  });
  
  // Sort by date
  allDaysData.sort((a, b) => a.dateObj - b.dateObj);
  
  if (allDaysData.length === 0) {
    agendaList.innerHTML = `
      <div class="list-empty-state">
        <i class="fa-regular fa-calendar-xmark"></i>
        <p>No hay turnos en los próximos días.</p>
      </div>`;
    return;
  }
  
  // Calculate summary stats
  let totalReservados = 0, totalDisponibles = 0, totalBloqueados = 0;
  allDaysData.forEach(d => {
    d.turnos.forEach(t => {
      if (t.estado === 'Reservado') totalReservados++;
      else if (t.estado === 'Disponible' || t.estado === 'Vencido Sin Confirmar') totalDisponibles++;
      else if (t.estado === 'Bloqueado') totalBloqueados++;
    });
  });
  
  // Render list view
  let html = '';
  
  // Summary bar
  html += '<div class="list-summary-bar">';
  if (totalReservados > 0) {
    html += `<div class="list-summary-item"><span class="list-summary-dot reservado"></span><span class="list-summary-text">Reservados <span class="list-summary-count">${totalReservados}</span></span></div>`;
  }
  if (totalDisponibles > 0) {
    html += `<div class="list-summary-item"><span class="list-summary-dot disponible"></span><span class="list-summary-text">Disponibles <span class="list-summary-count">${totalDisponibles}</span></span></div>`;
  }
  if (totalBloqueados > 0) {
    html += `<div class="list-summary-item"><span class="list-summary-dot bloqueado"></span><span class="list-summary-text">Bloqueados <span class="list-summary-count">${totalBloqueados}</span></span></div>`;
  }
  html += '</div>';
  
  // Day groups
  allDaysData.forEach((dayInfo, dayIdx) => {
    const diaNombre = getDiaSemana(dayInfo.dateObj);
    const esHoy = dayInfo.dateObj.toDateString() === today.toDateString();
    const fechaKey = dayInfo.date;
    
    // Sort turnos by time
    const sortedTurnos = [...dayInfo.turnos].sort((a, b) => (a.horaInicio || '').localeCompare(b.horaInicio || ''));
    
    html += `<div class="list-day-group" data-day="${fechaKey}">`;
    
    // Day header
    html += `<div class="list-day-header" onclick="toggleDayGroup('${fechaKey}')">`;
    html += `<span class="list-day-date">${esHoy ? '📍 Hoy' : dayInfo.date}</span>`;
    html += `<span class="list-day-name">${diaNombre}</span>`;
    html += `<span class="list-day-count">${sortedTurnos.length} turno${sortedTurnos.length !== 1 ? 's' : ''}</span>`;
    html += `<i class="fa-solid fa-chevron-down list-day-toggle"></i>`;
    html += `</div>`;
    
    // Turn rows (collapsible)
    html += `<div class="list-day-body" data-day="${fechaKey}">`;
    
    sortedTurnos.forEach(t => {
      const estadoClass = t.estado.toLowerCase().replace(/\s+/g, '-');
      const clienteDisplay = t.clienteNombre || (t.estado === 'Disponible' ? 'Libre' : 'Sin confirmar');
      const clienteClass = t.clienteNombre && t.estado === 'Disponible' ? '' : (t.clienteNombre ? '' : 'is-free');
      
      html += `<div class="list-turn-row" data-turn-id="${t.id}" onclick="toggleTurnDetails('${t.id}')">`;
      html += `<span class="list-turn-time">${t.horaInicio || '--:--'} - ${t.horaFin || '--:--'}</span>`;
      html += `<span class="list-turn-client ${clienteClass}">${clienteDisplay}</span>`;
      html += `<span class="list-turn-status status-${estadoClass}">${t.estado}</span>`;
      html += `<i class="fa-solid fa-chevron-down list-turn-expand"></i>`;
      html += `</div>`;
      
      // Expanded details (hidden by default)
      html += `<div class="list-turn-details" id="details-${t.id}">`;
      html += `<div class="list-turn-details-inner">`;
      
      // Treatment info
      const esBloqueadoPorDuracion = t.estado === "Bloqueado" && t.idBloqueado && t.idBloqueado.toString().trim() !== "";
      if (esBloqueadoPorDuracion) {
        html += `<p style="color:#e65100;font-weight:600;margin-bottom:8px">🔒 Bloqueado por turno ${t.idBloqueado}</p>`;
      } else {
        html += `<p style="margin-bottom:4px;color:var(--text-light);font-size:0.85rem"><i class="fa-solid fa-spa"></i> ${t.tratamiento || 'Sin tratamiento'}</p>`;
      }
      
      // Client info if available
      if (t.clienteNombre) {
        html += `<p style="margin-bottom:4px;font-size:0.85rem;color:var(--text-dark)">👤 ${t.clienteNombre}</p>`;
      }
      
      // Notes
      if (t.notasCliente && !esBloqueadoPorDuracion) {
        html += `<p style="margin-bottom:8px;font-size:0.82rem;color:var(--text-light);font-style:italic"><i class="fa-solid fa-comment-dots"></i> "${t.notasCliente}"</p>`;
      }
      
      // Finances for reserved turns
      if (t.estado === "Reservado") {
        html += `<div class="turn-finances-integrated">`;
        html += `<div class="fin-total-row"><span class="lbl">Precio Total</span><span class="val total-price">$${getBookingPrice(t).toLocaleString('es-AR')}</span></div>`;
        html += `<div class="fin-split-row"><div class="fin-item"><span class="lbl">Seña</span><span class="val green">$${Number(t.montoAbonado || 0).toLocaleString('es-AR')}</span></div><div class="fin-item"><span class="lbl">A cobrar</span><span class="val orange">$${Number(t.montoFaltante || 0).toLocaleString('es-AR')}</span></div></div>`;
        html += `</div>`;
      }
      
      // Actions
      let actions = '';
      if (t.estado === "Reservado" || t.estado === "Reservado Temporal") {
        actions = `<button class="btn-small btn-secondary" onclick="event.stopPropagation();liberarTurno('${t.id}')">Liberar</button><button class="btn-small btn-primary" onclick="event.stopPropagation();bloquearTurno('${t.id}')">Bloquear</button>`;
      } else if (t.estado === "Disponible" || t.estado === "Vencido Sin Confirmar") {
        actions = `<button class="btn-small btn-primary" onclick="event.stopPropagation();bloquearTurno('${t.id}')">Bloquear</button>`;
      } else if (t.estado === "Bloqueado") {
        actions = `<button class="btn-small btn-secondary" onclick="event.stopPropagation();liberarTurno('${t.id}')">Desbloquear</button>`;
      }
      
      if (actions) {
        html += `<div class="turn-actions" style="margin-top:12px">${actions}</div>`;
      }
      
      html += `</div></div>`; // details-inner, details
    });
    
    html += `</div></div>`; // day-body, day-group
  });
  
  agendaList.innerHTML = html;
  
  // Update month label in filters
  updateListMonthLabel();
  
  // Show pagination with month label
  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const monthLabel = `${months[targetMonth]} ${targetYear}`;
  
  // Can go back only if offset > 0
  const canGoBack = listModeMonthOffset > 0;
  // Always allow going forward
  const canGoForward = true;
  
  showPagination(canGoBack, canGoForward, monthLabel);
}

// Current month button (calendar icon)
if (document.getElementById('btnCurrentMonth')) {
  document.getElementById('btnCurrentMonth').addEventListener('click', () => {
    if (listModeActive) {
      listModeMonthOffset = 0;
      loadAgendaList();
    } else {
      // Daily view - go back to today
      document.getElementById('filterDate').valueAsDate = new Date();
      loadDailyView();
    }
  });
}

function updateListMonthLabel() {
  const labelEl = document.getElementById('listMonthLabel');
  if (!labelEl) return;
  
  const today = new Date();
  let targetMonth = today.getMonth() + listModeMonthOffset;
  let targetYear = today.getFullYear();
  while (targetMonth >= 12) {
    targetMonth -= 12;
    targetYear++;
  }
  while (targetMonth < 0) {
    targetMonth += 12;
    targetYear--;
  }
  
  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  labelEl.textContent = months[targetMonth] + ' ' + targetYear;
}

// Helper to update the "current" button label based on mode
function updateCurrentMonthButton() {
  const btn = document.getElementById('btnCurrentMonth');
  if (!btn) return;
  
  if (listModeActive) {
    btn.title = 'Volver al mes actual';
    btn.innerHTML = '<i class="fa-solid fa-calendar-day"></i> Mes Actual';
  } else {
    btn.title = 'Volver al día actual';
    btn.innerHTML = '<i class="fa-solid fa-calendar-day"></i> Hoy';
  }
}

function toggleDayGroup(dayKey) {
  const group = document.querySelector(`.list-day-group[data-day="${dayKey}"]`);
  if (!group) return;
  
  group.classList.toggle('collapsed');
  const body = group.querySelector('.list-day-body');
  if (body) {
    if (group.classList.contains('collapsed')) {
      body.style.maxHeight = '0';
      body.style.overflow = 'hidden';
    } else {
      body.style.maxHeight = body.scrollHeight + 'px';
      body.style.overflow = 'visible';
    }
  }
}

function toggleTurnDetails(turnId) {
  const details = document.getElementById('details-' + turnId);
  const row = details?.closest('.list-turn-row');
  
  if (details) {
    // Close all other open details first
    document.querySelectorAll('.list-turn-details.open').forEach(d => {
      if (d.id !== 'details-' + turnId) {
        d.classList.remove('open');
        d.style.maxHeight = '0';
        d.closest('.list-turn-row')?.classList.remove('expanded');
      }
    });
    
    details.classList.toggle('open');
    row?.classList.toggle('expanded');
    
    if (details.classList.contains('open')) {
      details.style.maxHeight = details.scrollHeight + 'px';
    } else {
      details.style.maxHeight = '0';
    }
  }
}

// ==========================================
// TRATAMIENTOS
// ==========================================
const treatmentsList = document.getElementById('treatmentsList');
const modalTreatment = document.getElementById('modalTreatment');

document.getElementById('btnNewTreatment').addEventListener('click', () => {
  document.getElementById('tratId').value = "";
  document.getElementById('tratNombre').value = "";
  document.getElementById('tratPrecio').value = "";
  document.getElementById('tratDuracionFilas').value = "1";
  document.getElementById('tratDuracionTexto').value = "";
  resetDescEditor();
  document.getElementById('tratImagen').value = "";
  populateCategorySelect(currentTratamientos);
  document.getElementById('tratCategoria').value = "General";
  document.getElementById('tratReservaWs').checked = false;
  document.getElementById('tratMsjWs').value = "";
  document.getElementById('tratColorPicker').value = "#C4A16D";
  document.getElementById('tratColorBorde').value = "";
  document.getElementById('modalTreatmentTitle').textContent = "Nuevo Tratamiento";
  modalTreatment.classList.remove('hidden');
});

document.getElementById('btnCancelTrat').addEventListener('click', () => {
  modalTreatment.classList.add('hidden');
});

document.getElementById('btnCloseTreatmentModal').addEventListener('click', () => {
  modalTreatment.classList.add('hidden');
});

modalTreatment.addEventListener('click', (e) => {
  if (e.target === modalTreatment) {
    modalTreatment.classList.add('hidden');
  }
});

// Add section button
document.getElementById('btnAddSection').addEventListener('click', () => {
  addSection('', 'check');
});

// Auto-update preview when intro text changes
document.addEventListener('DOMContentLoaded', () => {
  const introEl = document.getElementById('tratDescIntro');
  if (introEl) {
    introEl.addEventListener('input', updatePreview);
  }

  // Sync color picker <-> hex input
  const colorPicker = document.getElementById('tratColorPicker');
  const colorHex = document.getElementById('tratColorBorde');
  if (colorPicker && colorHex) {
    colorPicker.addEventListener('input', () => { colorHex.value = colorPicker.value; });
    colorHex.addEventListener('input', () => {
      if (/^#[0-9a-fA-F]{6}$/.test(colorHex.value)) { colorPicker.value = colorHex.value; }
    });
  }
});

document.getElementById('btnSaveTrat').addEventListener('click', async () => {
  const id = document.getElementById('tratId').value;
  const nombre = document.getElementById('tratNombre').value;
  const precio = document.getElementById('tratPrecio').value;
  const duracionFilas = document.getElementById('tratDuracionFilas').value;
  const duracionTexto = document.getElementById('tratDuracionTexto').value;
  const descripcionCorta = document.getElementById('tratDescripcionCorta').value.trim();
  const descripcionLarga = getDescJson();
  const imagen = document.getElementById('tratImagen').value;
  const categoria = document.getElementById('tratCategoria').value;
  const reservaWs = document.getElementById('tratReservaWs').checked;
  const msjWs = document.getElementById('tratMsjWs').value.trim();
  const colorBorde = document.getElementById('tratColorBorde').value.trim() || document.getElementById('tratColorPicker').value;

  if (!nombre || !precio) {
    showToast("Nombre y precio obligatorios", true);
    return;
  }

  const payload = { nombre, precio, duracionFilas, duracionTexto, descripcionCorta, descripcionLarga, imagen, linkSena: "", categoria, reservaWs, msjWs, colorBorde };
  let res;

  document.getElementById('btnSaveTrat').textContent = "Guardando...";
  document.getElementById('btnSaveTrat').disabled = true;

  if (id) {
    res = await apiRequest('actualizarTratamiento', { id, ...payload });
  } else {
    res = await apiRequest('agregarTratamiento', payload);
  }

  document.getElementById('btnSaveTrat').textContent = "Guardar";
  document.getElementById('btnSaveTrat').disabled = false;

  if (res && res.success) {
    showToast("Tratamiento guardado");
    modalTreatment.classList.add('hidden');
    loadTreatments();
  }
});

async function loadTreatments() {
  treatmentsList.innerHTML = '<div class="loading-spinner"><i class="fa-solid fa-circle-notch fa-spin"></i> Cargando tratamientos...</div>';
  console.log('Cargando tratamientos...');
  const res = await apiRequest('obtenerTratamientosAdmin');
  console.log('Response tratamientos:', res);
  if (!res || !res.tratamientos) {
    if (res && res.error) {
      treatmentsList.innerHTML = '<p style="text-align:center;padding:40px;color:var(--error)">Error: ' + res.error + '</p>';
    } else {
      treatmentsList.innerHTML = '<p style="text-align:center;padding:40px;color:var(--text-light)">No se pudieron cargar los tratamientos</p>';
    }
    return;
  }

  currentTratamientos = res.tratamientos;
  treatmentsList.innerHTML = '';

  currentTratamientos.forEach(t => {
    const div = document.createElement('div');
    div.className = 'treat-card';
    let imgSrc = t.imagen || '';
    if (imgSrc.includes('drive.google.com/file/d/')) {
        const match = imgSrc.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
        if (match && match[1]) imgSrc = "https://drive.google.com/uc?id=" + match[1];
    }
    const bgImg = imgSrc ? `url('${imgSrc}')` : 'none';
    const catClass = t.categoria ? t.categoria.toLowerCase().replace(/\s+/g, '-') : 'general';
    const isWsOnly = (t.reservaWs === true || t.reservaWs === "SI");
    const displayColor = t.colorBorde || '#C4A16D';

    div.innerHTML = `
      <div class="treat-img" style="background-image: ${bgImg}; border-bottom: 3px solid ${displayColor}"></div>
      <div class="treat-info">
        <div class="treat-name">${t.nombre}</div>
        <span class="treat-category cat-${catClass}" style="border-left: 3px solid ${displayColor}; padding-left: 6px">${t.categoria || 'General'}</span>
        ${isWsOnly ? '<span class="ws-badge" title="Reserva solo por WhatsApp"><i class="fa-brands fa-whatsapp"></i> Solo WhatsApp</span>' : ''}
        <div class="treat-price">$${t.precio}</div>
        <div class="treat-treat" style="color:var(--text-light); font-size:0.85rem; margin-bottom:15px;">Duración: ${t.duracionTexto}</div>
        <div class="treat-actions">
          <button class="btn-small btn-secondary w-100" onclick="editTreatment('${t.id}')"><i class="fa-solid fa-pen"></i> Editar</button>
          <button class="btn-small btn-primary w-100" onclick="deleteTreatment('${t.id}')" style="background:var(--error);"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
    `;
    treatmentsList.appendChild(div);
  });
  
  // Populate category select from loaded treatments
  populateCategorySelect(currentTratamientos);
}

window.editTreatment = async (id) => {
  const t = currentTratamientos.find(x => x.id === id);
  if (!t) return;

  populateCategorySelect(currentTratamientos);
  document.getElementById('tratId').value = t.id;
  document.getElementById('tratNombre').value = t.nombre;
  document.getElementById('tratPrecio').value = t.precio;
  document.getElementById('tratDuracionFilas').value = t.duracionFilas;
  document.getElementById('tratDuracionTexto').value = t.duracionTexto;

  // Load description JSON first (it clears descripcionCorta internally)
  let descData = t.descripcionLarga || t.descripcion || "";
  loadDescJson(descData);

  // Then set descripcionCorta - priority: col J > JSON intro > plain text
  let cortaVal = "";
  if (t.descripcionCorta) {
    cortaVal = t.descripcionCorta;
  } else if (typeof t.descripcionLarga === 'string') {
    try {
      const parsed = JSON.parse(t.descripcionLarga);
      if (parsed && parsed.intro) cortaVal = parsed.intro.trim();
    } catch(e) {}
  }
  document.getElementById('tratDescripcionCorta').value = cortaVal;
  document.getElementById('tratImagen').value = t.imagen || "";
  document.getElementById('tratCategoria').value = t.categoria || "General";
  document.getElementById('tratReservaWs').checked = (t.reservaWs === true || t.reservaWs === "SI");
  document.getElementById('tratMsjWs').value = t.msjWs || "";
  const colorVal = t.colorBorde || "#C4A16D";
  if (/^#[0-9a-fA-F]{6}$/.test(colorVal)) {
    document.getElementById('tratColorPicker').value = colorVal;
    document.getElementById('tratColorBorde').value = colorVal;
  } else {
    document.getElementById('tratColorPicker').value = "#C4A16D";
    document.getElementById('tratColorBorde').value = colorVal;
  }
  document.getElementById('modalTreatmentTitle').textContent = "Editar Tratamiento";
  modalTreatment.classList.remove('hidden');
};

window.deleteTreatment = async (id) => {
  if (!confirm("¿Seguro que deseas eliminar este tratamiento?")) return;
  const res = await apiRequest('eliminarTratamiento', { id });
  if (res && res.success) {
    showToast("Tratamiento eliminado");
    loadTreatments();
  }
};

// ==========================================
// DAR TURNO (MANUAL)
// ==========================================
async function prepareBookForm() {
  // Cargar tratamientos en el select
  if (currentTratamientos.length === 0) {
    const res = await apiRequest('obtenerTratamientosAdmin');
    if (res && res.tratamientos) currentTratamientos = res.tratamientos;
  }

  const selectT = document.getElementById('bookTratamiento');
  selectT.innerHTML = '<option value="">Selecciona un tratamiento...</option>';
  
  // Filter out WhatsApp-only treatments (same as user-app)
  const tratamientosDisponibles = currentTratamientos.filter(t => t.reservaWs !== 'SI');
  
  tratamientosDisponibles.forEach(t => {
    const duracionLabel = t.duracionFilas > 1 ? ` (${t.duracionFilas * 2}h)` : ' (2h)';
    const p = Number(t.precio) || 0;
    selectT.innerHTML += `<option value="${t.id}" data-precio="${p}" data-filas="${t.duracionFilas}">${t.nombre} - $${p}${duracionLabel}</option>`;
  });

  // Function to update button states based on treatment selection
  function updateBookButtonsState() {
    const allBtn = document.getElementById('bookViewAllBtn');
    const calBtn = document.getElementById('bookViewCalendarBtn');
    const hasTreatment = selectT && selectT.value;
    
    if (hasTreatment) {
      allBtn.style.opacity = '1';
      allBtn.style.pointerEvents = 'auto';
      allBtn.style.cursor = 'pointer';
      calBtn.style.opacity = '1';
      calBtn.style.pointerEvents = 'auto';
      calBtn.style.cursor = 'pointer';
    } else {
      allBtn.style.opacity = '0.4';
      allBtn.style.pointerEvents = 'none';
      allBtn.style.cursor = 'not-allowed';
      calBtn.style.opacity = '0.4';
      calBtn.style.pointerEvents = 'none';
      calBtn.style.cursor = 'not-allowed';
    }
  }

  // Load slots when treatment changes (like user-app triggers on select change)
  selectT.removeEventListener('change', window._bookTreatmentChangeHandler);
  window._bookTreatmentChangeHandler = async () => {
    document.getElementById('bookSelectedSlotId').value = '';
    document.getElementById('bookSelectedFecha').value = '';
    document.getElementById('bookSelectedHorario').value = '';
    updateBookButtonsState();
    await loadAvailableSlots();
  };
  selectT.addEventListener('change', window._bookTreatmentChangeHandler);

  // Initialize button states
  updateBookButtonsState();

  // Auto-load slots if a treatment is already selected
  if (selectT.value) {
    await loadAvailableSlots();
  }
  
  // Initialize view mode
  setBookViewMode('all', true);
}

// ========== DAR TURNO - Visual Slot Picker (like user-app) ==========

/**
 * Parse a time string from sheet format (e.g. "T09:00" or "9:00") into HH:MM
 */
function parseSheetTime(timeStr) {
  if (!timeStr) return '';
  const match = timeStr.match(/T(\d{2}):(\d{2})/);
  if (match) return match[1] + ':' + match[2];
  // Already in HH:MM format or similar
  return timeStr.toString().trim();
}

/**
 * Parse a display date string DD/MM/YYYY into Date object
 */
function parseDisplayDate(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
  }
  return null;
}

/**
 * Format a Date object to DD/MM/YYYY display format
 */
function formatDateDisplay(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Get the day name in Spanish for a Date object
 */
function getDiaSemana(date) {
  const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  return dias[date.getDay()];
}

/**
 * Load and render available slots visually grouped by date (like user-app)
 */
async function loadAvailableSlots() {
  const grid = document.getElementById('bookSlotsGrid');
  const loader = document.getElementById('bookSlotsLoader');
  const noSlots = document.getElementById('bookNoSlotsMsg');
  const notice = document.getElementById('bookDurationNotice');

  // Get treatment info
  const selectT = document.getElementById('bookTratamiento');
  const opt = selectT.options[selectT.selectedIndex];
  const duracionFilas = parseInt(opt?.dataset?.filas || 1);
  const tratamientoNombre = opt?.text?.split(' - ')[0] || '';

  if (!tratamientoNombre) {
    grid.style.display = 'none';
    noSlots.style.display = 'none';
    notice.style.display = 'none';
    return;
  }

  // Show duration notice for multi-row treatments
  const duracionTexto = opt?.text?.match(/\((\d+h)\)/)?.[1] || `${duracionFilas * 2} horas`;
  if (duracionFilas > 1) {
    notice.innerHTML = `📝 Este tratamiento dura <strong>${duracionTexto}</strong> seguidas. Solo se muestran horarios que tengan ese tiempo libre sin saltar entre días.`;
    notice.style.display = 'block';
  } else {
    notice.style.display = 'none';
  }

  loader.style.display = 'block';
  grid.style.display = 'none';
  noSlots.style.display = 'none';

  try {
    const res = await apiRequest('obtenerTurnos', { duracionFilas: duracionFilas }, true);
    loader.style.display = 'none';

    if (!res || !res.turnos || res.turnos.length === 0) {
      noSlots.style.display = 'block';
      noSlots.textContent = duracionFilas > 1
        ? `No hay horarios con espacio suficiente de <strong>${duracionTexto}</strong> seguidas en el mismo día. Llamanos para consultar.`
        : 'No hay turnos disponibles. Llamanos.';
      return;
    }

    // Parse slots and group by date
    const byDate = {};
    res.turnos.forEach(s => {
      s._horaInicioParsed = parseSheetTime(s.horaInicio);
      s._horaFinParsed = parseSheetTime(s.horaFin);
      const fechaKey = s.fecha || '';
      if (fechaKey && !byDate[fechaKey]) byDate[fechaKey] = [];
      if (fechaKey) byDate[fechaKey].push(s);
    });

    // Sort dates chronologically (DD/MM/YYYY format)
    const sortedDates = Object.keys(byDate).sort((a, b) => {
      const partsA = a.split('/');
      const partsB = b.split('/');
      const dateA = partsA[2] + '-' + partsA[1] + '-' + partsA[0];
      const dateB = partsB[2] + '-' + partsB[1] + '-' + partsB[0];
      return dateA < dateB ? -1 : (dateA > dateB ? 1 : 0);
    });

    if (sortedDates.length === 0) {
      noSlots.style.display = 'block';
      noSlots.textContent = 'No hay turnos disponibles para los próximos días.';
      return;
    }

    // Filter: only show dates within MAX_MESES_RESERVA (3 months default)
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const limiteMeses = new Date(hoy.getFullYear(), hoy.getMonth() + 3, hoy.getDate());
    limiteMeses.setHours(23, 59, 59, 999);

    // Filter today: exclude past hours
    const ahoraActual = new Date();
    const horaActualStr = String(ahoraActual.getHours()).padStart(2, '0') + ':' + String(ahoraActual.getMinutes()).padStart(2, '0');

    let filteredDates = [];
    sortedDates.forEach(fechaStr => {
      const fechaObj = parseDisplayDate(fechaStr);
      if (!fechaObj) return;
      if (fechaObj < hoy || fechaObj > limiteMeses) return;

      // For today, filter out past time slots
      const esHoy = fechaStr === formatDateDisplay(hoy);
      let slotsDelDia = byDate[fechaStr];
      if (esHoy) {
        slotsDelDia = slotsDelDia.filter(s => s._horaInicioParsed >= horaActualStr);
      }

      if (slotsDelDia.length > 0) {
        filteredDates.push({ fecha: fechaStr, slots: slotsDelDia });
      }
    });

    // Store available dates for calendar view
    window._bookAvailableDates = filteredDates.map(d => d.fecha);
    
    // Store full slots data with parsed times for calendar view
    window._bookAvailableDatesSlots = filteredDates.map(d => ({
      fecha: d.fecha,
      slots: d.slots
    }));

    if (filteredDates.length === 0) {
      noSlots.style.display = 'block';
      noSlots.textContent = 'No hay turnos disponibles dentro del rango de <strong>3 meses</strong>. Llamanos para consultar.';
      return;
    }

    // Build HTML - accordion style like user-app
    let html = '';
    filteredDates.forEach(dayInfo => {
      const fechaObj = parseDisplayDate(dayInfo.fecha);
      const diaNombre = fechaObj ? getDiaSemana(fechaObj) : '';
      const displayDate = diaNombre ? `${dayInfo.fecha} - ${diaNombre}` : dayInfo.fecha;
      const cantidadTurnos = dayInfo.slots.length;

      // Sort slots by time
      dayInfo.slots.sort((a, b) => (a._horaInicioParsed || '').localeCompare(b._horaInicioParsed || ''));

      html += `<div class="date-accordion-header" data-date="${dayInfo.fecha}" style="padding:10px 14px;border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;background:rgba(0,0,0,0.12);border:1px solid rgba(255,255,255,0.12);margin-bottom:2px;transition:all 0.3s;grid-column:1/-1">`;
      html += `<span style="color:rgba(255,215,0,0.9);font-size:0.78rem;font-weight:600">${displayDate}</span>`;
      html += `<span style="color:rgba(255,215,0,0.7);font-size:0.72rem">${cantidadTurnos} turno${cantidadTurnos > 1 ? 's' : ''} <span class="accordion-arrow" style="display:inline-block;transition:transform 0.3s;margin-left:4px">▼</span></span>`;
      html += `</div>`;
      html += `<div class="date-accordion-content" data-date="${dayInfo.fecha}" style="display:none;padding-top:4px;grid-column:1/-1">`;

      dayInfo.slots.forEach(slot => {
        const horaInicio = slot._horaInicioParsed || '';
        const horaFin = slot._horaFinParsed || '';
        html += `<button type="button" class="slot-btn book-slot-btn" data-id="${slot.id}" data-fecha="${dayInfo.fecha}" data-hora="${horaInicio}">${horaInicio} - ${horaFin}</button>`;
      });

      html += `</div>`;
    });

    grid.innerHTML = html;
    grid.style.display = 'grid';
    
    // Save accordion HTML for calendar mode restoration
    bookAccordionHTML = html;

    // Accordion: click en fecha para expandir/colapsar turnos
    grid.querySelectorAll('.date-accordion-header').forEach(header => {
      header.addEventListener('click', function () {
        const dateKey = this.dataset.date;
        const content = grid.querySelector(`.date-accordion-content[data-date="${dateKey}"]`);
        const arrow = this.querySelector('.accordion-arrow');

        // Cerrar todos los demás
        grid.querySelectorAll('.date-accordion-header').forEach(h => {
          if (h !== header) {
            const otherDate = h.dataset.date;
            const otherContent = grid.querySelector(`.date-accordion-content[data-date="${otherDate}"]`);
            const otherArrow = h.querySelector('.accordion-arrow');
            if (otherContent) otherContent.style.display = 'none';
            if (otherArrow) otherArrow.style.transform = '';
            h.style.background = 'rgba(0,0,0,0.12)';
          }
        });

        // Toggle actual
        if (content) {
          const isOpen = content.style.display === 'block';
          content.style.display = isOpen ? 'none' : 'block';
          if (arrow) arrow.style.transform = isOpen ? '' : 'rotate(180deg)';
          this.style.background = !isOpen ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)';
        }
      });
    });

    // Abrir el primer día por defecto
    const firstHeader = grid.querySelector('.date-accordion-header');
    if (firstHeader) {
      firstHeader.click();
    }

    // Attach click handlers to slot buttons
    grid.querySelectorAll('.book-slot-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        grid.querySelectorAll('.book-slot-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        document.getElementById('bookSelectedSlotId').value = this.dataset.id;
        document.getElementById('bookSelectedFecha').value = this.dataset.fecha;
        document.getElementById('bookSelectedHorario').value = this.dataset.hora;
      });
    });

  } catch (err) {
    console.error('Error cargando horarios:', err);
    loader.style.display = 'none';
    noSlots.style.display = 'block';
    noSlots.textContent = 'Error al cargar horarios. Intenta de nuevo.';
  }
}

// ========== DAR TURNO - View Mode Toggle (like user-app) ==========
let bookViewMode = 'all';
let bookAccordionHTML = ''; // Store accordion HTML for calendar mode

function setBookViewMode(mode, skipReload) {
  // Block view switching until a treatment is selected (like user-app blocks until slotsLoaded)
  const selectT = document.getElementById('bookTratamiento');
  if (!selectT || !selectT.value) {
    return;
  }
  
  bookViewMode = mode;
  const allBtn = document.getElementById('bookViewAllBtn');
  const calBtn = document.getElementById('bookViewCalendarBtn');
  const miniCal = document.getElementById('bookMiniCalendar');
  const wrapper = document.getElementById('bookSlotsWrapper');
  const grid = document.getElementById('bookSlotsGrid');
  const noSlots = document.getElementById('bookNoSlotsMsg');
  const loader = document.getElementById('bookSlotsLoader');

  if (mode === 'all') {
    // Active state for "Ver todos"
    allBtn.style.background = 'rgba(45,139,139,0.2)';
    allBtn.style.borderColor = 'rgba(45,139,139,0.6)';
    allBtn.style.color = '#2D8B8B';
    allBtn.style.boxShadow = '0 2px 8px rgba(45,139,139,0.2)';
    // Inactive state for "Calendario"
    calBtn.style.background = 'rgba(45,139,139,0.08)';
    calBtn.style.borderColor = 'rgba(45,139,139,0.25)';
    calBtn.style.color = 'rgba(45,139,139,0.6)';
    
    if (miniCal) miniCal.style.display = 'none';
    if (wrapper) wrapper.style.display = 'block';
    if (grid) {
      // Restore saved accordion HTML
      if (bookAccordionHTML) {
        grid.innerHTML = bookAccordionHTML;
        // Close all accordion contents
        const contents = grid.querySelectorAll('.date-accordion-content');
        const arrows = grid.querySelectorAll('.accordion-arrow');
        const headers = grid.querySelectorAll('.date-accordion-header');
        contents.forEach(c => c.style.display = 'none');
        arrows.forEach(a => a.style.transform = '');
        headers.forEach(h => h.style.background = 'rgba(0,0,0,0.12)');
        // Re-attach accordion handlers
        grid.querySelectorAll('.date-accordion-header').forEach(header => {
          header.addEventListener('click', function () {
            const dateKey = this.dataset.date;
            const content = grid.querySelector(`.date-accordion-content[data-date="${dateKey}"]`);
            const arrow = this.querySelector('.accordion-arrow');
            grid.querySelectorAll('.date-accordion-header').forEach(h => {
              if (h !== header) {
                const otherDate = h.dataset.date;
                const otherContent = grid.querySelector(`.date-accordion-content[data-date="${otherDate}"]`);
                const otherArrow = h.querySelector('.accordion-arrow');
                if (otherContent) otherContent.style.display = 'none';
                if (otherArrow) otherArrow.style.transform = '';
                h.style.background = 'rgba(0,0,0,0.12)';
              }
            });
            if (content) {
              const isOpen = content.style.display === 'block';
              content.style.display = isOpen ? 'none' : 'block';
              if (arrow) arrow.style.transform = isOpen ? '' : 'rotate(180deg)';
              this.style.background = !isOpen ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)';
            }
          });
        });
        // Re-attach slot button click handlers
        grid.querySelectorAll('.book-slot-btn').forEach(btn => {
          btn.addEventListener('click', function () {
            grid.querySelectorAll('.book-slot-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            document.getElementById('bookSelectedSlotId').value = this.dataset.id;
            document.getElementById('bookSelectedFecha').value = this.dataset.fecha;
            document.getElementById('bookSelectedHorario').value = this.dataset.hora;
          });
        });
        grid.style.display = '';
        return; // Already restored, no need to reload
      }
      grid.style.display = '';
    }
    
    if (!skipReload && document.getElementById('bookTratamiento').value) {
      loadAvailableSlots();
    }
  } else if (mode === 'calendar') {
    // Inactive state for "Ver todos" (like user-app)
    allBtn.style.background = 'rgba(45,139,139,0.08)';
    allBtn.style.borderColor = 'rgba(45,139,139,0.25)';
    allBtn.style.color = 'rgba(45,139,139,0.6)';
    allBtn.style.boxShadow = 'none';
    // Active state for "Calendario"
    calBtn.style.background = 'rgba(45,139,139,0.2)';
    calBtn.style.borderColor = 'rgba(45,139,139,0.6)';
    calBtn.style.color = '#2D8B8B';
    calBtn.style.boxShadow = '0 2px 8px rgba(45,139,139,0.2)';
    
    if (miniCal) miniCal.style.display = 'block';
    if (wrapper) wrapper.style.display = 'block'; // show wrapper for calendar
    if (grid) {
      // Save accordion HTML before clearing
      bookAccordionHTML = grid.innerHTML;
      grid.style.display = 'none';
      grid.innerHTML = ''; // Clear grid - show nothing until a day is clicked
    }
    if (noSlots) noSlots.style.display = 'none';
    if (loader) loader.style.display = 'none';
    
    renderBookCalendar();
  }
}

// ========== DAR TURNO - Mini Calendar (exact copy from user-app booking.js) ==========
let bookCalendarDate = new Date();
let bookCalendarSelectedDate = null;

function renderBookCalendar() {
  var calDays = document.getElementById('bookCalendarDays');
  var monthYear = document.getElementById('bookCalendarMonthYear');
  
  if (!calDays || !monthYear) return;

  var year = bookCalendarDate.getFullYear();
  var month = bookCalendarDate.getMonth();
  
  var mesNombres = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  var diaNombres = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sa"];
  
  monthYear.textContent = mesNombres[month] + " " + year;
  
  // Construir mapa de días con turnos disponibles (misma lógica que filterSlotsByDate)
  var allSlots = window._bookAvailableDatesSlots || [];
  var diasConTurnos = {};
  var hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  var ahoraActual = new Date();
  var horaActualStr = String(ahoraActual.getHours()).padStart(2, "0") + ":" + String(ahoraActual.getMinutes()).padStart(2, "0");
  
  allSlots.forEach(function(t) {
    if (t.fecha) {
      var partes = t.fecha.split('/');
      if (partes.length === 3) {
        var fechaSlot = new Date(parseInt(partes[2]), parseInt(partes[1]) - 1, parseInt(partes[0]));
        if (fechaSlot.getFullYear() === year && fechaSlot.getMonth() === month) {
          var dia = fechaSlot.getDate();
          // Verificar que no sea pasado y que hoy no tenga horarios ya pasados
          var esPasada = fechaSlot < hoy;
          var tieneTurnosDisponibles = false;
          
          if (!esPasada) {
            if (fechaSlot.getTime() === hoy.getTime()) {
              // Hoy: solo contar slots con hora >= ahora
              var slotHora = t.slots[0] && t.slots[0]._horaInicioParsed || "";
              if (slotHora >= horaActualStr) {
                tieneTurnosDisponibles = true;
              }
            } else {
              tieneTurnosDisponibles = true;
            }
          }
          
          if (tieneTurnosDisponibles) {
            if (!diasConTurnos[dia]) diasConTurnos[dia] = [];
            diasConTurnos[dia].push(t);
          }
        }
      }
    }
  });
  
  // Días de la semana (header)
  var daysHtml = diaNombres.map(function(d) {
    return '<div style="color:rgba(255,255,255,0.4);font-size:0.7rem;padding:4px 0">' + d + '</div>';
  }).join('');
  
  // Días del mes
  var primerDia = new Date(year, month, 1).getDay();
  var diasEnMes = new Date(year, month + 1, 0).getDate();
  
  for (var i = 0; i < primerDia; i++) {
    daysHtml += '<div></div>';
  }
  
  for (var d = 1; d <= diasEnMes; d++) {
    var fecha = new Date(year, month, d);
    var esHoy = fecha.getTime() === hoy.getTime();
    var esPasada = fecha < hoy;
    var tieneTurnos = !!diasConTurnos[d];
    var isSelected = bookCalendarSelectedDate && bookCalendarSelectedDate.getDate() === d && bookCalendarSelectedDate.getMonth() === month && bookCalendarSelectedDate.getFullYear() === year;
    
    var cursorStyle = 'not-allowed';
    var opacityStyle = '';
    
    if (esPasada || !tieneTurnos) {
      cursorStyle = 'not-allowed';
      opacityStyle = 'opacity:0.4;';
    } else {
      cursorStyle = 'pointer';
    }
    
    var classes = 'style="padding:6px 4px;border-radius:8px;font-size:0.75rem;cursor:' + cursorStyle + ';' + opacityStyle;
    if (isSelected) {
      classes += 'background:rgba(196,161,109,0.4);border:1px solid rgba(196,161,109,0.6);color:white;';
    } else if (esHoy && tieneTurnos) {
      classes += 'border:1px solid rgba(255,215,0,0.6);color:#FFD700;font-weight:600;';
    } else if (tieneTurnos) {
      classes += 'border:1px solid transparent;color:white;';
    }
    classes += '"';
    
    classes += ' data-cal-day="' + d + '" data-cal-month="' + month + '" data-cal-year="' + year + '"';
    
    daysHtml += '<div ' + classes + '>' + d + '</div>';
  }
  
  calDays.innerHTML = daysHtml;
  
  calDays.onclick = function(e) {
    var target = e.target.closest('[data-cal-day]');
    if (!target || target.style.cursor === 'not-allowed') return;
    var day = parseInt(target.dataset.calDay);
    var m = parseInt(target.dataset.calMonth);
    var y = parseInt(target.dataset.calYear);
    if (day && !isNaN(y)) {
      selectBookCalendarDate(y, m, day);
    }
  };
}

function changeBookCalendarMonth(dir) {
  bookCalendarDate.setMonth(bookCalendarDate.getMonth() + dir);
  bookCalendarSelectedDate = null;
  renderBookCalendar();
}

function selectBookCalendarDate(year, month, day) {
  bookCalendarSelectedDate = new Date(year, month, day);
  renderBookCalendar();
  filterBookSlotsByDate(bookCalendarSelectedDate);
}

// Filter slots by selected date (exact copy from user-app filterSlotsByDate)
function filterBookSlotsByDate(fechaSeleccionada) {
  var grid = document.getElementById('bookSlotsGrid');
  if (!grid) return;
  
  if (!window._bookAvailableDatesSlots || window._bookAvailableDatesSlots.length === 0) {
    grid.innerHTML = '<div style="text-align:center;padding:30px;color:rgba(255,255,255,0.5);font-size:0.85rem">Seleccioná un tratamiento primero para ver los turnos</div>';
    return;
  }
  
  var fechaStr = String(fechaSeleccionada.getDate()).padStart(2, '0') + '/' + String(fechaSeleccionada.getMonth() + 1).padStart(2, '0');
  var diaSemana = fechaSeleccionada.toLocaleDateString('es-AR', { weekday: 'long' });
  diaSemana = diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1);
  
  // Filtrar por fecha seleccionada (misma lógica que user-app)
  var slotsDelDia = [];
  window._bookAvailableDatesSlots.forEach(function(t) {
    if (t.fecha) {
      var normalizedFecha = t.fecha || '';
      if (normalizedFecha && normalizedFecha.indexOf(fechaStr + '/') === 0) {
        slotsDelDia = slotsDelDia.concat(t.slots || []);
      }
    }
  });
  
  // Si es hoy, filtrar horarios pasados (misma lógica que "Ver todos")
  if (slotsDelDia.length > 0) {
    var hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    var fechaSelDate = new Date(fechaSeleccionada.getFullYear(), fechaSeleccionada.getMonth(), fechaSeleccionada.getDate());
    
    if (fechaSelDate.getTime() === hoy.getTime()) {
      var horaActualStr = String(hoy.getHours()).padStart(2, "0") + ":" + String(hoy.getMinutes()).padStart(2, "0");
      slotsDelDia = slotsDelDia.filter(function(s) {
        return s._horaInicioParsed >= horaActualStr;
      });
    }
  }
  
  if (slotsDelDia.length === 0) {
    grid.innerHTML = '<div style="text-align:center;padding:30px;color:rgba(255,255,255,0.5);font-size:0.85rem">No hay turnos disponibles para esta fecha</div>';
    grid.style.display = "grid";
    return;
  }
  
  grid.style.display = "grid";
  
  slotsDelDia.sort(function(a, b) {
    var timeA = a._horaInicioParsed || "";
    var timeB = b._horaInicioParsed || "";
    return timeA < timeB ? -1 : (timeA > timeB ? 1 : 0);
  });
  
  var html = '<div class="slot-date-label" style="display:flex;align-items:center;justify-content:space-between;color:rgba(255,215,0,0.9)">' + String(fechaSeleccionada.getDate()).padStart(2, '0') + '/' + String(fechaSeleccionada.getMonth() + 1).padStart(2, '0') + ' - ' + diaSemana + ' <span style="color:rgba(255,215,0,0.7);font-size:0.7rem;font-weight:400">' + slotsDelDia.length + ' turnos</span></div>';
  
  slotsDelDia.forEach(function(slot) {
    var horaInicioDisplay = slot._horaInicioParsed || "";
    var horaFinDisplay = slot._horaFinParsed || "";
    html += '<button type="button" class="slot-btn" data-id="' + slot.id + '" data-fecha="' + slot.fecha + '" data-hora="' + horaInicioDisplay + '">' + horaInicioDisplay + " - " + horaFinDisplay + '</button>';
  });
  
  grid.innerHTML = html;
  
  // Scroll suave hacia los turnos
  setTimeout(function() {
    grid.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 200);
  
  // Agregar event listeners
  grid.querySelectorAll(".slot-btn").forEach(function(btn) {
    btn.addEventListener("click", function() {
      grid.querySelectorAll(".slot-btn").forEach(function(b) { b.classList.remove("selected"); });
      btn.classList.add("selected");
      document.getElementById("bookSelectedSlotId").value = btn.dataset.id;
      document.getElementById("bookSelectedFecha").value = btn.dataset.fecha;
      document.getElementById("bookSelectedHorario").value = btn.dataset.hora;
    });
  });
}

document.getElementById('btnConfirmBook').addEventListener('click', async () => {
  const selectT = document.getElementById('bookTratamiento');
  const opt = selectT.options[selectT.selectedIndex];

  const payload = {
    idTurno: document.getElementById('bookSelectedSlotId').value,
    tratamiento: opt ? opt.text.split(' - ')[0] : "",
    duracionFilas: opt ? opt.dataset.filas : 1,
    precioTotal: Number(opt ? opt.dataset.precio : 0) || 0,
    nombre: document.getElementById('bookNombre').value,
    telefono: document.getElementById('bookTelefono').value,
    email: document.getElementById('bookEmail').value.trim().toLowerCase(),
    notasCliente: document.getElementById('bookNotas').value || "Agendado por Admin",
    estadoSena: document.getElementById('bookEstadoSena').value,
    montoAbonado: document.getElementById('bookMontoAbonado').value || 0
  };

  if (!payload.idTurno || !payload.tratamiento || !payload.nombre) {
    showToast("Por favor completa tratamiento, horario y nombre del cliente.", true);
    return;
  }

  document.getElementById('btnConfirmBook').textContent = "Agendando...";
  document.getElementById('btnConfirmBook').disabled = true;

  const res = await apiRequest('reservarManual', payload);

  document.getElementById('btnConfirmBook').textContent = "Agendar Turno";
  document.getElementById('btnConfirmBook').disabled = false;

  if (res && res.success) {
    // Save info for modal BEFORE resetting
    const fechaSel = document.getElementById('bookSelectedFecha').value;
    const horaSel = document.getElementById('bookSelectedHorario').value;

    // Reset form fields
    document.getElementById('bookNombre').value = "";
    document.getElementById('bookEmail').value = "";
    document.getElementById('bookTelefono').value = "";
    document.getElementById('bookMontoAbonado').value = "";
    document.getElementById('bookNotas').value = "";
    document.getElementById('bookSelectedSlotId').value = '';
    document.getElementById('bookSelectedFecha').value = '';
    document.getElementById('bookSelectedHorario').value = '';
    document.getElementById('bookTratamiento').selectedIndex = 0;

    // Reset slots grid
    const grid = document.getElementById('bookSlotsGrid');
    if (grid) grid.innerHTML = '';
    const notice = document.getElementById('bookDurationNotice');
    if (notice) notice.style.display = 'none';

    // Show success modal
    document.getElementById('bookingSuccessMsg').textContent =
      `${payload.nombre} - ${payload.tratamiento}\nel ${fechaSel} a las ${horaSel}`;
    document.getElementById('modalBookingSuccess').classList.remove('hidden');
  }
});

// ==========================================
// MODAL ÉXITO AGENDAR TURNO
// ==========================================
function resetBookingForm() {
  document.getElementById('modalBookingSuccess').classList.add('hidden');
  // Reset everything and reload slots
  bookAccordionHTML = '';
  bookCalendarSelectedDate = null;
  bookViewMode = 'all';
  setBookViewMode('all', true);
  loadAvailableSlots();
}

document.getElementById('btnNewBooking').addEventListener('click', resetBookingForm);
document.getElementById('btnCloseBookingModal').addEventListener('click', resetBookingForm);
document.getElementById('modalBookingSuccess').addEventListener('click', (e) => {
  if (e.target.id === 'modalBookingSuccess') {
    resetBookingForm();
  }
});

// ==========================================
// AJUSTES
// ==========================================
async function loadSettings() {
  const sf = document.getElementById('settingsForm');
  sf.innerHTML = '<div class="loading-spinner"><i class="fa-solid fa-circle-notch fa-spin"></i> Cargando...</div>';

  const res = await apiRequest('obtenerConfiguracionAdmin');
  if (!res || !res.config) return;

  sf.innerHTML = '<h3>Configuraciones del Sistema</h3><p class="helper-text">Modifica las variables operativas.</p>';

  // Definir campos que deben ser select SI/NO en lugar de input normal
  const booleanFields = ['Exigir_Sena_Todos', 'Activar_Recordatorio_Dia_Anterior'];
  // Campos especiales (email, numero, etc.) se manejan abajo por nombre

  const configKeys = Object.keys(res.config);
  configKeys.forEach(k => {
    const val = res.config[k];
    let inputHtml;

    if (booleanFields.includes(k)) {
      // Campos SI/NO con dropdown
      inputHtml = `
        <select class="input-style config-input" data-key="${k}">
          <option value="SI" ${val === 'SI' ? 'selected' : ''}>SI</option>
          <option value="NO" ${val !== 'SI' ? 'selected' : ''}>NO</option>
        </select>`;
    } else if (k === 'Hora_Envio_Recordatorio') {
      // Hora de envio en formato 24h (0-23)
      inputHtml = `
        <input type="number" min="0" max="23" class="input-style config-input" data-key="${k}" value="${val || 19}">`;
    } else {
      // Input de texto por defecto (numeros, porcentajes, etc.)
      inputHtml = `
        <input type="text" class="input-style config-input" data-key="${k}" value="${val}">`;
    }

    sf.innerHTML += `
      <div class="form-group">
        <label>${k.replace(/_/g, ' ')}</label>
        ${inputHtml}
      </div>
    `;
  });

  sf.innerHTML += `<button id="btnSaveConfig" class="btn-primary w-100 mt-20">Guardar Cambios</button>`;

  document.getElementById('btnSaveConfig').addEventListener('click', async () => {
    const inputs = document.querySelectorAll('.config-input');
    const updates = {};
    inputs.forEach(i => updates[i.dataset.key] = i.value);

    document.getElementById('btnSaveConfig').textContent = "Guardando...";
    const r = await apiRequest('actualizarConfiguracion', { updates });
    if (r && r.success) {
      showToast("Configuración guardada");
      document.getElementById('btnSaveConfig').textContent = "Guardar Cambios";
    }
  });
}

// ==========================================
// POPULATE CATEGORY SELECT from treatments data
// ==========================================
function populateCategorySelect(tratamientos) {
  const select = document.getElementById('tratCategoria');
  if (!select) return;
  
  // Extract unique categories from treatments + defaults, sorted with capitalization
  const catSet = new Set(['General', 'Facial', 'Corporal', 'Especial']);
  
  if (tratamientos && tratamientos.length > 0) {
    tratamientos.forEach(t => {
      if (t.categoria) catSet.add(t.categoria.trim());
    });
  }
  
  const currentValue = select.value;
  select.innerHTML = '';
  
  // Sort: capitalize first letter, then alphabetical
  const sortedCats = Array.from(catSet).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  
  sortedCats.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    select.appendChild(opt);
  });
  
  // Keep current value if valid
  if (currentValue && catSet.has(currentValue)) {
    select.value = currentValue;
  } else {
    select.value = 'General';
  }
}

// Botón "+" para agregar categoría nueva inline - Modal integrado
document.addEventListener('DOMContentLoaded', () => {
  const modalNewCategory = document.getElementById('modalNewCategory');
  const btnNewCatInline = document.getElementById('btnNewCatInline');
  const btnCancelNewCat = document.getElementById('btnCancelNewCat');
  const btnSaveNewCat = document.getElementById('btnSaveNewCat');
  const newCatInput = document.getElementById('newCatInput');
  const newCatSuggestions = document.getElementById('newCatSuggestions');

  if (btnNewCatInline) {
  btnNewCatInline.addEventListener('click', () => {
    // Populate suggestions from existing categories
    newCatSuggestions.innerHTML = '';
    const select = document.getElementById('tratCategoria');
    if (!select) return;
    
    const allCats = [];
    for (let i = 0; i < select.options.length; i++) {
      allCats.push(select.options[i].value);
    }
    
    // Show existing categories as clickable chips
    allCats.forEach(cat => {
      if (!cat) return;
      const chip = document.createElement('span');
      chip.textContent = cat;
      chip.style.cssText = 'padding:4px 12px;background:rgba(196,161,109,0.15);border:1px solid rgba(196,161,109,0.3);border-radius:16px;font-size:0.8rem;cursor:pointer;color:var(--primary-dark)';
      chip.addEventListener('click', () => {
        select.value = cat;
        modalNewCategory.classList.add('hidden');
      });
      newCatSuggestions.appendChild(chip);
    });
    
    modalNewCategory.classList.remove('hidden');
    newCatInput.value = '';
    newCatInput.focus();
  });
}

if (btnCancelNewCat) {
  btnCancelNewCat.addEventListener('click', () => {
    modalNewCategory.classList.add('hidden');
  });
}

if (btnSaveNewCat) {
  btnSaveNewCat.addEventListener('click', () => {
    const catName = newCatInput.value.trim();
    if (!catName) {
      showToast('Escribí un nombre para la categoría', true);
      return;
    }
    
    const select = document.getElementById('tratCategoria');
    if (!select) return;
    
    // Check if already exists in select
    let found = false;
    for (let i = 0; i < select.options.length; i++) {
      if (select.options[i].value.toLowerCase() === catName.toLowerCase()) {
        found = true;
        break;
      }
    }
    
    if (!found) {
      // Add new option to the select
      const opt = document.createElement('option');
      opt.value = catName;
      opt.textContent = catName;
      select.appendChild(opt);
      
      // Set select to the new category
      select.value = catName;
      
      // Add to currentTratamientos so populateCategorySelect picks it up next time
      if (!currentTratamientos) currentTratamientos = [];
      const existingCats = new Set(currentTratamientos.map(t => t.categoria));
      if (!existingCats.has(catName)) {
        // Just store the category name for reference
        currentTratamientos.push({ categoria: catName });
      }
      
      showToast('Categoría "' + catName + '" creada');
    } else {
      select.value = catName;
    }
    
    modalNewCategory.classList.add('hidden');
  });
}

 // Enter key saves the new category
  if (newCatInput) {
    newCatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        btnSaveNewCat.click();
      }
      if (e.key === 'Escape') {
        modalNewCategory.classList.add('hidden');
      }
    });
  }
});
// ====================================================
// RESEÑAS - CRUD COMPLETO
// ====================================================
let allReviews = [];

async function loadReviews() {
  const reviewsList = document.getElementById('reviewsList');
  if (!reviewsList) return;
  
  reviewsList.innerHTML = '<div class="loading-spinner"><i class="fa-solid fa-circle-notch fa-spin"></i> Cargando reseñas...</div>';
  
  try {
    console.log('Cargando reseñas desde API...');
    
    const res = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'obtenerResenasAdmin', token: TOKEN_SECRETO })
    });
    console.log('Response status:', res.status);
    
    const data = await res.json();
    console.log('Response data:', JSON.stringify(data).substring(0, 500));
    
    if (data.success && data.resenas) {
      console.log('Reseñas cargadas:', data.resenas.length);
      
      allReviews = data.resenas.map((r) => {
        return { ...r };
      });
      
      // Default sort by date (most recent first)
      allReviews.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
      
      renderReviewsList(allReviews);
      updateReviewStats(allReviews);
    } else {
      console.error('Error loading reviews:', data);
      reviewsList.innerHTML = '<p style="text-align:center;padding:40px;color:var(--error)">Error al cargar reseñas</p>';
    }
  } catch (err) {
    console.error('Error loading reviews:', err);
    reviewsList.innerHTML = '<p style="text-align:center;padding:40px;color:var(--error)">Error de conexión</p>';
  }
}

function renderReviewsList(reviews) {
  const reviewsList = document.getElementById('reviewsList');
  
  if (!reviews || reviews.length === 0) {
    reviewsList.innerHTML = '<p style="text-align:center;padding:40px;color:var(--text-light)">No hay reseñas registradas</p>';
    return;
  }
  
  let html = '';
  reviews.forEach((review, index) => {
    const stars = '★'.repeat(review.calificacion) + '☆'.repeat(5 - review.calificacion);
    const visibleBadge = review.visible === 'SI' 
      ? '<span style="background:#4CAF50;color:white;padding:2px 8px;border-radius:10px;font-size:0.7rem">Visible</span>'
      : '<span style="background:#999;color:white;padding:2px 8px;border-radius:10px;font-size:0.7rem">Oculta</span>';
    
    html += `
      <div class="review-card" data-index="${index}" onclick="openReviewModal('${review.id}')">
        <div class="review-card-header">
          <div class="review-avatar">${review.nombre ? review.nombre.charAt(0).toUpperCase() : '?'}</div>
          <div style="flex:1">
            <strong>${review.nombre || 'Sin nombre'}</strong>
            ${visibleBadge}
          </div>
          <span style="color:#F59E0B;font-size:1.1rem">${stars}</span>
        </div>
        <p class="review-text-preview">"${(review.comentario || '').substring(0, 100)}${review.comentario && review.comentario.length > 100 ? '...' : ''}"</p>
        <div class="review-card-footer" style="display:flex;justify-content:space-between;align-items:center;padding-top:8px;border-top:1px solid rgba(196,161,109,0.1);margin-top:8px">
          <span style="font-size:0.75rem;color:var(--text-light)">${review.servicio || 'General'} · ${review.fecha ? new Date(review.fecha).toLocaleDateString('es-AR', {day:'2-digit',month:'short',year:'numeric'}) : ''}</span>
          <div style="display:flex;gap:4px">
            <button onclick="event.stopPropagation();editReview(${index})" class="btn-icon-sm" title="Editar"><i class="fa-solid fa-pen"></i></button>
            <button onclick="event.stopPropagation();toggleReviewVisibility('${review.id}')" class="btn-icon-sm" title="${review.visible === 'SI' ? 'Ocultar' : 'Mostrar'}">
              <i class="fa-solid ${review.visible === 'SI' ? 'fa-eye-slash' : 'fa-eye'}"></i>
            </button>
          </div>
        </div>
      </div>`;
  });
  
  reviewsList.innerHTML = html;
}

function updateReviewStats(reviews) {
  const totalEl = document.getElementById('statTotalReviews');
  const visibleEl = document.getElementById('statVisibleReviews');
  const hiddenEl = document.getElementById('statHiddenReviews');
  
  if (totalEl) totalEl.textContent = reviews.length;
  if (visibleEl) visibleEl.textContent = reviews.filter(r => r.visible === 'SI').length;
  if (hiddenEl) hiddenEl.textContent = reviews.filter(r => r.visible !== 'SI').length;
}

function openReviewModal(reviewId) {
  const modal = document.getElementById('modalReview');
  if (!modal) return;
  
  modal.classList.remove('hidden');
  document.getElementById('modalReviewTitle').textContent = 'Nueva Reseña';
  document.getElementById('btnDeleteReview').style.display = 'none';
  document.getElementById('reviewId').value = reviewId || '';
}

function editReview(index) {
  const review = allReviews[index];
  if (!review) return;
  
  const modal = document.getElementById('modalReview');
  if (!modal) return;
  
  modal.classList.remove('hidden');
  document.getElementById('modalReviewTitle').textContent = 'Editar Reseña';
  document.getElementById('btnDeleteReview').style.display = 'inline-block';
  
  // Fill form
  document.getElementById('reviewNombre').value = review.nombre || '';
  document.getElementById('reviewCalificacion').value = review.calificacion || 5;
  document.getElementById('reviewComentario').value = review.comentario || '';
  document.getElementById('reviewServicio').value = review.servicio || '';
  document.getElementById('reviewFecha').value = review.fecha ? review.fecha.split('T')[0] : '';
  document.getElementById('reviewRespuesta').value = review.respuesta || '';
  document.getElementById('reviewVisible').checked = (review.visible === 'SI');
  
  // Store id for save
  document.getElementById('reviewId').value = review.id;
}

async function saveReview() {
  const nombre = document.getElementById('reviewNombre').value.trim();
  const calificacion = document.getElementById('reviewCalificacion').value;
  const comentario = document.getElementById('reviewComentario').value.trim();
  const servicio = document.getElementById('reviewServicio').value.trim();
  const fecha = document.getElementById('reviewFecha').value;
  const respuesta = document.getElementById('reviewRespuesta').value.trim();
  const visible = document.getElementById('reviewVisible').checked ? 'SI' : 'NO';
  
  if (!nombre || !comentario) {
    showToast('Nombre y comentario son obligatorios', 'error');
    return;
  }
  
  const reviewId = document.getElementById('reviewId').value;
  const isEdit = reviewId && reviewId !== '';
  
  const data = {
    nombre,
    calificacion: parseInt(calificacion),
    comentario,
    servicio: servicio || 'General',
    fecha: fecha || new Date().toISOString().split('T')[0],
    respuesta,
    visible
  };
  
  if (isEdit) {
    data.id = reviewId;
  }
  
  try {
    const body = JSON.stringify({ action: isEdit ? 'actualizarResena' : 'agregarResena', token: TOKEN_SECRETO, ...data });
    console.log('Saving review:', body);
    
    const res = await fetch(SCRIPT_URL, { method: 'POST', body });
    const result = await res.json();
    console.log('Save result:', result);
    
    if (result.success) {
      showToast('Reseña guardada correctamente', 'success');
      document.getElementById('modalReview').classList.add('hidden');
      loadReviews();
    } else {
      showToast('Error: ' + (result.error || 'No se pudo guardar'), 'error');
    }
  } catch (err) {
    console.error('Save error:', err);
    showToast('Error de conexión', 'error');
  }
}

async function deleteReview() {
  const reviewId = document.getElementById('reviewId').value;
  if (!reviewId || !confirm('¿Estás segura de eliminar esta reseña?')) return;
  
  try {
    const body = JSON.stringify({ action: 'eliminarResena', token: TOKEN_SECRETO, id: reviewId });
    const res = await fetch(SCRIPT_URL, { method: 'POST', body });
    const result = await res.json();
    
    if (result.success) {
      showToast('Reseña eliminada', 'success');
      document.getElementById('modalReview').classList.add('hidden');
      loadReviews();
    } else {
      showToast('Error: ' + (result.error || 'No se pudo eliminar'), 'error');
    }
  } catch (err) {
    showToast('Error de conexión', 'error');
  }
}

async function toggleReviewVisibility(reviewId) {
  const review = allReviews.find(r => r.id === reviewId);
  if (!review) return;
  
  const newVisible = review.visible === 'SI' ? 'NO' : 'SI';
  
  try {
    const body = JSON.stringify({ action: 'actualizarResena', token: TOKEN_SECRETO, id: reviewId, visible: newVisible });
    const res = await fetch(SCRIPT_URL, { method: 'POST', body });
    const result = await res.json();
    
    if (result.success) {
      loadReviews();
    } else {
      showToast('Error al actualizar', 'error');
    }
  } catch (err) {
    showToast('Error de conexión', 'error');
  }
}

// Review modal event listeners
const btnNewReview = document.getElementById('btnNewReview');
if (btnNewReview) {
  btnNewReview.addEventListener('click', () => {
    const modal = document.getElementById('modalReview');
    if (modal) {
      modal.classList.remove('hidden');
      document.getElementById('modalReviewTitle').textContent = 'Nueva Reseña';
      document.getElementById('btnDeleteReview').style.display = 'none';
      // Clear form
      document.getElementById('reviewNombre').value = '';
      document.getElementById('reviewCalificacion').value = '5';
      document.getElementById('reviewComentario').value = '';
      document.getElementById('reviewServicio').value = '';
      document.getElementById('reviewFecha').value = new Date().toISOString().split('T')[0];
      document.getElementById('reviewRespuesta').value = '';
      document.getElementById('reviewVisible').checked = true;
      document.getElementById('reviewId').value = '';
    }
  });
}

const btnSaveReview = document.getElementById('btnSaveReview');
if (btnSaveReview) btnSaveReview.addEventListener('click', saveReview);

const btnCancelReview = document.getElementById('btnCancelReview');
if (btnCancelReview) btnCancelReview.addEventListener('click', () => {
  document.getElementById('modalReview').classList.add('hidden');
});

const btnDeleteReview = document.getElementById('btnDeleteReview');
if (btnDeleteReview) btnDeleteReview.addEventListener('click', deleteReview);

// Review search & filter
const searchReview = document.getElementById('searchReview');
const filterVisible = document.getElementById('filterVisible');
if (searchReview && filterVisible) {
  function applyReviewFilters() {
    const query = searchReview.value.toLowerCase();
    const visibleFilter = filterVisible.value;
    
    let filtered = allReviews.filter(r => {
      const matchSearch = !query || 
        (r.nombre || '').toLowerCase().includes(query) ||
        (r.servicio || '').toLowerCase().includes(query);
      const matchVisible = visibleFilter === 'all' || r.visible === visibleFilter;
      return matchSearch && matchVisible;
    });
    
    renderReviewsList(filtered);
  }
  
  searchReview.addEventListener('input', applyReviewFilters);
  filterVisible.addEventListener('change', applyReviewFilters);
}

// Sort by date toggle
const btnSortDate = document.getElementById('btnSortDate');
let sortAsc = false;
if (btnSortDate) {
  btnSortDate.addEventListener('click', () => {
    sortAsc = !sortAsc;
    allReviews.sort((a, b) => sortAsc 
      ? new Date(a.fecha) - new Date(b.fecha) 
      : new Date(b.fecha) - new Date(a.fecha)
    );
    const query = document.getElementById('searchReview')?.value?.toLowerCase() || '';
    const visibleFilter = document.getElementById('filterVisible')?.value || 'all';
    
    let filtered = allReviews.filter(r => {
      const matchSearch = !query || 
        (r.nombre || '').toLowerCase().includes(query) ||
        (r.servicio || '').toLowerCase().includes(query);
      const matchVisible = visibleFilter === 'all' || r.visible === visibleFilter;
      return matchSearch && matchVisible;
    });
    
    renderReviewsList(filtered);
    btnSortDate.innerHTML = sortAsc 
      ? '<i class="fa-solid fa-arrow-down-wide-short"></i> Más antiguas' 
      : '<i class="fa-solid fa-clock-rotate-left"></i> Más recientes';
  });
}

// Review keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const modalReview = document.getElementById('modalReview');
    if (modalReview && !modalReview.classList.contains('hidden')) {
      modalReview.classList.add('hidden');
    }
  }
});

// ==========================================
// INSTAGRAM REELS - CRUD COMPLETO
// ==========================================
let allReels = [];

async function loadInstagramReels() {
  const reelsList = document.getElementById('reelsList');
  if (!reelsList) return;
  
  reelsList.innerHTML = '<div class="loading-spinner"><i class="fa-solid fa-circle-notch fa-spin"></i> Cargando reels...</div>';
  
  try {
    const res = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'obtenerReelsAdmin', token: TOKEN_SECRETO })
    });
    
    const data = await res.json();
    
    if (data.success && data.reels) {
      allReels = data.reels.map((r) => ({ ...r }));
      allReels.sort((a, b) => a.orden - b.orden);
      
      renderReelsList(allReels);
      updateReelStats(allReels);
    } else {
      reelsList.innerHTML = '<p style="text-align:center;padding:40px;color:var(--error)">Error al cargar reels</p>';
    }
  } catch (err) {
    console.error('Error loading reels:', err);
    reelsList.innerHTML = '<p style="text-align:center;padding:40px;color:var(--error)">Error de conexión</p>';
  }
}

function renderReelsList(reels) {
  const reelsList = document.getElementById('reelsList');
  
  if (!reels || reels.length === 0) {
    reelsList.innerHTML = '<p style="text-align:center;padding:40px;color:var(--text-light)">No hay reels registrados</p>';
    return;
  }
  
  let html = '';
  reels.forEach((reel) => {
    const visibleBadge = reel.visible === 'SI' 
      ? '<span style="background:#4CAF50;color:white;padding:2px 8px;border-radius:10px;font-size:0.7rem">Visible</span>'
      : '<span style="background:#999;color:white;padding:2px 8px;border-radius:10px;font-size:0.7rem">Oculto</span>';
    
    const emojiDisplay = reel.emoji || '📹';
    const captionDisplay = reel.caption || 'Sin caption';
    
    html += `
      <div class="review-card" data-reel-index="${reel.id}" onclick="openReelModal('${reel.id}')" style="cursor:pointer">
        <div class="review-card-header">
          <div class="review-avatar" style="background:linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045);font-size:1.2rem">${emojiDisplay}</div>
          <div style="flex:1">
            <strong>${captionDisplay}</strong>
            ${visibleBadge}
          </div>
          <span style="color:var(--text-light);font-size:0.85rem;white-space:nowrap">Orden: ${reel.orden || 0}</span>
        </div>
        <p class="review-text-preview" style="word-break:break-all;font-size:0.75rem;color:var(--text-light)">${reel.url || ''}</p>
        <div class="review-card-footer" style="display:flex;justify-content:space-between;align-items:center;padding-top:8px;border-top:1px solid rgba(196,161,109,0.1);margin-top:8px">
          <span style="font-size:0.75rem;color:var(--text-light)">ID: ${reel.id}</span>
          <div style="display:flex;gap:4px">
            <button onclick="event.stopPropagation();editReel('${reel.id}')" class="btn-icon-sm" title="Editar"><i class="fa-solid fa-pen"></i></button>
            <button onclick="event.stopPropagation();toggleReelVisibility('${reel.id}')" class="btn-icon-sm" title="${reel.visible === 'SI' ? 'Ocultar' : 'Mostrar'}">
              <i class="fa-solid ${reel.visible === 'SI' ? 'fa-eye-slash' : 'fa-eye'}"></i>
            </button>
          </div>
        </div>
      </div>`;
  });
  
  reelsList.innerHTML = html;
}

function updateReelStats(reels) {
  const totalEl = document.getElementById('statTotalReels');
  const visibleEl = document.getElementById('statVisibleReels');
  const hiddenEl = document.getElementById('statHiddenReels');
  
  if (totalEl) totalEl.textContent = reels.length;
  if (visibleEl) visibleEl.textContent = reels.filter(r => r.visible === 'SI').length;
  if (hiddenEl) hiddenEl.textContent = reels.filter(r => r.visible !== 'SI').length;
}

function openReelModal(reelId) {
  const modal = document.getElementById('modalReel');
  if (!modal) return;
  
  modal.classList.remove('hidden');
  document.getElementById('modalReelTitle').textContent = 'Nuevo Reel';
  document.getElementById('btnDeleteReel').style.display = 'none';
  document.getElementById('reelId').value = reelId || '';
}

function editReel(reelId) {
  const reel = allReels.find(r => r.id === reelId);
  if (!reel) return;
  
  const modal = document.getElementById('modalReel');
  if (!modal) return;
  
  modal.classList.remove('hidden');
  document.getElementById('modalReelTitle').textContent = 'Editar Reel';
  document.getElementById('btnDeleteReel').style.display = 'inline-block';
  
  document.getElementById('reelUrl').value = reel.url || '';
  document.getElementById('reelCaption').value = reel.caption || '';
  document.getElementById('reelEmoji').value = reel.emoji || '';
  document.getElementById('reelOrden').value = reel.orden || 0;
  document.getElementById('reelVisible').checked = (reel.visible === 'SI');
  document.getElementById('reelId').value = reel.id;
}

async function saveReel() {
  const url = document.getElementById('reelUrl').value.trim();
  const caption = document.getElementById('reelCaption').value.trim();
  const emoji = document.getElementById('reelEmoji').value.trim();
  const orden = parseInt(document.getElementById('reelOrden').value) || 0;
  const visible = document.getElementById('reelVisible').checked ? 'SI' : 'NO';
  
  if (!url) {
    showToast('La URL es obligatoria', true);
    return;
  }
  
  const reelId = document.getElementById('reelId').value;
  const isEdit = reelId && reelId !== '';
  
  const data = { url, caption: caption || '', emoji: emoji || '', orden, visible };
  
  if (isEdit) {
    data.id = reelId;
  }
  
  try {
    const action = isEdit ? 'actualizarReel' : 'agregarReel';
    const body = JSON.stringify({ action, token: TOKEN_SECRETO, ...data });
    
    const res = await fetch(SCRIPT_URL, { method: 'POST', body });
    const result = await res.json();
    
    if (result.success) {
      showToast('Reel guardado correctamente', 'success');
      document.getElementById('modalReel').classList.add('hidden');
      loadInstagramReels();
    } else {
      showToast('Error: ' + (result.error || 'No se pudo guardar'), 'error');
    }
  } catch (err) {
    console.error('Save error:', err);
    showToast('Error de conexión', 'error');
  }
}

async function deleteReel() {
  const reelId = document.getElementById('reelId').value;
  if (!reelId || !confirm('¿Estás segura de eliminar este reel?')) return;
  
  try {
    const body = JSON.stringify({ action: 'eliminarReel', token: TOKEN_SECRETO, id: reelId });
    const res = await fetch(SCRIPT_URL, { method: 'POST', body });
    const result = await res.json();
    
    if (result.success) {
      showToast('Reel eliminado', 'success');
      document.getElementById('modalReel').classList.add('hidden');
      loadInstagramReels();
    } else {
      showToast('Error: ' + (result.error || 'No se pudo eliminar'), 'error');
    }
  } catch (err) {
    showToast('Error de conexión', 'error');
  }
}

async function toggleReelVisibility(reelId) {
  const reel = allReels.find(r => r.id === reelId);
  if (!reel) return;
  
  const newVisible = reel.visible === 'SI' ? 'NO' : 'SI';
  
  try {
    const body = JSON.stringify({ action: 'actualizarReel', token: TOKEN_SECRETO, id: reelId, visible: newVisible });
    const res = await fetch(SCRIPT_URL, { method: 'POST', body });
    const result = await res.json();
    
    if (result.success) {
      loadInstagramReels();
    } else {
      showToast('Error al actualizar', 'error');
    }
  } catch (err) {
    showToast('Error de conexión', 'error');
  }
}

// Reel modal event listeners
const btnNewReel = document.getElementById('btnNewReel');
if (btnNewReel) {
  btnNewReel.addEventListener('click', () => {
    const modal = document.getElementById('modalReel');
    if (modal) {
      modal.classList.remove('hidden');
      document.getElementById('modalReelTitle').textContent = 'Nuevo Reel';
      document.getElementById('btnDeleteReel').style.display = 'none';
      document.getElementById('reelUrl').value = '';
      document.getElementById('reelCaption').value = '';
      document.getElementById('reelEmoji').value = '';
      document.getElementById('reelOrden').value = allReels.length > 0 ? Math.max(...allReels.map(r => r.orden || 0)) + 1 : 0;
      document.getElementById('reelVisible').checked = true;
      document.getElementById('reelId').value = '';
    }
  });
}

const btnSaveReel = document.getElementById('btnSaveReel');
if (btnSaveReel) btnSaveReel.addEventListener('click', saveReel);

const btnCancelReel = document.getElementById('btnCancelReel');
if (btnCancelReel) btnCancelReel.addEventListener('click', () => {
  document.getElementById('modalReel').classList.add('hidden');
});

const btnDeleteReel = document.getElementById('btnDeleteReel');
if (btnDeleteReel) btnDeleteReel.addEventListener('click', deleteReel);

// Reel search & filter
const searchReel = document.getElementById('searchReel');
const filterReelVisible = document.getElementById('filterReelVisible');
if (searchReel && filterReelVisible) {
  function applyReelFilters() {
    const query = searchReel.value.toLowerCase();
    const visibleFilter = filterReelVisible.value;
    
    let filtered = allReels.filter(r => {
      const matchSearch = !query || (r.caption || '').toLowerCase().includes(query);
      const matchVisible = visibleFilter === 'all' || r.visible === visibleFilter;
      return matchSearch && matchVisible;
    });
    
    renderReelsList(filtered);
  }
  
  searchReel.addEventListener('input', applyReelFilters);
  filterReelVisible.addEventListener('change', applyReelFilters);
}

// Reel keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const modalReel = document.getElementById('modalReel');
    if (modalReel && !modalReel.classList.contains('hidden')) {
      modalReel.classList.add('hidden');
    }
  }
});

// ==========================================
// INICIALIZACIÓN: Auto-login al cargar la página
// ==========================================
autoLogin();
