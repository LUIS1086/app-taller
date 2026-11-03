/* Cell Service · js/modules/43-tecnicos-nube.js
   Gestión de técnicos desde la pestaña Nube: ficha (teléfono, especialidad, comisión),
   carga de trabajo, activar/desactivar y WhatsApp directo.
   · La lista de nombres sigue en localStorage 'tecnicos' (la usan los selectores y reportes).
   · Las fichas viven en 'tecnicosPerfil' { NOMBRE: {tel, esp, com, nota, activo} }.
   · Un técnico desactivado sale de los selectores pero conserva su historial de órdenes.
   · Ambas claves viajan en el respaldo de Supabase (ver 41-respaldo-supabase.js). */
(function () {
  'use strict';

  const LS_PERFIL = 'tecnicosPerfil';
  const byId = id => document.getElementById(id);
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (m, t) => { if (typeof showToast === 'function') showToast(m, t || 'info'); };
  const cur = () => (typeof getCurrency === 'function' ? getCurrency() : '$');
  const money = n => cur() + Math.round(n || 0).toLocaleString('es-CO');

  function perfiles() { try { return JSON.parse(localStorage.getItem(LS_PERFIL) || '{}') || {}; } catch (e) { return {}; } }
  function savePerfiles(p) { localStorage.setItem(LS_PERFIL, JSON.stringify(p)); }
  function activos() { return (typeof getTecnicos === 'function') ? getTecnicos() : []; }
  function todos() {
    const p = perfiles(), set = new Set(activos());
    Object.keys(p).forEach(n => set.add(n));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }
  function isActivo(n) { return activos().includes(n); }
  function refresh() {
    if (typeof renderTecnicosList === 'function') renderTecnicosList();
    if (typeof _refreshTecnicosSelects === 'function') _refreshTecnicosSelects();
  }
  const attr = s => esc(s).replace(/\\/g, '\\\\');

  async function cargaDe() {
    const out = {};
    try {
      const orders = await getAll('orders');
      const ini = new Date(); ini.setDate(1); ini.setHours(0, 0, 0, 0);
      orders.forEach(o => {
        const t = o.tecnico; if (!t) return;
        const r = out[t] || (out[t] = { activas: 0, mes: 0, valorMes: 0 });
        if (o.sta === 'entregado') {
          if ((o.fechaEntrega || o.fecha || 0) >= ini.getTime()) { r.mes++; r.valorMes += (o.val || 0); }
        } else if (o.sta !== 'no-reparable') r.activas++;
      });
    } catch (e) { /* sin datos */ }
    return out;
  }

  function sheet(inner) {
    let m = byId('tec-modal');
    if (!m) {
      m = document.createElement('div'); m.id = 'tec-modal'; m.className = 'sg-modal hidden';
      m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); document.body.appendChild(m);
      m.addEventListener('click', e => { if (e.target === m) m.classList.add('hidden'); });
    }
    m.innerHTML = inner; m.classList.remove('hidden'); return m;
  }
  window.closeTecnicosNube = function () { const m = byId('tec-modal'); if (m) m.classList.add('hidden'); };

  const inputCss = 'width:100%;box-sizing:border-box;border:1px solid #334155;background:#111c30;color:#f8fafc;border-radius:11px;padding:11px 12px;font-size:13px;min-height:44px';

  window.openTecnicosNube = async function () {
    const carga = await cargaDe(), p = perfiles(), lista = todos();
    const filas = lista.length ? lista.map(n => {
      const f = p[n] || {}, c = carga[n] || { activas: 0, mes: 0, valorMes: 0 }, on = isActivo(n);
      const comision = f.com ? ' · comisión ' + esc(f.com) + '% = <b>' + money(c.valorMes * f.com / 100) + '</b>' : '';
      const tel = String(f.tel || '').replace(/\D/g, '');
      return '<div class="sg-status" style="text-align:left;opacity:' + (on ? 1 : .55) + '">' +
        '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><strong style="font-size:14px">👷 ' + esc(n) + (on ? '' : ' <small>(inactivo)</small>') + '</strong>' +
        '<span style="font-size:10px">' + esc(f.esp || 'General') + '</span></div>' +
        '<div style="font-size:11px;margin-top:6px;font-weight:600">🔧 ' + c.activas + ' en taller · ✅ ' + c.mes + ' entregadas este mes (' + money(c.valorMes) + ')' + comision + '</div>' +
        (f.nota ? '<div style="font-size:11px;margin-top:4px;font-weight:500;color:#94a3b8">' + esc(f.nota) + '</div>' : '') +
        '<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">' +
        '<button type="button" class="sg-btn" style="flex:1;min-height:38px;padding:6px" onclick="tecEditar(\'' + attr(n) + '\')">✏️ Editar</button>' +
        (tel ? '<button type="button" class="sg-btn" style="flex:1;min-height:38px;padding:6px" onclick="window.open(\'https://wa.me/' + (tel.length === 10 ? '57' + tel : tel) + '\',\'_blank\')">💬 WhatsApp</button>' : '') +
        '<button type="button" class="sg-btn" style="flex:1;min-height:38px;padding:6px" onclick="tecToggle(\'' + attr(n) + '\')">' + (on ? '⏸️ Desactivar' : '▶️ Activar') + '</button>' +
        '<button type="button" class="sg-btn" style="min-height:38px;padding:6px 10px;color:#fda4af" onclick="tecEliminar(\'' + attr(n) + '\')" aria-label="Eliminar">🗑️</button>' +
        '</div></div>';
    }).join('') : '<div class="sg-status">Aún no hay técnicos. Agrega el primero abajo.</div>';

    sheet('<div class="sg-panel"><div class="sg-head"><div class="sg-badge" style="background:rgba(255,159,10,.16)">👷</div><div><h2>Técnicos</h2><p>Equipo del taller, carga de trabajo y comisiones</p></div>' +
      '<button type="button" class="sg-x" onclick="closeTecnicosNube()" aria-label="Cerrar">×</button></div>' +
      '<div class="sg-body">' + filas +
      '<p class="sg-h" style="margin:14px 0 8px" id="tec-form-title">Agregar técnico</p>' +
      '<input type="hidden" id="tec-orig">' +
      '<div class="sg-field"><label for="tec-nombre">Nombre</label><input id="tec-nombre" type="text" placeholder="Nombre del técnico" style="' + inputCss + '"></div>' +
      '<div class="sg-field"><label for="tec-tel">Celular (WhatsApp)</label><input id="tec-tel" type="tel" inputmode="tel" placeholder="3001234567" style="' + inputCss + '"></div>' +
      '<div class="sg-field"><label for="tec-esp">Especialidad</label><input id="tec-esp" type="text" placeholder="Pantallas, placa, software, micro-soldadura…" style="' + inputCss + '"></div>' +
      '<div class="sg-field"><label for="tec-com">Comisión sobre lo entregado (%)</label><input id="tec-com" type="number" inputmode="decimal" min="0" max="100" step="0.5" placeholder="0" style="' + inputCss + '"></div>' +
      '<div class="sg-field"><label for="tec-nota">Nota</label><input id="tec-nota" type="text" placeholder="Horario, observaciones…" style="' + inputCss + '"></div>' +
      '</div><div class="sg-actions"><button type="button" class="sg-btn wa" onclick="tecGuardar()">💾 Guardar técnico</button>' +
      '<button type="button" class="sg-btn" onclick="openTecnicosReport()">📊 Reporte</button><button type="button" class="sg-btn" onclick="closeTecnicosNube()">Cerrar</button></div></div>');
  };

  window.tecEditar = function (n) {
    const f = perfiles()[n] || {};
    byId('tec-orig').value = n; byId('tec-nombre').value = n; byId('tec-tel').value = f.tel || '';
    byId('tec-esp').value = f.esp || ''; byId('tec-com').value = f.com || ''; byId('tec-nota').value = f.nota || '';
    byId('tec-form-title').textContent = 'Editando: ' + n;
    byId('tec-nombre').scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  window.tecGuardar = async function () {
    const orig = byId('tec-orig').value;
    const nombre = byId('tec-nombre').value.trim().toUpperCase();
    if (!nombre) { toast('Escribe el nombre del técnico', 'warning'); return; }
    const com = Math.min(100, Math.max(0, parseFloat(byId('tec-com').value) || 0));
    const tel = byId('tec-tel').value.trim();
    if (tel && tel.replace(/\D/g, '').length < 7) { toast('El celular parece incompleto', 'warning'); return; }
    const lista = todos();
    if (nombre !== orig && lista.includes(nombre)) { toast('Ya existe un técnico con ese nombre', 'warning'); return; }
    const p = perfiles(), wasActive = orig ? isActivo(orig) : true;
    if (orig && orig !== nombre) { // renombrar: se actualizan también las órdenes para no perder el historial
      delete p[orig];
      try {
        const orders = await getAll('orders');
        for (const o of orders) if (o.tecnico === orig) { o.tecnico = nombre; await put('orders', o); }
      } catch (e) { console.warn('[tecnicos] no se pudo renombrar en órdenes', e); }
      saveTecnicos(activos().filter(t => t !== orig));
    }
    p[nombre] = { tel, esp: byId('tec-esp').value.trim(), com, nota: byId('tec-nota').value.trim() };
    savePerfiles(p);
    if (wasActive && !activos().includes(nombre)) saveTecnicos(activos().concat(nombre));
    refresh();
    toast('Técnico ' + nombre + (orig ? ' actualizado' : ' agregado'), 'success');
    window.openTecnicosNube();
  };

  window.tecToggle = function (n) {
    const l = activos();
    saveTecnicos(l.includes(n) ? l.filter(t => t !== n) : l.concat(n));
    refresh(); window.openTecnicosNube();
  };

  window.tecEliminar = function (n) {
    const run = () => {
      saveTecnicos(activos().filter(t => t !== n));
      const p = perfiles(); delete p[n]; savePerfiles(p);
      refresh(); window.openTecnicosNube();
    };
    const msg = '¿Eliminar a ' + n + '?\n\nLas órdenes que ya tiene asignadas conservan su nombre. Si solo dejó de trabajar, mejor usa Desactivar.';
    if (typeof showConfirm === 'function') showConfirm(msg, run); else if (window.confirm(msg)) run();
  };

  // Compatibilidad: el alta rápida de Configuración también crea ficha vacía
  const _add = window.addTecnico;
  if (typeof _add === 'function') {
    window.addTecnico = function () { _add.apply(this, arguments); try { const p = perfiles(); activos().forEach(n => { if (!p[n]) p[n] = {}; }); savePerfiles(p); } catch (e) { /* nada */ } };
  }
})();
