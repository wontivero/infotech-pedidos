// --- MÓDULO ABM CLIENTES ---
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { db } from "./firebase.js";
import { capitalizarTexto, limpiarTelefono } from "./utils.js";
import { suscribirCambios, guardarReferenciaSiNoExiste, colegiosEnMemoria, clientesEnMemoria } from "./data.js";
import { seleccionarCliente } from "./gestor-pedidos.js"; // Importamos para el cliente rápido

const formNuevoCliente = document.getElementById('form-nuevo-cliente');
const listaClientesDiv = document.getElementById('lista-clientes');
const formNuevoClienteRapido = document.getElementById('form-nuevo-cliente-rapido');

export const inicializarClientes = () => {
  renderizarTablaClientes();
  suscribirCambios('clientes', renderizarTablaClientes);

  setupEventListeners();
};

const renderizarTablaClientes = () => {
  if (clientesEnMemoria.length === 0) { listaClientesDiv.innerHTML = '<div class="alert alert-info">No hay clientes.</div>'; return; }
  let tableHTML = `<table class="table table-striped table-hover"><thead><tr><th>Nombre</th><th>Teléfono</th><th>Colegio</th><th>Acciones</th></tr></thead><tbody>`;
  clientesEnMemoria.forEach((c) => {
    tableHTML += `<tr><td>${c.nombre}</td><td>${c.telefono || '-'}</td><td>${c.colegio || '-'}</td><td><button class="btn btn-warning btn-sm btn-editar-cliente" data-id="${c.id}"><i class="bi bi-pencil"></i></button> <button class="btn btn-danger btn-sm btn-eliminar-cliente" data-id="${c.id}"><i class="bi bi-trash"></i></button></td></tr>`;
  });
  listaClientesDiv.innerHTML = tableHTML + `</tbody></table>`;
};

const setupEventListeners = () => {
  // Nuevo Cliente Normal
  formNuevoCliente.addEventListener('submit', async (e) => {
    e.preventDefault();
    await guardarCliente(
      document.getElementById('cliente-nombre').value,
      limpiarTelefono(document.getElementById('cliente-telefono').value),
      document.getElementById('cliente-colegio').value,
      formNuevoCliente
    );
  });

  // Nuevo Cliente Rápido (Modal)
  formNuevoClienteRapido.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = document.getElementById('rapido-cliente-nombre').value;
    const telefono = limpiarTelefono(document.getElementById('rapido-cliente-telefono').value);
    const colegio = document.getElementById('rapido-cliente-colegio').value;
    const docRef = await guardarCliente(nombre, telefono, colegio, formNuevoClienteRapido);
    
    // Seleccionar automáticamente en el gestor
    seleccionarCliente({ id: docRef.id, nombre: capitalizarTexto(nombre), telefono, colegio: capitalizarTexto(colegio) });
    bootstrap.Modal.getInstance(document.getElementById('modalNuevoClienteRapido')).hide();
  });

  // Acciones Tabla
  listaClientesDiv.addEventListener('click', async (e) => {
    if (e.target.closest('.btn-eliminar-cliente')) {
      const id = e.target.closest('.btn-eliminar-cliente').dataset.id;
      const result = await Swal.fire({ title: '¿Eliminar?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Sí' });
      if (result.isConfirmed) { await deleteDoc(doc(db, "clientes", id)); Swal.fire('Eliminado', '', 'success'); }
    }
    if (e.target.closest('.btn-editar-cliente')) {
      const id = e.target.closest('.btn-editar-cliente').dataset.id;
      const c = clientesEnMemoria.find(cl => cl.id === id);
      if (c) {
        document.getElementById('edit-cliente-id').value = id;
        document.getElementById('edit-cliente-nombre').value = c.nombre;
        document.getElementById('edit-cliente-telefono').value = c.telefono || '';
        document.getElementById('edit-cliente-colegio').value = c.colegio || '';
        new bootstrap.Modal(document.getElementById('modalEditarCliente')).show();
      }
    }
  });

  // Guardar Edición
  document.getElementById('btn-guardar-edicion-cliente').addEventListener('click', async () => {
    const id = document.getElementById('edit-cliente-id').value;
    const colegio = capitalizarTexto(document.getElementById('edit-cliente-colegio').value);
    const datos = { nombre: capitalizarTexto(document.getElementById('edit-cliente-nombre').value), telefono: limpiarTelefono(document.getElementById('edit-cliente-telefono').value), colegio: colegio };
    await guardarReferenciaSiNoExiste("colegios", colegiosEnMemoria, colegio);
    await updateDoc(doc(db, "clientes", id), datos);
    Swal.fire('Actualizado', '', 'success');
    bootstrap.Modal.getInstance(document.getElementById('modalEditarCliente')).hide();
  });
};

const guardarCliente = async (nombre, telefono, colegio, form) => {
  const n = capitalizarTexto(nombre); const c = capitalizarTexto(colegio);
  await guardarReferenciaSiNoExiste("colegios", colegiosEnMemoria, c);
  const docRef = await addDoc(collection(db, "clientes"), { nombre: n, telefono, colegio: c });
  Swal.fire('Registrado', '', 'success');
  form.reset();
  return docRef;
};