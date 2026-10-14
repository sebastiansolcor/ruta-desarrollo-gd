/* Ruta Desarrollo de GD – plataforma de habilitación de proyectos GD / CE / AGR */
'use strict';

// ============================================================ constantes
const FIGURAS = { GD: 'GD / AGPE ≤ 1 MW', CE: 'Comunidad energética', AGR: 'Autogeneración remota', PMR: 'Productor marginal remoto' };
// Todo proyecto en la plataforma ya superó Prefactibilidad: con la firma del contrato entra a la fase de Desarrollo.
// Desarrollo = Factibilidad (6 áreas en paralelo) ∥ Licenciamiento. RTB = ambas al 100 %.
const AREAS_FACT = ['Solapamientos', 'Jurídico', 'Conexión', 'Ingeniería', 'Predial', 'Social'];
const AREAS = [...AREAS_FACT, 'Licenciamiento'];
const ETAPAS = AREAS; // agrupación de trámites y entregables
const etapaDe = a => a === 'Licenciamiento' ? 'Licenciamiento' : 'Factibilidad';
const AREA_INFO = {
  Solapamientos: { desc: 'Consultas externas sobre el polígono del predio.', req: [
    'ANLA, ANM, ANH, PNN, URT y ANT respondidas',
    'Certificación de procedencia de consulta previa (Ministerio del Interior)',
    'Concepto arqueológico (ICANH) y determinantes ambientales (CAR)',
    'Consultas adicionales por hallazgo: operador de hidrocarburos, ductos, titular minero, MinAmbiente, Mincultura, INVIAS',
    'Ningún resultado desfavorable'] },
  'Jurídico': { desc: 'Seguridad jurídica del predio.', req: [
    'Contrato de arrendamiento firmado',
    'Estudio de títulos sin riesgos que impidan el proyecto',
    'Comunidad energética constituida (solo comunidades energéticas)'] },
  'Conexión': { desc: 'Viabilidad de la conexión con el operador de red.', req: [
    'Solicitud y recepción de insumos del operador de red',
    'Radicación y aprobación del estudio de conexión (ECS)',
    'Fecha de puesta en operación (FPO) asignada',
    'Contrato de conexión con el operador de red',
    'Solo autogeneración remota: concepto de la UPME, contrato de respaldo y frontera ante el ASIC'] },
  'Ingeniería': { desc: 'Diseño técnico del proyecto.', req: [
    'Layout preliminar',
    'Diseño de ingeniería básica',
    'Layout en AutoCAD',
    'Simulación PVsyst vigente (se toma siempre la última versión, con P50, P75 y P90)'] },
  Predial: { desc: 'Estudios de campo del predio.', req: [
    'Levantamiento topográfico',
    'Estudio hidrológico e hidrográfico',
    'Pruebas de pull-out'] },
  Social: { desc: 'Entorno de seguridad y relación con la comunidad.', req: [
    'Estudio de seguridad (orden público y riesgos para la obra y la operación)',
    'Estudio social (comunidad del área de influencia)'] },
  Licenciamiento: { desc: 'Licencias y permisos para construir. Avanza en paralelo con Factibilidad.', req: [
    'Certificado de uso del suelo',
    'Licencia de construcción para cerramiento',
    'Licencia de construcción para bases',
    'Certificación de incentivos tributarios de la UPME (Ley 1715 de 2014)',
    'Si aplican: permisos de la CAR (forestal, cauce, veda), arqueología preventiva, sustracción de reserva forestal y permiso de vía nacional'] },
};
const ETAPAS_PROY = ['Desarrollo', 'RTB alcanzado'];
const ESTADOS_PROY = ['Activo', 'Pausado', 'Descartado', 'RTB alcanzado'];
const ESTADOS_T = ['Por radicar', 'Radicado', 'Requerimiento', 'Respondido', 'No aplica'];
const RESULTADOS = ['Favorable', 'Con condiciones', 'Desfavorable', 'Sin pronunciamiento de fondo'];
const EVENTOS = ['Radicado', 'Requerimiento de la entidad', 'Respuesta a requerimiento', 'Observaciones del OR', 'Subsanación radicada', 'Insistencia / recordatorio',
  'Derecho de petición / queja', 'Respuesta de la entidad', 'Entrega', 'Nota'];
const EV_ESTADO = ['Radicado', 'Requerimiento de la entidad', 'Respuesta a requerimiento', 'Observaciones del OR', 'Subsanación radicada', 'Respuesta de la entidad', 'Entrega'];
// abren / cierran una suspensión del plazo: requerimientos de cualquier entidad y rondas de subsanación del ECS ante el OR
const EV_ABRE = ['Requerimiento de la entidad', 'Observaciones del OR'];
const EV_CIERRA = ['Respuesta a requerimiento', 'Subsanación radicada'];
const esEntregable = t => (CAT[t.catalogo_id]?.clase || '') === 'entregable';
const DEPTOS = ['Amazonas', 'Antioquia', 'Arauca', 'Atlántico', 'Bogotá D.C.', 'Bolívar', 'Boyacá', 'Caldas', 'Caquetá',
  'Casanare', 'Cauca', 'Cesar', 'Chocó', 'Córdoba', 'Cundinamarca', 'Guainía', 'Guaviare', 'Huila', 'La Guajira',
  'Magdalena', 'Meta', 'Nariño', 'Norte de Santander', 'Putumayo', 'Quindío', 'Risaralda', 'San Andrés y Providencia',
  'Santander', 'Sucre', 'Tolima', 'Valle del Cauca', 'Vaupés', 'Vichada'];
const TIPOS_ENT = ['CAR', 'Autoridad ambiental urbana', 'Nacional', 'Operador de red', 'Sector eléctrico', 'Municipal',
  'Operador hidrocarburos', 'Transporte de hidrocarburos', 'Transmisor', 'Titular minero', 'Otro'];
const GRUPOS_ENT = {
  'Autoridades ambientales': ['CAR', 'Autoridad ambiental urbana'],
  'Operadores de red': ['Operador de red'],
  'Entidades nacionales': ['Nacional'],
  'Sector eléctrico (UPME / XM / MinEnergía)': ['Sector eléctrico'],
  'Municipios': ['Municipal'],
  'Terceros (hidrocarburos, ductos, transmisión, minería)': ['Operador hidrocarburos', 'Transporte de hidrocarburos', 'Transmisor', 'Titular minero', 'Otro'],
};
const AMB = ['CAR', 'Autoridad ambiental urbana'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

// ============================================================ utilidades
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtD = s => { if (!s) return '—'; const [y, m, d] = s.split('-'); return `${+d} ${MESES[+m - 1]} ${y}`; };
const pct = (a, b) => b ? Math.round(100 * a / b) : 0;
const median = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
const r1 = v => v == null ? '—' : (Math.round(v * 10) / 10).toLocaleString('es-CO');
const ls = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } } };

async function api(method, url, body) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && data.login) { pantallaAcceso(); throw new Error(data.error); } // sesión vencida o cerrada
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => t.hidden = true, 2400);
}

