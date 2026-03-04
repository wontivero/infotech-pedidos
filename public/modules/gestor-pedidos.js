// --- MÓDULO GESTOR DE PEDIDOS ---
import { collection, addDoc, getDocs, query, where, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { db } from "./firebase.js";
import { generarCodigo, formatter } from "./utils.js";
import { librosEnMemoria, clientesEnMemoria, pedidosEnMemoria, suscribirCambios } from "./data.js";
import { configuracionGlobal } from "./configuracion.js";

let carrito = [];
let totalPedido = 0;
let clienteSeleccionado = null;
let resultadosBusqueda = [];
let selectedIndex = -1;
let presupuestoOrigen = null; // Para rastrear si viene de un presupuesto
let idPedidoEnEdicion = null; // ID del pedido que se está editando (null si es nuevo)
let codigoPedidoEnEdicion = null; // Código visible del pedido en edición

// Elementos DOM
const inputBuscarCliente = document.getElementById('input-buscar-cliente');
const listaResultadosClientes = document.getElementById('lista-resultados-clientes');
const inputBuscarLibro = document.getElementById('input-buscar-libro');
const listaResultados = document.getElementById('lista-resultados-libros');
const tablaCarrito = document.getElementById('tabla-carrito');
const inputSena = document.getElementById('sena-pagada');
const btnGenerarPedido = document.getElementById('btn-generar-pedido');
const btnGenerarPresupuesto = document.getElementById('btn-generar-presupuesto');
const btnCargarPresupuesto = document.getElementById('btn-cargar-presupuesto');
const inputPresupuestoCodigo = document.getElementById('input-presupuesto-codigo');
const modoEdicionAlert = document.getElementById('modo-edicion-alert');
const btnCancelarEdicion = document.getElementById('btn-cancelar-edicion');

export const inicializarGestorPedidos = () => {
  inputPresupuestoCodigo.value = "P";
  setupEventListeners();
  mostrarLibrosSugeridos();

  // Suscribirse a cambios en libros para actualizar la vista automáticamente
  suscribirCambios('libros', () => {
    // Si el buscador está vacío, actualizamos los sugeridos (ahí aparecerá el nuevo libro)
    if (inputBuscarLibro.value.trim() === '') {
      mostrarLibrosSugeridos();
    } else {
      // Si el usuario estaba buscando algo, refrescamos la búsqueda
      inputBuscarLibro.dispatchEvent(new Event('input'));
    }
  });
};

// --- FUNCIONES EXPORTADAS PARA OTROS MÓDULOS ---
export const seleccionarCliente = (cliente) => {
  clienteSeleccionado = cliente;
  inputBuscarCliente.value = cliente.nombre;
  listaResultadosClientes.style.display = 'none';
};

export const cargarPedidoParaEdicion = (pedido) => {
  idPedidoEnEdicion = pedido.id;
  codigoPedidoEnEdicion = pedido.codigo_seguimiento;
  presupuestoOrigen = pedido.presupuesto_origen || null;

  // 1. Cargar Cliente
  const cliente = clientesEnMemoria.find(c => c.id === pedido.id_cliente);
  if (cliente) seleccionarCliente(cliente);

  // 2. Cargar Carrito (Reagrupar items planos a items con cantidad)
  carrito = [];
  pedido.items.forEach(item => {
    // Buscamos si ya está en el carrito visual
    const idx = carrito.findIndex(i => i.id === item.id); // Asumiendo que item.id es el ID del libro
    if (idx !== -1) {
      carrito[idx].cantidad++;
    } else {
      // Aseguramos tener las propiedades necesarias (si vienen del pedido guardado)
      carrito.push({ ...item, cantidad: 1 });
    }
  });

  // 3. Cargar Seña
  inputSena.value = pedido.sena_pagada;

  // 4. Actualizar UI
  renderizarCarrito();
  actualizarTotales();
  
  // Activar modo edición visual
  modoEdicionAlert.classList.remove('d-none');
  document.getElementById('lbl-edicion-codigo').textContent = pedido.codigo_seguimiento;
  btnGenerarPedido.innerHTML = '<i class="bi bi-save"></i> Guardar Cambios';
  btnGenerarPedido.classList.replace('btn-success', 'btn-warning');

  // Cambiar a la pestaña de gestor
  const tab = new bootstrap.Tab(document.getElementById('pedidos-tab'));
  tab.show();
};

// --- LÓGICA INTERNA ---

const setupEventListeners = () => {
  // Buscador Libros
  inputBuscarLibro.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    selectedIndex = -1;
    if (term.length === 0) { mostrarLibrosSugeridos(); return; }
    const terms = term.split(' ').filter(t => t.trim().length > 0);
    resultadosBusqueda = librosEnMemoria.filter(l => {
      const str = [l.titulo, l.editorial, l.precio.toString()].join(' ').toLowerCase();
      return terms.every(t => str.includes(t));
    });
    renderizarResultadosBusqueda(resultadosBusqueda);
  });

  // Buscador Clientes
  inputBuscarCliente.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    clienteSeleccionado = null;
    if (term.length < 2) { listaResultadosClientes.style.display = 'none'; return; }
    const res = clientesEnMemoria.filter(c => (c.nombre + c.telefono).toLowerCase().includes(term));
    renderizarResultadosClientes(res);
  });

  // Totales
  inputSena.addEventListener('input', actualizarTotales);

  // Botones Acción
  btnGenerarPedido.addEventListener('click', confirmarPedido);
  btnGenerarPresupuesto.addEventListener('click', generarPresupuesto);
  btnCargarPresupuesto.addEventListener('click', cargarPresupuesto);

  // Enter en campo de presupuesto
  inputPresupuestoCodigo.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      cargarPresupuesto();
    }
  });

  // Cancelar Edición
  btnCancelarEdicion.addEventListener('click', resetearFormulario);

  // Atajos Teclado
  document.addEventListener('keydown', (e) => {
    if (e.key === 'F1') { e.preventDefault(); if(!btnGenerarPedido.disabled) btnGenerarPedido.click(); }
    if (e.key === 'F2') { e.preventDefault(); if(!btnGenerarPresupuesto.disabled) btnGenerarPresupuesto.click(); }
  });
};

