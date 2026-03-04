// --- MÓDULO LISTA DE PEDIDOS ---
import { collection, getDocs, query, orderBy, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { db } from "./firebase.js";
import { formatter } from "./utils.js";
import { clientesEnMemoria, pedidosEnMemoria, cargarPedidosEnMemoria } from "./data.js";
import { mostrarLibrosSugeridos } from "./gestor-pedidos.js";

const container = document.getElementById('tabla-pedidos-container');
const btnRefrescar = document.getElementById('btn-refrescar-pedidos');
const filtroTexto = document.getElementById('filtro-pedidos-texto');
const filtroEstado = document.getElementById('filtro-pedidos-estado');
const btnMasivo = document.getElementById('btn-aplicar-masivo');
const selectMasivo = document.getElementById('accion-masiva-estado');

export const inicializarListaPedidos = () => {
  cargarPedidos();
  setupEventListeners();
};

export const cargarPedidos = async () => {
  container.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary"></div></div>';
  try {
    await cargarPedidosEnMemoria(); // Actualiza la variable global pedidosEnMemoria
    filtrarYRenderizar();
    mostrarLibrosSugeridos(); // Actualiza sugerencias del gestor
  } catch (e) { console.error(e); container.innerHTML = '<div class="alert alert-danger">Error cargando pedidos.</div>'; }
};

const filtrarYRenderizar = () => {
  const txt = filtroTexto.value.toLowerCase();
  const est = filtroEstado.value;

  const filtrados = pedidosEnMemoria.filter(p => {
    const c = clientesEnMemoria.find(cl => cl.id === p.id_cliente);
    const nombre = c ? c.nombre.toLowerCase() : '';
    const cod = p.codigo_seguimiento ? p.codigo_seguimiento.toString() : '';
    return (nombre.includes(txt) || cod.includes(txt)) && (est === "" || p.estado_general === est);
  });

  if (filtrados.length === 0) { container.innerHTML = '<div class="alert alert-warning">No hay pedidos.</div>'; return; }

  let html = `<table class="table table-hover align-middle"><thead class="table-light"><tr><th style="width:40px"><input type="checkbox" id="check-todos"></th><th>Fecha</th><th>Código</th><th>Cliente</th><th>Estado</th><th>Progreso</th><th>Saldo</th><th>Acciones</th></tr></thead><tbody>`;

  filtrados.forEach(p => {
    const fecha = p.fecha_creacion ? new Date(p.fecha_creacion.seconds * 1000).toLocaleDateString() : '-';
    let badge = 'bg-secondary';
    if (p.estado_general === 'En cola de impresión') badge = 'bg-warning text-dark';
    if (p.estado_general === 'Imprimiendo / Armando') badge = 'bg-info text-dark';
    if (p.estado_general === 'Encuadernando') badge = 'bg-primary';
    if (p.estado_general === 'Listo para retirar') badge = 'bg-success';

    const totalItems = p.items.length;
    const terminados = p.items.filter(i => i.estado === 'Terminado').length;
    const completo = totalItems > 0 && totalItems === terminados;
    const rowClass = (completo && p.estado_general !== 'Entregado') ? 'table-success' : '';
    const prog = completo ? `<span class="badge bg-success"><i class="bi bi-check-all"></i> ${terminados}/${totalItems}</span>` : `<span class="badge bg-secondary">${terminados}/${totalItems}</span>`;

    html += `<tr class="${rowClass}">
      <td><input type="checkbox" class="form-check-input check-pedido" value="${p.id}"></td>
      <td><small>${fecha}</small></td>
      <td class="fw-bold text-primary">${p.codigo_seguimiento}</td>
      <td>${clientesEnMemoria.find(c => c.id === p.id_cliente)?.nombre || 'Unknown'}</td>
      <td><span class="badge ${badge}">${p.estado_general}</span></td>
      <td>${prog}</td>
      <td>${formatter.format(p.saldo_pendiente)}</td>
      <td>
        <button class="btn btn-sm btn-outline-primary btn-detalle" data-id="${p.id}"><i class="bi bi-eye"></i></button>
        <div class="btn-group">
          <button class="btn btn-sm btn-outline-secondary dropdown-toggle" data-bs-toggle="dropdown">Estado</button>
          <ul class="dropdown-menu">
            <li><a class="dropdown-item btn-est" href="#" data-id="${p.id}" data-val="En cola de impresión">En cola</a></li>
            <li><a class="dropdown-item btn-est" href="#" data-id="${p.id}" data-val="Imprimiendo / Armando">Imprimiendo</a></li>
            <li><a class="dropdown-item btn-est" href="#" data-id="${p.id}" data-val="Encuadernando">Encuadernando</a></li>
            <li><a class="dropdown-item btn-est" href="#" data-id="${p.id}" data-val="Listo para retirar">Listo</a></li>
            <li><a class="dropdown-item btn-est" href="#" data-id="${p.id}" data-val="Entregado">Entregado</a></li>
          </ul>
        </div>
        ${completo ? `<button class="btn btn-sm btn-success btn-wa" data-id="${p.id}"><i class="bi bi-whatsapp"></i></button>` : ''}
      </td>
    </tr>`;
  });
  container.innerHTML = html + '</tbody></table>';
};

const setupEventListeners = () => {
  btnRefrescar.addEventListener('click', cargarPedidos);
  filtroTexto.addEventListener('input', filtrarYRenderizar);
  filtroEstado.addEventListener('change', filtrarYRenderizar);

  container.addEventListener('click', async (e) => {
    // Detalle
    if (e.target.closest('.btn-detalle')) {
      const id = e.target.closest('.btn-detalle').dataset.id;
      const p = pedidosEnMemoria.find(x => x.id === id);
      const c = clientesEnMemoria.find(x => x.id === p.id_cliente);
      document.getElementById('detalle-pedido-codigo').textContent = p.codigo_seguimiento;
      document.getElementById('detalle-pedido-info-cliente').innerHTML = `<strong>${c?.nombre}</strong><br>${c?.telefono || '-'}`;
      document.getElementById('detalle-pedido-lista-items').innerHTML = p.items.map(i => `<li class="list-group-item d-flex justify-content-between"><div><strong>${i.titulo}</strong><br><small>${i.editorial||''}</small></div><span>${formatter.format(i.precio)}</span></li>`).join('');
      document.getElementById('detalle-pedido-totales').innerHTML = `Total: ${formatter.format(p.total)}<br>Seña: ${formatter.format(p.sena_pagada)}<br><span class="text-danger">Saldo: ${formatter.format(p.saldo_pendiente)}</span>`;
      new bootstrap.Modal(document.getElementById('modalDetallePedido')).show();
    }
    // Cambio Estado
    if (e.target.closest('.btn-est')) {
      e.preventDefault();
      await updateDoc(doc(db, "pedidos", e.target.closest('.btn-est').dataset.id), { estado_general: e.target.closest('.btn-est').dataset.val });
      cargarPedidos();
    }
    // WhatsApp
    if (e.target.closest('.btn-wa')) {
      const p = pedidosEnMemoria.find(x => x.id === e.target.closest('.btn-wa').dataset.id);
      const c = clientesEnMemoria.find(x => x.id === p.id_cliente);
      const nombreCliente = c ? c.nombre : 'Cliente';

      let msg = `Hola ${nombreCliente}! 👋\n`;
      msg += `¡Buenas noticias! Tu pedido ya está completo y listo para retirar. 📚✨\n\n`;
      msg += `🔢 *Para retirar, por favor indicanos el número de pedido:* *${p.codigo_seguimiento}*\n\n`;
      
      if (p.saldo_pendiente > 0) {
        msg += `❗ *Saldo pendiente:* ${formatter.format(p.saldo_pendiente)}\n`;
      } else {
        msg += `✅ *El pedido está pagado.*\n`;
      }
      
      msg += `\nTe esperamos!`;

      navigator.clipboard.writeText(msg);
      Swal.fire('Copiado', 'Mensaje listo para pegar en WhatsApp.', 'success');
    }
  });
};