// ============================================================ fechas y días hábiles (Colombia)
const D = s => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const iso = dt => dt.toISOString().slice(0, 10);
const addDays = (dt, n) => new Date(dt.getTime() + n * 864e5);
const HOY = (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`; })();
function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25),
    g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4,
    l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451),
    mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(y, mo - 1, da));
}
const nextMonday = dt => { const w = dt.getUTCDay(); return w === 1 ? dt : addDays(dt, (8 - w) % 7); };
const _fest = {};
function festivos(y) {
  if (_fest[y]) return _fest[y];
  const s = new Set();
  ['01-01', '05-01', '07-20', '08-07', '12-08', '12-25'].forEach(md => s.add(`${y}-${md}`));
  ['01-06', '03-19', '06-29', '08-15', '10-12', '11-01', '11-11'].forEach(md => s.add(iso(nextMonday(D(`${y}-${md}`)))));
  const E = easter(y);
  [-3, -2, 43, 64, 71].forEach(n => s.add(iso(addDays(E, n))));
  return (_fest[y] = s);
}
const isHabil = dt => { const w = dt.getUTCDay(); return w !== 0 && w !== 6 && !festivos(dt.getUTCFullYear()).has(iso(dt)); };
function habiles(a, b) { // días hábiles en (a, b]
  if (!a || !b || b <= a) return 0;
  let n = 0, d = addDays(D(a), 1); const end = D(b);
  while (d <= end) { if (isHabil(d)) n++; d = addDays(d, 1); }
  return n;
}
const calDays = (a, b) => (!a || !b || b <= a) ? 0 : Math.round((D(b) - D(a)) / 864e5);
function addHabiles(a, n) {
  let d = D(a), k = 0;
  while (k < n) { d = addDays(d, 1); if (isHabil(d)) k++; }
  return iso(d);
}

// ============================================================ estado
let S = { entidades: [], catalogo: [], proyectos: [], tramites: [], eventos: [] };
let ENT = {}, CAT = {}, PRO = {}, TR = {}, EV = {}, _tm = new Map();
async function load() {
  S = await api('GET', '/api/state');
  ENT = Object.fromEntries(S.entidades.map(e => [e.id, e]));
  S.catalogo.forEach(c => { c.area ||= c.etapa === 'Licenciamiento' ? 'Licenciamiento' : 'Solapamientos'; });
  CAT = Object.fromEntries(S.catalogo.map(c => [c.id, c]));
  S.tramites.forEach(t => { t.area ||= CAT[t.catalogo_id]?.area || (t.etapa === 'Licenciamiento' ? 'Licenciamiento' : 'Solapamientos'); });
  PRO = Object.fromEntries(S.proyectos.map(p => [p.id, p]));
  TR = {}; S.tramites.forEach(t => (TR[t.proyecto_id] ||= []).push(t));
  EV = {}; S.eventos.forEach(e => (EV[e.tramite_id] ||= []).push(e));
  Object.values(EV).forEach(a => a.sort((x, y) => (x.fecha || '').localeCompare(y.fecha || '') || x.id - y.id));
  COS = {}; (S.costos || []).forEach(c => (COS[c.proyecto_id] ||= []).push(c));
  try { const r = await api('GET', '/api/sync/config'); CFG = r.config; SYNCST = r.estado; } catch { /* sin configuración */ }
  _tm = new Map();
}
let COS = {}, CFG = {}, SYNCST = {};
const ent = id => ENT[id] || { sigla: '—', nombre: '', tipo: '' };

// ============================================================ métricas
/** Métricas de un trámite: días de la entidad (descontando suspensiones por requerimiento), vencimiento y semáforo. */
function tm(t) {
  if (_tm.has(t.id)) return _tm.get(t.id);
  const m = { sem: 'pend-rad', dias: null, diasHab: null, nreq: 0, susp: 0, vence: null, rest: null };
  const evs = EV[t.id] || [];
  m.nreq = evs.filter(e => e.tipo === 'Requerimiento de la entidad').length;
  m.nsub = evs.filter(e => e.tipo === 'Observaciones del OR').length;
  if (t.estado === 'No aplica') m.sem = 'na';
  else if (!t.fecha_radicado && t.fecha_respuesta) m.sem = 'sin-rad';
  else if (t.fecha_radicado) {
    const rad = t.fecha_radicado, end = t.fecha_respuesta || HOY;
    let susp = 0, suspCal = 0, open = null;
    for (const e of evs) {
      if (EV_ABRE.includes(e.tipo) && !open) { open = e.fecha; m.abiertoTipo = e.tipo; }
      else if (EV_CIERRA.includes(e.tipo) && open) { susp += habiles(open, e.fecha); suspCal += calDays(open, e.fecha); open = null; }
    }
    if (open) { susp += habiles(open, end); suspCal += calDays(open, end); }
    const cal = t.tipo_plazo === 'calendario';
    m.diasHab = Math.max(0, habiles(rad, end) - susp);
    m.dias = cal ? Math.max(0, calDays(rad, end) - suspCal) : m.diasHab;
    m.susp = cal ? suspCal : susp;
    m.suspendido = !!open && !t.fecha_respuesta;
    const plazo = t.plazo_dias;
    if (plazo != null && !m.suspendido) m.vence = cal ? iso(addDays(D(rad), plazo + suspCal)) : addHabiles(rad, plazo + susp);
    if (t.fecha_respuesta) m.sem = plazo == null ? 'resp' : (m.dias <= plazo ? 'ok' : 'late-resp');
    else if (m.suspendido) m.sem = 'susp';
    else if (plazo == null) m.sem = 'curso';
    else { m.rest = plazo - m.dias; m.sem = m.rest < 0 ? 'vencido' : m.rest <= 3 ? 'porvencer' : 'curso'; }
  }
  _tm.set(t.id, m);
  return m;
}
function semPill(t) {
  const m = tm(t), u = t.tipo_plazo === 'calendario' ? 'd cal.' : 'd háb.';
  if (esEntregable(t) && t.estado !== 'No aplica')
    return t.fecha_respuesta ? `<span class="pill ok">Entregado · ${fmtD(t.fecha_respuesta)}</span>` : '<span class="pill">Pendiente</span>';
  switch (m.sem) {
    case 'ok': return `<span class="pill ok">En plazo · ${m.dias} ${u}</span>`;
    case 'late-resp': return `<span class="pill bad">Fuera de plazo · ${m.dias} ${u}</span>`;
    case 'resp': return `<span class="pill info">Respondido · ${m.dias} ${u}</span>`;
    case 'vencido': return `<span class="pill bad">Vencido hace ${-m.rest} ${u}</span>`;
    case 'porvencer': return `<span class="pill warn">Vence en ${m.rest} ${u}</span>`;
    case 'curso': return `<span class="pill info">En curso · ${m.dias} ${u}</span>`;
    case 'susp': return `<span class="pill warn">${m.abiertoTipo === 'Observaciones del OR' ? 'En subsanación' : 'Requerimiento'} · plazo suspendido</span>`;
    case 'na': return `<span class="pill">No aplica</span>`;
    case 'sin-rad': return `<span class="pill warn">Respondido · falta fecha de radicado</span>`;
    default: return `<span class="pill">Por radicar</span>`;
  }
}
/** Vigencia de un documento obtenido: fecha explícita o meses de vigencia del catálogo contados desde la respuesta. */
function vig(t) {
  let hasta = t.vigencia_hasta;
  const meses = CAT[t.catalogo_id]?.vigencia_meses;
  if (!hasta && meses && t.fecha_respuesta) { const d = D(t.fecha_respuesta); d.setUTCMonth(d.getUTCMonth() + +meses); hasta = iso(d); }
  if (!hasta) return { s: 'na' };
  const dias = calDays(HOY, hasta) * (hasta >= HOY ? 1 : -1);
  return { hasta, dias, s: hasta < HOY ? 'vencida' : dias <= 60 ? 'porvencer' : 'vigente' };
}
const vigPill = t => { const v = vig(t); return v.s === 'na' ? '' : v.s === 'vencida' ? `<span class="pill bad">Vigencia vencida</span>`
  : v.s === 'porvencer' ? `<span class="pill warn">Vence en ${v.dias} días</span>` : `<span class="pill ok">Vigente hasta ${fmtD(v.hasta)}</span>`; };
const resPill = r => !r ? '<span class="muted">—</span>' :
  `<span class="pill ${r === 'Favorable' ? 'ok' : r === 'Desfavorable' ? 'bad' : r === 'Con condiciones' ? 'warn' : 'info'}">${esc(r)}</span>`;

/** Duración esperada (días hábiles) usando el histórico real de la plataforma. */
function expected(entidad_id, catalogo_id, plazo) {
  const done = S.tramites.filter(x => x.fecha_respuesta && x.fecha_radicado && x.entidad_id === entidad_id);
  const same = done.filter(x => catalogo_id && x.catalogo_id === catalogo_id).map(x => tm(x).diasHab);
  if (same.length) return { d: Math.round(median(same)), src: `histórico (${same.length})` };
  const any = done.map(x => tm(x).diasHab);
  if (any.length) return { d: Math.round(median(any)), src: `histórico entidad (${any.length})` };
  if (plazo != null) return { d: plazo, src: 'plazo legal' };
  return { d: 20, src: 'supuesto (20 d)' };
}

/** Estima el cierre de cada área y el RTB: todas las áreas (Factibilidad y Licenciamiento) avanzan en paralelo. */
function estimate(items) {
  const ends = {}; let rtb = HOY;
  for (const ar of AREAS) {
    let end = HOY;
    for (const t of items.filter(x => x.area === ar && x.estado !== 'No aplica')) {
      let e;
      if (t.fecha_respuesta) e = t.fecha_respuesta;
      else {
        const ex = expected(t.entidad_id, t.catalogo_id, t.plazo_dias).d;
        if (t.fecha_radicado) { const el = tm(t).diasHab || 0; e = addHabiles(HOY, Math.max(5, ex - el)); }
        else e = addHabiles(HOY, 5 + ex);
      }
      if (e > end) end = e;
    }
    ends[ar] = end; if (end > rtb) rtb = end;
  }
  return { ends, rtb };
}

function pm(p) {
  const all = TR[p.id] || [], ts = all.filter(t => t.estado !== 'No aplica');
  const done = ts.filter(t => t.estado === 'Respondido');
  const m = { total: ts.length, done: done.length };
  // avance por área; Factibilidad = promedio de sus 6 áreas (pesan igual porque avanzan en paralelo)
  m.areas = AREAS.map(ar => { const x = ts.filter(t => t.area === ar); const d = x.filter(t => t.estado === 'Respondido').length; return { ar, n: x.length, d, pct: pct(d, x.length) }; });
  const fa = m.areas.filter(a => AREAS_FACT.includes(a.ar) && a.n);
  m.fact = fa.length ? Math.round(avg(fa.map(a => a.pct))) : 0;
  const li = m.areas.find(a => a.ar === 'Licenciamiento');
  m.lic = li.n ? li.pct : 0;
  m.avance = Math.round((m.fact + m.lic) / 2);
  m.venc = ts.filter(t => tm(t).sem === 'vencido').length;
  m.porv = ts.filter(t => tm(t).sem === 'porvencer').length;
  m.desf = done.filter(t => t.resultado === 'Desfavorable').length;
  m.cond = done.filter(t => t.resultado === 'Con condiciones').length;
  m.sinp = done.filter(t => t.resultado === 'Sin pronunciamiento de fondo').length;
  m.viab = m.desf ? { c: 'bad', l: 'Riesgo alto' } : m.cond ? { c: 'warn', l: 'Con condiciones' } : m.sinp ? { c: 'warn', l: 'Verificación propia pendiente' } : done.length ? { c: 'ok', l: 'Viable a la fecha' } : { c: '', l: 'Sin respuestas' };
  m.rtb = p.estado === 'RTB alcanzado' || p.etapa === 'RTB alcanzado';
  m.listoRtb = !m.rtb && m.fact === 100 && m.lic === 100 && !m.desf;
  m.est = m.rtb ? null : estimate(ts);
  return m;
}

/** Estadísticas agrupadas (por entidad o por tipo de trámite). */
function stats(filter, keyFn, inclPend) {
  const g = {};
  for (const t of S.tramites) {
    if (!t.fecha_radicado || t.estado === 'No aplica' || esEntregable(t)) continue;
    const p = PRO[t.proyecto_id]; if (!p || !filter(t, p)) continue;
    const k = keyFn(t); (g[k] ||= []).push(t);
  }
  return Object.entries(g).map(([k, ts]) => {
    const resp = ts.filter(t => t.fecha_respuesta), pend = ts.filter(t => !t.fecha_respuesta);
    const dias = (inclPend ? ts : resp).map(t => tm(t).dias);
    const conPlazo = resp.filter(t => t.plazo_dias != null);
    const plazos = ts.map(t => t.plazo_dias).filter(v => v != null);
    return {
      k, n: ts.length, resp: resp.length, pend: pend.length,
      venc: pend.filter(t => tm(t).sem === 'vencido').length,
      prom: avg(dias), med: median(dias), max: dias.length ? Math.max(...dias) : null,
      plazo: plazos.length ? median(plazos) : null,
      enPlazo: conPlazo.length ? pct(conPlazo.filter(t => tm(t).dias <= t.plazo_dias).length, conPlazo.length) : null,
      req: pct(ts.filter(t => tm(t).nreq > 0).length, ts.length), ts,
    };
  }).sort((a, b) => (b.prom ?? -1) - (a.prom ?? -1));
}

// ============================================================ router
const VIEWS = { tablero: vTablero, proyectos: vProyectos, proyecto: vProyecto, pendientes: vPendientes, pipeline: vPipeline, red: vRed,
  planificador: vPlanificador, comparativo: vComparativo, sharepoint: vSharepoint, catalogo: vCatalogo, datos: vDatos, soporte: vSoporte };
let mapInst = null;
let mapMarkers = {};
let KEYS = []; // claves para los clics del comparativo (evita escapar texto dentro de onclick)
const kref = k => { KEYS.push(k); return `entityDrawer(KEYS[${KEYS.length - 1}])`; };
let LOADED = false;
const offline = msg => `<div class="card card-pad" style="max-width:640px">
  <h2>No hay conexión con el servidor local</h2>
  <p class="muted">${esc(msg || '')}</p>
  <p>La plataforma necesita que el servidor esté corriendo. Abre <b>iniciar.bat</b> (o ejecuta <code>python server.py</code>) en la carpeta <code>ruta-rtb</code>, deja esa ventana abierta y luego pulsa reintentar.</p>
  <button class="btn primary" onclick="boot()">Reintentar</button></div>`;
function render() {
  if (!LOADED) { $('#main').innerHTML = offline(); return; }
  KEYS = [];
  const [r, arg] = (location.hash.replace(/^#\/?/, '') || 'tablero').split('/');
  const view = VIEWS[r] || vTablero;
  $$('#nav a').forEach(a => a.classList.toggle('on', a.dataset.r === (r === 'proyecto' ? 'proyectos' : r)));
  if (mapInst) { mapInst.remove(); mapInst = null; }
  $('#main').innerHTML = view(arg);
  view.after?.(arg);
  window.scrollTo(0, 0);
}
async function refresh() { await load(); const y = window.scrollY; render(); window.scrollTo(0, y); if (openDrawerId) openTramite(openDrawerId); }

// ============================================================ vistas
function vTablero() {
  const act = S.proyectos.filter(p => p.estado === 'Activo');
  const actIds = new Set(act.map(p => p.id));
  const ts = S.tramites.filter(t => actIds.has(t.proyecto_id) && t.estado !== 'No aplica');
  const venc = ts.filter(t => tm(t).sem === 'vencido'), porv = ts.filter(t => tm(t).sem === 'porvencer');
  const curso = ts.filter(t => t.fecha_radicado && !t.fecha_respuesta);
  const resp = S.tramites.filter(t => t.fecha_respuesta && t.fecha_radicado);
  const conPl = resp.filter(t => t.plazo_dias != null);
  const alerts = [...venc, ...porv, ...ts.filter(t => tm(t).sem === 'susp')];
  const alertGroups = Object.values(alerts.reduce((acc, t) => {
    (acc[t.proyecto_id] ||= { pid: t.proyecto_id, items: [], bad: false }).items.push(t);
    if (tm(t).sem === 'vencido') acc[t.proyecto_id].bad = true;
    return acc;
  }, {})).sort((a, b) => (PRO[a.pid]?.nombre || '').localeCompare(PRO[b.pid]?.nombre || ''));
  const mapList = S.proyectos.filter(p => p.estado !== 'Descartado' && p.lat != null && p.lon != null && p.lat !== '' && p.lon !== '');
  const vigs = ts.filter(t => ['vencida', 'porvencer'].includes(vig(t).s)).sort((a, b) => vig(a).hasta.localeCompare(vig(b).hasta));
  const slow = stats(() => true, t => t.entidad_id, false).filter(s => s.resp).slice(0, 8);
  const maxS = Math.max(1, ...slow.map(s => Math.max(s.prom || 0, s.plazo || 0)));
  if (!S.proyectos.length) return `
    ${head('Tablero', 'Seguimiento de la habilitación de proyectos desde el contrato firmado hasta RTB')}
    <div class="card empty" style="padding:48px">
      <h2 style="margin-bottom:8px">Aún no hay proyectos</h2>
      <p>Registra tu primer proyecto con contrato firmado o carga los datos de ejemplo para explorar la plataforma.</p>
      <div class="actions" style="justify-content:center;margin-top:14px">
        <button class="btn primary" onclick="projectForm()">+ Nuevo proyecto</button>
        <button class="btn" onclick="loadDemo()">Cargar datos de ejemplo</button>
      </div>
    </div>`;
  return `
    ${head('Tablero', 'Seguimiento de la habilitación de proyectos desde el contrato firmado hasta RTB', `<button class="btn primary" onclick="projectForm()">+ Nuevo proyecto</button>`)}
    <div class="kpis">
      ${kpi('Proyectos activos', act.length, `${S.proyectos.length} registrados`)}
      ${kpi('Trámites en curso', curso.length, `${ts.filter(t => !t.fecha_radicado && !t.fecha_respuesta && !esEntregable(t)).length} por radicar · ${ts.filter(t => esEntregable(t) && !t.fecha_respuesta).length} entregables pendientes`)}
      ${kpi('Vencidos', venc.length, 'superan el plazo legal', venc.length ? 'bad' : 'ok')}
      ${kpi('Por vencer', porv.length, '≤ 3 días', porv.length ? 'warn' : '')}
      ${kpi('Tiempo medio de respuesta', r1(avg(resp.map(t => tm(t).diasHab))), 'días hábiles')}
      ${kpi('Respondidos en plazo', conPl.length ? pct(conPl.filter(t => tm(t).dias <= t.plazo_dias).length, conPl.length) + '%' : '—', `${conPl.length} con plazo legal`)}
    </div>
    <div class="card" style="margin-bottom:16px">
      <div class="card-head"><div><h2>Mapa de proyectos</h2>${viabLegend()}</div>
        <div class="filters">
          <input id="mapaBuscar" list="dlMapaProy" placeholder="Buscar proyecto por nombre…" autocomplete="off" oninput="buscarEnMapa(this.value)">
          <datalist id="dlMapaProy">${mapList.map(p => `<option value="${esc(p.nombre)}">`).join('')}</datalist>
        </div>
      </div>
      <div id="map" class="map"></div>
    </div>
    ${rutaCard()}
    <div class="split">
      <div class="stack">
        <div class="card">
          <div class="card-head"><h2>Proyectos activos</h2><a href="#/proyectos" class="small">Ver todos →</a></div>
          ${projTable(act)}
        </div>
      </div>
      <div class="stack">
        <div class="card">
          <div class="card-head"><h2>Alertas</h2><span class="muted small">${alerts.length}</span></div>
          <div class="alert-groups">${alertGroups.length ? alertGroups.map(g => `
            <details class="alert-group">
              <summary><span class="t">${esc(PRO[g.pid]?.nombre)}</span><span class="pill ${g.bad ? 'bad' : 'warn'}">${g.items.length}</span></summary>
              <div class="alerts">${g.items.map(t => `
                <div class="alert" onclick="openTramite(${t.id})">
                  <div class="top">${semPill(t)}<span class="muted small">${tm(t).vence ? 'vence ' + fmtD(tm(t).vence) : ''}</span></div>
                  <div class="t">${esc(ent(t.entidad_id).sigla)} · ${esc(t.nombre)}</div>
                </div>`).join('')}</div>
            </details>`).join('') : '<div class="empty">Sin alertas. Todo dentro de plazo.</div>'}</div>
        </div>
        <div class="card">
          <div class="card-head"><h2>Vigencias de documentos</h2><span class="muted small">vencen en ≤ 60 días</span></div>
          <div class="alerts">${vigs.length ? vigs.map(t => `
            <div class="alert" onclick="openTramite(${t.id})">
              <div class="top">${vigPill(t)}<span class="muted small">hasta ${fmtD(vig(t).hasta)}</span></div>
              <div class="t">${esc(t.nombre)}</div><div class="muted small">${esc(PRO[t.proyecto_id]?.nombre)}</div>
            </div>`).join('') : '<div class="empty">Ningún documento vence en los próximos 60 días.</div>'}</div>
        </div>
        ${calidadCard()}
        <div class="card">
          <div class="card-head"><h2>Entidades más lentas</h2><a href="#/comparativo" class="small">Comparativo →</a></div>
          <div class="card-pad">${slow.length ? hbars(slow.map(s => ({ ...s, label: ent(+s.k).sigla, id: +s.k })), maxS) : '<div class="empty">Sin respuestas registradas aún.</div>'}</div>
        </div>
      </div>
    </div>`;
}
vTablero.after = () => drawMap(S.proyectos.filter(p => p.estado !== 'Descartado'));
vProyecto.after = id => drawProjectMap(+id);

const head = (t, sub, actions = '') => `<div class="page-head"><div><h1>${t}</h1>${sub ? `<p>${sub}</p>` : ''}</div><div class="actions">${actions}</div></div>`;
const kpi = (l, v, s, c = '') => `<div class="card kpi ${c}"><div class="lbl">${l}</div><div class="val">${v}</div><div class="sub">${s}</div></div>`;
const viabLegend = () => `<div class="legend"><span><i style="background:var(--ok)"></i>Viable</span><span><i style="background:var(--warn)"></i>Con condiciones</span><span><i style="background:var(--bad)"></i>Riesgo alto</span><span><i style="background:var(--muted)"></i>Sin respuestas</span></div>`;

const etapaPill = (p, m) => p.estado !== 'Activo' && p.estado !== 'RTB alcanzado' ? `<span class="pill">${esc(p.estado)}</span>`
  : m.rtb ? '<span class="pill ok">RTB</span>' : m.listoRtb ? '<span class="pill ok">Listo para RTB</span>' : '<span class="pill acc">Desarrollo</span>';

/** Resumen de la ruta de desarrollo: qué exige cada área para llegar a RTB. */
function rutaCard() {
  const abierto = ls.get('rutaAbierta') !== '0';
  const area = ar => `<div class="ruta-area"><div class="t">${ar}</div><p>${AREA_INFO[ar].desc}</p>
    <ul>${AREA_INFO[ar].req.map(r => `<li>${r}</li>`).join('')}</ul></div>`;
  return `<details class="card ruta" ${abierto ? 'open' : ''} ontoggle="ls.set('rutaAbierta', this.open ? '1' : '0')">
    <summary class="card-head"><div><h2>Ruta de desarrollo</h2><div class="muted small">Prefactibilidad se supera con la firma del contrato. Desde ahí, Factibilidad y Licenciamiento avanzan en paralelo y el proyecto es RTB cuando ambas están completas.</div></div><span class="muted small">mostrar / ocultar</span></summary>
    <div class="card-pad">
      <div class="ruta-flujo">
        <div class="ruta-bloque">
          <div class="ruta-titulo">Factibilidad <span class="muted small">· 6 áreas en paralelo</span></div>
          <div class="ruta-areas">${AREAS_FACT.map(area).join('')}</div>
        </div>
        <div class="ruta-bloque lic">
          <div class="ruta-titulo">Licenciamiento <span class="muted small">· en paralelo</span></div>
          ${area('Licenciamiento')}
        </div>
      </div>
      <div class="ruta-rtb"><b>RTB · Ready to Build</b> — se declara cuando Factibilidad (sus 6 áreas) y Licenciamiento están al 100 % y sin resultados desfavorables. El proyecto queda listo para iniciar la construcción.</div>
    </div>
  </details>`;
}

function projTable(list) {
  if (!list.length) return '<div class="empty">No hay proyectos con estos filtros.</div>';
  const prog = v => `<div class="prog"><div class="bar"><span style="width:${v}%"></span></div><span class="num">${v}%</span></div>`;
  return `<div class="table-wrap"><table><thead><tr><th>Proyecto</th><th>Figura</th><th>Ubicación</th><th>Etapa</th><th>Factibilidad</th><th>Licenciamiento</th><th>Viabilidad</th><th>Alertas</th><th>RTB estimado</th></tr></thead><tbody>
  ${list.map(p => {
    const m = pm(p); const late = p.rtb_objetivo && m.est && m.est.rtb > p.rtb_objetivo;
    return `<tr class="click" onclick="location.hash='#/proyecto/${p.id}'">
      <td><b>${esc(p.nombre)}</b><div class="muted small">${esc(p.codigo || '')}${p.demo ? ' · <span class="tag">ejemplo</span>' : ''}</div></td>
      <td><span class="tag acc">${esc(p.figura)}</span> <span class="muted small num">${p.capacidad_kw ? (+p.capacidad_kw).toLocaleString('es-CO') + ' kW' : ''}</span></td>
      <td>${esc(p.municipio || '')}<div class="muted small">${esc(p.departamento || '')}</div></td>
      <td>${etapaPill(p, m)}</td>
      <td>${prog(m.fact)}</td>
      <td>${prog(m.lic)}</td>
      <td><span class="pill ${m.viab.c}">${m.viab.l}</span></td>
      <td>${m.venc ? `<span class="pill bad">${m.venc} vencidos</span>` : ''} ${m.porv ? `<span class="pill warn">${m.porv} por vencer</span>` : ''}${!m.venc && !m.porv ? '<span class="muted">—</span>' : ''}</td>
      <td class="num">${m.est ? fmtD(m.est.rtb) : '—'}${late ? '<div class="small" style="color:var(--bad)">después del objetivo</div>' : ''}</td>
    </tr>`;
  }).join('')}</tbody></table></div>`;
}

function drawMap(list) {
  const el = $('#map'); if (!el) return;
  if (!window.L) { el.outerHTML = '<div class="map-off">Mapa no disponible (sin conexión a internet).</div>'; return; }
  // capa única satelital; se controla con el mouse (arrastrar para mover, rueda para acercar o alejar)
  mapInst = L.map(el, { scrollWheelZoom: true, dragging: true, doubleClickZoom: true, boxZoom: true, keyboard: true, maxZoom: 19 }).setView([5.3, -74.2], 6);
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19, maxNativeZoom: 18, attribution: 'Imágenes © Esri, Maxar, Earthstar Geographics',
  }).addTo(mapInst);
  // capa de referencia: nombres de municipios, vías y lugares sobre la imagen satelital
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19, maxNativeZoom: 18,
  }).addTo(mapInst);
  const css = getComputedStyle(document.documentElement);
  const col = c => css.getPropertyValue({ ok: '--ok', warn: '--warn', bad: '--bad' }[c] || '--muted').trim();
  const pts = [];
  mapMarkers = {};
  list.filter(p => p.lat != null && p.lon != null && p.lat !== '' && p.lon !== '').forEach(p => {
    const m = pm(p);
    mapMarkers[p.id] = L.circleMarker([+p.lat, +p.lon], { radius: 9, color: '#fff', weight: 2, fillColor: col(m.viab.c), fillOpacity: .95 })
      .addTo(mapInst).bindTooltip(esc(p.nombre.replace(/^GD\s+/, '')), { permanent: true, direction: 'top', offset: [0, -8], className: 'map-lbl' }).bindPopup(`<b>${esc(p.nombre)}</b><br>${esc(p.figura)} · Factibilidad ${m.fact}% · Licenciamiento ${m.lic}%<br>${m.viab.l}<br><a href="#/proyecto/${p.id}">Abrir proyecto</a>`);
    pts.push([+p.lat, +p.lon]);
  });
  // si todos los GD están en el mismo predio se ve el predio; si están dispersos, todo el país
  if (pts.length > 1) mapInst.fitBounds(pts, { padding: [40, 40], maxZoom: 16 });
  else if (pts.length === 1) mapInst.setView(pts[0], 16);
  setTimeout(() => mapInst && mapInst.invalidateSize(), 200);
}

/** Busca un proyecto por nombre en el mapa del tablero y centra la vista en él. */
function buscarEnMapa(q) {
  q = (q || '').trim().toLowerCase();
  if (!q) return;
  const ids = Object.keys(mapMarkers);
  let id = ids.find(i => (PRO[i]?.nombre || '').toLowerCase() === q);
  if (!id) {
    const m = ids.filter(i => (PRO[i]?.nombre || '').toLowerCase().includes(q));
    if (m.length === 1) id = m[0];
  }
  if (id) irAProyectoEnMapa(id);
}
function irAProyectoEnMapa(id) {
  const mk = mapMarkers[id];
  if (!mapInst || !mk) return;
  mapInst.setView(mk.getLatLng(), 16);
  mk.openPopup();
}

function hbars(rows, max) {
  return `<div class="hbars">${rows.map(s => {
    const c = s.enPlazo == null ? 'none' : s.enPlazo >= 80 ? '' : s.enPlazo >= 50 ? 'warn' : 'bad';
    return `<div class="hb" onclick="${kref(s.id ?? s.k)}" title="${esc(s.label)}">
      <span class="nm">${esc(s.label)}</span>
      <div class="tr"><div class="fill ${c}" style="width:${pct(s.prom || 0, max)}%"></div>${s.plazo != null ? `<div class="lim" style="left:${pct(s.plazo, max)}%" title="Plazo legal ${s.plazo} d"></div>` : ''}</div>
      <span class="v">${r1(s.prom)} d</span></div>`;
  }).join('')}</div>
  <div class="legend" style="margin-top:12px"><span><i style="background:var(--ok)"></i>≥80% en plazo</span><span><i style="background:var(--warn)"></i>50–79%</span><span><i style="background:var(--bad)"></i>&lt;50%</span><span><i style="background:var(--info)"></i>sin plazo legal</span><span><i style="border-left:2px dashed var(--text);width:0;border-radius:0"></i>plazo legal</span></div>`;
}

// ------------------------------------------------------------ proyectos
let fP = { q: '', estado: 'Activo', figura: '', dep: '' };
function vProyectos() {
  const list = S.proyectos.filter(p =>
    (!fP.estado || p.estado === fP.estado) && (!fP.figura || p.figura === fP.figura) && (!fP.dep || p.departamento === fP.dep) &&
    (!fP.q || `${p.nombre} ${p.codigo} ${p.municipio} ${p.predio}`.toLowerCase().includes(fP.q.toLowerCase())));
  const deps = [...new Set(S.proyectos.map(p => p.departamento).filter(Boolean))].sort();
  return `${head('Proyectos', 'Proyectos con contrato firmado, en seguimiento hasta RTB', `<button class="btn primary" onclick="projectForm()">+ Nuevo proyecto</button>`)}
  <div class="card">
    <div class="card-head"><div class="filters">
      <input placeholder="Buscar nombre, código, municipio…" value="${esc(fP.q)}" oninput="fP.q=this.value;rerenderList()">
      <select onchange="fP.estado=this.value;rerenderList()"><option value="">Todos los estados</option>${ESTADOS_PROY.map(e => `<option ${fP.estado === e ? 'selected' : ''}>${e}</option>`).join('')}</select>
      <select onchange="fP.figura=this.value;rerenderList()"><option value="">Todas las figuras</option>${Object.entries(FIGURAS).map(([k, v]) => `<option value="${k}" ${fP.figura === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
      <select onchange="fP.dep=this.value;rerenderList()"><option value="">Todos los departamentos</option>${deps.map(d => `<option ${fP.dep === d ? 'selected' : ''}>${esc(d)}</option>`).join('')}</select>
    </div><span class="muted small">${list.length} proyectos</span></div>
    <div id="plist">${projTable(list)}</div>
  </div>`;
}
function rerenderList() { // conserva el foco del buscador
  const a = document.activeElement, pos = a?.selectionStart;
  render();
  if (a?.tagName === 'INPUT') { const i = $('.filters input'); i.focus(); i.setSelectionRange(pos, pos); }
}

function vProyecto(id) {
  const p = PRO[+id];
  if (!p) return `${head('Proyecto no encontrado')}<a href="#/proyectos">← Volver</a>`;
  const m = pm(p), ts = (TR[p.id] || []);
  const late = p.rtb_objetivo && m.est && m.est.rtb > p.rtb_objetivo;
  return `
  <div class="small" style="margin-bottom:6px"><a href="#/proyectos">← Proyectos</a></div>
  ${head(esc(p.nombre), `${esc(p.codigo || '')} · ${esc(FIGURAS[p.figura] || p.figura)} · ${p.capacidad_kw ? (+p.capacidad_kw).toLocaleString('es-CO') + ' kW' : ''} · ${esc(p.municipio || '')}, ${esc(p.departamento || '')}${p.predio ? ' · Predio ' + esc(p.predio) : ''}`,
    `<button class="btn" onclick="projectForm(${p.id})">Editar</button><button class="btn primary" onclick="addConsulta(${p.id})">+ Agregar consulta</button>`)}
  <div class="kpis">
    ${kpi('Avance a RTB', m.avance + '%', `Factibilidad ${m.fact}% · Licenciamiento ${m.lic}%`)}
    <div class="card kpi"><div class="lbl">Viabilidad</div><div class="val" style="font-size:18px;margin-top:8px"><span class="pill ${m.viab.c}">${m.viab.l}</span></div><div class="sub">${m.cond} con condiciones · ${m.desf} desfavorables</div></div>
    ${kpi('Vencidos / por vencer', `${m.venc} / ${m.porv}`, 'frente al plazo legal', m.venc ? 'bad' : m.porv ? 'warn' : 'ok')}
    ${kpi('Días desde contrato', p.fecha_contrato ? calDays(p.fecha_contrato, HOY) : '—', p.fecha_contrato ? 'firmado ' + fmtD(p.fecha_contrato) : 'sin fecha de contrato')}
    ${kpi('RTB estimado', m.est ? fmtD(m.est.rtb) : 'Alcanzado', p.rtb_objetivo ? `objetivo ${fmtD(p.rtb_objetivo)}` : 'sin objetivo definido', late ? 'bad' : '')}
  </div>
  ${devCard(p, m)}
  ${proyExtras(p)}
  <div class="card" style="margin-bottom:16px">
    <div class="card-head"><h2>Línea de tiempo de trámites</h2><div class="legend"><span><i style="background:var(--ok)"></i>Respondido en plazo</span><span><i style="background:var(--bad)"></i>Fuera de plazo / vencido</span><span><i style="background:var(--info)"></i>En curso</span><span><i style="background:var(--warn)"></i>Requerimiento</span><span><i style="background:#ff8a3d"></i>Subsanación (observaciones del OR)</span></div></div>
    <div class="card-pad">${gantt(ts.filter(t => t.fecha_radicado), p.fecha_contrato)}</div>
  </div>
  <div class="card">
    <div class="card-head"><h2>Trámites y consultas</h2><span class="muted small">Haz clic en un trámite para registrar radicado, requerimientos o respuesta</span></div>
    ${tramTable(ts)}
  </div>
  ${p.notas ? `<div class="card card-pad" style="margin-top:16px"><h3>Notas</h3><p style="white-space:pre-wrap;margin:6px 0 0">${esc(p.notas)}</p></div>` : ''}`;
}

const cop = v => v == null ? '—' : '$ ' + Math.round(v).toLocaleString('es-CO');

/** Mapa del predio con el layout, red y circuito, y costos de desarrollo. */
function proyExtras(p) {
  const cs = COS[p.id] || [], total = cs.reduce((a, c) => a + (+c.valor || 0), 0), pag = cs.filter(c => c.estado === 'Pagado').reduce((a, c) => a + (+c.valor || 0), 0);
  const hermanos = S.proyectos.filter(x => x.circuito && x.circuito === p.circuito && x.or_id === p.or_id && x.estado !== 'Descartado');
  const kw = hermanos.reduce((a, x) => a + (+x.capacidad_kw || 0), 0);
  const circ = (S.circuitos || []).find(c => c.codigo === p.circuito && c.or_id === p.or_id);
  return `<div class="split" style="margin-bottom:16px">
    <div class="card"><div class="card-head"><div><h2>Predio y layout</h2><span class="muted small" id="pmapInfo"></span></div>
      <div class="legend"><span><i style="background:#44d52d"></i>Mesas de este GD</span><span><i style="background:#d3dd07"></i>Otros GD</span><span><i style="border:2px dashed var(--muted);background:none"></i>Área útil</span><span><i style="background:#ff5a4f"></i>Red eléctrica</span><span><i style="background:#ffd23f"></i>Vías</span></div></div>
      <div id="pmap" class="map"></div></div>
    <div class="stack">
      <div class="card card-pad">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><h3>Red</h3><button class="btn sm" onclick="redForm(${p.id})">Editar</button></div>
        <div class="facts">
          <div><span>Operador de red</span><b>${esc(ent(p.or_id).sigla)}</b></div>
          <div><span>Circuito</span><b>${p.circuito ? `<a href="#/red">${esc(p.circuito)}</a>` : '—'}</b></div>
          <div><span>Capacidad de la subestación</span><b>${p.capacidad_se_mva ? `${String(p.capacidad_se_mva).replace('.', ',')} MVA` : '—'}</b></div>
          <div><span>GD de Solcor en el circuito</span><b>${p.circuito ? `${hermanos.length} · ${kw.toLocaleString('es-CO')} kW` : '—'}</b></div>
          <div><span>Capacidad disponible registrada</span><b>${circ?.capacidad_disp_kw ? `${(+circ.capacidad_disp_kw).toLocaleString('es-CO')} kW` : '—'}</b></div>
        </div>
        ${circ?.capacidad_disp_kw && kw > circ.capacidad_disp_kw ? `<div class="note warn" style="margin-top:10px">Los GD de Solcor en este circuito (${kw.toLocaleString('es-CO')} kW) superan la capacidad disponible registrada.</div>` : ''}
      </div>
      <div class="card">
        <div class="card-head"><h3>Costos de desarrollo</h3><button class="btn sm" onclick="costoForm(${p.id})">+ Costo</button></div>
        <div class="card-pad" style="padding-bottom:6px">
          <div class="facts"><div><span>Total registrado</span><b>${cop(total)}</b></div><div><span>Pagado</span><b>${cop(pag)}</b></div>
            <div><span>Presupuesto</span><b>${p.presupuesto ? cop(p.presupuesto) : '<span class="muted">sin definir</span>'}</b></div>
            <div><span>Ejecución</span><b>${p.presupuesto ? pct(total, p.presupuesto) + ' %' : '—'}</b></div></div>
        </div>
        ${cs.length ? `<div class="table-wrap"><table><tbody>${cs.map(c => `<tr class="click" onclick="costoForm(${p.id}, ${c.id})">
          <td><b>${esc(c.concepto)}</b><div class="muted small">${esc(c.proveedor || '')}${c.area ? ' · ' + esc(c.area) : ''} · ${fmtD(c.fecha)}</div></td>
          <td class="r num">${cop(c.valor)}<div><span class="pill ${c.estado === 'Pagado' ? 'ok' : 'warn'}">${esc(c.estado)}</span></div></td></tr>`).join('')}</tbody></table></div>`
          : '<div class="empty" style="padding-top:4px">Sin costos registrados.</div>'}
      </div>
    </div>
  </div>`;
}

const SAT = () => L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  { maxZoom: 20, maxNativeZoom: 18, attribution: 'Imágenes © Esri, Maxar, Earthstar Geographics' });
async function drawProjectMap(pid) {
  const el = $('#pmap'); if (!el) return;
  if (!window.L) { el.outerHTML = '<div class="map-off">Mapa no disponible (sin conexión a internet).</div>'; return; }
  const p = PRO[pid];
  const map = mapInst = L.map(el, { scrollWheelZoom: true, maxZoom: 20 }).setView([+p.lat || 5.3, +p.lon || -74.2], p.lat ? 17 : 6);
  SAT().addTo(map);
  let lay = { features: [] };
  try { lay = await api('GET', `/api/layout?proyecto=${pid}`); } catch { /* sin layout */ }
  if (mapInst !== map) return; // la vista se redibujó mientras cargaba el layout
  const propios = [], todos = [];
  for (const f of lay.features) {
    const n = f.nombre.toLowerCase();
    let st;
    if (f.mesa) st = f.propio ? { color: '#44d52d', weight: 1, fillColor: '#44d52d', fillOpacity: .55 } : { color: '#d3dd07', weight: .6, fillColor: '#d3dd07', fillOpacity: .15 };
    else if (/área útil|area util|cerramiento/.test(n)) st = { color: '#ffffff', weight: 2, dashArray: '6 4', fill: false };
    else if (/red|eléctric|electric/.test(n)) st = { color: '#ff5a4f', weight: 2.5 };
    else if (/v[ií]a/.test(n)) st = { color: '#ffd23f', weight: 2 };
    else st = { color: '#5ec8ff', weight: 2, fillOpacity: .25 };
    let layer;
    if (f.tipo === 'Polygon') layer = L.polygon(f.coords, st);
    else if (f.tipo === 'LineString') layer = L.polyline(f.coords, st);
    else layer = L.circleMarker(f.coords[0], { radius: 5, color: '#fff', weight: 1.5, fillColor: /insumo/.test(n) ? '#ff5a4f' : '#5ec8ff', fillOpacity: 1 });
    if (!f.mesa) layer.bindTooltip(esc(f.nombre));
    layer.addTo(mapInst);
    todos.push(...f.coords); if (f.propio) propios.push(...f.coords);
  }
  if (p.lat) L.circleMarker([+p.lat, +p.lon], { radius: 7, color: '#fff', weight: 2, fillColor: '#2d3a45', fillOpacity: 1 }).addTo(mapInst)
    .bindTooltip(esc(p.nombre.replace(/^GD\s+/, '')), { permanent: true, direction: 'top', offset: [0, -8], className: 'map-lbl' });
  const pts = propios.length ? propios : todos;
  if (pts.length) mapInst.fitBounds(pts, { padding: [20, 20], maxZoom: 19 });
  $('#pmapInfo').textContent = lay.archivo ? `Layout: ${lay.archivo}` : 'Sin layout en SharePoint';
  setTimeout(() => mapInst && mapInst.invalidateSize(), 200);
}

function costoForm(pid, id) {
  const c = id ? (COS[pid] || []).find(x => x.id === id) : { fecha: HOY, estado: 'Pagado' };
  modal(id ? 'Editar costo' : 'Nuevo costo', `<form id="cof" class="form-grid">
    <div class="full"><label>Concepto *</label><input name="concepto" required value="${esc(c.concepto)}" placeholder="Estudio de conexión – 50 % anticipo"></div>
    <div><label>Proveedor</label><input name="proveedor" value="${esc(c.proveedor)}"></div>
    <div><label>Área</label><select name="area"><option value="">—</option>${AREAS.map(a => `<option ${c.area === a ? 'selected' : ''}>${a}</option>`).join('')}</select></div>
    <div><label>Valor (COP) *</label><input name="valor" type="number" step="any" required value="${esc(c.valor)}"></div>
    <div><label>Fecha</label><input name="fecha" type="date" value="${esc(c.fecha)}"></div>
    <div><label>Estado</label><select name="estado">${['Presupuestado', 'Pendiente', 'Pagado'].map(s => `<option ${c.estado === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
    <div class="full"><label>Notas</label><input name="notas" value="${esc(c.notas)}"></div>
  </form>`, `${id ? `<button class="btn danger" style="margin-right:auto" onclick="delCosto(${id})">Eliminar</button>` : ''}<button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="saveCosto(${pid}, ${id || 'null'})">Guardar</button>`);
}
async function saveCosto(pid, id) {
  const f = $('#cof'); if (!f.reportValidity()) return;
  const d = formData(f); d.valor = +d.valor; d.proyecto_id = pid;
  await api(id ? 'PUT' : 'POST', id ? `/api/costos/${id}` : '/api/costos', d); closeModal(); await refresh(); toast('Costo guardado');
}
async function delCosto(id) { if (!confirm('¿Eliminar este costo?')) return; await api('DELETE', `/api/costos/${id}`); closeModal(); await refresh(); }

/** Avance de la fase de Desarrollo: Factibilidad (6 áreas) y Licenciamiento en paralelo; RTB cuando ambas llegan al 100 %. */
function devCard(p, m) {
  const fila = a => `<div class="dev-fila click" onclick="irArea('${a.ar}')" title="Ver los trámites de ${a.ar}"><span>${a.ar} <span class="ir">↓</span></span><div class="bar"><span style="width:${a.pct}%"></span></div><span class="num">${a.n ? `${a.d}/${a.n}` : '—'}</span></div>`;
  const fact = m.areas.filter(a => AREAS_FACT.includes(a.ar)), lic = m.areas.find(a => a.ar === 'Licenciamiento');
  return `<div class="card" style="margin-bottom:16px">
    <div class="card-head"><div><h2>Desarrollo ${etapaPill(p, m)}</h2><div class="muted small">Prefactibilidad superada con la firma del contrato${p.fecha_contrato ? ' (' + fmtD(p.fecha_contrato) + ')' : ''}. Lo que exige cada área está descrito en el Tablero.</div></div>
      ${m.listoRtb ? `<button class="btn primary" onclick="declararRtb(${p.id})">Declarar RTB →</button>` : ''}</div>
    <div class="card-pad dev-grid">
      <div><div class="dev-tit click" onclick="irArea('${AREAS_FACT.find(a => m.areas.find(x => x.ar === a)?.n) || 'Solapamientos'}')">Factibilidad <b>${m.fact}%</b></div>${fact.map(fila).join('')}</div>
      <div><div class="dev-tit click" onclick="irArea('Licenciamiento')">Licenciamiento <b>${m.lic}%</b></div>${fila(lic)}
        <div class="dev-rtb ${m.rtb || m.listoRtb ? 'ok' : ''}"><b>RTB</b><span>${m.rtb ? 'Alcanzado' : m.listoRtb ? 'Cumple: listo para declarar' : m.est ? 'Estimado: ' + fmtD(m.est.rtb) : ''}</span></div></div>
    </div>
  </div>`;
}
async function declararRtb(pid) {
  if (!confirm('¿Confirmas que el proyecto alcanzó RTB?')) return;
  await api('PUT', `/api/proyectos/${pid}`, { etapa: 'RTB alcanzado', estado: 'RTB alcanzado' });
  await refresh(); toast('Proyecto declarado RTB');
}

function tramTable(ts) {
  if (!ts.length) return '<div class="empty">Sin trámites. Usa “Agregar consulta”.</div>';
  return `<div class="table-wrap"><table><thead><tr><th>Entidad</th><th>Trámite</th><th>Radicado</th><th>Respuesta</th><th>Tiempo / plazo</th><th>Estado</th><th>Resultado</th></tr></thead><tbody>
  ${AREAS.map(ar => {
    const x = ts.filter(t => t.area === ar); if (!x.length) return '';
    return `<tr class="group-row" id="area-${slug(ar)}"><td colspan="7">${etapaDe(ar) === 'Factibilidad' ? 'Factibilidad · ' : ''}${ar} · ${x.filter(t => t.estado === 'Respondido').length}/${x.filter(t => t.estado !== 'No aplica').length}</td></tr>` + x.map(t => {
      const m = tm(t), e = ent(t.entidad_id), en = esEntregable(t);
      return `<tr class="click" onclick="openTramite(${t.id})">
        <td><b>${esc(e.sigla)}</b><div class="muted small">${en ? 'Entregable' : esc(e.tipo)}</div></td>
        <td>${esc(t.nombre)} ${t.adicional ? '<span class="tag acc">adicional</span>' : ''}${t.motivo ? `<div class="muted small">${esc(t.motivo)}</div>` : ''}${t.detalle ? `<div class="small" style="color:var(--accent-ink)">${esc(t.detalle)}</div>` : ''}</td>
        <td class="num">${en ? '—' : fmtD(t.fecha_radicado)}${t.radicado_num ? `<div class="muted small">${esc(t.radicado_num)}</div>` : ''}</td>
        <td class="num">${fmtD(t.fecha_respuesta)}</td>
        <td class="num">${en ? '—' : `${m.dias != null ? m.dias : '—'} / ${t.plazo_dias ?? 's.p.'}`}${m.nreq ? `<div class="muted small">${m.nreq} req.</div>` : ''}${m.nsub ? `<div class="small" style="color:#e0782f">${m.nsub} subsanación${m.nsub > 1 ? 'es' : ''}</div>` : ''}</td>
        <td>${semPill(t)}</td>
        <td>${en ? '' : resPill(t.resultado)}</td></tr>`;
    }).join('');
  }).join('')}</tbody></table></div>`;
}

function gantt(ts, start) {
  if (!ts.length) return '<div class="empty">Aún no hay trámites radicados.</div>';
  ts = [...ts].sort((a, b) => a.fecha_radicado.localeCompare(b.fecha_radicado));
  const lo = [start, ...ts.map(t => t.fecha_radicado)].filter(Boolean).sort()[0];
  const hiC = [HOY, ...ts.map(t => t.fecha_respuesta).filter(Boolean)].sort().pop();
  const a = D(lo).getTime(), b = addDays(D(hiC), 10).getTime(), span = b - a;
  const x = s => ((D(s).getTime() - a) / span * 100).toFixed(2);
  const ticks = []; let d = new Date(Date.UTC(D(lo).getUTCFullYear(), D(lo).getUTCMonth() + 1, 1));
  while (d.getTime() < b) { ticks.push(d); d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)); }
  const step = Math.ceil(ticks.length / 10);
  return `<div class="gantt">
    ${ts.map(t => {
      const m = tm(t), end = t.fecha_respuesta || HOY;
      const cls = t.fecha_respuesta ? (m.sem === 'late-resp' ? 'late' : '') : (m.sem === 'vencido' ? 'late' : 'pend');
      const evs = EV[t.id] || []; let open = null; const susp = [];
      let tipoAb = null;
      evs.forEach(e => { if (EV_ABRE.includes(e.tipo) && !open) { open = e.fecha; tipoAb = e.tipo; } else if (EV_CIERRA.includes(e.tipo) && open) { susp.push([open, e.fecha, tipoAb]); open = null; } });
      if (open) susp.push([open, end, tipoAb]);
      return `<div class="g-row"><div class="g-lbl" title="${esc(t.nombre)}"><b>${esc(ent(t.entidad_id).sigla)}</b> · ${esc(t.nombre)}</div>
        <div class="g-track" onclick="openTramite(${t.id})" style="cursor:pointer">
          <div class="g-bar ${cls}" style="left:${x(t.fecha_radicado)}%;width:${Math.max(.6, x(end) - x(t.fecha_radicado))}%" title="${fmtD(t.fecha_radicado)} → ${t.fecha_respuesta ? fmtD(end) : 'hoy'} · ${m.dias} d"></div>
          ${susp.map(([s, e, k], i) => `<div class="g-bar ${k === 'Observaciones del OR' ? 'subs' : 'susp'}" style="left:${x(s)}%;width:${Math.max(.4, x(e) - x(s))}%" title="${k === 'Observaciones del OR' ? 'Subsanación ' + (i + 1) : 'Requerimiento'}: ${fmtD(s)} → ${fmtD(e)}"></div>`).join('')}
        </div></div>`;
    }).join('')}
    <div class="g-axis"><div></div><div class="ticks">${ticks.filter((_, i) => i % step === 0).map(t => `<span style="left:${x(iso(t))}%">${MESES[t.getUTCMonth()]} ${String(t.getUTCFullYear()).slice(2)}</span>`).join('')}</div></div>
    <div style="position:absolute;top:0;bottom:18px;left:240px;right:0;pointer-events:none" class="g-today-wrap"><div class="g-today" style="left:${x(HOY)}%" title="Hoy"></div></div>
  </div>`;
}

// ------------------------------------------------------------ planificador
let plan = { figura: 'GD', kw: 990, dep: 'Boyacá', car: '', or: '', inicio: HOY, extra: [] };
function vPlanificador() {
  const cars = S.entidades.filter(e => AMB.includes(e.tipo)), ors = S.entidades.filter(e => e.tipo === 'Operador de red');
  const sugg = suggest;
  if (!plan.car || !ENT[plan.car]) plan.car = sugg(cars, plan.dep)[0]?.id || cars[0]?.id;
  if (!plan.or || !ENT[plan.or]) plan.or = sugg(ors, plan.dep)[0]?.id || ors[0]?.id;
  const items = routeItems(plan.figura, plan.kw, { car_id: plan.car, or_id: plan.or }, plan.extra);
  // simula: trámites sin radicar desde la fecha de inicio
  // todas las áreas avanzan en paralelo desde la firma del contrato; RTB = la que cierre de última
  let prev = plan.inicio; const rows = []; const ends = {};
  for (const ar of AREAS) {
    let end = plan.inicio;
    for (const it of items.filter(i => i.c.area === ar)) {
      const ex = it.entidad_id ? expected(it.entidad_id, it.c.id, it.c.plazo_dias) : { d: it.c.plazo_dias ?? 20, src: it.c.plazo_dias != null ? 'plazo legal' : 'supuesto (20 d)' };
      const s = addHabiles(plan.inicio, 5), e = addHabiles(s, ex.d);
      rows.push({ ...it, ex, s, e }); if (e > end) end = e;
    }
    ends[ar] = end; if (end > prev) prev = end;
  }
  const adds = S.catalogo.filter(c => !c.base && (c.figuras === '*' || c.figuras.split(',').includes(plan.figura)));
  return `${head('Planificador de ruta', 'Simula la ruta de trámites de un proyecto nuevo y estima su fecha de RTB con los tiempos reales registrados')}
  <div class="split">
    <div class="card">
      <div class="card-head"><h2>Ruta estimada</h2><span class="pill acc nodot">RTB estimado: ${fmtD(prev)}</span></div>
      <div class="table-wrap"><table><thead><tr><th>Trámite</th><th>Entidad</th><th class="r">Plazo legal</th><th class="r">Duración usada</th><th>Fuente</th><th>Fin estimado</th></tr></thead><tbody>
      ${AREAS.map(et => {
        const x = rows.filter(r => r.c.area === et); if (!x.length) return '';
        return `<tr class="group-row"><td colspan="6">${etapaDe(et) === 'Factibilidad' ? 'Factibilidad · ' : ''}${et} · cierre ${fmtD(ends[et])}</td></tr>` + x.map(r => `<tr>
          <td>${esc(r.c.nombre)} ${r.c.base ? '' : '<span class="tag acc">adicional</span>'}</td>
          <td>${r.entidad_id ? esc(ent(r.entidad_id).sigla) : `<span class="muted">${esc(r.c.entidad_tipo)}</span>`}</td>
          <td class="r num">${r.c.plazo_dias ?? '—'}</td><td class="r num">${r.ex.d} d</td>
          <td class="small muted">${r.ex.src}</td><td class="num">${fmtD(r.e)}</td></tr>`).join('');
      }).join('')}</tbody></table></div>
      <div class="card-pad"><div class="note">Supuestos: las áreas de Factibilidad y Licenciamiento avanzan en paralelo desde la firma del contrato, con 5 días hábiles de preparación antes de radicar. La duración usa la mediana real registrada para esa entidad (y ese trámite, si existe); si no hay histórico, usa el plazo legal.</div></div>
    </div>
    <div class="stack">
      <div class="card card-pad">
        <h2 style="margin-bottom:12px">Parámetros</h2>
        <div class="form-grid">
          <div><label>Figura</label><select onchange="plan.figura=this.value;render()">${Object.entries(FIGURAS).map(([k, v]) => `<option value="${k}" ${plan.figura === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
          <div><label>Capacidad (kW)</label><input type="number" value="${plan.kw}" onchange="plan.kw=+this.value;render()"></div>
          <div><label>Departamento</label><select onchange="plan.dep=this.value;plan.car='';plan.or='';render()">${DEPTOS.map(d => `<option ${plan.dep === d ? 'selected' : ''}>${d}</option>`).join('')}</select></div>
          <div><label>Inicio (contrato)</label><input type="date" value="${plan.inicio}" onchange="plan.inicio=this.value||HOY;render()"></div>
          <div><label>Autoridad ambiental</label><select onchange="plan.car=+this.value;render()">${entOptions(cars, plan.car, sugg(cars, plan.dep))}</select></div>
          <div><label>Operador de red</label><select onchange="plan.or=+this.value;render()">${entOptions(ors, plan.or, sugg(ors, plan.dep))}</select></div>
        </div>
      </div>
      <div class="card">
        <div class="card-head"><h2>Hallazgos / consultas adicionales</h2></div>
        <div class="checklist" style="border:0;border-radius:0">${adds.map(c => `
          <label><input type="checkbox" ${plan.extra.includes(c.id) ? 'checked' : ''} onchange="togglePlan(${c.id})">
          <span>${esc(c.motivo || c.nombre)}<div class="muted small">${esc(c.nombre)}</div></span><span class="tag">${esc(c.area)}</span></label>`).join('')}</div>
      </div>
      <button class="btn primary" onclick="projectForm(null, {figura: plan.figura, capacidad_kw: plan.kw, departamento: plan.dep, car_id: plan.car, or_id: plan.or, fecha_contrato: plan.inicio, extra: plan.extra})">Crear proyecto con esta ruta →</button>
    </div>
  </div>`;
}
function togglePlan(id) { plan.extra = plan.extra.includes(id) ? plan.extra.filter(x => x !== id) : [...plan.extra, id]; render(); }

/** Trámites aplicables a un proyecto según figura, capacidad y adicionales elegidos. */
function routeItems(figura, kw, p, extra = []) {
  return S.catalogo.filter(c => {
    const okFig = c.figuras === '*' || (c.figuras || '').split(',').includes(figura);
    if (!okFig) return false;
    if (c.base) return true;
    if (c.codigo === 'UPME-CON' && kw >= 5000) return true;
    return extra.includes(c.id);
  }).sort((a, b) => AREAS.indexOf(a.area) - AREAS.indexOf(b.area) || a.orden - b.orden)
    .map(c => ({ c, entidad_id: resolveEnt(c, p) }));
}
function resolveEnt(c, p) {
  if (c.entidad_tipo === 'CAR') return p.car_id ? +p.car_id : null;
  if (c.entidad_tipo === 'Operador de red') return p.or_id ? +p.or_id : null;
  if (c.entidad_tipo === 'Municipal') return p.mun_id ? +p.mun_id : null;
  if (c.entidad_sigla) return S.entidades.find(e => e.sigla === c.entidad_sigla)?.id || null;
  return null;
}
/** Entidades con jurisdicción en el departamento; primero las que lo tienen como jurisdicción principal. */
function suggest(list, dep) {
  const deps = e => (e.departamentos || '').split(',');
  return list.filter(e => deps(e).includes(dep)).sort((a, b) => (deps(a)[0] === dep ? 0 : 1) - (deps(b)[0] === dep ? 0 : 1) || (a.tipo === 'CAR' ? 0 : 1) - (b.tipo === 'CAR' ? 0 : 1));
}
function entOptions(list, sel, sugg = [], blank = '') {
  const sIds = new Set(sugg.map(e => e.id));
  const o = e => `<option value="${e.id}" ${+sel === e.id ? 'selected' : ''}>${esc(e.sigla)} – ${esc(e.nombre)}</option>`;
  return (blank ? `<option value="">${blank}</option>` : '') +
    (sugg.length ? `<optgroup label="Sugeridas para el departamento">${sugg.map(o).join('')}</optgroup><optgroup label="Todas">${list.filter(e => !sIds.has(e.id)).map(o).join('')}</optgroup>` : list.map(o).join(''));
}

// ------------------------------------------------------------ comparativo
let fC = { grupo: 'Autoridades ambientales', dep: '', figura: '', por: 'entidad', pend: false };
function vComparativo() {
  const tipos = fC.grupo ? GRUPOS_ENT[fC.grupo] : null;
  const filter = (t, p) => (!tipos || tipos.includes(ent(t.entidad_id).tipo)) && (!fC.dep || p.departamento === fC.dep) && (!fC.figura || p.figura === fC.figura);
  const key = fC.por === 'entidad' ? t => t.entidad_id : t => (CAT[t.catalogo_id]?.nombre || t.nombre);
  const rows = stats(filter, key, fC.pend).map(s => ({ ...s, id: fC.por === 'entidad' ? +s.k : null, label: fC.por === 'entidad' ? ent(+s.k).sigla : s.k }));
  const max = Math.max(1, ...rows.map(s => Math.max(s.prom || 0, s.plazo || 0)));
  const deps = [...new Set(S.proyectos.map(p => p.departamento).filter(Boolean))].sort();
  const allResp = rows.reduce((a, s) => a + s.resp, 0);
  return `${head('Comparativo de entidades', 'Tiempos reales de respuesta de cada entidad frente a su plazo legal, actualizados con cada trámite registrado')}
  <div class="card card-pad" style="margin-bottom:16px"><div class="filters">
    <select onchange="fC.grupo=this.value;render()"><option value="">Todas las entidades</option>${Object.keys(GRUPOS_ENT).map(g => `<option ${fC.grupo === g ? 'selected' : ''}>${g}</option>`).join('')}</select>
    <select onchange="fC.dep=this.value;render()"><option value="">Todos los departamentos</option>${deps.map(d => `<option ${fC.dep === d ? 'selected' : ''}>${esc(d)}</option>`).join('')}</select>
    <select onchange="fC.figura=this.value;render()"><option value="">Todas las figuras</option>${Object.entries(FIGURAS).map(([k, v]) => `<option value="${k}" ${fC.figura === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
    <select onchange="fC.por=this.value;render()"><option value="entidad" ${fC.por === 'entidad' ? 'selected' : ''}>Agrupar por entidad</option><option value="tramite" ${fC.por === 'tramite' ? 'selected' : ''}>Agrupar por tipo de trámite</option></select>
    <label style="display:flex;gap:6px;align-items:center;margin:0"><input type="checkbox" ${fC.pend ? 'checked' : ''} onchange="fC.pend=this.checked;render()"> Incluir trámites pendientes (tiempo transcurrido)</label>
  </div></div>
  ${!rows.length ? '<div class="card empty">No hay trámites radicados con estos filtros.</div>' : `
  <div class="kpis">
    ${kpi('Grupos comparados', rows.length, fC.por === 'entidad' ? 'entidades' : 'tipos de trámite')}
    ${kpi('Trámites radicados', rows.reduce((a, s) => a + s.n, 0), `${allResp} con respuesta`)}
    ${kpi('Vencidos hoy', rows.reduce((a, s) => a + s.venc, 0), 'sin respuesta y fuera de plazo', rows.some(s => s.venc) ? 'bad' : 'ok')}
    ${kpi('Promedio general', r1(avg(rows.flatMap(s => (fC.pend ? s.ts : s.ts.filter(t => t.fecha_respuesta)).map(t => tm(t).dias)))), 'días de respuesta')}
  </div>
  <div class="grid" style="grid-template-columns:minmax(0,1fr)">
    <div class="card"><div class="card-head"><h2>Tiempo promedio de respuesta (días)</h2><span class="muted small">Descuenta el tiempo suspendido por requerimientos</span></div>
      <div class="card-pad">${hbars(rows, max)}</div></div>
    <div class="card"><div class="table-wrap"><table><thead><tr>
      <th>${fC.por === 'entidad' ? 'Entidad' : 'Trámite'}</th>${fC.por === 'entidad' ? '<th>Tipo</th>' : ''}<th class="r">Radicados</th><th class="r">Respondidos</th><th class="r">Pendientes</th><th class="r">Vencidos</th>
      <th class="r">Promedio</th><th class="r">Mediana</th><th class="r">Máximo</th><th class="r">Plazo legal</th><th class="r">% en plazo</th><th class="r">% con requerimiento</th></tr></thead><tbody>
      ${rows.map(s => `<tr class="click" onclick="${kref(s.id ?? s.k)}">
        <td><b>${esc(s.label)}</b>${s.id ? `<div class="muted small">${esc(ent(s.id).nombre)}</div>` : ''}</td>${fC.por === 'entidad' ? `<td class="small">${esc(ent(s.id).tipo)}</td>` : ''}
        <td class="r num">${s.n}</td><td class="r num">${s.resp}</td><td class="r num">${s.pend}</td>
        <td class="r num">${s.venc ? `<span class="pill bad">${s.venc}</span>` : '0'}</td>
        <td class="r num"><b>${r1(s.prom)}</b></td><td class="r num">${r1(s.med)}</td><td class="r num">${s.max ?? '—'}</td>
        <td class="r num">${s.plazo ?? 's.p.'}</td>
        <td class="r num">${s.enPlazo == null ? '—' : `<span class="pill ${s.enPlazo >= 80 ? 'ok' : s.enPlazo >= 50 ? 'warn' : 'bad'}">${s.enPlazo}%</span>`}</td>
        <td class="r num">${s.req}%</td></tr>`).join('')}
    </tbody></table></div></div>
  </div>`}`;
}

function entityDrawer(k) {
  const isEnt = typeof k === 'number';
  const ts = S.tramites.filter(t => t.fecha_radicado && (isEnt ? t.entidad_id === k : (CAT[t.catalogo_id]?.nombre || t.nombre) === k));
  const title = isEnt ? `${ent(k).sigla}` : k;
  const sub = isEnt ? `${ent(k).nombre} · ${ent(k).tipo}` : 'Tipo de trámite';
  const by = stats(t => ts.includes(t), isEnt ? t => (CAT[t.catalogo_id]?.nombre || t.nombre) : t => ent(t.entidad_id).sigla, false);
  openDrawerId = null;
  drawer(`<div class="modal-head"><div><h2>${esc(title)}</h2><div class="muted small">${esc(sub)}</div></div><button class="x" onclick="closeDrawer()">×</button></div>
  <div class="drawer-body">
    <h3 style="margin-bottom:8px">${isEnt ? 'Por tipo de trámite' : 'Por entidad'}</h3>
    <div class="table-wrap card" style="margin-bottom:16px"><table><thead><tr><th>${isEnt ? 'Trámite' : 'Entidad'}</th><th class="r">n</th><th class="r">Prom.</th><th class="r">Plazo</th><th class="r">% en plazo</th></tr></thead><tbody>
    ${by.map(s => `<tr><td>${esc(s.k)}</td><td class="r num">${s.n}</td><td class="r num">${r1(s.prom)}</td><td class="r num">${s.plazo ?? 's.p.'}</td><td class="r num">${s.enPlazo ?? '—'}${s.enPlazo != null ? '%' : ''}</td></tr>`).join('')}
    </tbody></table></div>
    <h3 style="margin-bottom:8px">Trámites (${ts.length})</h3>
    <div class="table-wrap card"><table><tbody>${ts.map(t => `<tr class="click" onclick="openTramite(${t.id})">
      <td><b>${esc(PRO[t.proyecto_id]?.nombre)}</b><div class="muted small">${esc(isEnt ? t.nombre : ent(t.entidad_id).sigla)} · radicado ${fmtD(t.fecha_radicado)}</div></td>
      <td>${semPill(t)}</td></tr>`).join('')}</tbody></table></div>
  </div>`);
}

// ------------------------------------------------------------ catálogo
let catTab = 'entidades', fE = { q: '', tipo: '' };
function vCatalogo() {
  const tabs = `<div class="tabs"><button class="${catTab === 'entidades' ? 'on' : ''}" onclick="catTab='entidades';render()">Entidades (${S.entidades.length})</button><button class="${catTab === 'tramites' ? 'on' : ''}" onclick="catTab='tramites';render()">Tipos de trámite (${S.catalogo.length})</button></div>`;
  if (catTab === 'entidades') {
    const list = S.entidades.filter(e => (!fE.tipo || e.tipo === fE.tipo) && (!fE.q || `${e.sigla} ${e.nombre} ${e.departamentos}`.toLowerCase().includes(fE.q.toLowerCase())));
    return `${head('Catálogo', 'Entidades consultadas y tipos de trámite con su plazo legal de referencia', `<button class="btn primary" onclick="entityForm()">+ Nueva entidad</button>`)}${tabs}
    <div class="card"><div class="card-head"><div class="filters">
      <input placeholder="Buscar…" value="${esc(fE.q)}" oninput="fE.q=this.value;rerenderList()">
      <select onchange="fE.tipo=this.value;render()"><option value="">Todos los tipos</option>${TIPOS_ENT.map(t => `<option ${fE.tipo === t ? 'selected' : ''}>${t}</option>`).join('')}</select>
    </div><span class="muted small">${list.length}</span></div>
    <div class="table-wrap"><table><thead><tr><th>Sigla</th><th>Nombre</th><th>Tipo</th><th>Departamentos (jurisdicción)</th><th class="r">Trámites</th><th></th></tr></thead><tbody>
    ${list.map(e => `<tr><td><b>${esc(e.sigla)}</b></td><td>${esc(e.nombre)}</td><td class="small">${esc(e.tipo)}</td><td class="small muted">${esc(e.departamentos || 'Nacional')}</td>
      <td class="r num">${S.tramites.filter(t => t.entidad_id === e.id).length}</td><td class="r"><button class="btn sm" onclick="entityForm(${e.id})">Editar</button></td></tr>`).join('')}
    </tbody></table></div></div>`;
  }
  return `${head('Catálogo', 'Entidades consultadas y tipos de trámite con su plazo legal de referencia', `<button class="btn primary" onclick="catForm()">+ Nuevo tipo de trámite</button>`)}${tabs}
  <div class="note warn" style="margin-bottom:12px">Los plazos son referenciales. Valídalos en el diagnóstico normativo y ajústalos aquí; los trámites nuevos toman el plazo del catálogo.</div>
  <div class="card"><div class="table-wrap"><table><thead><tr><th>Código</th><th>Trámite</th><th>Entidad</th><th>Etapa</th><th class="r">Plazo</th><th>Base legal</th><th>Figuras</th><th>Tipo</th><th></th></tr></thead><tbody>
  ${S.catalogo.slice().sort((a, b) => b.base - a.base || AREAS.indexOf(a.area) - AREAS.indexOf(b.area) || a.orden - b.orden).map(c => `<tr>
    <td class="small"><b>${esc(c.codigo)}</b></td><td>${esc(c.nombre)}${c.motivo ? `<div class="muted small">Cuando: ${esc(c.motivo)}</div>` : ''}</td>
    <td class="small">${esc(c.entidad_sigla || c.entidad_tipo)}</td><td class="small">${esc(c.area)}${c.clase === 'entregable' ? ' <span class="tag">entregable</span>' : ''}</td>
    <td class="r num">${c.plazo_dias ?? '—'} <span class="muted small">${c.plazo_dias != null ? (c.tipo_plazo === 'calendario' ? 'cal.' : 'háb.') : ''}</span></td>
    <td class="small muted">${esc(c.base_legal)}</td><td class="small">${c.figuras === '*' ? 'Todas' : esc(c.figuras)}</td>
    <td>${c.base ? '<span class="tag">base</span>' : '<span class="tag acc">adicional</span>'}</td>
    <td class="r"><button class="btn sm" onclick="catForm(${c.id})">Editar</button></td></tr>`).join('')}
  </tbody></table></div></div>`;
}

// ------------------------------------------------------------ sharepoint
const SP = { cfg: null, estado: null, scan: null, sel: new Set(), busy: false, err: null };
const baseName = p => (p || '').split(/[\\/]/).pop();
function vSharepoint() {
  const c = SP.cfg;
  if (!c) return `${head('SharePoint', 'Sincronización automática con la carpeta del Pipeline')}<div class="card card-pad muted">Cargando configuración…</div>`;
  const etapas = (c.etapas || '').split(',').filter(Boolean);
  const est = SP.estado || {};
  const res = SP.scan;
  let body = '';
  if (res) {
    if (res.error) body = `<div class="note warn">${esc(res.error)}</div>`;
    else {
      const groups = {};
      res.proposals.forEach(p => (groups[p.sp_ref] ||= []).push(p));
      const pend = res.proposals.filter(p => p.kind === 'evento' && !p.aplicado);
      body = `<div class="card" style="margin-top:16px">
        <div class="card-head"><h2>Resultado del escaneo</h2>
          <div class="actions"><span class="muted small">${pend.length} eventos nuevos · ${res.proposals.filter(p => p.kind === 'evento' && p.aplicado).length} ya sincronizados</span>
          <button class="btn primary" ${SP.busy || !SP.sel.size ? 'disabled' : ''} onclick="spApply()">Aplicar seleccionados (${SP.sel.size})</button></div></div>
        ${Object.entries(groups).map(([ref, ps]) => spGroup(ref, ps)).join('')}
      </div>`;
    }
  }
  return `${head('SharePoint', 'Lee la carpeta del Pipeline (sincronizada con OneDrive) y alimenta proyectos, radicados y respuestas a partir de los documentos')}
  <div class="card card-pad">
    <div class="form-grid">
      <div class="full"><label>Carpeta del Pipeline (sincronizada en este PC)</label><input id="spRoot" value="${esc(c.pipeline_root)}">
        <div class="hint">${c.existe ? '✓ Carpeta encontrada' : '<span style="color:var(--bad)">No se encuentra la carpeta. Sincroniza la biblioteca “Desarrollo GD” con OneDrive o corrige la ruta.</span>'}</div></div>
      <div class="full"><label>Etapas del pipeline a leer</label><div class="filters">${(c.carpetas || []).map(f => `<label style="display:flex;gap:6px;align-items:center;margin:0;color:var(--text);font-size:13px"><input type="checkbox" class="spEt" value="${esc(f)}" ${etapas.includes(f) ? 'checked' : ''}> ${esc(f)}</label>`).join('') || '<span class="muted">—</span>'}</div></div>
      <div><label>Sincronización automática</label><select id="spAuto"><option value="1" ${c.auto === '1' ? 'selected' : ''}>Activada</option><option value="0" ${c.auto !== '1' ? 'selected' : ''}>Desactivada</option></select>
        <div class="hint">Aplica sola lo que tiene fecha clara; lo dudoso queda aquí para revisión.</div></div>
      <div><label>Cada (minutos)</label><input id="spInt" type="number" min="5" value="${esc(c.intervalo_min)}"></div>
      <div class="full"><label>Dirección web de la carpeta 01 Pipeline en SharePoint (para “abrir en SharePoint”)</label><input id="spBase" value="${esc(c.sharepoint_base)}"></div>
    </div>
    <div class="actions" style="margin-top:14px">
      <button class="btn" onclick="spSave()">Guardar configuración</button>
      <button class="btn primary" ${SP.busy ? 'disabled' : ''} onclick="spScan()">${SP.busy ? 'Leyendo carpetas y PDFs…' : 'Escanear ahora'}</button>
      <span class="muted small">Última sincronización automática: ${est.ultima ? esc(est.ultima.replace('T', ' ')) : 'aún no'}${est.resultado ? ` · ${est.resultado.proyectos} proyectos nuevos, ${est.resultado.eventos} eventos` : ''}${est.error ? ` · <span style="color:var(--bad)">${esc(est.error)}</span>` : ''}</span>
    </div>
  </div>
  <div class="note" style="margin-top:12px"><b>Cómo lee las carpetas:</b> cada subcarpeta de <i>4 Conexión/ECS</i> es un GD independiente (Monsalve 1, 2, 3…) y comparte las consultas de <i>2 Consultas</i>. Radicado = fecha del pantallazo de envío o de la carta. Respuesta = fecha oficial del PDF; si pide información se registra como requerimiento y el resultado (favorable / con condiciones) se lee del texto. Ante el OR: solicitud de insumos, insumos recibidos y “Documentos enviados a EBSA” (ECS radicado), por GD. Contrato = PDF firmado en <i>3 Jurídico/Contrato</i>.</div>
  ${body}`;
}
vSharepoint.after = async () => { if (!SP.cfg) { await spLoadCfg(); render(); } };
async function spLoadCfg() { const r = await api('GET', '/api/sync/config'); SP.cfg = r.config; SP.estado = r.estado; }
function spGroup(ref, ps) {
  const pr = ps.find(p => p.kind === 'proyecto'), d = pr?.data || {};
  const evs = ps.filter(p => p.kind === 'evento' && !p.aplicado), done = ps.filter(p => p.kind === 'evento' && p.aplicado).length;
  const avisos = ps.filter(p => p.kind === 'aviso');
  const entLbl = p => p.entidad_sigla || (p.entidad_rol === 'OR' ? (d.or_sigla || 'Operador de red') : (d.car_sigla || 'CAR'));
  const catName = p => S.catalogo.find(c => c.codigo === p.codigo)?.nombre || p.descripcion;
  const chg = pr?.existe ? Object.keys(pr.cambios || {}) : null;
  return `<div style="border-top:1px solid var(--border)">
    <div class="card-pad" style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center">
      <div><b style="font-size:15px">${esc(d.nombre)}</b> <span class="muted small">${esc(d.codigo || '')} · ${esc(d.municipio || '?')}, ${esc(d.departamento || '?')} · predio ${esc(d.predio || '?')} · ${d.capacidad_kw ? (+d.capacidad_kw).toLocaleString('es-CO') + ' kW' : ''} · OR ${esc(d.or_sigla || '?')} · CAR ${esc(d.car_sigla || 'por depto.')}${d.fecha_contrato ? ' · contrato ' + fmtD(d.fecha_contrato) : ''}</span></div>
      ${pr?.existe ? (chg.length ? `<span class="pill info">Actualiza: ${esc(chg.join(', '))}</span>` : `<a class="pill ok" href="#/proyecto/${pr.proyecto_id}">Ya registrado</a>`) : `<label style="display:flex;gap:6px;align-items:center;margin:0;color:var(--text)"><input type="checkbox" ${SP.sel.has(pr.id) ? 'checked' : ''} onchange="spToggle('${pr.id}', this.checked)"> <span class="pill acc">Proyecto nuevo</span></label>`}
    </div>
    ${avisos.map(a => `<div class="note warn" style="margin:0 18px 10px">${esc(a.texto)}</div>`).join('')}
    ${evs.length ? `<div class="table-wrap"><table><thead><tr><th></th><th>Entidad</th><th>Trámite</th><th>Evento</th><th>Fecha</th><th>Origen fecha</th><th>Resultado / nota</th><th>Documento</th></tr></thead><tbody>
    ${evs.map(p => `<tr>
      <td><input type="checkbox" ${SP.sel.has(p.id) ? 'checked' : ''} onchange="spToggle('${p.id}', this.checked)"></td>
      <td><b>${esc(entLbl(p))}</b></td><td class="small">${esc(catName(p))}</td>
      <td>${esc(p.tipo)}</td><td class="num">${fmtD(p.fecha)}</td>
      <td><span class="pill ${p.confianza === 'alta' ? 'ok' : 'warn'}">${esc(p.origen_fecha)}</span></td>
      <td class="small">${p.resultado ? resPill(p.resultado) : ''} ${p.radicado_num ? `<span class="muted">rad. ${esc(p.radicado_num)}</span>` : ''} ${p.nota ? `<div style="color:var(--warn)">${esc(p.nota)}</div>` : ''}</td>
      <td class="small muted" title="${esc(p.fuente)}">${esc(baseName(p.fuente))}</td></tr>`).join('')}
    </tbody></table></div>` : `<div class="card-pad muted small" style="padding-top:0">Sin eventos nuevos${done ? ` · ${done} ya sincronizados` : ''}.</div>`}
  </div>`;
}
function spToggle(id, on) { on ? SP.sel.add(id) : SP.sel.delete(id); const y = scrollY; render(); scrollTo(0, y); }
async function spSave() {
  const etapas = $$('.spEt').filter(i => i.checked).map(i => i.value).join(',');
  await api('POST', '/api/sync/config', { pipeline_root: $('#spRoot').value.trim(), etapas, auto: $('#spAuto').value, intervalo_min: $('#spInt').value || '30', sharepoint_base: $('#spBase').value.trim() });
  await spLoadCfg(); render(); toast('Configuración guardada');
}
async function spScan() {
  SP.busy = true; render();
  try {
    SP.scan = await api('POST', '/api/sync/scan');
    SP.sel = new Set((SP.scan.proposals || []).filter(p => (p.kind === 'proyecto' && !p.existe) || (p.kind === 'proyecto' && Object.keys(p.cambios || {}).length) || (p.kind === 'evento' && !p.aplicado && p.confianza === 'alta')).map(p => p.id));
  } catch (e) { SP.scan = { error: e.message }; }
  SP.busy = false; render();
}
async function spApply() {
  const props = SP.scan.proposals;
  const chosen = props.filter(p => SP.sel.has(p.id));
  const refs = new Set(chosen.filter(p => p.kind === 'evento').map(p => p.sp_ref));
  // los eventos necesitan su proyecto: se incluye la ficha del proyecto aunque no se haya marcado
  const items = [...props.filter(p => p.kind === 'proyecto' && (SP.sel.has(p.id) || refs.has(p.sp_ref))), ...chosen.filter(p => p.kind === 'evento')];
  SP.busy = true; render();
  try {
    const r = await api('POST', '/api/sync/apply', { items });
    await load(); toast(`Sincronizado: ${r.proyectos} proyectos nuevos, ${r.eventos} eventos, ${r.tramites_nuevos} trámites adicionales`);
    SP.busy = false; await spScan();
  } catch (e) { SP.busy = false; alert('Error: ' + e.message); render(); }
}

// ------------------------------------------------------------ documentos de SharePoint
const rutaDoc = (p, fuente) => [p.carpeta, fuente].filter(Boolean).join('\\');
function spUrl(ruta) {
  const base = (CFG.sharepoint_base || '').replace(/\/+$/, '');
  return base + '/' + ruta.split(/[\\/]/).map(encodeURIComponent).join('/');
}
const docLinks = (p, fuente) => !p.carpeta ? '' :
  ` · <a href="${esc(spUrl(rutaDoc(p, fuente)))}" target="_blank" rel="noopener">abrir en SharePoint</a> · <a href="#" onclick="abrirDoc(event, ${p.id}, '${encodeURIComponent(fuente)}')">abrir en este PC</a>`;
async function abrirDoc(ev, pid, fuente) {
  ev.preventDefault();
  try { await api('POST', '/api/abrir', { ruta: rutaDoc(PRO[pid], decodeURIComponent(fuente)) }); toast('Abriendo el documento…'); }
  catch (e) { alert(e.message); }
}

// ------------------------------------------------------------ calidad de datos
function problemasCalidad() {
  const out = [];
  const add = (sev, texto, accion) => out.push({ sev, texto, accion });
  const act = S.proyectos.filter(p => p.estado === 'Activo');
  for (const p of act) {
    const ir = `location.hash='#/proyecto/${p.id}'`;
    if (p.lat == null || p.lat === '') add('warn', `${p.nombre}: sin coordenadas`, ir);
    if (!p.circuito) add('info', `${p.nombre}: sin circuito de conexión registrado`, ir);
    if (!p.or_id) add('warn', `${p.nombre}: sin operador de red`, ir);
    if (!p.fecha_contrato) add('warn', `${p.nombre}: sin fecha de firma del contrato`, ir);
    const mismo = act.filter(x => x.id !== p.id && x.lat && +x.lat === +p.lat && +x.lon === +p.lon);
    if (p.lat && mismo.length && p.id < mismo[0].id) add('warn', `${p.nombre} y ${mismo.map(x => x.nombre).join(', ')} tienen exactamente las mismas coordenadas`, ir);
  }
  const porCirc = {};
  act.filter(p => p.circuito && p.capacidad_se_mva).forEach(p => (porCirc[`${p.or_id}|${p.circuito}`] ||= []).push(p));
  for (const ps of Object.values(porCirc)) {
    const caps = [...new Set(ps.map(p => +p.capacidad_se_mva))];
    if (caps.length > 1) add('bad', `Circuito ${ps[0].circuito}: los insumos del OR reportan capacidades de subestación distintas (${ps.map(p => `${p.nombre.replace(/^GD\s+/, '')}: ${String(p.capacidad_se_mva).replace('.', ',')} MVA`).join(' · ')})`, `location.hash='#/red'`);
  }
  const actIds = new Set(act.map(p => p.id));
  for (const t of S.tramites.filter(t => actIds.has(t.proyecto_id) && t.estado !== 'No aplica')) {
    const nom = `${PRO[t.proyecto_id].nombre} · ${t.nombre}`, ir = `openTramite(${t.id})`;
    if (!t.entidad_id) add('warn', `${nom}: sin entidad asignada`, ir);
    if (!esEntregable(t) && t.fecha_respuesta && !t.fecha_radicado) add('warn', `${nom}: respondido sin fecha de radicado`, ir);
    if (t.fecha_radicado && t.fecha_respuesta && t.fecha_respuesta < t.fecha_radicado) add('bad', `${nom}: la respuesta es anterior al radicado`, ir);
    if (/No se encontraron P50/.test(t.detalle || '')) add('info', `${nom}: no se pudieron leer P50/P75/P90 del reporte`, ir);
    if (t.estado === 'Respondido' && !esEntregable(t) && !t.resultado) add('info', `${nom}: respondido sin resultado registrado`, ir);
  }
  for (const a of (SYNCST.avisos || [])) add('warn', `SharePoint · ${(a.sp_ref || '').split('#')[1] || ''}: ${a.texto}`, `location.hash='#/sharepoint'`);
  const orden = { bad: 0, warn: 1, info: 2 };
  return out.sort((a, b) => orden[a.sev] - orden[b.sev]);
}
function calidadCard() {
  const ps = problemasCalidad();
  return `<div class="card">
    <div class="card-head"><h2>Calidad de datos</h2><span class="muted small">${ps.length}</span></div>
    <div class="alerts">${ps.length ? ps.slice(0, 12).map(x => `<div class="alert" onclick="${x.accion}">
      <div class="top"><span class="pill ${x.sev}">${x.sev === 'bad' ? 'Inconsistencia' : x.sev === 'warn' ? 'Revisar' : 'Falta dato'}</span></div>
      <div class="small">${esc(x.texto)}</div></div>`).join('') + (ps.length > 12 ? `<div class="empty small">y ${ps.length - 12} más…</div>` : '')
      : '<div class="empty">Sin problemas detectados.</div>'}</div>
  </div>`;
}

// ------------------------------------------------------------ mis pendientes
let fPend = { resp: ls.get('responsable') || '', horizonte: '30', proyecto: '' };
const responsables = () => [...new Set([...S.tramites.map(t => t.responsable), ...S.proyectos.map(p => p.responsable)].filter(Boolean))].sort();
function pendientes() {
  const act = new Set(S.proyectos.filter(p => p.estado === 'Activo').map(p => p.id));
  const lim = addHabiles(HOY, +fPend.horizonte || 30);
  return S.tramites.filter(t => act.has(t.proyecto_id) && t.estado !== 'No aplica' && !t.fecha_respuesta)
    .filter(t => !fPend.resp || (t.responsable || PRO[t.proyecto_id].responsable) === fPend.resp)
    .filter(t => !fPend.proyecto || t.proyecto_id === +fPend.proyecto)
    .map(t => {
      const m = tm(t);
      const fecha = t.compromiso || m.vence || null;
      const motivo = t.compromiso ? 'Compromiso' : m.vence ? 'Vence plazo legal' : !t.fecha_radicado ? (esEntregable(t) ? 'Entregable pendiente' : 'Por radicar') : 'En trámite';
      return { t, fecha, motivo, atrasado: fecha && fecha < HOY };
    })
    .filter(x => !x.fecha || x.fecha <= lim)
    .sort((a, b) => (a.fecha || '9999').localeCompare(b.fecha || '9999'));
}
function vPendientes() {
  const ps = pendientes(), resps = responsables();
  const activos = S.proyectos.filter(p => p.estado === 'Activo').sort((a, b) => a.nombre.localeCompare(b.nombre));
  const grupo = (tit, xs) => xs.length ? `<tr class="group-row"><td colspan="5">${esc(tit)} · ${xs.length}</td></tr>` + xs.map(({ t, fecha, motivo, atrasado }) => `
    <tr class="click" onclick="openTramite(${t.id})">
      <td><b>${esc(t.area)}</b><div class="muted small">${esc(ent(t.entidad_id).sigla)}</div></td>
      <td>${esc(t.nombre)}</td>
      <td>${esc(t.responsable || PRO[t.proyecto_id].responsable || '—')}</td>
      <td class="num">${fecha ? fmtD(fecha) : '—'}<div class="small" style="color:${atrasado ? 'var(--bad)' : 'var(--muted)'}">${motivo}</div></td>
      <td>${semPill(t)}</td></tr>`).join('') : '';
  const porProyecto = [...new Set(ps.map(x => x.t.proyecto_id))].map(id => PRO[id]).filter(Boolean).sort((a, b) => a.nombre.localeCompare(b.nombre));
  return `${head('Mis pendientes', 'Trámites y entregables sin cerrar, agrupados por proyecto y ordenados por fecha compromiso o vencimiento legal', `<button class="btn" onclick="resumenSemanal()">Resumen semanal</button>`)}
  <div class="card card-pad" style="margin-bottom:16px"><div class="filters">
    <select onchange="fPend.proyecto=this.value;render()"><option value="">Todos los proyectos</option>${activos.map(p => `<option value="${p.id}" ${+fPend.proyecto === p.id ? 'selected' : ''}>${esc(p.nombre)}</option>`).join('')}</select>
    <select onchange="fPend.resp=this.value;ls.set('responsable',this.value);render()"><option value="">Todos los responsables</option>${resps.map(r => `<option ${fPend.resp === r ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select>
    <select onchange="fPend.horizonte=this.value;render()">${[['5', 'Próxima semana'], ['10', 'Próximas 2 semanas'], ['30', 'Próximo mes y medio'], ['9999', 'Todo']].map(([v, l]) => `<option value="${v}" ${fPend.horizonte === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
    <span class="muted small">El responsable y la fecha compromiso se asignan en “Editar datos del trámite”. Si un trámite no tiene responsable, se usa el del proyecto.</span>
  </div></div>
  <div class="card">${ps.length ? `<div class="table-wrap"><table><thead><tr><th>Área</th><th>Trámite</th><th>Responsable</th><th>Fecha</th><th>Estado</th></tr></thead><tbody>
    ${porProyecto.map(p => grupo(p.nombre, ps.filter(x => x.t.proyecto_id === p.id))).join('')}</tbody></table></div>` : '<div class="empty">No hay pendientes con estos filtros.</div>'}</div>`;
}
function resumenSemanal() {
  const ps = pendientes(), act = S.proyectos.filter(p => p.estado === 'Activo');
  const lineas = [`RESUMEN SEMANAL – DESARROLLO GD (${fmtD(HOY)})`, ''];
  lineas.push('AVANCE DE PROYECTOS');
  act.forEach(p => { const m = pm(p); lineas.push(`• ${p.nombre}: Factibilidad ${m.fact} % · Licenciamiento ${m.lic} % · RTB estimado ${m.est ? fmtD(m.est.rtb) : 'alcanzado'}`); });
  const venc = S.tramites.filter(t => act.some(p => p.id === t.proyecto_id) && tm(t).sem === 'vencido');
  lineas.push('', `TRÁMITES VENCIDOS (${venc.length})`);
  venc.forEach(t => lineas.push(`• ${PRO[t.proyecto_id].nombre} – ${ent(t.entidad_id).sigla}: ${t.nombre} (radicado ${fmtD(t.fecha_radicado)}, ${-tm(t).rest} días hábiles de atraso)`));
  const semana = ps.filter(x => x.fecha && x.fecha <= addHabiles(HOY, 5));
  lineas.push('', `PENDIENTES DE ESTA SEMANA (${semana.length})`);
  semana.forEach(({ t, fecha, motivo }) => lineas.push(`• ${PRO[t.proyecto_id].nombre} – ${t.nombre}: ${motivo.toLowerCase()} ${fmtD(fecha)}${t.responsable ? ` (${t.responsable})` : ''}`));
  const texto = lineas.join('\n');
  modal('Resumen semanal', `<textarea id="resTxt" style="min-height:340px;font-family:ui-monospace,Consolas,monospace;font-size:12px">${esc(texto)}</textarea>
    <div class="hint">Copia el texto en Teams o en un correo, o ábrelo directamente como borrador de Outlook.</div>`,
    `<button class="btn" onclick="navigator.clipboard.writeText($('#resTxt').value).then(()=>toast('Resumen copiado'))">Copiar</button>
     <a class="btn primary" href="mailto:?subject=${encodeURIComponent('Resumen semanal – Desarrollo GD ' + fmtD(HOY))}&body=${encodeURIComponent(texto.slice(0, 1800))}">Abrir borrador de correo</a>`, true);
}

// ------------------------------------------------------------ embudo del pipeline
let PIPE = null;
function vPipeline() {
  if (!PIPE) return `${head('Embudo del pipeline', 'Predios por etapa del pipeline en SharePoint')}<div class="card card-pad muted">Leyendo carpetas…</div>`;
  if (PIPE.error) return `${head('Embudo del pipeline')}<div class="note warn">${esc(PIPE.error)}</div>`;
  const et = PIPE.etapas, activas = et.filter(e => e.etapa !== 'Descartados' && !/prospecci/i.test(e.etapa));
  const notas = Object.fromEntries((S.pipeline_notas || []).map(n => [n.carpeta, n]));
  const totalGd = et.reduce((a, e) => a + e.gd, 0), desc = et.find(e => e.etapa === 'Descartados');
  const causas = PIPE.causas || [];
  const maxEtapa = Math.max(1, ...activas.map(e => e.gd));
  const filaEtapa = e => `<div class="hb" style="cursor:default"><span class="nm">${esc(e.etapa)}</span>
    <div class="tr"><div class="fill" style="width:${pct(e.gd, maxEtapa)}%"></div></div>
    <span class="v">${e.gd} GD · ${e.carpetas} carpetas</span></div>`;
  const maxCausa = Math.max(1, ...causas.map(c => c.cantidad));
  const filaCausa = c => `<div class="hb" style="cursor:default"><span class="nm">${esc(c.causa)}</span>
    <div class="tr"><div class="fill bad" style="width:${pct(c.cantidad, maxCausa)}%"></div></div>
    <span class="v">${c.cantidad}</span></div>`;
  const pendientes = (desc?.proyectos || []).filter(x => !notas[x.carpeta]?.causa);
  return `${head('Embudo del pipeline', 'Predios por etapa según las carpetas del pipeline (01 Pipeline y 02 Archivo)', `<button class="btn" onclick="PIPE=null;render()">Actualizar</button>`)}
  <div class="kpis">
    ${activas.map(e => kpi(e.etapa, e.gd, `${e.carpetas} carpetas`)).join('')}
    ${kpi('Descartados', desc?.gd ?? 0, totalGd ? `${pct(desc?.gd || 0, totalGd)} % del total` : '', 'bad')}
  </div>
  <div class="grid g2">
    <div class="card"><div class="card-head"><h2>GD por etapa</h2><span class="muted small">según las carpetas de cada etapa del pipeline</span></div>
      <div class="card-pad"><div class="hbars">${activas.map(filaEtapa).join('') || '<div class="empty">Sin datos.</div>'}</div></div>
    </div>
    <div class="card"><div class="card-head"><h2>Causas de descarte</h2><span class="muted small">asignadas por proyecto desde esta plataforma</span></div>
      ${causas.length ? `<div class="card-pad"><div class="hbars">${causas.map(filaCausa).join('')}</div></div>` : '<div class="empty">Aún no hay causas de descarte registradas.</div>'}
    </div>
  </div>
  <div class="card" style="margin-top:16px"><div class="card-head"><h2>Descartados por clasificar</h2><span class="muted small">al registrar la causa, el proyecto sale de este listado y queda contado en la gráfica</span></div>
    ${pendientes.length ? `<div class="table-wrap"><table><tbody>${pendientes.map(x => `<tr class="click" onclick="causaForm('${encodeURIComponent(x.carpeta)}')">
      <td><b>${esc(x.nombre)}</b></td><td class="muted small">registrar causa →</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Todos los descartados ya tienen causa registrada.</div>'}
  </div>
  <div class="card" style="margin-top:16px"><div class="card-head"><h2>Carpetas por etapa</h2><span class="muted small">ubicación de cada predio en el pipeline</span></div>
    <div class="alert-groups">${activas.map(e => `
      <details class="alert-group">
        <summary><span class="t">${esc(e.etapa)}</span><span class="pill">${e.carpetas}</span></summary>
        <div class="alerts">${e.proyectos.map(x => `
          <details class="carpeta-item">
            <summary>${esc(x.nombre)}</summary>
            <div class="ubicacion"><a href="${esc(spUrl(x.carpeta))}" target="_blank" rel="noopener">abrir en SharePoint</a> · <a href="#" onclick="abrirCarpeta(event, '${encodeURIComponent(x.carpeta)}')">abrir en este PC</a></div>
          </details>`).join('') || '<div class="empty">—</div>'}</div>
      </details>`).join('') || '<div class="empty">Sin carpetas.</div>'}</div>
  </div>`;
}
vPipeline.after = async () => { if (!PIPE) { try { PIPE = await api('GET', '/api/pipeline'); } catch (e) { PIPE = { error: e.message }; } render(); } };
async function abrirCarpeta(ev, carpetaEnc) {
  ev.preventDefault();
  try { await api('POST', '/api/abrir', { ruta: decodeURIComponent(carpetaEnc) }); toast('Abriendo la carpeta…'); }
  catch (e) { alert(e.message); }
}
const CAUSAS = ['Restricción de red / sin capacidad', 'Restricción ambiental', 'Traslape minero o de hidrocarburos', 'Problemas de titularidad', 'Consulta previa / comunidades',
  'Uso del suelo incompatible', 'Pendiente o topografía', 'Orden público', 'Propietario desistió', 'Condiciones económicas', 'Otra'];
function causaForm(carpetaEnc) {
  const carpeta = decodeURIComponent(carpetaEnc), n = (S.pipeline_notas || []).find(x => x.carpeta === carpeta) || {};
  modal(`Causa de descarte · ${esc(carpeta.split('/').pop())}`, `<form id="caf" class="form-grid">
    <div class="full"><label>Causa principal</label><select name="causa"><option value="">—</option>${CAUSAS.map(c => `<option ${n.causa === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
    <div class="full"><label>Notas</label><textarea name="notas">${esc(n.notas)}</textarea></div></form>`,
    `<button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="saveCausa('${carpetaEnc}', ${n.id || 'null'})">Guardar</button>`);
}
async function saveCausa(carpetaEnc, id) {
  const d = { ...formData($('#caf')), carpeta: decodeURIComponent(carpetaEnc) };
  await api(id ? 'PUT' : 'POST', id ? `/api/pipeline_notas/${id}` : '/api/pipeline_notas', d); closeModal(); await refresh(); toast('Causa registrada');
}

// ------------------------------------------------------------ red y circuitos
const dispInput = v => `<div class="dispbox"><input name="capacidad_disp" type="number" step="any" value="${esc(v)}" placeholder="lo que informe el OR">
  <select name="unidad_disp"><option value="kW">kW</option><option value="MW">MW</option><option value="MVA">MVA</option></select></div>
  <div class="hint">Es lo que el operador de red informa como <b>libre</b> para nueva generación, no la capacidad total de la subestación.</div>`;
/** Convierte la capacidad disponible a kW; si el valor parece estar en MW/MVA pero se marcó kW, pregunta. */
function dispKw(d) {
  const v = nz(d.capacidad_disp) == null ? null : +String(d.capacidad_disp).replace(',', '.');
  if (v == null) return { ok: true, kw: null };
  const kw = d.unidad_disp === 'kW' ? v : v * 1000;
  if (d.unidad_disp === 'kW' && v > 0 && v < 100 && !confirm(`Registraste ${v} kW de capacidad disponible, un valor muy bajo para un circuito. ¿Seguro que es en kW y no en MW o MVA?`)) return { ok: false };
  return { ok: true, kw };
}
function vRed() {
  const ps = S.proyectos.filter(p => p.circuito && p.estado !== 'Descartado');
  const g = {}; ps.forEach(p => (g[`${p.or_id}|${p.circuito}`] ||= []).push(p));
  const filas = Object.entries(g).map(([k, xs]) => {
    const [or, cod] = k.split('|'); const c = (S.circuitos || []).find(x => x.codigo === cod && String(x.or_id) === or);
    const kw = xs.reduce((a, p) => a + (+p.capacidad_kw || 0), 0), caps = [...new Set(xs.map(p => p.capacidad_se_mva).filter(Boolean))];
    return { or: +or, cod, c, xs, kw, caps };
  }).sort((a, b) => b.xs.length - a.xs.length);
  return `${head('Red y circuitos', 'GD de Solcor por circuito y subestación, para anticipar la saturación de la red')}
  <div class="note" style="margin-bottom:14px">El circuito y la capacidad de la subestación se leen de las solicitudes y los insumos del operador de red. La <b>capacidad disponible</b> (lo que queda libre para nueva generación) se registra a mano con lo que informe el OR, en kW, MW o MVA. Si la suma de los GD de Solcor la supera, el circuito se marca en rojo. “% de la SE” compara los kW de Solcor con la capacidad total de la subestación (aprox. 1 MVA ≈ 1.000 kW).</div>
  <div class="card">${filas.length ? `<div class="table-wrap"><table><thead><tr><th>Operador de red</th><th>Circuito</th><th>Subestación</th><th>Capacidad SE (insumos)</th><th class="r">GD de Solcor</th><th class="r">kW solicitados</th><th class="r">% de la SE</th><th class="r">Disponible (OR)</th><th>Estado</th><th></th></tr></thead><tbody>
    ${filas.map(f => { const disp = f.c?.capacidad_disp_kw; const sat = disp && f.kw > disp; return `<tr>
      <td><b>${esc(ent(f.or).sigla)}</b></td><td><b>${esc(f.cod)}</b></td><td>${esc(f.c?.subestacion || '—')}</td>
      <td>${f.caps.map(v => String(v).replace('.', ',') + ' MVA').join(' / ') || '—'}${f.caps.length > 1 ? ' <span class="pill bad nodot">no coinciden</span>' : ''}</td>
      <td class="r">${f.xs.length}<div class="muted small">${f.xs.map(p => esc(p.nombre.replace(/^GD\s+/, ''))).join(', ')}</div></td>
      <td class="r num">${f.kw.toLocaleString('es-CO')} kW</td>
      <td class="r num">${f.caps.length ? Math.round(f.kw / (Math.min(...f.caps) * 1000) * 100) + ' %' : '—'}</td>
      <td class="r num">${disp ? (+disp).toLocaleString('es-CO') + ' kW' : '—'}</td>
      <td>${sat ? '<span class="pill bad">Supera lo disponible</span>' : disp ? '<span class="pill ok">Dentro de lo disponible</span>' : f.xs.length > 1 ? '<span class="pill warn">Varios GD, sin dato del OR</span>' : '<span class="pill">Sin dato del OR</span>'}</td>
      <td class="r"><button class="btn sm" onclick="circuitoForm(${f.or}, '${esc(f.cod)}')">Editar</button></td></tr>`; }).join('')}
  </tbody></table></div>` : '<div class="empty">Aún no hay proyectos con circuito registrado.</div>'}</div>`;
}
function circuitoForm(or, cod) {
  const c = (S.circuitos || []).find(x => x.codigo === cod && x.or_id === or) || {};
  modal(`Circuito ${esc(cod)} · ${esc(ent(or).sigla)}`, `<form id="cif" class="form-grid">
    <div><label>Subestación</label><input name="subestacion" value="${esc(c.subestacion)}"></div>
    <div><label>Capacidad disponible informada por el OR</label>${dispInput(c.capacidad_disp_kw)}</div>
    <div class="full"><label>Notas (fuente, fecha del dato, otros promotores en cola…)</label><textarea name="notas">${esc(c.notas)}</textarea></div></form>`,
    `<button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="saveCircuito(${or}, '${esc(cod)}', ${c.id || 'null'})">Guardar</button>`);
}
async function saveCircuito(or, cod, id) {
  const f = formData($('#cif')), dk = dispKw(f); if (!dk.ok) return;
  const d = { subestacion: f.subestacion, notas: f.notas, codigo: cod, or_id: or, capacidad_disp_kw: dk.kw };
  await api(id ? 'PUT' : 'POST', id ? `/api/circuitos/${id}` : '/api/circuitos', d); closeModal(); await refresh(); toast('Circuito guardado');
}

// ------------------------------------------------------------ navegación por áreas
const strip = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
const slug = s => strip(s).toLowerCase().replace(/[^a-z0-9]+/g, '-');
function irArea(ar) {
  const el = document.getElementById('area-' + slug(ar));
  if (!el) return toast(`${ar}: este proyecto no tiene trámites en esa área`);
  const destino = el.getBoundingClientRect().top + window.scrollY - 16;
  window.scrollTo({ top: destino, behavior: 'smooth' });
  setTimeout(() => { if (Math.abs(window.scrollY - destino) > 40) window.scrollTo(0, destino); }, 600); // respaldo si el navegador no anima
  const filas = []; let n = el.nextElementSibling;
  while (n && !n.classList.contains('group-row')) { filas.push(n); n = n.nextElementSibling; }
  [el, ...filas].forEach(f => { f.classList.remove('flash'); void f.offsetWidth; f.classList.add('flash'); });
}

// ------------------------------------------------------------ datos de red editables
function redForm(pid) {
  const p = PRO[pid], c = (S.circuitos || []).find(x => x.codigo === p.circuito && x.or_id === p.or_id) || {};
  const ors = S.entidades.filter(e => e.tipo === 'Operador de red');
  modal(`Datos de red · ${esc(p.nombre)}`, `<form id="rdf" class="form-grid">
    <div><label>Operador de red</label><select name="or_id">${entOptions(ors, p.or_id, suggest(ors, p.departamento))}</select></div>
    <div><label>Circuito</label><input name="circuito" value="${esc(p.circuito)}"></div>
    <div><label>Subestación</label><input name="subestacion" value="${esc(p.subestacion || c.subestacion)}"></div>
    <div><label>Capacidad de la subestación (MVA)</label><input name="capacidad_se_mva" type="number" step="any" value="${esc(p.capacidad_se_mva)}"></div>
    <div><label>Capacidad disponible informada por el OR</label>${dispInput(c.capacidad_disp_kw)}</div>
    <div><label>Capacidad del proyecto (kWac)</label><input name="capacidad_kw" type="number" step="any" value="${esc(p.capacidad_kw)}"></div>
    <div class="full"><div class="hint">Los valores que edites a mano se respetan: la sincronización con SharePoint solo completa campos vacíos.</div></div>
  </form>`, `<button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="saveRed(${pid}, ${c.id || 'null'})">Guardar</button>`);
}
async function saveRed(pid, cid) {
  const d = formData($('#rdf')), dk = dispKw(d); if (!dk.ok) return;
  const num = v => nz(v) == null ? null : +String(v).replace(',', '.');
  await api('PUT', `/api/proyectos/${pid}`, { or_id: +d.or_id, circuito: nz(d.circuito), subestacion: nz(d.subestacion), capacidad_se_mva: num(d.capacidad_se_mva), capacidad_kw: num(d.capacidad_kw) });
  if (d.circuito && (dk.kw != null || cid)) {
    const c = { codigo: d.circuito, or_id: +d.or_id, subestacion: nz(d.subestacion), capacidad_disp_kw: dk.kw };
    await api(cid ? 'PUT' : 'POST', cid ? `/api/circuitos/${cid}` : '/api/circuitos', c);
  }
  closeModal(); await refresh(); toast('Datos de red actualizados');
}

// ------------------------------------------------------------ soporte: asistente + tiquets
const AYUDA = [
  { t: 'Registrar un radicado o una respuesta', k: 'radicado radicar respuesta respondio registrar evento fecha oficio', a: 'Abre el proyecto, haz clic en el trámite y usa <b>Registrar evento</b>: elige <i>Radicado</i> (con su número) o <i>Respuesta de la entidad</i> (con el resultado). Si el documento está en SharePoint, la sincronización lo registra sola.' },
  { t: 'Requerimientos y plazos suspendidos', k: 'requerimiento suspendido suspension plazo informacion adicional entidad pide', a: 'Registra <i>Requerimiento de la entidad</i> el día que la entidad pide información: el plazo legal se suspende. Cuando Solcor responda, registra <i>Respuesta a requerimiento</i> y el conteo se reanuda (Ley 1755 de 2015, art. 17).' },
  { t: 'Subsanaciones del estudio de conexión (ECS)', k: 'subsanacion subsanaciones observaciones ecs estudio conexion ebsa operador ronda corregir', a: 'Abre el trámite “Radicación y aprobación del estudio de conexión (ECS)”: en <b>Subsanaciones</b> registra cada ronda (fecha de las observaciones del OR y fecha en que Solcor radicó la subsanación). Mientras está en curso, el plazo del OR se suspende y en la línea de tiempo se ve en naranja. La aprobación final del ECS se registra como <i>Respuesta de la entidad</i>.' },
  { t: 'Cómo se cuentan los días', k: 'dias habiles festivos conteo calculo plazo vence vencido tiempo', a: 'Se cuentan días hábiles desde el día siguiente al radicado, sin sábados, domingos ni festivos de Colombia, y sin el tiempo suspendido por requerimientos. “Vencido” significa que la entidad superó su plazo legal sin responder.' },
  { t: 'Sincronización con SharePoint', k: 'sharepoint sincronizar sincronizacion actualizar carpeta subir archivo pdf e3 pipeline automatico', a: 'Cada 30 minutos la plataforma lee la carpeta del Pipeline (E3) y registra radicados, respuestas, entregables, PVsyst, layout y costos. Para verlo de inmediato: pestaña <b>SharePoint → Escanear ahora</b>. Usa nombres con fecha al inicio (AAAAMMDD) y la estructura de carpetas habitual.' },
  { t: 'Subí un archivo y no aparece', k: 'no aparece sale subi archivo falta dudosa revisar calidad', a: 'Puede ser: (1) aún no pasa la sincronización (máximo 30 min; usa “Escanear ahora”); (2) su fecha es dudosa y quedó para revisión en la pestaña SharePoint; (3) el archivo no se puede leer (escaneado o página de error). Revisa el panel <b>Calidad de datos</b> del Tablero.' },
  { t: 'Agregar una consulta adicional', k: 'agregar consulta adicional hallazgo ecopetrol ducto cenit titular minero nueva entidad', a: 'En el proyecto, botón <b>+ Agregar consulta</b>: elige el hallazgo (bloque de hidrocarburos, ducto, título minero…), la entidad y la fecha de radicado. Si la entidad no existe, créala con “+ Nueva”.' },
  { t: 'Crear un proyecto', k: 'crear proyecto nuevo contrato firmado registrar predio', a: 'Los proyectos de E3 se crean solos desde SharePoint. Para uno manual: <b>Proyectos → + Nuevo proyecto</b>; la plataforma genera los trámites según la figura y sugiere la CAR y el operador de red del departamento.' },
  { t: 'Factibilidad, Licenciamiento y RTB', k: 'factibilidad licenciamiento rtb porcentaje avance etapa area social predial ingenieria juridico conexion solapamientos', a: 'Factibilidad (6 áreas en paralelo) y Licenciamiento avanzan al tiempo. El % de Factibilidad es el promedio de sus áreas. El proyecto es RTB cuando ambas llegan al 100 % sin resultados desfavorables. Haz clic en cada área del proyecto para bajar a sus trámites; la descripción de cada área está en el Tablero.' },
  { t: 'Valores del PVsyst', k: 'pvsyst p50 p75 p90 energia produccion simulacion', a: 'La plataforma toma el reporte PVsyst más reciente de cada GD en SharePoint y muestra P50, P75 y P90 (MWh/año) en el entregable “Simulación PVsyst” del área Ingeniería.' },
  { t: 'Carta de insistencia o queja ante la SSPD', k: 'insistencia carta queja sspd vencido responde derecho peticion word', a: 'Abre un trámite vencido: aparece <b>Generar insistencia (Word)</b>; si es un operador de red, también <b>Queja ante la SSPD</b>. Los datos del firmante se editan en <b>Datos</b>.' },
  { t: 'Costos de desarrollo', k: 'costo costos pago pagos presupuesto kiandor factura valor', a: 'En el proyecto, tarjeta <b>Costos de desarrollo</b>: “+ Costo” para registrar uno, clic en un costo para editarlo. Los comprobantes de pago en SharePoint se leen solos. El presupuesto se define en “Editar” del proyecto.' },
  { t: 'Circuito y capacidad de la subestación', k: 'circuito subestacion capacidad mva red disponible saturacion operador ebsa', a: 'En el proyecto, tarjeta <b>Red → Editar</b>: circuito, subestación, capacidad (MVA) y capacidad disponible informada por el OR. La vista <b>Red y circuitos</b> alerta si los GD de Solcor superan lo disponible.' },
  { t: 'Editar datos del proyecto', k: 'editar modificar cambiar dato datos proyecto coordenadas municipio capacidad corregir', a: 'Botón <b>Editar</b> en el encabezado del proyecto, o “Editar” en la tarjeta Red. Lo que edites a mano se respeta: la sincronización solo completa campos vacíos.' },
  { t: 'Usuarios y contraseña', k: 'usuario usuarios contrasena clave olvide acceso rol administrador lector editor', a: 'Cambia tu contraseña en la barra lateral (“Cambiar contraseña”). Si la olvidaste, un administrador te asigna una nueva en <b>Datos → Usuarios</b>, donde también se crean usuarios y roles.' },
  { t: 'Responsables y Mis pendientes', k: 'responsable pendientes compromiso asignar resumen semanal tareas', a: 'En cada trámite, “Editar datos del trámite”: responsable y fecha compromiso. La vista <b>Mis pendientes</b> los ordena por atraso; “Resumen semanal” arma el texto para Teams o correo.' },
  { t: 'Embudo y causas de descarte', k: 'embudo pipeline e1 e2 descartado descarte causa conversion ubicacion carpeta', a: 'La vista <b>Embudo del pipeline</b> cuenta los GD por carpeta de cada etapa (E1 a E4) y los descartados. Haz clic en un descartado para registrar su causa; cada vez que se registra, sale del listado de pendientes y queda contado en la gráfica de causas. En <b>Carpetas por etapa</b>, despliega una etapa y haz clic en una carpeta para ver su ubicación (SharePoint o en este PC).' },
  { t: 'Exportar o respaldar', k: 'exportar excel csv respaldo backup descargar datos tesis', a: '<b>Datos → Descargar CSV</b> exporta todos los trámites para Excel. “Descargar respaldo” guarda toda la base.' },
  { t: 'La página no carga', k: 'carga caido servidor conexion error pagina apagado iniciar', a: 'El servidor local se apaga al reiniciar el PC. Ejecuta <b>iniciar.bat</b> en la carpeta ruta-rtb y deja abierta su ventana.' },
  { t: 'Cómo funcionan los tiquets', k: 'tiquet tiquets ticket tickets mejora error sugerencia solicitud soporte aceptar', a: 'Cualquiera puede crear un tiquet (mejora, error, duda o dato incorrecto). Un administrador lo abre en <b>Soporte</b> y pulsa <b>Aceptar y ejecutar con Claude</b> (o “Ejecutar con Claude ahora” si ya estaba aceptado). Claude hace una copia de la base, implementa la mejora y deja el tiquet en “Listo para revisar”; el administrador lo verifica y lo cierra.' },
];
const STOP = new Set('de la el los las un una y o en a que se como para por con del al mi me es no lo le su sus hay hago puedo donde cual cuando porque esta este'.split(' '));
const palabras = s => strip(s).toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2 && !STOP.has(w));
function responder(q) {
  const qs = palabras(q); if (!qs.length) return [];
  return AYUDA.map(e => {
    const ks = [...new Set([...palabras(e.k), ...palabras(e.t)])];
    const score = qs.reduce((a, w) => a + (ks.some(k => k.startsWith(w) || w.startsWith(k)) ? 1 : 0), 0);
    return { e, score };
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 2).map(x => x.e);
}
let CHAT = [{ de: 'bot', html: 'Hola, soy el asistente de la plataforma. Escribe tu duda (por ejemplo: “¿cómo registro un radicado?”). Si no la resuelvo, puedes crear un tiquet.' }];
let ULTIMA_DUDA = '';
function chatHtml() {
  const sug = ['¿Cómo registro un radicado?', 'Subí un archivo y no aparece', '¿Cómo edito la capacidad de la subestación?', '¿Cómo funcionan los tiquets?'];
  return `<div class="chat" id="chatLog">${CHAT.map(m => `<div class="msg ${m.de}">${m.html}</div>`).join('')}</div>
    <form class="chat-in" onsubmit="preguntar(event)"><input id="chatQ" placeholder="Escribe tu duda…" autocomplete="off"><button class="btn primary">Enviar</button></form>
    <div class="chat-sug">${sug.map((s, i) => `<button type="button" class="tag" onclick="preguntar(null, ${i})">${s}</button>`).join('')}</div>`;
}
function preguntar(ev, idx) {
  ev?.preventDefault();
  const sug = ['¿Cómo registro un radicado?', 'Subí un archivo y no aparece', '¿Cómo edito la capacidad de la subestación?', '¿Cómo funcionan los tiquets?'];
  const q = (idx != null ? sug[idx] : $('#chatQ').value).trim(); if (!q) return;
  ULTIMA_DUDA = q;
  CHAT.push({ de: 'yo', html: esc(q) });
  const r = responder(q);
  const crear = '<a href="#" onclick="event.preventDefault();ticketForm(\'Duda\', ULTIMA_DUDA)">';
  CHAT.push({ de: 'bot', html: r.length ? r.map(e => `<b>${e.t}</b><br>${e.a}`).join('<hr>') + `<div class="small muted" style="margin-top:6px">¿No era esto? ${crear}Crear un tiquet</a></div>`
    : `No encontré una respuesta para eso. ${crear}Crea un tiquet</a> y un administrador lo revisará.` });
  const box = $('#chatBox');
  if (box) { box.innerHTML = chatHtml(); $('#chatLog').scrollTop = 1e6; $('#chatQ').focus(); } else render();
}
function abrirAyuda() {
  $('#ayudaPanel')?.remove();
  document.body.insertAdjacentHTML('beforeend', `<div id="ayudaPanel" class="ayuda-panel">
    <div class="modal-head"><h2>Soporte</h2><div class="actions"><button class="btn sm" onclick="ticketForm()">+ Tiquet</button><button class="x" onclick="$('#ayudaPanel').remove()">×</button></div></div>
    <div id="chatBox" class="card-pad">${chatHtml()}</div></div>`);
  $('#chatLog').scrollTop = 1e6; $('#chatQ').focus();
}

let TK = null, fTk = 'abiertos';
const TK_PILL = { Nuevo: 'info', Aceptado: 'acc', 'En desarrollo': 'warn', 'Listo para revisar': 'warn', Resuelto: 'ok', Rechazado: '' };
async function cargarTickets() { TK = await api('GET', '/api/tickets'); }
function vSoporte() {
  const tab = ls.get('soporteTab') || 'tiquets';
  const tabs = `<div class="tabs"><button class="${tab === 'tiquets' ? 'on' : ''}" onclick="ls.set('soporteTab','tiquets');render()">Tiquets</button><button class="${tab === 'asistente' ? 'on' : ''}" onclick="ls.set('soporteTab','asistente');render()">Asistente</button></div>`;
  if (tab === 'asistente') return `${head('Soporte', 'Resuelve dudas sobre la plataforma o reporta mejoras y errores')}${tabs}<div class="card" style="max-width:780px"><div id="chatBox" class="card-pad">${chatHtml()}</div></div>`;
  if (!TK) return `${head('Soporte')}${tabs}<div class="card card-pad muted">Cargando tiquets…</div>`;
  const abiertos = ['Nuevo', 'Aceptado', 'En desarrollo', 'Listo para revisar'];
  const lista = TK.tickets.filter(t => fTk === 'todos' ? true : fTk === 'mios' ? t.creado_por === USUARIO?.email
    : fTk === 'abiertos' ? abiertos.includes(t.estado) : t.estado === fTk);
  const cuenta = e => TK.tickets.filter(t => t.estado === e).length;
  const admin = USUARIO?.rol === 'admin';
  const sub = { Nuevo: admin ? 'esperan tu revisión' : 'en revisión', Aceptado: 'en cola para Claude', 'En desarrollo': 'Claude trabajando', 'Listo para revisar': admin ? 'verifica y cierra' : 'por verificar', Resuelto: 'cerrados' };
  return `${head('Soporte', 'Tiquets de mejoras, errores y dudas. Un administrador los acepta y los aceptados pasan a la cola de Claude.', `<button class="btn primary" onclick="ticketForm()">+ Nuevo tiquet</button>`)}${tabs}
  ${TK.ejecucion?.activo ? `<div class="note warn" style="margin-bottom:14px">⏳ Claude está trabajando en el tiquet #${TK.ejecucion.ticket_id} desde las ${esc(TK.ejecucion.inicio.slice(11, 16))}.</div>` : ''}
  <div class="kpis">${Object.keys(sub).map(e => kpi(e, cuenta(e), sub[e], e === 'Nuevo' && cuenta(e) && admin ? 'warn' : '')).join('')}</div>
  <div class="card"><div class="card-head"><div class="filters"><select onchange="fTk=this.value;render()">${[['abiertos', 'Abiertos'], ['mios', 'Mis tiquets'], ['todos', 'Todos'], ...TK.estados.map(e => [e, e])].map(([v, l]) => `<option value="${v}" ${fTk === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div><span class="muted small">${lista.length}</span></div>
  ${lista.length ? `<div class="table-wrap"><table><thead><tr><th>#</th><th>Tiquet</th><th>Tipo</th><th>Prioridad</th><th>Estado</th><th>Creado por</th><th>Actualizado</th></tr></thead><tbody>
    ${lista.map(t => `<tr class="click" onclick="verTicket(${t.id})"><td class="num muted">${t.id}</td><td><b>${esc(t.titulo)}</b>${t.pagina ? `<div class="muted small">${esc(t.pagina)}</div>` : ''}</td>
      <td><span class="tag">${esc(t.tipo)}</span></td><td>${esc(t.prioridad)}</td><td><span class="pill ${TK_PILL[t.estado] || ''}">${esc(t.estado)}</span></td>
      <td class="small">${esc(t.creado_por)}</td><td class="small muted">${esc((t.actualizado || '').replace('T', ' ').slice(0, 16))}</td></tr>`).join('')}
  </tbody></table></div>` : '<div class="empty">No hay tiquets con este filtro.</div>'}</div>`;
}
vSoporte.after = async () => {
  if (!TK && (ls.get('soporteTab') || 'tiquets') === 'tiquets') { await cargarTickets(); render(); return; }
  if (TK?.ejecucion?.activo) vigilarEjecucion();
};
function ticketForm(tipo = 'Mejora', desc = '') {
  const pagina = location.hash.replace('#/', '') || 'tablero';
  modal('Nuevo tiquet', `<form id="tkf" class="form-grid">
    <div class="full"><label>Título *</label><input name="titulo" required minlength="5" placeholder="Ej.: Poder filtrar los trámites por responsable"></div>
    <div><label>Tipo</label><select name="tipo">${['Mejora', 'Error', 'Duda', 'Dato incorrecto'].map(x => `<option ${x === tipo ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
    <div><label>Pantalla</label><input name="pagina" value="${esc(pagina)}"></div>
    <div class="full"><label>Descripción</label><textarea name="descripcion" style="min-height:120px" placeholder="Qué pasa o qué necesitas, en qué proyecto o pantalla, y cómo debería funcionar">${esc(desc)}</textarea></div>
    <div class="full"><label>Adjuntar archivos (opcional)</label>
      <div class="adj-drop" tabindex="0" ondragover="event.preventDefault();this.classList.add('on')" ondragleave="this.classList.remove('on')"
        ondrop="event.preventDefault();this.classList.remove('on');agregarArchivosNuevoTicket(event.dataTransfer.files)"
        onpaste="pegarArchivoNuevoTicket(event)" onclick="event.target===this&&$('#tkfArchivo').click()">Arrastra un archivo, pega (Ctrl+V) una captura de pantalla, o <a href="#" onclick="event.preventDefault();$('#tkfArchivo').click()">elige un archivo</a> (PDF, KML, imágenes…, máx. 15 MB).
        <input id="tkfArchivo" type="file" multiple style="display:none" onchange="agregarArchivosNuevoTicket(this.files);this.value=''"></div>
      <ul id="tkfArchivosList" class="adjuntos-list"></ul>
    </div>
  </form>`, `<button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="guardarTicket()">Crear tiquet</button>`);
  _tkfArchivos = [];
}
let _tkfArchivos = [];
function agregarArchivosNuevoTicket(files) {
  for (const file of files || []) {
    if (file.size > MAX_ADJUNTO) { alert(`«${file.name}» supera el tamaño máximo permitido (15 MB)`); continue; }
    _tkfArchivos.push(file);
  }
  renderArchivosNuevoTicket();
}
function pegarArchivoNuevoTicket(ev) {
  const items = [...(ev.clipboardData?.items || [])].filter(i => i.kind === 'file');
  if (!items.length) return;
  ev.preventDefault();
  const files = items.map((it, i) => { const f = it.getAsFile(); return f && new File([f], f.name || `captura-${Date.now()}-${i}.png`, { type: f.type }); }).filter(Boolean);
  agregarArchivosNuevoTicket(files);
}
function quitarArchivoNuevoTicket(i) { _tkfArchivos.splice(i, 1); renderArchivosNuevoTicket(); }
function renderArchivosNuevoTicket() {
  const ul = $('#tkfArchivosList'); if (!ul) return;
  ul.innerHTML = _tkfArchivos.map((f, i) => `<li>${iconoAdjunto(f.type)} ${esc(f.name)} <span class="muted small">${tamFmt(f.size)}</span>
    <button type="button" class="x" title="Quitar" onclick="quitarArchivoNuevoTicket(${i})">×</button></li>`).join('');
}
async function guardarTicket() {
  const f = $('#tkf'); if (!f.reportValidity()) return;
  try {
    const t = await api('POST', '/api/tickets', formData(f));
    for (const file of _tkfArchivos) {
      try { const datos = await leerArchivo(file); await api('POST', `/api/tickets/${t.id}/adjuntos`, { nombre: file.name, tipo: file.type, datos }); }
      catch (e) { alert(`No se pudo adjuntar «${file.name}»: ${e.message}`); }
    }
    _tkfArchivos = []; closeModal(); $('#ayudaPanel')?.remove(); TK = null; toast(`Tiquet #${t.id} creado`);
    if (location.hash.startsWith('#/soporte')) { await cargarTickets(); render(); }
  } catch (e) { alert(e.message); }
}
function verTicket(id) {
  const t = TK.tickets.find(x => x.id === id), admin = USUARIO?.rol === 'admin';
  const accion = (estado, txt, cls = '') => `<button class="btn sm ${cls}" onclick="estadoTicket(${id}, '${estado}')">${txt}</button>`;
  openDrawerId = null;
  drawer(`<div class="modal-head"><div><div class="muted small">Tiquet #${t.id} · ${esc(t.tipo)} · creado por ${esc(t.creado_por)} el ${esc((t.creado || '').replace('T', ' ').slice(0, 16))}</div><h2>${esc(t.titulo)}</h2></div><button class="x" onclick="closeDrawer()">×</button></div>
  <div class="drawer-body">
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px"><span class="pill ${TK_PILL[t.estado] || ''}">${esc(t.estado)}</span><span class="tag">Prioridad ${esc(t.prioridad)}</span>${t.pagina ? `<a class="tag" href="#/${esc(t.pagina)}" onclick="closeDrawer()">pantalla: ${esc(t.pagina)}</a>` : ''}</div>
    <p style="white-space:pre-wrap">${esc(t.descripcion) || '<span class="muted">Sin descripción.</span>'}</p>
    ${admin ? `<div class="card card-pad" style="margin:14px 0"><h3 style="margin-bottom:8px">Acciones de administrador</h3>
      <div class="form-grid"><div><label>Prioridad</label><select onchange="prioridadTicket(${id}, this.value)">${TK.prioridades.map(x => `<option ${x === t.prioridad ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
      <div class="full"><label>Nota para el equipo o para Claude (opcional)</label><input id="tkNota" placeholder="Ej.: hacerlo solo para proyectos activos"></div></div>
      <div class="actions" style="margin-top:10px">
        ${t.estado === 'Nuevo' ? ejecutarBtn(id, 'Aceptar y ejecutar con Claude') + accion('Aceptado', 'Solo aceptar') + accion('Rechazado', 'Rechazar', 'danger') : ''}
        ${t.estado === 'Aceptado' ? ejecutarBtn(id, 'Ejecutar con Claude ahora') : ''}
        ${t.estado === 'Listo para revisar' ? accion('Resuelto', 'Verificado: cerrar', 'primary') + accion('Aceptado', 'Devolver a Claude') : ''}
        ${['Aceptado', 'En desarrollo'].includes(t.estado) && !trabajando(id) ? accion('Resuelto', 'Marcar resuelto') + accion('Rechazado', 'Cancelar', 'danger') : ''}
        ${t.notas.some(n => /Ejecución de Claude/.test(n.texto)) ? `<button class="btn sm" onclick="verRegistro(${id})">Ver registro de Claude</button>` : ''}
        ${['Resuelto', 'Rechazado'].includes(t.estado) ? accion('Nuevo', 'Reabrir') : ''}
      </div>
      ${trabajando(id) ? `<div class="note warn" style="margin-top:10px">⏳ Claude está trabajando en este tiquet desde las ${esc(TK.ejecucion.inicio.slice(11, 16))}. Puedes seguir usando la plataforma; esta vista se actualiza sola.</div>` : ''}
      ${TK.claude_disponible === false ? '<div class="note warn" style="margin-top:10px">Claude Code no está instalado en el PC del servidor; la ejecución automática no está disponible.</div>' : ''}</div>`
      : t.estado === 'Nuevo' ? '<div class="note" style="margin:14px 0">Pendiente de revisión por un administrador.</div>' : trabajando(id) ? '<div class="note warn" style="margin:14px 0">⏳ Claude está trabajando en este tiquet.</div>' : ''}
    ${adjuntosHtml(t)}
    <h3 style="margin:14px 0 8px">Historial y comentarios</h3>
    ${t.notas.length ? `<ul class="timeline">${t.notas.map(n => `<li class="${/^Claude/.test(n.autor) ? 'resp' : /^Solicitud de subsanación/.test(n.texto) ? 'subsanacion' : ''}"><b>${esc(n.autor)}</b><div class="d">${esc((n.fecha || '').replace('T', ' ').slice(0, 16))}</div><div style="white-space:pre-wrap">${esc(n.texto)}</div></li>`).join('')}</ul>` : '<p class="muted">Sin comentarios.</p>'}
    ${['Resuelto', 'Rechazado'].includes(t.estado) ? `<div class="note warn" style="margin-top:10px">Este tiquet está <b>${esc(t.estado.toLowerCase())}</b>. Si la solución quedó incompleta, solicita una subsanación: el comentario queda registrado y el tiquet vuelve a la cola para revisarlo de nuevo.</div>` : ''}
    <form class="chat-in" style="margin-top:10px" onsubmit="event.preventDefault()">
      <input id="tkCom" placeholder="${['Resuelto', 'Rechazado'].includes(t.estado) ? '¿Qué quedó incompleto o sin resolver?' : 'Agregar un comentario…'}">
      <button class="btn" onclick="comentarTicket(event, ${id})">Comentar</button>
      ${['Resuelto', 'Rechazado'].includes(t.estado) ? `<button class="btn primary" onclick="subsanarTicket(event, ${id})">Solicitar subsanación</button>` : ''}
    </form>
  </div>`);
}
const trabajando = id => !!(TK?.ejecucion?.activo && TK.ejecucion.ticket_id === id);
const ejecutarBtn = (id, txt) => TK?.ejecucion?.activo
  ? `<button class="btn sm" disabled title="Claude está ocupado con el tiquet #${TK.ejecucion.ticket_id}">${txt} (Claude ocupado)</button>`
  : `<button class="btn sm primary" onclick="ejecutarClaude(${id})">${txt}</button>`;
async function ejecutarClaude(id) {
  if (!confirm('Claude implementará este tiquet ahora: hará una copia de la base, modificará el código del proyecto y lo dejará en «Listo para revisar». ¿Continuar?')) return;
  try { await api('POST', `/api/tickets/${id}/ejecutar`); toast('Claude empezó a trabajar en el tiquet. Te aviso cuando termine; puedes seguir usando la plataforma.'); }
  catch (e) { return alert(e.message); }
  try { if (window.Notification && Notification.permission === 'default') Notification.requestPermission(); } catch { /* opcional */ }
  _ultimoEstado = true; await cargarTickets(); render(); verTicket(id); vigilarEjecucion(); setTimeout(revisarTickets, 4000);
}
let _vigia = null;
function vigilarEjecucion() {
  clearTimeout(_vigia);
  _vigia = setTimeout(async () => {
    if (!location.hash.startsWith('#/soporte')) { await revisarTickets(); if (TK?.ejecucion?.activo) vigilarEjecucion(); return; }
    const abierto = $('#drawer') && !$('#drawer').hidden ? +($('#drawer').innerText.match(/Tiquet #(\d+)/) || [])[1] : null;
    const antes = TK?.ejecucion?.activo;
    try { await cargarTickets(); } catch { return; }
    if (antes && !TK.ejecucion.activo) avisoFin();
    render(); if (abierto) verTicket(abierto);
    if (TK.ejecucion?.activo) vigilarEjecucion();
  }, 8000);
}
// aviso al terminar y contador de tiquets por revisar en el menú, desde cualquier pantalla
let _ultimoEstado = null;
function avisoFin() {
  const e = TK.ejecucion, t = TK.tickets.find(x => x.id === e.ticket_id);
  const msg = t?.estado === 'Listo para revisar' ? `✅ Claude terminó el tiquet #${e.ticket_id}: está listo para revisar` : `⚠️ La ejecución del tiquet #${e.ticket_id} terminó sin cerrarlo: revisa sus comentarios`;
  const el = $('#toast'); el.innerHTML = `${esc(msg)} <a href="#/soporte" style="color:inherit;text-decoration:underline;margin-left:8px">Ver</a>`; el.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => el.hidden = true, 15000);
  try { if (window.Notification && Notification.permission === 'granted') new Notification('Ruta Desarrollo de GD', { body: msg }); } catch { /* sin notificaciones */ }
}
async function revisarTickets() {
  if (!USUARIO) return;
  try { TK = await api('GET', '/api/tickets'); } catch { return; }
  const activo = !!TK.ejecucion?.activo;
  if (_ultimoEstado === true && !activo) avisoFin();
  _ultimoEstado = activo;
  const n = TK.tickets.filter(t => t.estado === 'Listo para revisar' || (USUARIO.rol === 'admin' && t.estado === 'Nuevo')).length;
  const link = $('#nav a[data-r="soporte"]');
  if (link) link.innerHTML = `<i>?</i>Soporte${activo ? ' <span class="nav-badge trabajando" title="Claude trabajando">⏳</span>' : n ? ` <span class="nav-badge" title="Tiquets por revisar">${n}</span>` : ''}`;
}
setInterval(revisarTickets, 20000);
async function verRegistro(id) {
  let r; try { r = await api('GET', `/api/tickets/${id}/registro`); } catch (e) { return alert(e.message); }
  modal(`Registro de Claude · tiquet #${id}`, `<pre class="registro">${esc(r.registro || 'Aún no hay registro.')}</pre>`,
    `<button class="btn" onclick="verRegistro(${id})">Actualizar</button><button class="btn primary" onclick="closeModal()">Cerrar</button>`, true);
}
async function estadoTicket(id, estado) {
  const nota = $('#tkNota')?.value || '';
  if (estado === 'Rechazado' && !nota && !confirm('¿Rechazar sin explicar el motivo? Puedes escribirlo en la nota.')) return;
  await api('PUT', `/api/tickets/${id}`, { estado, nota_admin: nota }); await cargarTickets(); render(); verTicket(id); toast(`Tiquet #${id}: ${estado}`);
}
async function prioridadTicket(id, prioridad) { await api('PUT', `/api/tickets/${id}`, { prioridad }); await cargarTickets(); render(); verTicket(id); }
async function comentarTicket(ev, id) {
  ev.preventDefault(); const txt = $('#tkCom').value.trim(); if (!txt) return;
  await api('POST', `/api/tickets/${id}/notas`, { texto: txt }); await cargarTickets(); render(); verTicket(id);
}
async function subsanarTicket(ev, id) {
  ev.preventDefault(); const txt = $('#tkCom').value.trim();
  if (!txt) return alert('Cuéntanos qué quedó incompleto para poder reabrir el tiquet.');
  if (!confirm('El tiquet volverá al estado “Nuevo” para que se revise de nuevo. ¿Continuar?')) return;
  try { await api('POST', `/api/tickets/${id}/subsanar`, { texto: txt }); }
  catch (e) { return alert(e.message); }
  await cargarTickets(); render(); verTicket(id); toast(`Tiquet #${id}: solicitud de subsanación enviada`);
}

// ------------------------------------------------------------ archivos adjuntos de un tiquet
const MAX_ADJUNTO = 15 * 1024 * 1024; // 15 MB, igual que en el servidor
const tamFmt = n => n == null ? '' : n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
const iconoAdjunto = tipo => tipo?.startsWith('image/') ? '🖼️' : tipo === 'application/pdf' ? '📄'
  : /kml|xml|vnd\.google-earth/.test(tipo || '') ? '🗺️' : '📎';
function adjuntosHtml(t) {
  const puedeBorrar = a => USUARIO?.rol === 'admin' || a.autor === USUARIO?.email;
  return `<div style="margin:14px 0">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
      <h3>Archivos adjuntos${t.adjuntos?.length ? ` (${t.adjuntos.length})` : ''}</h3>
      <label class="btn sm" style="cursor:pointer">+ Adjuntar<input type="file" multiple style="display:none" onchange="subirArchivos(${t.id}, this.files);this.value=''"></label>
    </div>
    ${t.adjuntos?.length ? `<ul class="adjuntos-list">${t.adjuntos.map(a => `<li>
      <a href="/api/tickets/${t.id}/adjuntos/${a.id}" target="_blank" rel="noopener">${iconoAdjunto(a.tipo)} ${esc(a.nombre)}</a>
      <span class="muted small">${tamFmt(a.tamano)} · ${esc(a.autor)} · ${esc((a.fecha || '').replace('T', ' ').slice(0, 16))}</span>
      ${puedeBorrar(a) ? `<button class="x" title="Eliminar adjunto" onclick="eliminarAdjunto(${t.id}, ${a.id})">×</button>` : ''}
    </li>`).join('')}</ul>` : ''}
    <div class="adj-drop" tabindex="0" ondragover="event.preventDefault();this.classList.add('on')" ondragleave="this.classList.remove('on')"
      ondrop="event.preventDefault();this.classList.remove('on');subirArchivos(${t.id}, event.dataTransfer.files)"
      onpaste="pegarAdjunto(event, ${t.id})">Arrastra un archivo aquí, o haz clic y pega (Ctrl+V) una captura de pantalla. También sirve para PDF, KML y otros documentos.</div>
  </div>`;
}
function leerArchivo(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(new Error(`No se pudo leer «${file.name}»`));
    r.readAsDataURL(file);
  });
}
async function subirArchivos(id, files) {
  if (!files || !files.length) return;
  for (const file of files) {
    if (file.size > MAX_ADJUNTO) { alert(`«${file.name}» supera el tamaño máximo permitido (15 MB)`); continue; }
    try {
      const datos = await leerArchivo(file);
      await api('POST', `/api/tickets/${id}/adjuntos`, { nombre: file.name, tipo: file.type, datos });
    } catch (e) { alert(e.message); }
  }
  await cargarTickets(); render(); verTicket(id);
}
function pegarAdjunto(ev, id) {
  const items = [...(ev.clipboardData?.items || [])].filter(i => i.kind === 'file');
  if (!items.length) return;
  ev.preventDefault();
  const files = items.map((it, i) => { const f = it.getAsFile(); return f && new File([f], f.name || `captura-${Date.now()}-${i}.png`, { type: f.type }); }).filter(Boolean);
  subirArchivos(id, files);
}
async function eliminarAdjunto(id, aid) {
  if (!confirm('¿Eliminar este archivo adjunto?')) return;
  try { await api('DELETE', `/api/tickets/${id}/adjuntos/${aid}`); } catch (e) { return alert(e.message); }
  await cargarTickets(); render(); verTicket(id);
}

// ------------------------------------------------------------ subsanaciones del ECS (rondas de observaciones del OR)
const esTramiteOR = t => !esEntregable(t) && ent(t.entidad_id).tipo === 'Operador de red';
function rondasSubsanacion(t) {
  const r = []; let cur = null;
  for (const e of (EV[t.id] || [])) {
    if (e.tipo === 'Observaciones del OR') { cur = { obs: e, sub: null }; r.push(cur); }
    else if (e.tipo === 'Subsanación radicada' && cur && !cur.sub) cur.sub = e;
  }
  return r;
}
function subsanacionesHtml(t) {
  if (!esTramiteOR(t)) return '';
  const rs = rondasSubsanacion(t), abierta = rs.find(r => !r.sub);
  const diasSolcor = rs.reduce((a, r) => a + habiles(r.obs.fecha, r.sub ? r.sub.fecha : HOY), 0);
  return `<div class="card" style="margin-bottom:18px">
    <div class="card-head"><div><h3>Subsanaciones</h3><div class="muted small">Cada ronda va desde que el OR envía observaciones hasta que Solcor radica la subsanación. Mientras tanto el plazo del OR queda suspendido. La aprobación final se registra como “Respuesta de la entidad”.</div></div>
      ${abierta ? `<button class="btn sm primary" onclick="subsanacionForm(${t.id}, true)">Registrar subsanación radicada</button>` : `<button class="btn sm" onclick="subsanacionForm(${t.id}, false)">+ Nueva ronda de observaciones</button>`}</div>
    ${rs.length ? `<div class="table-wrap"><table><thead><tr><th>Ronda</th><th>Observaciones del OR</th><th>Subsanación radicada</th><th class="r">Días hábiles de Solcor</th></tr></thead><tbody>
      ${rs.map((r, i) => `<tr><td><b>${i + 1}</b>${r.obs.descripcion ? `<div class="muted small">${esc(r.obs.descripcion)}</div>` : ''}</td>
        <td class="num">${fmtD(r.obs.fecha)}</td>
        <td class="num">${r.sub ? fmtD(r.sub.fecha) + (r.sub.descripcion ? `<div class="muted small">${esc(r.sub.descripcion)}</div>` : '') : '<span class="pill warn">En curso</span>'}</td>
        <td class="r num">${habiles(r.obs.fecha, r.sub ? r.sub.fecha : HOY)}</td></tr>`).join('')}
      </tbody></table></div>
      <div class="card-pad small muted" style="padding-top:8px">${rs.length} ronda${rs.length > 1 ? 's' : ''} · ${diasSolcor} días hábiles en subsanación · aprobación final: ${t.fecha_respuesta ? `<b>${fmtD(t.fecha_respuesta)}</b>` : 'pendiente'}</div>`
      : '<div class="empty" style="padding:14px">Sin observaciones del OR registradas.</div>'}
  </div>`;
}
function subsanacionForm(tid, cerrar) {
  modal(cerrar ? 'Registrar subsanación radicada' : 'Nueva ronda de observaciones del OR', `<form id="sbf" class="form-grid">
    ${cerrar ? '' : '<div><label>Fecha de las observaciones del OR *</label><input name="obs" type="date" required value="' + HOY + '"></div><div class="full"><label>Observaciones (resumen)</label><input name="obs_desc" placeholder="Ej.: ajustar diagrama unifilar y memoria de protecciones"></div>'}
    <div><label>Fecha de radicación de la subsanación${cerrar ? ' *' : ' (si ya se radicó)'}</label><input name="sub" type="date" ${cerrar ? 'required value="' + HOY + '"' : ''}></div>
    <div class="full"><label>Detalle de la subsanación</label><input name="sub_desc" placeholder="Ej.: se radicó la versión 2 del ECS"></div>
  </form>`, `<button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="guardarSubsanacion(${tid})">Guardar</button>`);
}
async function guardarSubsanacion(tid) {
  const f = $('#sbf'); if (!f.reportValidity()) return;
  const d = formData(f), t = S.tramites.find(x => x.id === tid), nuevos = [];
  if (d.obs) nuevos.push(await api('POST', '/api/eventos', { tramite_id: tid, fecha: d.obs, tipo: 'Observaciones del OR', descripcion: d.obs_desc || '' }));
  if (d.sub) {
    if (d.obs && d.sub < d.obs) return alert('La subsanación no puede ser anterior a las observaciones');
    nuevos.push(await api('POST', '/api/eventos', { tramite_id: tid, fecha: d.sub, tipo: 'Subsanación radicada', descripcion: d.sub_desc || '' }));
  }
  const evs = [...(EV[tid] || []), ...nuevos].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id - b.id);
  await api('PUT', `/api/tramites/${tid}`, deriveFromEvents(t, evs));
  closeModal(); await refresh(); toast('Subsanación registrada');
}

// ------------------------------------------------------------ datos
function vDatos() {
  const demo = S.proyectos.filter(p => p.demo).length;
  return `${head('Datos', 'Exportación para el análisis de la investigación, respaldos y datos de ejemplo')}
  <div class="grid g2">
    <div class="card card-pad"><h2>Exportar trámites (CSV)</h2><p class="muted">Una fila por trámite con fechas, plazos, estado, resultado y número de requerimientos. Se abre directamente en Excel para el análisis estadístico del proyecto de grado.</p>
      <a class="btn primary" href="/api/export/tramites.csv">Descargar CSV</a></div>
    <div class="card card-pad"><h2>Respaldo completo</h2><p class="muted">Descarga toda la base (entidades, catálogo, proyectos, trámites y eventos) en JSON. Sirve también para migrar a la nube.</p>
      <div class="actions"><a class="btn" href="/api/backup">Descargar respaldo</a>
      <label class="btn" style="margin:0;color:var(--text);font-size:14px">Restaurar respaldo…<input type="file" accept=".json" hidden onchange="restore(this.files[0])"></label></div></div>
    <div class="card card-pad"><h2>Datos de ejemplo</h2><p class="muted">${demo ? `Hay ${demo} proyectos de ejemplo cargados. Elimínalos antes de empezar a registrar los proyectos reales.` : 'Carga 5 proyectos ficticios (GD, AGR y CE en Boyacá, Santander, Cundinamarca y Meta) para explorar la plataforma.'}</p>
      ${demo ? '<button class="btn danger" onclick="removeDemo()">Eliminar datos de ejemplo</button>' : '<button class="btn" onclick="loadDemo()">Cargar datos de ejemplo</button>'}</div>
    <div class="card card-pad"><h2>Cómo se calculan los tiempos</h2><p class="muted" style="margin-bottom:0">Los días se cuentan desde el día siguiente al radicado y hasta la respuesta (o hasta hoy si sigue pendiente). Se descuentan sábados, domingos y festivos de Colombia (Ley 51 de 1983) y el tiempo en que el plazo está suspendido: desde un <i>requerimiento de la entidad</i> hasta la <i>respuesta a requerimiento</i> (Ley 1755/2015, art. 17).</p></div>
    <div class="card card-pad" style="grid-column:1/-1"><h2>Datos para las cartas de insistencia</h2>
      <p class="muted">Se usan en el encabezado, la firma y las notificaciones de las cartas generadas.</p>
      <form id="fcf" class="form-grid">
        ${[['firmante_nombre', 'Firmante'], ['firmante_cargo', 'Cargo'], ['empresa', 'Empresa'], ['nit', 'NIT'], ['direccion', 'Dirección'], ['correo', 'Correo de notificaciones'], ['telefono', 'Teléfono']]
          .map(([k, l]) => `<div><label>${l}</label><input name="${k}" value="${esc(CFG[k])}"></div>`).join('')}
      </form>
      <div class="actions" style="margin-top:12px"><button class="btn primary" onclick="saveFirmante()">Guardar</button></div>
    </div>
  </div>
  ${usuariosCard()}`;
}
vDatos.after = () => { if (USUARIO?.rol === 'admin' && !USERS) cargarUsuarios(); };
// ------------------------------------------------------------ usuarios (administradores)
let USERS = null;
const ROL_TXT = { admin: 'Administrador', editor: 'Editor', lector: 'Solo lectura' };
function usuariosCard() {
  if (USUARIO?.rol !== 'admin') return '';
  return `<div class="card" style="margin-top:16px">
    <div class="card-head"><div><h2>Usuarios</h2><div class="muted small">Administrador: todo, incluidos los usuarios · Editor: registra y edita · Solo lectura: consulta</div></div>
      <button class="btn primary" onclick="usuarioForm()">+ Nuevo usuario</button></div>
    ${USERS ? `<div class="table-wrap"><table><thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th><th>Último ingreso</th><th></th></tr></thead><tbody>
      ${USERS.map(u => `<tr><td><b>${esc(u.nombre)}</b></td><td>${esc(u.email)}</td><td>${ROL_TXT[u.rol] || esc(u.rol)}</td>
        <td>${u.activo ? '<span class="pill ok">Activo</span>' : '<span class="pill">Inactivo</span>'}</td>
        <td class="small muted">${u.ultimo_ingreso ? esc(u.ultimo_ingreso.replace('T', ' ').slice(0, 16)) : 'nunca'}</td>
        <td class="r"><button class="btn sm" onclick="usuarioForm(${u.id})">Editar</button></td></tr>`).join('')}
    </tbody></table></div>` : '<div class="empty">Cargando…</div>'}
  </div>`;
}
async function cargarUsuarios() { if (USUARIO?.rol === 'admin') { USERS = await api('GET', '/api/usuarios'); render(); } }
function usuarioForm(id) {
  const u = id ? USERS.find(x => x.id === id) : { rol: 'editor', activo: 1 };
  modal(id ? 'Editar usuario' : 'Nuevo usuario', `<form id="usf" class="form-grid">
    <div><label>Nombre</label><input name="nombre" required value="${esc(u.nombre)}"></div>
    <div><label>Correo</label><input name="email" type="email" required value="${esc(u.email)}" ${id ? 'disabled' : ''}></div>
    <div><label>Rol</label><select name="rol">${Object.entries(ROL_TXT).map(([k, v]) => `<option value="${k}" ${u.rol === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
    ${id ? `<div><label>Estado</label><select name="activo"><option value="1" ${u.activo ? 'selected' : ''}>Activo</option><option value="0" ${!u.activo ? 'selected' : ''}>Inactivo</option></select></div>` : ''}
    <div class="full"><label>${id ? 'Nueva contraseña (dejar vacío para no cambiarla)' : 'Contraseña inicial'}</label><input name="password" type="password" ${id ? '' : 'required'} minlength="8" autocomplete="new-password">
      <div class="hint">Mínimo 8 caracteres. Compártela con la persona por un canal seguro; podrá cambiarla desde “Cambiar contraseña”.</div></div>
  </form>`, `<button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="guardarUsuario(${id || 'null'})">Guardar</button>`);
}
async function guardarUsuario(id) {
  const f = $('#usf'); if (!f.reportValidity()) return;
  const d = formData(f); if (!d.password) delete d.password; if (d.activo != null) d.activo = +d.activo;
  try { await api(id ? 'PUT' : 'POST', id ? `/api/usuarios/${id}` : '/api/usuarios', d); closeModal(); await cargarUsuarios(); toast('Usuario guardado'); }
  catch (e) { alert(e.message); }
}

async function saveFirmante() { await api('POST', '/api/sync/config', formData($('#fcf'))); await load(); render(); toast('Datos de las cartas guardados'); }
async function loadDemo() { await api('POST', '/api/demo'); await refresh(); toast('Datos de ejemplo cargados'); }
async function removeDemo() { if (!confirm('¿Eliminar los proyectos de ejemplo y sus trámites?')) return; await api('DELETE', '/api/demo'); await refresh(); toast('Datos de ejemplo eliminados'); }
async function restore(file) {
  if (!file) return;
  if (!confirm('Restaurar reemplaza TODA la información actual por la del respaldo. ¿Continuar?')) return;
  try { await api('POST', '/api/restaurar', JSON.parse(await file.text())); await refresh(); toast('Respaldo restaurado'); }
  catch (e) { alert('No se pudo restaurar: ' + e.message); }
}

// ============================================================ modal / drawer
function modal(title, body, foot, wide = false) {
  const m = $('#modal');
  m.innerHTML = `<div class="modal-box ${wide ? 'wide' : ''}" role="dialog" aria-modal="true"><div class="modal-head"><h2>${title}</h2><button class="x" onclick="closeModal()">×</button></div><div class="modal-body">${body}</div>${foot ? `<div class="modal-foot">${foot}</div>` : ''}</div>`;
  m.hidden = false;
  m.onclick = e => { if (e.target === m) closeModal(); };
}
const closeModal = () => { $('#modal').hidden = true; $('#modal').innerHTML = ''; };
let openDrawerId = null;
function drawer(html) {
  const d = $('#drawer'); d.innerHTML = `<div class="drawer-box">${html}</div>`; d.hidden = false;
  d.onclick = e => { if (e.target === d) closeDrawer(); };
}
const closeDrawer = () => { openDrawerId = null; $('#drawer').hidden = true; $('#drawer').innerHTML = ''; };
document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (!$('#modal').hidden) closeModal(); else closeDrawer(); } });
const formData = f => Object.fromEntries(new FormData(f).entries());
const nz = v => v === '' || v == null ? null : v;

// ------------------------------------------------------------ formulario de proyecto
function projectForm(id = null, pre = {}) {
  const p = id ? PRO[id] : { figura: 'GD', capacidad_kw: 990, etapa: 'Desarrollo', estado: 'Activo', fecha_contrato: HOY, ...pre };
  const cars = S.entidades.filter(e => AMB.includes(e.tipo)), ors = S.entidades.filter(e => e.tipo === 'Operador de red');
  const sugg = suggest;
  const body = `<form id="pf" class="form-grid">
    <div><label>Nombre del proyecto *</label><input name="nombre" required value="${esc(p.nombre)}" placeholder="GD Sogamoso – La Esperanza"></div>
    <div><label>Código</label><input name="codigo" value="${esc(p.codigo)}" placeholder="GD-BOY-003"></div>
    <div><label>Figura</label><select name="figura" onchange="pfChange()">${Object.entries(FIGURAS).map(([k, v]) => `<option value="${k}" ${p.figura === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
    <div><label>Capacidad (kWac)</label><input name="capacidad_kw" type="number" step="any" value="${esc(p.capacidad_kw)}" onchange="pfChange()"></div>
    <div><label>Departamento *</label><select name="departamento" required onchange="pfDep()"><option value="">Selecciona…</option>${DEPTOS.map(d => `<option ${p.departamento === d ? 'selected' : ''}>${d}</option>`).join('')}</select></div>
    <div><label>Municipio *</label><input name="municipio" required value="${esc(p.municipio)}"></div>
    <div><label>Autoridad ambiental (CAR)</label><select name="car_id" id="pfCar" onchange="pfChange()">${entOptions(cars, p.car_id, sugg(cars, p.departamento), 'Selecciona…')}</select></div>
    <div><label>Operador de red</label><select name="or_id" id="pfOr" onchange="pfChange()">${entOptions(ors, p.or_id, sugg(ors, p.departamento), 'Selecciona…')}</select></div>
    <div><label>Predio</label><input name="predio" value="${esc(p.predio)}"></div>
    <div><label>Responsable</label><input name="responsable" value="${esc(p.responsable)}"></div>
    <div><label>Latitud (decimal)</label><input name="lat" type="number" step="any" value="${esc(p.lat)}" placeholder="5.7145"></div>
    <div><label>Longitud (decimal)</label><input name="lon" type="number" step="any" value="${esc(p.lon)}" placeholder="-72.9339"></div>
    <div><label>Fecha de firma del contrato</label><input name="fecha_contrato" type="date" value="${esc(p.fecha_contrato)}"></div>
    <div><label>Fecha objetivo de RTB</label><input name="rtb_objetivo" type="date" value="${esc(p.rtb_objetivo)}"></div>
    <div><label>Presupuesto de desarrollo (COP)</label><input name="presupuesto" type="number" step="any" value="${esc(p.presupuesto)}"></div>
    <div><label>Circuito de conexión</label><input name="circuito" value="${esc(p.circuito)}" placeholder="se lee de los insumos del OR"></div>
    <div><label>Subestación</label><input name="subestacion" value="${esc(p.subestacion)}"></div>
    <div><label>Capacidad de la subestación (MVA)</label><input name="capacidad_se_mva" type="number" step="any" value="${esc(p.capacidad_se_mva)}"></div>
    <div><label>Etapa actual</label><select name="etapa">${ETAPAS_PROY.map(e => `<option ${p.etapa === e ? 'selected' : ''}>${e}</option>`).join('')}</select></div>
    <div><label>Estado</label><select name="estado">${ESTADOS_PROY.map(e => `<option ${p.estado === e ? 'selected' : ''}>${e}</option>`).join('')}</select></div>
    <div class="full"><label>Notas</label><textarea name="notas">${esc(p.notas)}</textarea></div>
    ${id ? '' : `<div class="full"><label>Trámites que se van a generar</label><div id="pfList" class="checklist"></div><div class="hint">Los trámites base se marcan según la figura. Las consultas adicionales (ductos, operadores de hidrocarburos, titulares mineros…) también se pueden agregar después, cuando aparezca el hallazgo.</div></div>`}
  </form>`;
  const foot = `${id ? `<button class="btn danger" style="margin-right:auto" onclick="delProject(${id})">Eliminar proyecto</button>` : ''}<button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="saveProject(${id})">${id ? 'Guardar cambios' : 'Crear proyecto'}</button>`;
  modal(id ? 'Editar proyecto' : 'Nuevo proyecto', body, foot, true);
  projectForm._extra = pre.extra || [];
  if (!id) pfChange();
}
function pfDep() {
  const f = $('#pf'), dep = f.departamento.value;
  const cars = S.entidades.filter(e => AMB.includes(e.tipo)), ors = S.entidades.filter(e => e.tipo === 'Operador de red');
  const sg = l => suggest(l, dep);
  $('#pfCar').innerHTML = entOptions(cars, sg(cars)[0]?.id, sg(cars), 'Selecciona…');
  $('#pfOr').innerHTML = entOptions(ors, sg(ors)[0]?.id, sg(ors), 'Selecciona…');
  pfChange();
}
function pfChange() {
  const box = $('#pfList'); if (!box) return;
  const f = $('#pf'), fig = f.figura.value, kw = +f.capacidad_kw.value || 0;
  const prev = new Set($$('input[name=cat]:checked', box).map(i => +i.value));
  const first = !box._auto;
  const auto = new Set(routeItems(fig, kw, {}, projectForm._extra).map(i => i.c.id));
  const oldAuto = box._auto || new Set(); box._auto = auto;
  // lo que entra a la ruta automática se marca; lo que sale de ella se desmarca; lo demás respeta la selección manual
  const isChecked = id => first ? auto.has(id) : auto.has(id) && !oldAuto.has(id) ? true : !auto.has(id) && oldAuto.has(id) ? false : prev.has(id);
  const cats = S.catalogo.filter(c => c.figuras === '*' || (c.figuras || '').split(',').includes(fig))
    .sort((a, b) => b.base - a.base || AREAS.indexOf(a.area) - AREAS.indexOf(b.area) || a.orden - b.orden);
  const pseudo = { car_id: f.car_id.value, or_id: f.or_id.value, mun_id: 'mun' };
  const row = c => {
    const eid = c.entidad_tipo === 'Municipal' ? 'mun' : resolveEnt(c, pseudo);
    const checked = isChecked(c.id);
    const entSel = eid ? `<span class="tag">${eid === 'mun' ? 'Alcaldía' : esc(ent(eid).sigla)}</span>` :
      `<select name="ent_${c.id}" onclick="event.stopPropagation()" style="width:170px;padding:3px 6px;font-size:12px">${entOptions(S.entidades.filter(e => e.tipo === c.entidad_tipo), null, [], 'Entidad…')}</select>`;
    return `<label><input type="checkbox" name="cat" value="${c.id}" ${checked ? 'checked' : ''}><span>${esc(c.nombre)}${c.motivo ? `<div class="muted small">${esc(c.motivo)}</div>` : ''}</span>${entSel}</label>`;
  };
  const base = cats.filter(c => c.base || auto.has(c.id)), adds = cats.filter(c => !c.base && !auto.has(c.id));
  box.innerHTML = AREAS.map(et => { const x = base.filter(c => c.area === et); return x.length ? `<div class="grp">${et}</div>${x.map(row).join('')}` : ''; }).join('') +
    `<div class="grp">Consultas adicionales (por hallazgo)</div>${adds.map(row).join('')}`;
}
async function ensureMunicipio(mun, dep) {
  const sigla = `Alcaldía ${mun.trim()}`;
  const ex = S.entidades.find(e => e.tipo === 'Municipal' && e.sigla.toLowerCase() === sigla.toLowerCase() && (!e.departamentos || e.departamentos === dep));
  if (ex) return ex.id;
  const e = await api('POST', '/api/entidades', { sigla, nombre: `Alcaldía de ${mun.trim()} – Secretaría de Planeación`, tipo: 'Municipal', departamentos: dep });
  return e.id;
}
async function saveProject(id) {
  const f = $('#pf'); if (!f.reportValidity()) return;
  const d = formData(f);
  ['lat', 'lon', 'capacidad_kw', 'car_id', 'or_id', 'fecha_contrato', 'rtb_objetivo', 'presupuesto', 'circuito', 'subestacion', 'capacidad_se_mva'].forEach(k => d[k] = nz(d[k]));
  ['car_id', 'or_id'].forEach(k => d[k] = d[k] && +d[k]);
  try {
    d.mun_id = await ensureMunicipio(d.municipio, d.departamento);
    if (id) {
      const old = PRO[id];
      await api('PUT', `/api/proyectos/${id}`, d);
      // si cambió CAR / OR / municipio, re-asigna los trámites aún no radicados
      const map = { CAR: ['car_id'], 'Operador de red': ['or_id'], Municipal: ['mun_id'] };
      for (const t of (TR[id] || []).filter(t => !t.fecha_radicado)) {
        const c = CAT[t.catalogo_id]; const k = c && map[c.entidad_tipo]?.[0];
        if (k && old[k] !== d[k] && d[k]) await api('PUT', `/api/tramites/${t.id}`, { entidad_id: d[k] });
      }
      closeModal(); await refresh(); toast('Proyecto actualizado');
    } else {
      const sel = $$('#pfList input[name=cat]:checked').map(i => +i.value);
      const missing = [];
      const tramites = sel.map(cid => {
        const c = CAT[cid]; let eid = resolveEnt(c, d);
        if (!eid) { const s = f[`ent_${cid}`]; eid = s && s.value ? +s.value : null; }
        if (!eid) missing.push(c.nombre);
        return { catalogo_id: c.id, entidad_id: eid, nombre: c.nombre, etapa: c.etapa, area: c.area, adicional: c.base ? 0 : 1, motivo: c.base ? '' : c.motivo, plazo_dias: c.plazo_dias, tipo_plazo: c.tipo_plazo, estado: 'Por radicar' };
      });
      if (missing.length && !confirm(`Estos trámites no tienen entidad asignada:\n- ${missing.join('\n- ')}\n\n¿Crear el proyecto de todas formas? (podrás asignarla luego)`)) return;
      const r = await api('POST', '/api/proyectos/completo', { proyecto: d, tramites });
      closeModal(); await load(); location.hash = `#/proyecto/${r.proyecto.id}`; render(); toast('Proyecto creado');
    }
  } catch (e) { alert('Error: ' + e.message); }
}
async function delProject(id) {
  if (!confirm(`¿Eliminar "${PRO[id].nombre}" con todos sus trámites y eventos? Esta acción no se puede deshacer.`)) return;
  await api('DELETE', `/api/proyectos/${id}`); closeModal(); location.hash = '#/proyectos'; await refresh(); toast('Proyecto eliminado');
}

// ------------------------------------------------------------ agregar consulta
function addConsulta(pid) {
  const p = PRO[pid];
  const cats = S.catalogo.filter(c => c.figuras === '*' || (c.figuras || '').split(',').includes(p.figura));
  const opt = c => `<option value="${c.id}">${esc(c.motivo ? c.motivo + ' → ' : '')}${esc(c.nombre)}</option>`;
  const body = `<form id="cf" class="form-grid">
    <div class="full"><label>Tipo de consulta</label><select name="cat" onchange="cfFill(${pid})">
      <option value="">Personalizada (escribir)…</option>
      <optgroup label="Consultas adicionales por hallazgo">${cats.filter(c => !c.base).map(opt).join('')}</optgroup>
      <optgroup label="Trámites del catálogo base">${cats.filter(c => c.base).map(opt).join('')}</optgroup>
    </select></div>
    <div class="full"><label>Nombre del trámite *</label><input name="nombre" required></div>
    <div class="full"><label>Motivo / hallazgo que la origina</label><input name="motivo" placeholder="Ej.: respuesta ANH indica solapamiento con bloque VMM-xx"></div>
    <div class="full"><label>Entidad *</label><div style="display:flex;gap:8px"><select name="entidad_id" id="cfEnt" required></select><button type="button" class="btn" onclick="quickEntity()">+ Nueva</button></div></div>
    <div><label>Área</label><select name="area">${AREAS.map(e => `<option>${e}</option>`).join('')}</select></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div><label>Plazo (días)</label><input name="plazo_dias" type="number" placeholder="sin plazo"></div><div><label>Tipo de días</label><select name="tipo_plazo"><option>hábiles</option><option>calendario</option></select></div></div>
    <div><label>Fecha de radicado (opcional)</label><input name="fecha_radicado" type="date"></div>
    <div><label>N.º de radicado</label><input name="radicado_num"></div>
  </form>`;
  modal(`Agregar consulta · ${esc(p.nombre)}`, body, `<button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="saveConsulta(${pid})">Agregar</button>`);
  cfFill(pid);
}
function cfFill(pid) {
  const f = $('#cf'), c = CAT[+f.cat.value], p = PRO[pid];
  let list = S.entidades, pre = null, sugg = [];
  if (c) {
    f.nombre.value = c.nombre; f.motivo.value = c.base ? '' : c.motivo; f.area.value = c.area;
    f.plazo_dias.value = c.plazo_dias ?? ''; f.tipo_plazo.value = c.tipo_plazo || 'hábiles';
    pre = resolveEnt(c, p);
    const tipos = c.entidad_tipo === 'CAR' ? AMB : [c.entidad_tipo];
    sugg = S.entidades.filter(e => tipos.includes(e.tipo));
  }
  $('#cfEnt').innerHTML = `<option value="">Selecciona…</option>` + (sugg.length ? `<optgroup label="Sugeridas">${sugg.map(e => `<option value="${e.id}" ${pre === e.id ? 'selected' : ''}>${esc(e.sigla)} – ${esc(e.nombre)}</option>`).join('')}</optgroup>` : '') +
    `<optgroup label="Todas">${list.filter(e => !sugg.includes(e)).map(e => `<option value="${e.id}">${esc(e.sigla)} – ${esc(e.nombre)}</option>`).join('')}</optgroup>`;
}
function quickEntity() {
  const sigla = prompt('Sigla o nombre corto de la nueva entidad (ej.: OCENSA, Hocol, Gobernación de Boyacá):'); if (!sigla) return;
  const tipo = prompt(`Tipo de entidad (${TIPOS_ENT.join(', ')}):`, 'Otro') || 'Otro';
  api('POST', '/api/entidades', { sigla: sigla.trim(), nombre: sigla.trim(), tipo: tipo.trim() }).then(async e => {
    await load(); const s = $('#cfEnt'); s.insertAdjacentHTML('afterbegin', `<option value="${e.id}">${esc(e.sigla)}</option>`); s.value = e.id; toast('Entidad creada');
  });
}
async function saveConsulta(pid) {
  const f = $('#cf'); if (!f.reportValidity()) return;
  const d = formData(f), c = CAT[+d.cat];
  const t = await api('POST', '/api/tramites', {
    proyecto_id: pid, catalogo_id: c?.id || null, entidad_id: +d.entidad_id, nombre: d.nombre, area: d.area, etapa: etapaDe(d.area),
    adicional: c && c.base ? 0 : 1, motivo: d.motivo, plazo_dias: nz(d.plazo_dias) && +d.plazo_dias, tipo_plazo: d.tipo_plazo,
    radicado_num: d.radicado_num, fecha_radicado: nz(d.fecha_radicado), estado: d.fecha_radicado ? 'Radicado' : 'Por radicar',
  });
  if (d.fecha_radicado) await api('POST', '/api/eventos', { tramite_id: t.id, fecha: d.fecha_radicado, tipo: 'Radicado', descripcion: d.radicado_num ? `Radicado ${d.radicado_num}` : 'Radicación de la solicitud' });
  closeModal(); await refresh(); toast('Consulta agregada');
}

// ------------------------------------------------------------ detalle de trámite
function openTramite(id) {
  const t = S.tramites.find(x => x.id === id); if (!t) return closeDrawer();
  openDrawerId = id;
  const m = tm(t), e = ent(t.entidad_id), p = PRO[t.proyecto_id], evs = EV[t.id] || [];
  const u = t.tipo_plazo === 'calendario' ? 'calendario' : 'hábiles';
  const en = esEntregable(t);
  drawer(`<div class="modal-head"><div><div class="muted small"><a href="#/proyecto/${p.id}" onclick="closeDrawer()">${esc(p.nombre)}</a> · ${esc(etapaDe(t.area))} · ${esc(t.area)}</div><h2>${en ? '' : esc(e.sigla) + ' · '}${esc(t.nombre)}</h2></div><button class="x" onclick="closeDrawer()">×</button></div>
  <div class="drawer-body">
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">${semPill(t)} ${en ? '<span class="tag">entregable</span>' : resPill(t.resultado)} ${vigPill(t)} ${t.adicional ? '<span class="tag acc">adicional</span>' : ''}
      ${t.responsable ? `<span class="tag">👤 ${esc(t.responsable)}</span>` : ''} ${t.compromiso ? `<span class="tag ${t.compromiso < HOY && !t.fecha_respuesta ? 'acc' : ''}">compromiso ${fmtD(t.compromiso)}</span>` : ''}</div>
    ${!en && ['vencido', 'susp'].includes(m.sem) || (!en && m.sem === 'porvencer') ? `<div class="note warn" style="margin-bottom:14px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
      <span>${m.sem === 'vencido' ? 'La entidad superó el plazo legal.' : m.sem === 'porvencer' ? 'El plazo está por vencer.' : 'Plazo suspendido por requerimiento.'}</span>
      ${m.sem === 'vencido' ? `<a class="btn sm primary" href="/api/carta?tramite=${t.id}&tipo=insistencia">Generar insistencia (Word)</a>
      ${ent(t.entidad_id).tipo === 'Operador de red' ? `<a class="btn sm" href="/api/carta?tramite=${t.id}&tipo=sspd">Queja ante la SSPD (Word)</a>` : ''}` : ''}</div>` : ''}
    ${t.motivo ? `<div class="note" style="margin-bottom:14px"><b>Motivo:</b> ${esc(t.motivo)}</div>` : ''}
    ${t.detalle ? `<div class="note" style="margin-bottom:14px"><b>Detalle:</b> ${esc(t.detalle)}</div>` : ''}
    ${en ? `<div class="facts" style="margin-bottom:18px">
      <div><span>Responsable</span><b>${esc(e.nombre || e.sigla)}</b></div>
      <div><span>Fecha de entrega</span><b>${fmtD(t.fecha_respuesta)}</b></div>
    </div>` : `<div class="facts" style="margin-bottom:18px">
      <div><span>Entidad</span><b>${esc(e.nombre || e.sigla)}</b></div>
      <div><span>N.º radicado</span><b>${esc(t.radicado_num || '—')}</b></div>
      <div><span>Radicado</span><b>${fmtD(t.fecha_radicado)}</b></div>
      <div><span>Respuesta</span><b>${fmtD(t.fecha_respuesta)}</b></div>
      <div><span>Plazo legal</span><b>${t.plazo_dias != null ? `${t.plazo_dias} días ${u}` : 'Sin plazo legal'}</b></div>
      <div><span>Vence</span><b>${m.suspendido ? 'Suspendido' : fmtD(m.vence)}</b></div>
      <div><span>Días de la entidad</span><b>${m.dias ?? '—'}</b></div>
      <div><span>Días suspendido</span><b>${m.susp || 0} (${m.nreq} req.)</b></div>
    </div>`}
    ${subsanacionesHtml(t)}
    <div class="card card-pad" style="margin-bottom:18px">
      <h3 style="margin-bottom:10px">${en ? 'Registrar entrega' : 'Registrar evento'}</h3>
      <form id="ef" class="form-grid">
        <div><label>Evento</label><select name="tipo" onchange="efTipo()">${(en ? ['Entrega', 'Nota'] : EVENTOS.filter(x => x !== 'Entrega')).map(x => `<option ${x === (en ? 'Entrega' : t.fecha_radicado ? (t.estado === 'Requerimiento' ? 'Respuesta a requerimiento' : 'Respuesta de la entidad') : 'Radicado') ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
        <div><label>Fecha</label><input type="date" name="fecha" value="${HOY}" required></div>
        <div id="efRad"><label>N.º de radicado</label><input name="radicado_num" value="${esc(t.radicado_num)}"></div>
        <div id="efRes"><label>Resultado</label><select name="resultado">${RESULTADOS.map(r => `<option>${r}</option>`).join('')}</select></div>
        <div id="efDet" class="full"><label>Detalle (versión, valores clave)</label><input name="detalle" value="${esc(t.detalle)}" placeholder="${t.nombre.includes('PVsyst') ? 'P50: … MWh/año · P75: … · P90: …' : 'Versión, observaciones'}"></div>
        <div class="full"><label>Descripción</label><input name="descripcion" placeholder="Detalle, oficio de respuesta, condiciones…"></div>
        <div class="full"><button type="button" class="btn primary" onclick="saveEvento(${t.id})">Registrar</button></div>
      </form>
    </div>
    <h3 style="margin-bottom:10px">Historial</h3>
    ${evs.length ? `<ul class="timeline">${evs.map(v => `<li class="${v.tipo.startsWith('Requerimiento') ? 'req' : ['Respuesta de la entidad', 'Entrega'].includes(v.tipo) ? 'resp' : ''}">
      <div style="display:flex;justify-content:space-between;gap:8px"><b>${esc(v.tipo)}</b><button class="btn ghost sm danger" onclick="delEvento(${v.id},${t.id})">Quitar</button></div>
      <div class="d">${fmtD(v.fecha)}${v.usuario ? ` · registrado por ${esc(v.usuario)}` : v.fuente ? ' · sincronizado desde SharePoint' : ''}</div>${v.descripcion ? `<div>${esc(v.descripcion)}</div>` : ''}
      ${v.fuente ? `<div class="small muted" title="${esc(v.fuente)}">📄 ${esc(baseName(v.fuente))} ${docLinks(p, v.fuente)}</div>` : ''}</li>`).join('')}</ul>` : '<p class="muted">Sin eventos registrados.</p>'}
    <details style="margin-top:18px"><summary style="cursor:pointer;font-weight:600">Editar datos del trámite</summary>
      <form id="tf" class="form-grid" style="margin-top:12px">
        <div class="full"><label>Nombre</label><input name="nombre" value="${esc(t.nombre)}"></div>
        <div class="full"><label>Entidad</label><select name="entidad_id">${S.entidades.map(x => `<option value="${x.id}" ${x.id === t.entidad_id ? 'selected' : ''}>${esc(x.sigla)} – ${esc(x.nombre)}</option>`).join('')}</select></div>
        <div><label>Área</label><select name="area">${AREAS.map(x => `<option ${x === t.area ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
        <div><label>Estado</label><select name="estado">${ESTADOS_T.map(x => `<option ${x === t.estado ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
        <div><label>Plazo (días)</label><input name="plazo_dias" type="number" value="${t.plazo_dias ?? ''}"></div>
        <div><label>Tipo de días</label><select name="tipo_plazo"><option ${u === 'hábiles' ? 'selected' : ''}>hábiles</option><option ${u === 'calendario' ? 'selected' : ''}>calendario</option></select></div>
        <div><label>Fecha radicado</label><input name="fecha_radicado" type="date" value="${esc(t.fecha_radicado)}"></div>
        <div><label>Fecha respuesta</label><input name="fecha_respuesta" type="date" value="${esc(t.fecha_respuesta)}"></div>
        <div><label>Resultado</label><select name="resultado"><option value="">—</option>${RESULTADOS.map(r => `<option ${r === t.resultado ? 'selected' : ''}>${r}</option>`).join('')}</select></div>
        <div><label>N.º radicado</label><input name="radicado_num" value="${esc(t.radicado_num)}"></div>
        <div><label>Responsable</label><input name="responsable" list="dlResp" value="${esc(t.responsable)}"><datalist id="dlResp">${responsables().map(r => `<option value="${esc(r)}">`).join('')}</datalist></div>
        <div><label>Fecha compromiso</label><input name="compromiso" type="date" value="${esc(t.compromiso)}"></div>
        <div><label>Vigencia hasta</label><input name="vigencia_hasta" type="date" value="${esc(t.vigencia_hasta)}">${CAT[t.catalogo_id]?.vigencia_meses ? `<div class="hint">Si se deja vacío: ${CAT[t.catalogo_id].vigencia_meses} meses desde la respuesta.</div>` : ''}</div>
        <div class="full"><label>Detalle</label><input name="detalle" value="${esc(t.detalle)}"></div>
        <div class="full"><label>Motivo</label><input name="motivo" value="${esc(t.motivo)}"></div>
        <div class="full"><label>Notas</label><textarea name="notas">${esc(t.notas)}</textarea></div>
        <div class="full actions"><button type="button" class="btn primary" onclick="saveTram(${t.id})">Guardar</button><button type="button" class="btn danger" onclick="delTram(${t.id})">Eliminar trámite</button></div>
      </form>
    </details>
  </div>`);
  efTipo();
}
function efTipo() {
  const f = $('#ef'); if (!f) return;
  $('#efRad').style.display = f.tipo.value === 'Radicado' ? '' : 'none';
  $('#efRes').style.display = f.tipo.value === 'Respuesta de la entidad' ? '' : 'none';
  $('#efDet').style.display = f.tipo.value === 'Entrega' ? '' : 'none';
}
/** Recalcula fechas y estado del trámite a partir de su historial de eventos. */
function deriveFromEvents(t, evs, extra = {}) {
  const u = {};
  const rad = evs.find(e => e.tipo === 'Radicado');
  if (rad) u.fecha_radicado = rad.fecha;
  const esResp = e => e.tipo === 'Respuesta de la entidad' || e.tipo === 'Entrega';
  const resp = [...evs].reverse().find(esResp);
  const fr = u.fecha_radicado ?? t.fecha_radicado;
  if (resp) { u.fecha_respuesta = resp.fecha; u.estado = 'Respondido'; }
  else {
    if (t.fecha_respuesta && !evs.some(esResp) && extra.removedResp) { u.fecha_respuesta = null; u.resultado = ''; }
    if (!t.fecha_respuesta || extra.removedResp) {
      let open = false; evs.forEach(e => { if (EV_ABRE.includes(e.tipo)) open = true; if (EV_CIERRA.includes(e.tipo)) open = false; });
      u.estado = fr ? (open ? 'Requerimiento' : 'Radicado') : 'Por radicar';
    }
  }
  return { ...u, ...extra.set };
}
async function saveEvento(tid) {
  const f = $('#ef'); if (!f.reportValidity()) return;
  const d = formData(f), t = S.tramites.find(x => x.id === tid);
  let desc = d.descripcion;
  if (d.tipo === 'Respuesta de la entidad') desc = `Resultado: ${d.resultado}${desc ? '. ' + desc : ''}`;
  if (d.tipo === 'Radicado' && d.radicado_num && !desc) desc = `Radicado ${d.radicado_num}`;
  const ev = await api('POST', '/api/eventos', { tramite_id: tid, fecha: d.fecha, tipo: d.tipo, descripcion: desc });
  if (EV_ESTADO.includes(d.tipo)) {
    const evs = [...(EV[tid] || []), ev].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id - b.id);
    const set = {};
    if (d.tipo === 'Radicado' && d.radicado_num) set.radicado_num = d.radicado_num;
    if (d.tipo === 'Respuesta de la entidad') set.resultado = d.resultado;
    if (d.tipo === 'Entrega' && d.detalle) set.detalle = d.detalle;
    await api('PUT', `/api/tramites/${tid}`, deriveFromEvents(t, evs, { set }));
  }
  await refresh(); toast('Evento registrado');
}
async function delEvento(id, tid) {
  if (!confirm('¿Quitar este evento del historial?')) return;
  const v = S.eventos.find(e => e.id === id), t = S.tramites.find(x => x.id === tid);
  await api('DELETE', `/api/eventos/${id}`);
  if (EV_ESTADO.includes(v.tipo)) {
    const evs = (EV[tid] || []).filter(e => e.id !== id);
    const u = deriveFromEvents(t, evs, { removedResp: v.tipo === 'Respuesta de la entidad' || v.tipo === 'Entrega' });
    if (v.tipo === 'Radicado' && !evs.some(e => e.tipo === 'Radicado')) { u.fecha_radicado = null; u.estado = 'Por radicar'; }
    await api('PUT', `/api/tramites/${tid}`, u);
  }
  await refresh();
}
async function saveTram(id) {
  const d = formData($('#tf'));
  ['plazo_dias', 'fecha_radicado', 'fecha_respuesta', 'vigencia_hasta', 'compromiso'].forEach(k => d[k] = nz(d[k]));
  d.plazo_dias = d.plazo_dias == null ? null : +d.plazo_dias; d.entidad_id = +d.entidad_id;
  d.etapa = etapaDe(d.area);
  if (d.fecha_respuesta && d.estado !== 'No aplica') d.estado = 'Respondido';
  if (!d.fecha_respuesta && d.estado === 'Respondido') d.estado = d.fecha_radicado ? 'Radicado' : 'Por radicar';
  await api('PUT', `/api/tramites/${id}`, d); await refresh(); toast('Trámite guardado');
}
async function delTram(id) {
  if (!confirm('¿Eliminar este trámite y su historial?')) return;
  await api('DELETE', `/api/tramites/${id}`); closeDrawer(); await refresh(); toast('Trámite eliminado');
}

// ------------------------------------------------------------ catálogo: formularios
function entityForm(id) {
  const e = id ? ENT[id] : { tipo: 'Otro' };
  modal(id ? 'Editar entidad' : 'Nueva entidad', `<form id="enf" class="form-grid">
    <div><label>Sigla *</label><input name="sigla" required value="${esc(e.sigla)}"></div>
    <div><label>Tipo</label><select name="tipo">${TIPOS_ENT.map(t => `<option ${e.tipo === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
    <div class="full"><label>Nombre</label><input name="nombre" value="${esc(e.nombre)}"></div>
    <div class="full"><label>Departamentos de jurisdicción (separados por coma)</label><input name="departamentos" value="${esc(e.departamentos)}" placeholder="Boyacá,Cundinamarca"><div class="hint">Se usa para sugerir la CAR y el operador de red al crear un proyecto.</div></div>
    <div class="full"><label>Notas (contacto, canal de radicación…)</label><textarea name="notas">${esc(e.notas)}</textarea></div>
  </form>`, `${id && !S.tramites.some(t => t.entidad_id === id) ? `<button class="btn danger" style="margin-right:auto" onclick="delEntity(${id})">Eliminar</button>` : ''}<button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="saveEntity(${id || 'null'})">Guardar</button>`);
}
async function saveEntity(id) {
  const f = $('#enf'); if (!f.reportValidity()) return;
  const d = formData(f);
  await api(id ? 'PUT' : 'POST', id ? `/api/entidades/${id}` : '/api/entidades', d); closeModal(); await refresh(); toast('Entidad guardada');
}
async function delEntity(id) { if (!confirm('¿Eliminar esta entidad?')) return; await api('DELETE', `/api/entidades/${id}`); closeModal(); await refresh(); }
function catForm(id) {
  const c = id ? CAT[id] : { area: 'Solapamientos', clase: 'consulta', tipo_plazo: 'hábiles', figuras: '*', base: 0, entidad_tipo: 'Nacional' };
  modal(id ? 'Editar tipo de trámite' : 'Nuevo tipo de trámite', `<form id="ctf" class="form-grid">
    <div><label>Código *</label><input name="codigo" required value="${esc(c.codigo)}"></div>
    <div><label>Área</label><select name="area">${AREAS.map(e => `<option ${c.area === e ? 'selected' : ''}>${e}</option>`).join('')}</select></div><div><label>Clase</label><select name="clase"><option value="consulta" ${c.clase !== 'entregable' ? 'selected' : ''}>Consulta a entidad (con plazo)</option><option value="entregable" ${c.clase === 'entregable' ? 'selected' : ''}>Entregable interno</option></select></div>
    <div class="full"><label>Nombre *</label><input name="nombre" required value="${esc(c.nombre)}"></div>
    <div><label>Tipo de entidad</label><select name="entidad_tipo">${TIPOS_ENT.map(t => `<option ${c.entidad_tipo === t ? 'selected' : ''}>${t}</option>`).join('')}</select><div class="hint">CAR, Operador de red y Municipal se asignan automáticamente según el proyecto.</div></div>
    <div><label>Entidad fija (sigla, opcional)</label><input name="entidad_sigla" value="${esc(c.entidad_sigla)}" placeholder="ANLA"></div>
    <div><label>Plazo (días)</label><input name="plazo_dias" type="number" value="${c.plazo_dias ?? ''}" placeholder="sin plazo"></div>
    <div><label>Tipo de días</label><select name="tipo_plazo"><option ${c.tipo_plazo !== 'calendario' ? 'selected' : ''}>hábiles</option><option ${c.tipo_plazo === 'calendario' ? 'selected' : ''}>calendario</option></select></div>
    <div class="full"><label>Base legal</label><input name="base_legal" value="${esc(c.base_legal)}"></div>
    <div><label>Figuras (GD,CE,AGR,PMR o *)</label><input name="figuras" value="${esc(c.figuras)}"></div>
    <div><label>¿Trámite base?</label><select name="base"><option value="1" ${c.base ? 'selected' : ''}>Sí – se genera siempre</option><option value="0" ${!c.base ? 'selected' : ''}>No – adicional por hallazgo</option></select></div>
    <div class="full"><label>Cuándo aplica (motivo / hallazgo)</label><input name="motivo" value="${esc(c.motivo)}"></div>
  </form>`, `<button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="saveCat(${id || 'null'})">Guardar</button>`);
}
async function saveCat(id) {
  const f = $('#ctf'); if (!f.reportValidity()) return;
  const d = formData(f); d.plazo_dias = nz(d.plazo_dias) == null ? null : +d.plazo_dias; d.base = +d.base;
  d.etapa = etapaDe(d.area);
  if (!id) d.orden = S.catalogo.length;
  await api(id ? 'PUT' : 'POST', id ? `/api/catalogo/${id}` : '/api/catalogo', d); closeModal(); await refresh(); toast('Tipo de trámite guardado');
}

// ============================================================ arranque
(function theme() {
  const saved = ls.get('theme'); if (saved) document.documentElement.dataset.theme = saved;
  $('#themeBtn').onclick = () => {
    const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const nx = cur === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = nx; ls.set('theme', nx); render();
  };
})();
$('#hoyLbl').textContent = 'Hoy: ' + fmtD(HOY);
window.addEventListener('hashchange', () => { closeDrawer(); render(); });
// ============================================================ inicio de sesión
let USUARIO = null;
async function boot() {
  let st;
  try { st = await (await fetch('/api/auth/estado')).json(); }
  catch (e) { LOADED = false; $('#main').innerHTML = offline(e.message); return; }
  if (st.configurar) return pantallaAcceso(true);
  if (!st.usuario) return pantallaAcceso();
  USUARIO = st.usuario; $('#authScreen')?.remove(); pintarUsuario(); setTimeout(revisarTickets, 1500); $('#ayudaBtn').hidden = false;
  load().then(() => { LOADED = true; render(); })
    .catch(e => { LOADED = false; if (!$('#authScreen')) $('#main').innerHTML = offline(e.message); });
}
function pantallaAcceso(configurar = false) {
  LOADED = false; USUARIO = null; closeModal(); closeDrawer(); $('#ayudaBtn') && ($('#ayudaBtn').hidden = true); $('#ayudaPanel')?.remove();
  $('#authScreen')?.remove();
  document.body.insertAdjacentHTML('beforeend', `<div id="authScreen" class="auth-screen">
    <form class="auth-box" onsubmit="entrar(event, ${configurar})">
      <img src="logo-solcor-blanco.png" alt="SOLCOR Colombia" class="auth-logo">
      <h1>Ruta Desarrollo de GD</h1>
      <p>${configurar ? 'Primera vez: crea la cuenta del administrador de la plataforma.' : 'Ingresa con tu correo y contraseña.'}</p>
      ${configurar ? '<label>Nombre</label><input name="nombre" required autocomplete="name">' : ''}
      <label>Correo</label><input name="email" type="email" required autocomplete="username" autofocus>
      <label>Contraseña</label><input name="password" type="password" required minlength="${configurar ? 8 : 1}" autocomplete="${configurar ? 'new-password' : 'current-password'}">
      ${configurar ? '<label>Confirmar contraseña</label><input name="confirmar" type="password" required minlength="8" autocomplete="new-password"><div class="hint">Mínimo 8 caracteres.</div>' : ''}
      <div id="authErr" class="auth-err" hidden></div>
      <button class="btn primary" type="submit">${configurar ? 'Crear cuenta e ingresar' : 'Ingresar'}</button>
      ${configurar ? '' : '<div class="hint" style="text-align:center">¿Olvidaste la contraseña? Pídele a un administrador que te asigne una nueva.</div>'}
    </form></div>`);
}
async function entrar(ev, configurar) {
  ev.preventDefault();
  const d = formData(ev.target), err = $('#authErr'); err.hidden = true;
  if (configurar && d.password !== d.confirmar) { err.textContent = 'Las contraseñas no coinciden'; err.hidden = false; return; }
  const res = await fetch(`/api/auth/${configurar ? 'configurar' : 'login'}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) });
  const r = await res.json().catch(() => ({}));
  if (!res.ok) { err.textContent = r.error || 'No fue posible ingresar'; err.hidden = false; return; }
  boot();
}
async function salir() {
  await fetch('/api/auth/logout', { method: 'POST' });
  location.hash = '#/tablero'; pantallaAcceso();
}
function pintarUsuario() {
  const el = $('#userBox'); if (!el || !USUARIO) return;
  const rol = { admin: 'Administrador', editor: 'Editor', lector: 'Solo lectura' }[USUARIO.rol] || USUARIO.rol;
  el.innerHTML = `<div class="user-name">${esc(USUARIO.nombre)}</div><div class="small" style="opacity:.75">${esc(USUARIO.email)} · ${rol}</div>
    <div class="user-acts"><a href="#" onclick="event.preventDefault();cambiarClave()">Cambiar contraseña</a><a href="#" onclick="event.preventDefault();salir()">Cerrar sesión</a></div>`;
  document.body.classList.toggle('lector', USUARIO.rol === 'lector');
}
function cambiarClave() {
  modal('Cambiar contraseña', `<form id="pwf" class="form-grid">
    <div class="full"><label>Contraseña actual</label><input name="actual" type="password" required autocomplete="current-password"></div>
    <div><label>Nueva contraseña</label><input name="nueva" type="password" required minlength="8" autocomplete="new-password"></div>
    <div><label>Confirmar</label><input name="confirmar" type="password" required minlength="8" autocomplete="new-password"></div></form>`,
    `<button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="guardarClave()">Guardar</button>`);
}
async function guardarClave() {
  const f = $('#pwf'); if (!f.reportValidity()) return;
  const d = formData(f); if (d.nueva !== d.confirmar) return alert('Las contraseñas no coinciden');
  try { await api('POST', '/api/auth/password', d); closeModal(); toast('Contraseña actualizada'); } catch (e) { alert(e.message); }
}
// cualquier error de red posterior (servidor detenido) muestra el aviso en vez de dejar la página vacía
window.addEventListener('unhandledrejection', e => {
  if (e.reason instanceof TypeError) { LOADED = false; closeModal(); closeDrawer(); $('#main').innerHTML = offline(e.reason.message); }
});
boot();
// la página trae los datos nuevos sola (cada 2 min y al volver a la pestaña), sin interrumpir si estás escribiendo
async function autoRefresh() {
  const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
  if (!LOADED || typing || !$('#modal').hidden || document.visibilityState !== 'visible') return;
  try { await refresh(); } catch (e) { LOADED = false; closeDrawer(); $('#main').innerHTML = offline(e.message); }
}
setInterval(autoRefresh, 120000);
window.addEventListener('focus', autoRefresh);