// --- RENDERIZADO ---

const renderizarResultadosBusqueda = (libros, titulo = '') => {
  listaResultados.innerHTML = '';
  if (titulo) listaResultados.innerHTML += `<div class="col-12 mb-2"><h6 class="text-muted border-bottom pb-2 small text-uppercase fw-bold"><i class="bi bi-graph-up-arrow text-primary"></i> ${titulo}</h6></div>`;
  
  if (libros.length === 0) { listaResultados.innerHTML += '<div class="col-12 text-center text-muted py-4">No se encontraron libros.</div>'; return; }

  libros.slice(0, 10).forEach((libro) => {
    const col = document.createElement('div'); col.className = 'col-md-6';
    col.innerHTML = `
      <div class="card h-100 search-card-book border-light" style="transition: transform 0.1s;">
        <div class="card-body p-2 d-flex flex-column h-100">
          <h6 class="card-title mb-2 text-center text-dark fw-bold" style="font-size: 0.95rem;">${libro.titulo}</h6>
          <div class="d-flex align-items-center justify-content-center mt-auto">
            <img src="${libro.imageUrl || 'https://via.placeholder.com/50x75'}" class="rounded me-3 shadow-sm" style="height: 80px; width: 55px; object-fit: cover; cursor: zoom-in;" data-bs-toggle="modal" data-bs-target="#modalImagen" data-img-url="${libro.imageUrl}">
            <div class="text-start">
              <p class="card-text mb-1 lh-1"><small class="text-muted">${libro.editorial || '-'}<br>${libro.paginas || '?'} pág.</small></p>
              <p class="card-text text-primary fw-bold fs-5 mb-0">${formatter.format(libro.precio)}</p>
            </div>
          </div>
          <div class="d-flex gap-2 mt-3">
            <button class="btn btn-success btn-sm flex-grow-1 fw-bold btn-agregar"><i class="bi bi-cart-plus"></i> Agregar</button>
            <button class="btn btn-outline-secondary btn-sm btn-info-libro"><i class="bi bi-info-circle"></i></button>
          </div>
        </div>
      </div>`;
    col.querySelector('.btn-agregar').addEventListener('click', () => agregarAlCarrito(libro));
    col.querySelector('.btn-info-libro').addEventListener('click', () => verDetalleLibro(libro));
    listaResultados.appendChild(col);
  });
};

