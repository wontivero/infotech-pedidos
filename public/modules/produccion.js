// --- MÓDULO COLA DE PRODUCCIÓN ---
import { collection, getDocs, query, orderBy, doc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { db } from "./firebase.js";
import { clientesEnMemoria } from "./data.js";

const container = document.getElementById('tabla-produccion-container');
const btnRefrescar = document.getElementById('btn-refrescar-produccion');
const filtroLibro = document.getElementById('filtro-produccion-libro');
let gruposProduccion = {};

export const inicializarProduccion = () => {
  cargarColaProduccion();
  setupEventListeners();
};

const cargarColaProduccion = async (grupoAbiertoKey = null) => {
  if (!grupoAbiertoKey) container.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-warning"></div></div>';
  try {
    const q = query(collection(db, "pedidos"), orderBy("fecha_creacion", "asc"));
    const snap = await getDocs(q);
    gruposProduccion = {};

    snap.forEach(doc => {
      const p = doc.data();
      if (p.estado_general === 'Entregado') return;
      const c = clientesEnMemoria.find(cl => cl.id === p.id_cliente)?.nombre || 'Desc.';
      const fecha = p.fecha_creacion ? new Date(p.fecha_creacion.seconds * 1000).toLocaleDateString() : '-';

      p.items.forEach((item, idx) => {
        const key = `${item.titulo} - ${item.editorial}`;
        if (!gruposProduccion[key]) gruposProduccion[key] = { titulo: item.titulo, editorial: item.editorial, items: [], stats: { total: 0, pendientes: 0, imprimiendo: 0, encuadernando: 0, terminados: 0 } };
        
        const flatItem = { pedidoId: doc.id, pedidoCodigo: p.codigo_seguimiento, cliente: c, fecha, itemIndex: idx, estadoItem: item.estado || 'En cola de impresión' };
        gruposProduccion[key].items.push(flatItem);
        gruposProduccion[key].stats.total++;
        
        if (flatItem.estadoItem === 'Terminado') gruposProduccion[key].stats.terminados++;
        else if (flatItem.estadoItem === 'Encuadernando') gruposProduccion[key].stats.encuadernando++;
        else if (flatItem.estadoItem === 'Imprimiendo / Armando') gruposProduccion[key].stats.imprimiendo++;
        else gruposProduccion[key].stats.pendientes++;
      });
    });
    renderizar(grupoAbiertoKey);
  } catch (e) { console.error(e); container.innerHTML = '<div class="alert alert-danger">Error.</div>'; }
};

const renderizar = (grupoAbiertoKey) => {
  const filtro = filtroLibro.value.toLowerCase();
  const estadosSel = Array.from(document.querySelectorAll('.check-filtro-estado:checked')).map(c => c.value);
  const claves = Object.keys(gruposProduccion).filter(k => k.toLowerCase().includes(filtro) && gruposProduccion[k].items.some(i => estadosSel.includes(i.estadoItem)));

  // Stats
  let total = 0, terminados = 0;
  claves.forEach(k => { total += gruposProduccion[k].stats.total; terminados += gruposProduccion[k].stats.terminados; });
  document.getElementById('produccion-stats').innerHTML = `<div class="row g-3"><div class="col-md-4"><div class="p-3 bg-white border rounded shadow-sm border-start border-4 border-primary"><div><small class="text-muted fw-bold">TOTAL</small><div class="fs-3 fw-bold text-primary">${total}</div></div></div></div><div class="col-md-4"><div class="p-3 bg-white border rounded shadow-sm border-start border-4 border-success"><div><small class="text-muted fw-bold">TERMINADOS</small><div class="fs-3 fw-bold text-success">${terminados}</div></div></div></div></div>`;

  if (claves.length === 0) { container.innerHTML = '<div class="alert alert-info">Sin resultados.</div>'; return; }

  let html = `<div class="accordion" id="accordionProduccion">`;
  claves.forEach((key, idx) => {
    const g = gruposProduccion[key];
    const itemsVisibles = g.items.filter(i => estadosSel.includes(i.estadoItem));
    if (itemsVisibles.length === 0) return;

    const isOpen = key === grupoAbiertoKey;
    const pct = Math.round((g.stats.terminados / g.stats.total) * 100);
    
    html += `
      <div class="accordion-item">
        <h2 class="accordion-header">
          <button class="accordion-button ${isOpen ? '' : 'collapsed'}" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-${idx}">
            <div class="d-flex w-100 justify-content-between align-items-center me-3">
              <div><strong>${g.titulo}</strong> <small>(${g.editorial})</small><div class="progress mt-1" style="height:5px;width:100px"><div class="progress-bar bg-${pct===100?'success':'primary'}" style="width:${pct}%"></div></div></div>
              <div class="text-end"><span class="badge bg-secondary rounded-pill">${g.stats.total}</span></div>
            </div>
          </button>
        </h2>
        <div id="collapse-${idx}" class="accordion-collapse collapse ${isOpen ? 'show' : ''}" data-bs-parent="#accordionProduccion">
          <div class="accordion-body p-0">
            <div class="p-2 bg-light border-bottom text-end"><select class="form-select form-select-sm w-auto d-inline-block select-masivo"><option value="">Cambiar todos a...</option><option value="En cola de impresión">En cola</option><option value="Imprimiendo / Armando">Imprimiendo</option><option value="Encuadernando">Encuadernando</option><option value="Terminado">Terminado</option></select> <button class="btn btn-sm btn-dark btn-aplicar-masivo" data-key="${key}">Aplicar</button></div>
            <table class="table table-sm mb-0"><tbody>
              ${itemsVisibles.map(i => `<tr>
                <td><input type="checkbox" class="check-item" value="${i.pedidoId}|${i.itemIndex}" data-key="${key}"></td>
                <td><small>${i.fecha}</small></td><td>${i.cliente}</td><td><span class="badge bg-secondary">${i.estadoItem}</span></td>
                <td><select class="form-select form-select-sm select-estado" data-pid="${i.pedidoId}" data-idx="${i.itemIndex}" data-key="${key}"><option value="En cola de impresión" ${i.estadoItem==='En cola de impresión'?'selected':''}>En cola</option><option value="Imprimiendo / Armando" ${i.estadoItem==='Imprimiendo / Armando'?'selected':''}>Imprimiendo</option><option value="Encuadernando" ${i.estadoItem==='Encuadernando'?'selected':''}>Encuadernando</option><option value="Terminado" ${i.estadoItem==='Terminado'?'selected':''}>Terminado</option></select></td>
              </tr>`).join('')}
            </tbody></table>
          </div>
        </div>
      </div>`;
  });
  container.innerHTML = html + '</div>';
};

const setupEventListeners = () => {
  btnRefrescar.addEventListener('click', () => cargarColaProduccion());
  filtroLibro.addEventListener('input', () => renderizar());
  document.querySelectorAll('.check-filtro-estado').forEach(c => c.addEventListener('change', () => renderizar()));

  container.addEventListener('change', async (e) => {
    if (e.target.classList.contains('select-estado')) {
      const sel = e.target;
      sel.disabled = true;
      await actualizarItem(sel.dataset.pid, parseInt(sel.dataset.idx), sel.value);
      await cargarColaProduccion(sel.dataset.key);
    }
  });

  container.addEventListener('click', async (e) => {
    if (e.target.classList.contains('btn-aplicar-masivo')) {
      const key = e.target.dataset.key;
      const estado = e.target.previousElementSibling.value;
      const checks = container.querySelectorAll(`.check-item[data-key="${key}"]:checked`);
      if (!estado || checks.length === 0) return;
      
      e.target.disabled = true;
      const items = Array.from(checks).map(c => { const [pid, idx] = c.value.split('|'); return { pedidoId: pid, itemIndex: parseInt(idx) }; });
      await actualizarMasivo(items, estado);
      await cargarColaProduccion(key);
    }
  });
};

const actualizarItem = async (pid, idx, estado) => {
  const ref = doc(db, "pedidos", pid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const items = snap.data().items;
    items[idx].estado = estado;
    await updateDoc(ref, { items });
  }
};

const actualizarMasivo = async (lista, estado) => {
  const porPedido = {};
  lista.forEach(i => { if(!porPedido[i.pedidoId]) porPedido[i.pedidoId] = []; porPedido[i.pedidoId].push(i.itemIndex); });
  
  await Promise.all(Object.keys(porPedido).map(async (pid) => {
    const ref = doc(db, "pedidos", pid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const items = snap.data().items;
      porPedido[pid].forEach(idx => items[idx].estado = estado);
      await updateDoc(ref, { items });
    }
  }));
};