export const mostrarLibrosSugeridos = () => {
  if (librosEnMemoria.length === 0) return;
  // Lógica simplificada de sugeridos (puedes copiar la lógica completa de fechas si quieres)
  renderizarResultadosBusqueda(librosEnMemoria.slice(0, 10), 'Sugeridos / Más Vendidos');
};

const renderizarResultadosClientes = (clientes) => {
  listaResultadosClientes.innerHTML = '';
  if (clientes.length === 0) { listaResultadosClientes.style.display = 'none'; return; }
  clientes.forEach(c => {
    const item = document.createElement('button');
    item.className = 'list-group-item list-group-item-action';
    item.innerHTML = `<div class="d-flex w-100 justify-content-between"><h6 class="mb-1">${c.nombre}</h6><small>${c.telefono || ''}</small></div>`;
    item.addEventListener('click', () => seleccionarCliente(c));
    listaResultadosClientes.appendChild(item);
  });
  listaResultadosClientes.style.display = 'block';
};

// --- CARRITO ---

const agregarAlCarrito = (libro) => {
  const idx = carrito.findIndex(i => i.id === libro.id);
  if (idx !== -1) carrito[idx].cantidad++;
  else carrito.push({ ...libro, cantidad: 1 });
  renderizarCarrito(); actualizarTotales();
  
  const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 1500 });
  Toast.fire({ icon: 'success', title: 'Agregado al pedido' });
  inputBuscarLibro.focus();
};

const renderizarCarrito = () => {
  tablaCarrito.innerHTML = '';
  carrito.forEach((item, index) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><img src="${item.imageUrl || 'https://via.placeholder.com/50x75'}" width="30" height="45" class="rounded" style="object-fit: cover;"></td>
      <td><div class="text-truncate" style="max-width: 150px;" title="${item.titulo}">${item.titulo}</div></td>
      <td class="text-center">
        <div class="input-group input-group-sm" style="width: 80px; margin: 0 auto;">
          <button class="btn btn-outline-secondary px-1 btn-restar" data-index="${index}">-</button>
          <input type="text" class="form-control text-center px-0" value="${item.cantidad}" readonly style="font-size: 0.8rem;">
          <button class="btn btn-outline-secondary px-1 btn-sumar" data-index="${index}">+</button>
        </div>
      </td>
      <td class="text-end small">${formatter.format(item.precio * item.cantidad)}</td>
      <td><button class="btn btn-link text-danger btn-sm p-0 btn-eliminar" data-index="${index}"><i class="bi bi-x-circle-fill"></i></button></td>
    `;
    tablaCarrito.appendChild(row);
  });
  // Event listeners para botones del carrito...
  tablaCarrito.querySelectorAll('.btn-sumar').forEach(b => b.addEventListener('click', e => { carrito[e.target.dataset.index].cantidad++; renderizarCarrito(); actualizarTotales(); }));
  tablaCarrito.querySelectorAll('.btn-restar').forEach(b => b.addEventListener('click', e => { const i = e.target.dataset.index; if(carrito[i].cantidad > 1) { carrito[i].cantidad--; renderizarCarrito(); actualizarTotales(); } }));
  tablaCarrito.querySelectorAll('.btn-eliminar').forEach(b => b.addEventListener('click', e => { carrito.splice(e.target.closest('button').dataset.index, 1); renderizarCarrito(); actualizarTotales(); }));
};

const actualizarTotales = () => {
  totalPedido = carrito.reduce((acc, item) => acc + (item.precio * item.cantidad), 0);
  let sena = parseFloat(inputSena.value) || 0;
  if (sena > totalPedido || sena < 0) inputSena.classList.add('is-invalid'); else inputSena.classList.remove('is-invalid');
  document.getElementById('total-pedido').value = formatter.format(totalPedido);
  document.getElementById('saldo-pendiente').value = formatter.format(totalPedido - sena);
};

// --- ACCIONES ---

const confirmarPedido = async () => {
  if (carrito.length === 0) { Swal.fire('Carrito vacío', 'Agregá libros.', 'warning'); return; }
  if (!clienteSeleccionado) { Swal.fire('Falta Cliente', 'Seleccioná un cliente.', 'warning'); return; }
  
  const sena = parseFloat(inputSena.value) || 0;
  if (sena > totalPedido || sena < 0) { Swal.fire('Error', 'Seña inválida.', 'error'); return; }

  const btn = btnGenerarPedido; const txt = btn.innerHTML;
  btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Procesando...';

  // Lógica de Actualización (Edición)
  if (idPedidoEnEdicion) {
    try {
      const itemsExpandidos = carrito.flatMap(item => {
        const itemsIndividuales = [];
        for (let i = 0; i < item.cantidad; i++) {
          const { cantidad, ...itemSinCantidad } = item;
          itemsIndividuales.push(itemSinCantidad);
        }
        return itemsIndividuales;
      });
      await updateDoc(doc(db, "pedidos", idPedidoEnEdicion), {
        items: itemsExpandidos,
        total: totalPedido,
        sena_pagada: sena,
        saldo_pendiente: totalPedido - sena
      });

      // Generar mensaje WhatsApp para edición
      const urlSeguimiento = 'https://infotech-pedidos.web.app';
      let msg = `Hola ${clienteSeleccionado.nombre}! 👋\n`;
      msg += `Tu pedido fue actualizado. 📝\n\n`;
      msg += `🔖 *Código de Seguimiento:* *${codigoPedidoEnEdicion}*\n`;
      msg += `🔗 *Seguí el estado acá:* ${urlSeguimiento}\n\n`;
      msg += `📚 *Detalle Actualizado:*\n`;
      carrito.forEach(i => msg += `   • ${i.titulo} (x${i.cantidad})\n`);
      msg += `\n`;
      msg += `💰 *Total:* ${formatter.format(totalPedido)}\n`;
      msg += `✅ *Seña:* ${formatter.format(sena)}\n`;
      msg += `❗ *Saldo:* ${formatter.format(totalPedido - sena)}\n\n`;
      msg += `Muchas gracias por elegirnos.`;
      
      navigator.clipboard.writeText(msg);
      Swal.fire({ title: '¡Actualizado!', html: `El pedido se modificó correctamente.<br>Mensaje copiado.`, icon: 'success' });
      resetearFormulario();
    } catch (e) { console.error(e); Swal.fire('Error', 'No se pudo actualizar.', 'error'); }
    finally { btn.disabled = false; btn.innerHTML = txt; }
    return;
  }

  // Lógica de Creación (Nuevo)
  try {
    const codigo = generarCodigo();
    const itemsExpandidos = carrito.flatMap(item => {
      const itemsIndividuales = [];
      for (let i = 0; i < item.cantidad; i++) {
        const { cantidad, ...itemSinCantidad } = item;
        itemsIndividuales.push(itemSinCantidad);
      }
      return itemsIndividuales;
    });
    
    await addDoc(collection(db, "pedidos"), {
      codigo_seguimiento: codigo,
      id_cliente: clienteSeleccionado.id,
      presupuesto_origen: presupuestoOrigen, // Guardamos la referencia
      items: itemsExpandidos,
      total: totalPedido,
      sena_pagada: sena,
      saldo_pendiente: totalPedido - sena,
      estado_general: 'En cola de impresión',
      fecha_creacion: new Date()
    });

    // Generar mensaje WhatsApp
    const urlSeguimiento = 'https://infotech-pedidos.web.app';
    let msg = `Hola ${clienteSeleccionado.nombre}! 👋\n`;
    msg += `Tu pedido fue generado con éxito. 🚀\n\n`;
    msg += `🔖 *Código de Seguimiento:* *${codigo}*\n`;
    msg += `🔗 *Seguí el estado acá:* ${urlSeguimiento}\n\n`;
    msg += `💰 *Total:* ${formatter.format(totalPedido)}\n`;
    msg += `✅ *Seña:* ${formatter.format(sena)}\n`;
    msg += `❗ *Saldo:* ${formatter.format(totalPedido - sena)}\n\n`;
    msg += `Te avisamos cuando esté listo para retirar!\n`;
    msg += `Muchas gracias por elegirnos.`;
    
    navigator.clipboard.writeText(msg);
    Swal.fire({ title: '¡Pedido Creado!', html: `Código: <strong>${codigo}</strong><br>Mensaje copiado.`, icon: 'success' });
    
    // Reset
    resetearFormulario();
  } catch (e) { console.error(e); Swal.fire('Error', 'Falló al crear pedido.', 'error'); }
  finally { btn.disabled = false; btn.innerHTML = txt; }
};

const resetearFormulario = () => {
  carrito = []; totalPedido = 0; inputSena.value = ""; clienteSeleccionado = null; inputBuscarCliente.value = "";
  presupuestoOrigen = null; idPedidoEnEdicion = null; codigoPedidoEnEdicion = null;
  renderizarCarrito(); actualizarTotales(); inputPresupuestoCodigo.value = "P";
  
  // Restaurar UI
  modoEdicionAlert.classList.add('d-none');
  btnGenerarPedido.innerHTML = '<i class="bi bi-check-lg"></i> Confirmar Pedido <span class="badge bg-dark ms-2" style="font-size: 0.7em;">F1</span>';
  btnGenerarPedido.classList.replace('btn-warning', 'btn-success');
};

const generarPresupuesto = async () => {
  if (carrito.length === 0) { Swal.fire('Vacío', 'Agregá libros.', 'warning'); return; }
  const btn = btnGenerarPresupuesto; const txt = btn.innerHTML;
  btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';

  try {
    const codigo = generarCodigo('P');
    const itemsExpandidos = carrito.flatMap(item => {
      const itemsIndividuales = [];
      for (let i = 0; i < item.cantidad; i++) {
        const { cantidad, ...itemSinCantidad } = item;
        itemsIndividuales.push(itemSinCantidad);
      }
      return itemsIndividuales;
    });
    
    // Guardar en BD (opcional, no bloqueante)
    addDoc(collection(db, "presupuestos"), {
      codigo, items: itemsExpandidos, total: totalPedido, fecha: new Date(),
      cliente: clienteSeleccionado ? { id: clienteSeleccionado.id, nombre: clienteSeleccionado.nombre } : null
    });

    const senaSugerida = totalPedido / 2;

    let msg = `Hola! 👋 Te paso el presupuesto solicitado (Ref: ${codigo}):\n\n`;
    carrito.forEach(i => {
      const totalItem = i.precio * i.cantidad;
      msg += `📚 *${i.titulo}* (x${i.cantidad})\n   _${i.editorial || 'Ed. Varios'}_ — ${formatter.format(totalItem)}\n`;
    });

    msg += `\n✅ *Impresión a color y anillado incluido.*\n`;
    msg += `💰 *Total: ${formatter.format(totalPedido)}*\n`;
    msg += `-----------------------------------\n`;
    msg += `📝 Para encargarlo necesitamos:\n`;
    msg += `   • Nombre del alumno\n`;
    msg += `   • Colegio\n`;
    msg += `   • Seña de ${formatter.format(senaSugerida)} (50%)\n\n`;
    msg += `💳 *Alias:* ${configuracionGlobal.alias}\n`;
    if(configuracionGlobal.banco) msg += `🏦 *Banco:* ${configuracionGlobal.banco}\n`;
    if(configuracionGlobal.titular) msg += `👤 *Titular:* ${configuracionGlobal.titular}\n`;
    msg += `(Por favor enviar comprobante)`;
    
    navigator.clipboard.writeText(msg);
    
    // Alerta con opciones
    const result = await Swal.fire({
      title: 'Presupuesto Listo',
      html: `Ref: <strong>${codigo}</strong><br>Copiado al portapapeles.`,
      icon: 'success',
      showCancelButton: true,
      confirmButtonText: 'Cerrar',
      cancelButtonText: 'Crear Otro (Limpiar)',
      cancelButtonColor: '#6c757d'
    });

    // Si elige "Crear Otro", limpiamos todo
    if (result.dismiss === Swal.DismissReason.cancel) {
      resetearFormulario();
    }
  } finally { btn.disabled = false; btn.innerHTML = txt; }
};

const cargarPresupuesto = async () => {
  const codigo = inputPresupuestoCodigo.value.trim().toUpperCase();
  if (!codigo) { Swal.fire('Atención', 'Ingresá código.', 'warning'); return; }
  
  try {
    const q = query(collection(db, "presupuestos"), where("codigo", "==", codigo));
    const snap = await getDocs(q);
    if (snap.empty) { Swal.fire('Error', 'No existe.', 'error'); return; }
    
    const p = snap.docs[0].data();
    presupuestoOrigen = p.codigo; // Guardamos el origen
    carrito = [];
    // Reagrupar items
    p.items.forEach(item => {
      const idx = carrito.findIndex(i => i.id === item.id);
      if (idx !== -1) carrito[idx].cantidad++; else carrito.push({ ...item, cantidad: 1 });
    });
    if (p.cliente) seleccionarCliente(p.cliente);
    renderizarCarrito(); actualizarTotales();
    Swal.fire('Cargado', '', 'success');
  } catch (e) { console.error(e); Swal.fire('Error', 'Falló la carga.', 'error'); }
};

const verDetalleLibro = (libro) => {
  document.getElementById('detalle-libro-titulo').textContent = libro.titulo;
  const content = document.getElementById('detalle-libro-contenido');
  
  let total = 0;
  let estados = { 'En cola de impresión': 0, 'Imprimiendo / Armando': 0, 'Encuadernando': 0, 'Terminado': 0, 'Entregado': 0 };

  pedidosEnMemoria.forEach(p => {
    p.items.filter(i => i.id === libro.id).forEach(i => {
      total++;
      const est = i.estado || p.estado_general;
      if (estados[est] !== undefined) estados[est]++;
    });
  });

  const bar = (lbl, val, col) => {
    if (val === 0) return '';
    const pct = Math.round((val / total) * 100);
    return `<div class="mb-2"><div class="d-flex justify-content-between small"><span>${lbl}</span><span>${val} (${pct}%)</span></div><div class="progress" style="height: 8px;"><div class="progress-bar bg-${col}" style="width: ${pct}%"></div></div></div>`;
  };

  content.innerHTML = `
    <div class="text-center mb-3"><img src="${libro.imageUrl || 'https://via.placeholder.com/150'}" class="img-thumbnail" style="max-height: 200px;"></div>
    <ul class="list-group list-group-flush mb-3">
      <li class="list-group-item d-flex justify-content-between"><span>Precio:</span> <strong>${formatter.format(libro.precio)}</strong></li>
      <li class="list-group-item d-flex justify-content-between"><span>Editorial:</span> <span>${libro.editorial || '-'}</span></li>
    </ul>
    <h6 class="border-bottom pb-2 mb-3">Estadísticas</h6>
    <div class="alert alert-light border text-center"><h2 class="mb-0">${total}</h2><small>Pedidos Totales</small></div>
    ${bar('Pendiente', estados['En cola de impresión'], 'warning')}
    ${bar('Producción', estados['Imprimiendo / Armando'] + estados['Encuadernando'], 'primary')}
    ${bar('Terminado', estados['Terminado'] + estados['Entregado'], 'success')}
  `;
  new bootstrap.Modal(document.getElementById('modalLibroDetalle')).show();
};