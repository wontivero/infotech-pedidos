// 1. Importaciones del SDK de Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, where, deleteDoc, doc, updateDoc, orderBy, getDoc } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-storage.js";

// 2. Configuración de Firebase (reemplazar con tus credenciales)
const firebaseConfig = {
  apiKey: "AIzaSyBEhGpYnI0Pl1yN7lDFAqr5Z2fz956x6UE",
  authDomain: "infotech-pedidos.firebaseapp.com",
  projectId: "infotech-pedidos",
  storageBucket: "infotech-pedidos.firebasestorage.app",
  messagingSenderId: "439969283194",
  appId: "1:439969283194:web:6f65e5a01cd7efed6e0fc3"
};

// Inicializar Firebase, Firestore y Storage
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

// --- LÓGICA PARA PESTAÑA "ABM LIBROS" ---

// Selección de elementos del DOM
const formNuevoLibro = document.getElementById('form-nuevo-libro');
const listaLibrosDiv = document.getElementById('lista-libros');

/**
 * Sube un archivo a Firebase Storage y devuelve la URL de descarga.
 * @param {File} file - El archivo a subir.
 * @returns {Promise<string>} La URL de descarga de la imagen.
 */
const subirImagen = async (file) => {
  if (!file) return '';
  const storageRef = ref(storage, `libros/${Date.now()}-${file.name}`);
  const uploadResult = await uploadBytes(storageRef, file);
  return getDownloadURL(uploadResult.ref);
};

/**
 * Carga los libros desde Firestore y los renderiza en una tabla.
 */
const cargarLibros = async () => {
  listaLibrosDiv.innerHTML = '<div class="text-center"><div class="spinner-border" role="status"><span class="visually-hidden">Cargando...</span></div></div>';

  try {
    const querySnapshot = await getDocs(collection(db, "libros"));
    if (querySnapshot.empty) {
      listaLibrosDiv.innerHTML = '<div class="alert alert-info">No hay libros cargados todavía.</div>';
      return;
    }

    let tableHTML = `<table class="table table-striped table-hover align-middle">
      <thead><tr><th>Portada</th><th>Título</th><th>Páginas</th><th>Editorial</th><th>Precio</th><th>Acciones</th></tr></thead>
      <tbody>`;

    querySnapshot.forEach((doc) => {
      const libro = doc.data();
      const precioFormateado = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(libro.precio || 0);
      tableHTML += `<tr>
        <td><img src="${libro.imageUrl || 'https://via.placeholder.com/50x75'}" alt="Portada" width="50" class="img-thumbnail" style="cursor: pointer;" data-bs-toggle="modal" data-bs-target="#modalImagen" data-img-url="${libro.imageUrl || 'https://via.placeholder.com/50x75'}"></td>
        <td>${libro.titulo || 'Sin Título'}</td>
        <td>${libro.paginas || 'N/A'}</td>
        <td>${libro.editorial || 'N/A'}</td>
        <td>${precioFormateado}</td>
        <td>
          <button class="btn btn-warning btn-sm btn-editar-libro" data-id="${doc.id}"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-danger btn-sm btn-eliminar-libro" data-id="${doc.id}"><i class="bi bi-trash"></i></button>
        </td>
      </tr>`;
    });

    tableHTML += `</tbody></table>`;
    listaLibrosDiv.innerHTML = tableHTML;
  } catch (error) {
    console.error("Error al cargar los libros: ", error);
    listaLibrosDiv.innerHTML = `<div class="alert alert-danger">Error al cargar la lista de libros.</div>`;
  }
};

// 3. Evento 'submit' para el formulario de nuevo libro
formNuevoLibro.addEventListener('submit', async (e) => {
  e.preventDefault();
  const submitButton = document.getElementById('btn-guardar-libro');
  submitButton.disabled = true;
  submitButton.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Guardando...`;

  try {
    const imagenFile = document.getElementById('libro-imagen').files[0];
    const imageUrl = await subirImagen(imagenFile);

    const libroData = {
      titulo: document.getElementById('libro-titulo').value,
      paginas: Number(document.getElementById('libro-paginas').value) || 0,
      editorial: document.getElementById('libro-editorial').value,
      precio: parseFloat(document.getElementById('libro-precio').value),
      imageUrl: imageUrl
    };

    await addDoc(collection(db, "libros"), libroData);
    alert('¡Libro guardado con éxito!');
    formNuevoLibro.reset();
    await cargarLibros(); // Actualizar la lista de libros
  } catch (error) {
    console.error("Error al guardar el libro: ", error);
    alert('Ocurrió un error al guardar el libro.');
  } finally {
    submitButton.disabled = false;
    submitButton.innerHTML = 'Guardar Libro';
  }
});

// --- LÓGICA DE EDICIÓN Y ELIMINACIÓN DE LIBROS ---

listaLibrosDiv.addEventListener('click', async (e) => {
  // Eliminar Libro
  if (e.target.closest('.btn-eliminar-libro')) {
    const id = e.target.closest('.btn-eliminar-libro').dataset.id;
    if (confirm('¿Estás seguro de que querés eliminar este libro?')) {
      try {
        await deleteDoc(doc(db, "libros", id));
        cargarLibros();
        cargarLibrosEnMemoria();
      } catch (error) {
        console.error("Error al eliminar libro:", error);
        alert("Error al eliminar el libro.");
      }
    }
  }

  // Editar Libro (Abrir Modal)
  if (e.target.closest('.btn-editar-libro')) {
    const id = e.target.closest('.btn-editar-libro').dataset.id;
    const libro = librosEnMemoria.find(l => l.id === id);
    if (libro) {
      document.getElementById('edit-libro-id').value = id;
      document.getElementById('edit-libro-titulo').value = libro.titulo;
      document.getElementById('edit-libro-paginas').value = libro.paginas;
      document.getElementById('edit-libro-editorial').value = libro.editorial;
      document.getElementById('edit-libro-precio').value = libro.precio;
      const modal = new bootstrap.Modal(document.getElementById('modalEditarLibro'));
      modal.show();
    }
  }
});

// Guardar cambios del libro editado
document.getElementById('btn-guardar-edicion-libro').addEventListener('click', async () => {
  const id = document.getElementById('edit-libro-id').value;
  const datosActualizados = {
    titulo: document.getElementById('edit-libro-titulo').value,
    paginas: Number(document.getElementById('edit-libro-paginas').value),
    editorial: document.getElementById('edit-libro-editorial').value,
    precio: parseFloat(document.getElementById('edit-libro-precio').value)
  };

  await updateDoc(doc(db, "libros", id), datosActualizados);
  alert("Libro actualizado correctamente");
  cargarLibros();
  cargarLibrosEnMemoria();
  bootstrap.Modal.getInstance(document.getElementById('modalEditarLibro')).hide();
});

// Carga inicial de libros cuando el DOM está listo
document.addEventListener('DOMContentLoaded', () => {
  cargarLibros();
  cargarClientes();
  cargarClientesEnMemoria();
  cargarLibrosEnMemoria();
  cargarPedidos(); // Cargar pedidos al inicio

  // Configuración del modal de imágenes
  const modalImagenElement = document.getElementById('modalImagen');
  if (modalImagenElement) {
    modalImagenElement.addEventListener('show.bs.modal', event => {
      const trigger = event.relatedTarget;
      const url = trigger.getAttribute('data-img-url');
      const modalImg = document.getElementById('imagen-ampliada');
      if (modalImg) modalImg.src = url;
    });
  }
});

// --- LÓGICA PARA PESTAÑA "GESTOR DE PEDIDOS" ---

let carrito = [];
let totalPedido = 0;
let clientesEnMemoria = []; // Array para búsqueda rápida de clientes
let clienteSeleccionado = null; // Objeto del cliente seleccionado
let resultadosBusquedaClientes = [];
let selectedIndexClientes = -1;
let librosEnMemoria = []; // Array para búsqueda rápida
let resultadosBusqueda = []; // Array temporal de resultados filtrados
let selectedIndex = -1; // Para navegación con teclado

const inputBuscarCliente = document.getElementById('input-buscar-cliente');
const listaResultadosClientes = document.getElementById('lista-resultados-clientes');
const inputBuscarLibro = document.getElementById('input-buscar-libro');
const listaResultados = document.getElementById('lista-resultados-libros');
const tablaCarrito = document.getElementById('tabla-carrito');
const inputTotal = document.getElementById('total-pedido');
const inputSena = document.getElementById('sena-pagada');
const inputSaldo = document.getElementById('saldo-pendiente');
const btnGenerarPedido = document.getElementById('btn-generar-pedido');
const btnGenerarPresupuesto = document.getElementById('btn-generar-presupuesto');
const inputPresupuestoCodigo = document.getElementById('input-presupuesto-codigo');
const btnCargarPresupuesto = document.getElementById('btn-cargar-presupuesto');

// Carga todos los clientes en memoria para el buscador rápido
const cargarClientesEnMemoria = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, "clientes"));
    clientesEnMemoria = [];
    querySnapshot.forEach((doc) => {
      clientesEnMemoria.push({
        id: doc.id,
        ...doc.data()
      });
    });
  } catch (error) {
    console.error("Error al cargar clientes en memoria:", error);
  }
};

// Carga todos los libros en memoria para el buscador rápido
const cargarLibrosEnMemoria = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, "libros"));
    librosEnMemoria = [];
    querySnapshot.forEach((doc) => {
      librosEnMemoria.push({
        id: doc.id,
        ...doc.data()
      });
    });
  } catch (error) {
    console.error("Error al cargar libros en memoria:", error);
  }
};

const actualizarTotales = () => {
  const sena = parseFloat(inputSena.value) || 0;
  const saldo = totalPedido - sena;
  const formatter = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });
  
  inputTotal.value = formatter.format(totalPedido);
  inputSaldo.value = formatter.format(saldo);
};

const renderizarCarrito = () => {
  tablaCarrito.innerHTML = '';
  const formatter = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });

  carrito.forEach((item, index) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><img src="${item.imageUrl || 'https://via.placeholder.com/50x75'}" alt="Portada" width="40" class="img-thumbnail" style="cursor: pointer;" data-bs-toggle="modal" data-bs-target="#modalImagen" data-img-url="${item.imageUrl || 'https://via.placeholder.com/50x75'}"></td>
      <td>
        ${item.titulo}
        ${item.editorial ? `<br><small class="text-muted">${item.editorial}</small>` : ''}
      </td>
      <td>${formatter.format(item.precio)}</td>
      <td><button class="btn btn-danger btn-sm btn-eliminar-item" data-index="${index}"><i class="bi bi-trash"></i></button></td>
    `;
    tablaCarrito.appendChild(row);
  });

  document.querySelectorAll('.btn-eliminar-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.closest('button').dataset.index);
      totalPedido -= carrito[index].precio;
      carrito.splice(index, 1);
      renderizarCarrito();
      actualizarTotales();
    });
  });
};

// Función auxiliar para agregar al carrito
const agregarAlCarrito = (libro) => {
  carrito.push({ id: libro.id, titulo: libro.titulo, editorial: libro.editorial, precio: libro.precio, imageUrl: libro.imageUrl });
  totalPedido += libro.precio;
  renderizarCarrito();
  actualizarTotales();
  
  // Limpiar buscador y mantener el foco para seguir agregando
  inputBuscarLibro.value = '';
  listaResultados.style.display = 'none';
  selectedIndex = -1;
  inputBuscarLibro.focus();
};

// --- LÓGICA DEL BUSCADOR DE CLIENTES ---

const seleccionarCliente = (cliente) => {
  clienteSeleccionado = cliente;
  inputBuscarCliente.value = cliente.nombre;
  listaResultadosClientes.style.display = 'none';
  selectedIndexClientes = -1;
};

const renderizarResultadosClientes = (clientes) => {
  listaResultadosClientes.innerHTML = '';
  if (clientes.length === 0) {
    listaResultadosClientes.style.display = 'none';
    return;
  }

  clientes.forEach((cliente, index) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = `list-group-item list-group-item-action ${index === selectedIndexClientes ? 'active' : ''}`;
    item.innerHTML = `
      <div class="d-flex w-100 justify-content-between">
        <h6 class="mb-1">${cliente.nombre}</h6>
        <small>${cliente.telefono || ''}</small>
      </div>
    `;
    
    item.addEventListener('click', () => seleccionarCliente(cliente));
    listaResultadosClientes.appendChild(item);
  });

  listaResultadosClientes.style.display = 'block';
};

inputBuscarCliente.addEventListener('input', (e) => {
  const userInput = e.target.value.toLowerCase();
  clienteSeleccionado = null; // Resetear selección si edita
  selectedIndexClientes = -1;

  if (userInput.length < 2) {
    listaResultadosClientes.style.display = 'none';
    return;
  }

  const searchTerms = userInput.split(' ').filter(term => term.trim().length > 0);

  resultadosBusquedaClientes = clientesEnMemoria.filter(cliente => {
    const searchableString = [
      cliente.nombre,
      cliente.telefono || ''
    ].join(' ').toLowerCase();

    return searchTerms.every(term => searchableString.includes(term));
  });

  renderizarResultadosClientes(resultadosBusquedaClientes);
});

inputBuscarCliente.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    selectedIndexClientes = (selectedIndexClientes + 1) % resultadosBusquedaClientes.length;
    renderizarResultadosClientes(resultadosBusquedaClientes);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (selectedIndexClientes === -1) selectedIndexClientes = resultadosBusquedaClientes.length - 1;
    else selectedIndexClientes = (selectedIndexClientes - 1 + resultadosBusquedaClientes.length) % resultadosBusquedaClientes.length;
    renderizarResultadosClientes(resultadosBusquedaClientes);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (selectedIndexClientes > -1 && resultadosBusquedaClientes[selectedIndexClientes]) {
      seleccionarCliente(resultadosBusquedaClientes[selectedIndexClientes]);
    } else if (resultadosBusquedaClientes.length === 1) {
      seleccionarCliente(resultadosBusquedaClientes[0]);
    }
  } else if (e.key === 'Escape') {
    listaResultadosClientes.style.display = 'none';
  }
});

// Cerrar lista de clientes si clickeo afuera
document.addEventListener('click', (e) => {
  if (!inputBuscarCliente.contains(e.target) && !listaResultadosClientes.contains(e.target)) {
    listaResultadosClientes.style.display = 'none';
  }
});

// --- LÓGICA DEL BUSCADOR (Tokenización y Teclado) ---

const renderizarResultadosBusqueda = (libros) => {
  listaResultados.innerHTML = '';
  if (libros.length === 0) {
    listaResultados.style.display = 'none';
    return;
  }

  const formatter = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });

  libros.forEach((libro, index) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = `list-group-item list-group-item-action ${index === selectedIndex ? 'active' : ''}`;
    item.innerHTML = `
      <div class="d-flex w-100 justify-content-between">
        <h6 class="mb-1">${libro.titulo || 'Sin Título'}</h6>
        <small>${formatter.format(libro.precio)}</small>
      </div>
      <small class="text-muted">${libro.editorial || ''}</small>
    `;
    
    // Click para agregar
    item.addEventListener('click', () => agregarAlCarrito(libro));
    listaResultados.appendChild(item);
  });

  listaResultados.style.display = 'block';
};

inputBuscarLibro.addEventListener('input', (e) => {
  const userInput = e.target.value.toLowerCase();
  selectedIndex = -1; // Resetear selección al escribir

  if (userInput.length < 2) {
    listaResultados.style.display = 'none';
    return;
  }

  // 1. Tokenización
  const searchTerms = userInput.split(' ').filter(term => term.trim().length > 0);

  // 2. Filtrado "AND"
  resultadosBusqueda = librosEnMemoria.filter(libro => {
    const searchableString = [
      libro.titulo,
      libro.editorial,
      libro.precio.toString()
    ].join(' ').toLowerCase();

    return searchTerms.every(term => searchableString.includes(term));
  });

  renderizarResultadosBusqueda(resultadosBusqueda);
});

// Manejo del teclado (Flechas y Enter)
inputBuscarLibro.addEventListener('keydown', (e) => {
  const items = listaResultados.querySelectorAll('.list-group-item');
  
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    selectedIndex = (selectedIndex + 1) % resultadosBusqueda.length;
    renderizarResultadosBusqueda(resultadosBusqueda);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (selectedIndex === -1) selectedIndex = resultadosBusqueda.length - 1;
    else selectedIndex = (selectedIndex - 1 + resultadosBusqueda.length) % resultadosBusqueda.length;
    renderizarResultadosBusqueda(resultadosBusqueda);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    
    // Caso 1: Hay un elemento seleccionado con flechas
    if (selectedIndex > -1 && resultadosBusqueda[selectedIndex]) {
      agregarAlCarrito(resultadosBusqueda[selectedIndex]);
    } 
    // Caso 2: Solo hay 1 resultado en la lista (Speed entry)
    else if (resultadosBusqueda.length === 1) {
      agregarAlCarrito(resultadosBusqueda[0]);
    }
  } else if (e.key === 'Escape') {
    listaResultados.style.display = 'none';
  }
});

// Cerrar lista si clickeo afuera
document.addEventListener('click', (e) => {
  if (!inputBuscarLibro.contains(e.target) && !listaResultados.contains(e.target)) {
    listaResultados.style.display = 'none';
  }
});

inputSena.addEventListener('input', actualizarTotales);

const generarCodigo = (prefix = '') => {
  // Genera un número aleatorio de 5 dígitos (entre 10000 y 99999)
  const numero = Math.floor(10000 + Math.random() * 90000);
  return `${prefix}${numero}`;
};

btnGenerarPedido.addEventListener('click', async (e) => {
  e.preventDefault();
  const idCliente = clienteSeleccionado ? clienteSeleccionado.id : null;

  if (!idCliente || carrito.length === 0) {
    alert('Por favor, seleccioná un cliente y agregá al menos un libro al pedido.');
    return;
  }

  const codigo = generarCodigo();
  const sena = parseFloat(inputSena.value) || 0;
  const saldo = totalPedido - sena;

  const nuevoPedido = {
    codigo_seguimiento: codigo,
    id_cliente: idCliente,
    items: carrito,
    total: totalPedido,
    sena_pagada: sena,
    saldo_pendiente: saldo,
    estado_general: 'En cola de impresión',
    fecha_creacion: new Date()
  };

  try {
    await addDoc(collection(db, "pedidos"), nuevoPedido);

    // Generar mensaje para el cliente
    const formatter = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 });
    const nombreCliente = clienteSeleccionado ? clienteSeleccionado.nombre : '';
    const urlSeguimiento = window.location.origin; // Toma la URL base de tu sitio

    let mensajeCliente = `Hola ${nombreCliente}! 👋\n`;
    mensajeCliente += `Tu pedido fue generado con éxito. 🚀\n\n`;
    mensajeCliente += `🔖 *Código de Seguimiento:* *${codigo}*\n`;
    mensajeCliente += `🔗 *Seguí el estado acá:* ${urlSeguimiento}\n\n`;
    mensajeCliente += `💰 *Total:* ${formatter.format(totalPedido)}\n`;
    mensajeCliente += `✅ *Seña:* ${formatter.format(sena)}\n`;
    mensajeCliente += `❗ *Saldo:* ${formatter.format(saldo)}\n\n`;
    mensajeCliente += `Te avisamos cuando esté listo para retirar!\n`;
    mensajeCliente += `Muchas gracias por elegirnos.`;

    // Copiar al portapapeles y avisar
    navigator.clipboard.writeText(mensajeCliente);
    alert(`Pedido creado con éxito.\nEl código de seguimiento es: ${codigo}\n\n✅ ¡Mensaje para el cliente copiado al portapapeles!`);
    
    // Resetear estado
    carrito = [];
    totalPedido = 0;
    renderizarCarrito();
    actualizarTotales();
    document.getElementById('form-carrito').reset();
    document.getElementById('form-resumen-cobro').reset();
    clienteSeleccionado = null;
    inputBuscarCliente.value = "";
    inputBuscarLibro.value = "";
  } catch (error) {
    console.error("Error al generar pedido:", error);
    alert("Hubo un error al generar el pedido.");
  }
});

btnGenerarPresupuesto.addEventListener('click', async () => {
  if (carrito.length === 0) {
    alert('Por favor, agregá al menos un libro al carrito para presupuestar.');
    return;
  }

  const formatter = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 });
  const senaSugerida = totalPedido / 2;
  const codigoPresupuesto = generarCodigo('P'); // Generamos un código único para el presupuesto (Ej: P12345)

  // Guardar presupuesto en Firestore
  try {
    const presupuestoData = {
      codigo: codigoPresupuesto,
      items: carrito,
      total: totalPedido,
      cliente: clienteSeleccionado ? { id: clienteSeleccionado.id, nombre: clienteSeleccionado.nombre, telefono: clienteSeleccionado.telefono } : null,
      fecha: new Date()
    };
    await addDoc(collection(db, "presupuestos"), presupuestoData);
  } catch (error) {
    console.error("Error al guardar presupuesto:", error);
    alert("Error al guardar el presupuesto en el sistema (aunque se copiará al portapapeles).");
  }

  let mensaje = `Hola! 👋 Te paso el presupuesto solicitado (Ref: ${codigoPresupuesto}):\n\n`;

  carrito.forEach(item => {
    mensaje += `📚 *${item.titulo}*\n   _${item.editorial || 'Ed. Varios'}_ — ${formatter.format(item.precio)}\n`;
  });

  mensaje += `\n✅ *Impresión a color y anillado incluido.*\n`;
  mensaje += `💰 *Total: ${formatter.format(totalPedido)}*\n`;
  mensaje += `-----------------------------------\n`;
  mensaje += `📝 Para encargarlo necesitamos:\n`;
  mensaje += `   • Nombre del alumno\n`;
  mensaje += `   • Colegio\n`;
  mensaje += `   • Seña de ${formatter.format(senaSugerida)} (50%)\n\n`;
  mensaje += `💳 *Alias:* INFOTECH.PAGOS\n`;
  mensaje += `(Por favor enviar comprobante)`;

  // Copiar al portapapeles y avisar
  navigator.clipboard.writeText(mensaje);
  alert(`✅ ¡Presupuesto #${codigoPresupuesto} guardado y copiado!\n\nYa podés pegarlo en WhatsApp.`);
});

// --- LÓGICA PARA CARGAR PRESUPUESTO ---

btnCargarPresupuesto.addEventListener('click', async () => {
  const codigo = inputPresupuestoCodigo.value.trim().toUpperCase();
  if (!codigo) {
    alert("Por favor, ingresá un código de presupuesto.");
    return;
  }

  btnCargarPresupuesto.disabled = true;
  btnCargarPresupuesto.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';

  try {
    const q = query(collection(db, "presupuestos"), where("codigo", "==", codigo));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      alert("❌ No se encontró ningún presupuesto con ese código.");
    } else {
      const presupuesto = querySnapshot.docs[0].data();
      
      // Cargar datos al carrito
      carrito = presupuesto.items || [];
      totalPedido = presupuesto.total || 0;
      
      // Cargar cliente si existe en el presupuesto
      if (presupuesto.cliente) {
        seleccionarCliente(presupuesto.cliente);
      }

      renderizarCarrito();
      actualizarTotales();
      alert("✅ Presupuesto cargado correctamente.");
      inputPresupuestoCodigo.value = "P"; // Limpiar input (manteniendo el prefijo)
    }
  } catch (error) {
    console.error("Error al cargar presupuesto:", error);
    alert("Ocurrió un error al buscar el presupuesto.");
  } finally {
    btnCargarPresupuesto.disabled = false;
    btnCargarPresupuesto.innerHTML = '<i class="bi bi-download"></i> Cargar';
  }
});

// --- LÓGICA PARA PESTAÑA "ABM CLIENTES" ---

const formNuevoCliente = document.getElementById('form-nuevo-cliente');
const listaClientesDiv = document.getElementById('lista-clientes');

const cargarClientes = async () => {
  listaClientesDiv.innerHTML = '<div class="text-center"><div class="spinner-border" role="status"><span class="visually-hidden">Cargando...</span></div></div>';

  try {
    const querySnapshot = await getDocs(collection(db, "clientes"));
    if (querySnapshot.empty) {
      listaClientesDiv.innerHTML = '<div class="alert alert-info">No hay clientes registrados todavía.</div>';
      return;
    }

    let tableHTML = `<table class="table table-striped table-hover">
      <thead><tr><th>Nombre</th><th>Teléfono</th><th>Colegio</th><th>Acciones</th></tr></thead>
      <tbody>`;

    querySnapshot.forEach((doc) => {
      const cliente = doc.data();
      tableHTML += `<tr>
        <td>${cliente.nombre}</td>
        <td>${cliente.telefono || '-'}</td>
        <td>${cliente.colegio || '-'}</td>
        <td>
          <button class="btn btn-warning btn-sm btn-editar-cliente" data-id="${doc.id}"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-danger btn-sm btn-eliminar-cliente" data-id="${doc.id}"><i class="bi bi-trash"></i></button>
        </td>
      </tr>`;
    });

    tableHTML += `</tbody></table>`;
    listaClientesDiv.innerHTML = tableHTML;
  } catch (error) {
    console.error("Error al cargar clientes: ", error);
    listaClientesDiv.innerHTML = `<div class="alert alert-danger">Error al cargar la lista de clientes.</div>`;
  }
};

formNuevoCliente.addEventListener('submit', async (e) => {
  e.preventDefault();
  const nombre = document.getElementById('cliente-nombre').value;
  const telefono = document.getElementById('cliente-telefono').value;
  const colegio = document.getElementById('cliente-colegio').value;

  try {
    await addDoc(collection(db, "clientes"), { nombre, telefono, colegio });
    alert('¡Cliente registrado con éxito!');
    formNuevoCliente.reset();
    cargarClientes();
    cargarClientesEnMemoria(); // Actualizar el buscador también
  } catch (error) {
    console.error("Error al guardar cliente: ", error);
    alert('Error al guardar el cliente.');
  }
});

// --- LÓGICA DE EDICIÓN Y ELIMINACIÓN DE CLIENTES ---

listaClientesDiv.addEventListener('click', async (e) => {
  // Eliminar Cliente
  if (e.target.closest('.btn-eliminar-cliente')) {
    const id = e.target.closest('.btn-eliminar-cliente').dataset.id;
    if (confirm('¿Estás seguro de que querés eliminar este cliente?')) {
      try {
        await deleteDoc(doc(db, "clientes", id));
        cargarClientes();
        cargarClientesEnMemoria();
      } catch (error) {
        console.error("Error al eliminar cliente:", error);
        alert("Error al eliminar el cliente.");
      }
    }
  }

  // Editar Cliente (Abrir Modal)
  if (e.target.closest('.btn-editar-cliente')) {
    const id = e.target.closest('.btn-editar-cliente').dataset.id;
    const cliente = clientesEnMemoria.find(c => c.id === id);
    if (cliente) {
      document.getElementById('edit-cliente-id').value = id;
      document.getElementById('edit-cliente-nombre').value = cliente.nombre;
      document.getElementById('edit-cliente-telefono').value = cliente.telefono || '';
      document.getElementById('edit-cliente-colegio').value = cliente.colegio || '';
      const modal = new bootstrap.Modal(document.getElementById('modalEditarCliente'));
      modal.show();
    }
  }
});

// Guardar cambios del cliente editado
document.getElementById('btn-guardar-edicion-cliente').addEventListener('click', async () => {
  const id = document.getElementById('edit-cliente-id').value;
  const datosActualizados = {
    nombre: document.getElementById('edit-cliente-nombre').value,
    telefono: document.getElementById('edit-cliente-telefono').value,
    colegio: document.getElementById('edit-cliente-colegio').value
  };

  await updateDoc(doc(db, "clientes", id), datosActualizados);
  alert("Cliente actualizado correctamente");
  cargarClientes();
  cargarClientesEnMemoria();
  bootstrap.Modal.getInstance(document.getElementById('modalEditarCliente')).hide();
});

// --- LÓGICA PARA PESTAÑA "LISTA DE PEDIDOS" ---

const tablaPedidosContainer = document.getElementById('tabla-pedidos-container');
const btnRefrescarPedidos = document.getElementById('btn-refrescar-pedidos');
const filtroTexto = document.getElementById('filtro-pedidos-texto');
const filtroEstado = document.getElementById('filtro-pedidos-estado');
const selectAccionMasiva = document.getElementById('accion-masiva-estado');
const btnAplicarMasivo = document.getElementById('btn-aplicar-masivo');
let pedidosEnMemoria = []; // Para acceder rápido al detalle

const cargarPedidos = async () => {
  tablaPedidosContainer.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary" role="status"></div></div>';

  try {
    // Traer pedidos ordenados por fecha (más nuevos primero)
    // Nota: Si falla por falta de índice en Firebase, verás un link en la consola para crearlo.
    // Si no querés crear índice ahora, sacá el orderBy y ordenalos con JS.
    const q = query(collection(db, "pedidos"), orderBy("fecha_creacion", "desc"));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      tablaPedidosContainer.innerHTML = '<div class="alert alert-info">No hay pedidos registrados.</div>';
      return;
    }

    pedidosEnMemoria = [];
    querySnapshot.forEach((doc) => {
      pedidosEnMemoria.push({ id: doc.id, ...doc.data() });
    });

    filtrarYRenderizarPedidos();

  } catch (error) {
    console.error("Error al cargar pedidos:", error);
    tablaPedidosContainer.innerHTML = `<div class="alert alert-danger">Error al cargar pedidos (Revisar consola por índices).<br>${error.message}</div>`;
  }
};

const filtrarYRenderizarPedidos = () => {
  const texto = filtroTexto.value.toLowerCase();
  const estado = filtroEstado.value;

  // Filtrar en memoria
  const pedidosFiltrados = pedidosEnMemoria.filter(pedido => {
    const cliente = clientesEnMemoria.find(c => c.id === pedido.id_cliente);
    const nombreCliente = cliente ? cliente.nombre.toLowerCase() : '';
    const codigo = pedido.codigo_seguimiento ? pedido.codigo_seguimiento.toString().toLowerCase() : '';
    
    const coincideTexto = nombreCliente.includes(texto) || codigo.includes(texto);
    const coincideEstado = estado === "" || pedido.estado_general === estado;

    return coincideTexto && coincideEstado;
  });

  if (pedidosFiltrados.length === 0) {
    tablaPedidosContainer.innerHTML = '<div class="alert alert-warning">No se encontraron pedidos con esos filtros.</div>';
    return;
  }

  let html = `
      <table class="table table-hover align-middle">
        <thead class="table-light">
          <tr>
            <th style="width: 40px;"><input type="checkbox" class="form-check-input" id="check-todos-pedidos"></th>
            <th>Fecha</th>
            <th>Código</th>
            <th>Cliente</th>
            <th>Estado</th>
            <th>Progreso</th>
            <th>Saldo</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
    `;

  const formatter = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });

  pedidosFiltrados.forEach((pedido) => {
      const fecha = pedido.fecha_creacion ? new Date(pedido.fecha_creacion.seconds * 1000).toLocaleDateString() : '-';
      
      // Color del badge según estado
      let badgeClass = 'bg-secondary';
      if (pedido.estado_general === 'En cola de impresión') badgeClass = 'bg-warning text-dark';
      if (pedido.estado_general === 'Imprimiendo / Armando') badgeClass = 'bg-info text-dark';
      if (pedido.estado_general === 'Encuadernando') badgeClass = 'bg-primary';
      if (pedido.estado_general === 'Listo para retirar') badgeClass = 'bg-success';
      
      // Calcular progreso de libros terminados
      const totalItems = pedido.items.length;
      const itemsTerminados = pedido.items.filter(i => i.estado === 'Terminado').length;
      const esCompleto = totalItems > 0 && totalItems === itemsTerminados;
      
      // Si está completo y no entregado, resaltamos la fila
      const rowClass = (esCompleto && pedido.estado_general !== 'Entregado') ? 'table-success' : '';
      const progresoHtml = esCompleto 
        ? `<span class="badge bg-success"><i class="bi bi-check-all"></i> ${itemsTerminados}/${totalItems}</span>` 
        : `<span class="badge bg-secondary">${itemsTerminados}/${totalItems}</span>`;

      html += `
        <tr class="${rowClass}">
          <td><input type="checkbox" class="form-check-input check-pedido" value="${pedido.id}"></td>
          <td><small>${fecha}</small></td>
          <td class="fw-bold text-primary">${pedido.codigo_seguimiento}</td>
          <td>${pedido.id_cliente ? (clientesEnMemoria.find(c => c.id === pedido.id_cliente)?.nombre || 'Cliente eliminado') : 'Desconocido'}</td>
          <td><span class="badge ${badgeClass}">${pedido.estado_general}</span></td>
          <td>${progresoHtml}</td>
          <td>${formatter.format(pedido.saldo_pendiente)}</td>
          <td>
            <button class="btn btn-sm btn-outline-primary btn-ver-detalle" data-id="${pedido.id}" title="Ver Detalle"><i class="bi bi-eye"></i></button>
            <div class="btn-group">
              <button type="button" class="btn btn-sm btn-outline-secondary dropdown-toggle" data-bs-toggle="dropdown" aria-expanded="false">
                Estado
              </button>
              <ul class="dropdown-menu">
                <li><a class="dropdown-item btn-cambiar-estado" href="#" data-id="${pedido.id}" data-estado="En cola de impresión">En cola</a></li>
                <li><a class="dropdown-item btn-cambiar-estado" href="#" data-id="${pedido.id}" data-estado="Imprimiendo / Armando">Imprimiendo</a></li>
                <li><a class="dropdown-item btn-cambiar-estado" href="#" data-id="${pedido.id}" data-estado="Encuadernando">Encuadernando</a></li>
                <li><a class="dropdown-item btn-cambiar-estado" href="#" data-id="${pedido.id}" data-estado="Listo para retirar">Listo para retirar</a></li>
                <li><a class="dropdown-item btn-cambiar-estado" href="#" data-id="${pedido.id}" data-estado="Entregado">Entregado</a></li>
              </ul>
            </div>
            ${esCompleto ? `<button class="btn btn-sm btn-success btn-whatsapp-listo" data-id="${pedido.id}" title="Avisar por WhatsApp"><i class="bi bi-whatsapp"></i></button>` : ''}
          </td>
        </tr>
      `;
    });

  html += '</tbody></table>';
  tablaPedidosContainer.innerHTML = html;
  
  // Resetear estado del botón masivo al renderizar
  btnAplicarMasivo.disabled = true;
};

btnRefrescarPedidos.addEventListener('click', cargarPedidos);
filtroTexto.addEventListener('input', filtrarYRenderizarPedidos);
filtroEstado.addEventListener('change', filtrarYRenderizarPedidos);

// Eventos delegados para la tabla de pedidos
tablaPedidosContainer.addEventListener('click', async (e) => {
  // Ver Detalle
  const btnDetalle = e.target.closest('.btn-ver-detalle');
  if (btnDetalle) {
    const id = btnDetalle.dataset.id;
    const pedido = pedidosEnMemoria.find(p => p.id === id);
    if (!pedido) return;

    document.getElementById('detalle-pedido-codigo').textContent = pedido.codigo_seguimiento;
    
    // Info Cliente
    const cliente = clientesEnMemoria.find(c => c.id === pedido.id_cliente);
    document.getElementById('detalle-pedido-info-cliente').innerHTML = `
      <strong>Cliente:</strong> ${cliente ? cliente.nombre : 'Desconocido'}<br>
      <strong>Teléfono:</strong> ${cliente ? cliente.telefono : '-'}<br>
      <strong>Colegio:</strong> ${cliente ? cliente.colegio : '-'}
    `;

    // Lista de Items
    const listaItems = document.getElementById('detalle-pedido-lista-items');
    listaItems.innerHTML = '';
    const formatter = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });
    
    pedido.items.forEach(item => {
      listaItems.innerHTML += `
        <li class="list-group-item d-flex justify-content-between align-items-center">
          <div>
            <span class="fw-bold">${item.titulo}</span>
            <br><small class="text-muted">${item.editorial || ''}</small>
          </div>
          <span>${formatter.format(item.precio)}</span>
        </li>
      `;
    });

    // Totales
    document.getElementById('detalle-pedido-totales').innerHTML = `
      Total: ${formatter.format(pedido.total)}<br>
      Seña: ${formatter.format(pedido.sena_pagada)}<br>
      <span class="text-danger">Saldo: ${formatter.format(pedido.saldo_pendiente)}</span>
    `;

    const modal = new bootstrap.Modal(document.getElementById('modalDetallePedido'));
    modal.show();
  }

  // Cambiar Estado
  const btnEstado = e.target.closest('.btn-cambiar-estado');
  if (btnEstado) {
    e.preventDefault();
    const id = btnEstado.dataset.id;
    const nuevoEstado = btnEstado.dataset.estado;

    try {
      await updateDoc(doc(db, "pedidos", id), { estado_general: nuevoEstado });
      // Actualizar localmente sin recargar todo
      cargarPedidos();
    } catch (error) {
      console.error("Error al actualizar estado:", error);
      alert("No se pudo actualizar el estado.");
    }
  }

  // Botón WhatsApp (Pedido Listo)
  const btnWhatsapp = e.target.closest('.btn-whatsapp-listo');
  if (btnWhatsapp) {
    const id = btnWhatsapp.dataset.id;
    const pedido = pedidosEnMemoria.find(p => p.id === id);
    const cliente = clientesEnMemoria.find(c => c.id === pedido.id_cliente);
    
    if (!pedido || !cliente) return;

    const formatter = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 });
    const saldo = pedido.saldo_pendiente;
    
    let mensaje = `Hola ${cliente.nombre}! 👋\n`;
    mensaje += `¡Buenas noticias! Tu pedido *#${pedido.codigo_seguimiento}* ya está completo y listo para retirar. 📚✨\n\n`;
    
    if (saldo > 0) {
      mensaje += `❗ *Saldo pendiente:* ${formatter.format(saldo)}\n`;
    } else {
      mensaje += `✅ *El pedido está pagado.*\n`;
    }
    
    mensaje += `\nTe esperamos!`;

    navigator.clipboard.writeText(mensaje);
    alert("✅ Mensaje copiado al portapapeles.\n\nYa podés pegarlo en WhatsApp.");
  }
});

// --- LÓGICA DE ACCIONES MASIVAS Y CHECKBOXES ---

tablaPedidosContainer.addEventListener('change', (e) => {
  // Checkbox "Seleccionar Todos"
  if (e.target.id === 'check-todos-pedidos') {
    const checkboxes = tablaPedidosContainer.querySelectorAll('.check-pedido');
    checkboxes.forEach(cb => cb.checked = e.target.checked);
    actualizarBotonMasivo();
  }

  // Checkbox individual
  if (e.target.classList.contains('check-pedido')) {
    actualizarBotonMasivo();
  }
});

const actualizarBotonMasivo = () => {
  const checkboxes = tablaPedidosContainer.querySelectorAll('.check-pedido:checked');
  btnAplicarMasivo.disabled = checkboxes.length === 0 || selectAccionMasiva.value === "";
};

selectAccionMasiva.addEventListener('change', actualizarBotonMasivo);

btnAplicarMasivo.addEventListener('click', async () => {
  const nuevoEstado = selectAccionMasiva.value;
  const checkboxes = tablaPedidosContainer.querySelectorAll('.check-pedido:checked');
  const ids = Array.from(checkboxes).map(cb => cb.value);

  if (!nuevoEstado || ids.length === 0) return;

  if (!confirm(`¿Estás seguro de cambiar el estado de ${ids.length} pedidos a "${nuevoEstado}"?`)) return;

  btnAplicarMasivo.disabled = true;
  btnAplicarMasivo.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';

  try {
    const promesas = ids.map(id => updateDoc(doc(db, "pedidos", id), { estado_general: nuevoEstado }));
    await Promise.all(promesas);
    alert("¡Estados actualizados correctamente!");
    cargarPedidos(); // Recargar para ver cambios
    selectAccionMasiva.value = ""; // Resetear select
  } catch (error) {
    console.error("Error en actualización masiva:", error);
    alert("Hubo un error al actualizar algunos pedidos.");
  } finally {
    btnAplicarMasivo.innerHTML = 'Aplicar';
  }
});

// --- LÓGICA PARA PESTAÑA "COLA DE PRODUCCIÓN" ---

const tablaProduccionContainer = document.getElementById('tabla-produccion-container');
const btnRefrescarProduccion = document.getElementById('btn-refrescar-produccion');
const filtroProduccionLibro = document.getElementById('filtro-produccion-libro');
let itemsProduccion = []; // Lista aplanada de libros pendientes
let gruposProduccion = {}; // Objeto para agrupar por título

const cargarColaProduccion = async (grupoAbiertoKey = null) => {
  // Solo mostrar spinner de carga completa si NO estamos manteniendo un grupo abierto
  if (!grupoAbiertoKey) {
    tablaProduccionContainer.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-warning" role="status"></div></div>';
  }

  try {
    // Traemos pedidos que NO estén entregados (para ver qué falta producir)
    // Nota: Firebase no permite filtros de desigualdad (!=) simples sin índices complejos a veces,
    // así que traemos todo y filtramos en memoria lo que no sea "Entregado".
    const q = query(collection(db, "pedidos"), orderBy("fecha_creacion", "asc")); // Los más viejos primero (prioridad)
    const querySnapshot = await getDocs(q);

    itemsProduccion = [];
    gruposProduccion = {};

    querySnapshot.forEach((doc) => {
      const pedido = doc.data();
      // Ignorar pedidos ya entregados
      if (pedido.estado_general === 'Entregado') return;

      const cliente = clientesEnMemoria.find(c => c.id === pedido.id_cliente);
      const nombreCliente = cliente ? cliente.nombre : 'Desconocido';
      const fecha = pedido.fecha_creacion ? new Date(pedido.fecha_creacion.seconds * 1000).toLocaleDateString() : '-';

      // "Aplanar" los items: Crear una fila por cada libro
      pedido.items.forEach((item, index) => {
        itemsProduccion.push({
          pedidoId: doc.id,
          pedidoCodigo: pedido.codigo_seguimiento,
          cliente: nombreCliente,
          fecha: fecha,
          itemIndex: index, // Necesario para saber qué item actualizar en el array
          titulo: item.titulo,
          editorial: item.editorial || '',
          estadoItem: item.estado || 'En cola de impresión' // Estado individual del libro
        });
      });
    });

    // Ordenar por título para agrupar tandas
    itemsProduccion.sort((a, b) => a.titulo.localeCompare(b.titulo));

    // Agrupar por Título + Editorial
    itemsProduccion.forEach(item => {
      const key = `${item.titulo} - ${item.editorial}`;
      if (!gruposProduccion[key]) {
        gruposProduccion[key] = {
          titulo: item.titulo,
          editorial: item.editorial,
          items: [],
          stats: { total: 0, pendientes: 0, imprimiendo: 0, encuadernando: 0, terminados: 0 }
        };
      }
      gruposProduccion[key].items.push(item);
      gruposProduccion[key].stats.total++;
      
      // Contadores simples
      const est = item.estadoItem;
      if (est === 'Terminado') gruposProduccion[key].stats.terminados++;
      else if (est === 'Encuadernando') gruposProduccion[key].stats.encuadernando++;
      else if (est === 'Imprimiendo / Armando') gruposProduccion[key].stats.imprimiendo++;
      else gruposProduccion[key].stats.pendientes++;
    });

    renderizarProduccion(grupoAbiertoKey);

  } catch (error) {
    console.error("Error al cargar producción:", error);
    tablaProduccionContainer.innerHTML = `<div class="alert alert-danger">Error al cargar la cola de producción.<br>${error.message}</div>`;
  }
};

const renderizarProduccion = (grupoAbiertoKey = null) => {
  const filtro = filtroProduccionLibro.value.toLowerCase();
  
  // Obtener estados seleccionados de los checkboxes
  const checkboxesEstados = document.querySelectorAll('.check-filtro-estado:checked');
  const estadosSeleccionados = Array.from(checkboxesEstados).map(cb => cb.value);
  
  // Filtrar grupos y recalcular items visibles por grupo
  const clavesFiltradas = Object.keys(gruposProduccion).filter(key => {
    const coincideTitulo = key.toLowerCase().includes(filtro);
    // Verificar si el grupo tiene al menos un item que coincida con ALGUNO de los estados seleccionados
    const tieneItemsEstado = gruposProduccion[key].items.some(i => estadosSeleccionados.includes(i.estadoItem));
    
    return coincideTitulo && tieneItemsEstado;
  });

  // Calcular estadísticas dinámicas
  let totalLibros = 0;
  let totalTerminados = 0;
  
  clavesFiltradas.forEach(key => {
    totalLibros += gruposProduccion[key].stats.total;
    totalTerminados += gruposProduccion[key].stats.terminados;
  });

  const statsContainer = document.getElementById('produccion-stats');
  if (statsContainer) {
    statsContainer.innerHTML = `📊 Resumen: <strong>${totalLibros}</strong> Libros en lista | ✅ Terminados: <strong>${totalTerminados}</strong>`;
  }

  if (clavesFiltradas.length === 0) {
    tablaProduccionContainer.innerHTML = '<div class="alert alert-info">No hay libros pendientes que coincidan con la búsqueda.</div>';
    return;
  }

  let html = `<div class="accordion" id="accordionProduccion">`;

  clavesFiltradas.forEach((key, index) => {
    const grupo = gruposProduccion[key];
    const collapseId = `collapse-${index}`;

    // Determinar si este grupo debe aparecer abierto
    const isOpen = key === grupoAbiertoKey;
    const showClass = isOpen ? 'show' : '';
    const collapsedClass = isOpen ? '' : 'collapsed';
    const ariaExpanded = isOpen ? 'true' : 'false';

    // Filtrar items dentro del grupo para mostrar solo los que coinciden con el estado seleccionado
    const itemsVisibles = grupo.items.filter(i => estadosSeleccionados.includes(i.estadoItem));
    if (itemsVisibles.length === 0) return; // Si no hay items visibles en este grupo tras filtrar, saltar
    
    // Barra de progreso visual para el grupo
    const porcentaje = Math.round((grupo.stats.terminados / grupo.stats.total) * 100);
    const colorBarra = porcentaje === 100 ? 'bg-success' : 'bg-primary';

    html += `
      <div class="accordion-item">
        <h2 class="accordion-header">
          <button class="accordion-button ${collapsedClass}" type="button" data-bs-toggle="collapse" data-bs-target="#${collapseId}" aria-expanded="${ariaExpanded}">
            <div class="d-flex w-100 justify-content-between align-items-center me-3">
              <div>
                <strong>${grupo.titulo}</strong> <small class="text-muted">(${grupo.editorial})</small>
                <div class="progress mt-1" style="height: 5px; width: 100px;">
                  <div class="progress-bar ${colorBarra}" role="progressbar" style="width: ${porcentaje}%"></div>
                </div>
              </div>
              <div class="text-end">
                <span class="badge bg-secondary rounded-pill">${grupo.stats.total} copias</span>
                <small class="d-block text-muted" style="font-size: 0.7rem">
                  ${grupo.stats.pendientes} Cola | ${grupo.stats.imprimiendo} Imp | ${grupo.stats.encuadernando} Enc | ${grupo.stats.terminados} OK
                </small>
              </div>
            </div>
          </button>
        </h2>
        <div id="${collapseId}" class="accordion-collapse collapse ${showClass}" data-bs-parent="#accordionProduccion">
          <div class="accordion-body p-0">
            <!-- Controles Masivos del Grupo -->
            <div class="p-2 bg-light border-bottom d-flex justify-content-end align-items-center gap-2">
              <small>Acción para seleccionados:</small>
              <select class="form-select form-select-sm w-auto select-masivo-grupo">
                <option value="">Cambiar todos a...</option>
                <option value="En cola de impresión">En cola</option>
                <option value="Imprimiendo / Armando">Imprimiendo</option>
                <option value="Encuadernando">Encuadernando</option>
                <option value="Terminado">Terminado</option>
              </select>
              <button class="btn btn-sm btn-dark btn-aplicar-masivo-grupo" data-group-key="${key}">Aplicar</button>
            </div>

            <table class="table table-sm table-hover mb-0">
              <thead class="table-light">
                <tr>
                  <th style="width: 30px;"><input type="checkbox" class="form-check-input check-todos-grupo" data-group-key="${key}"></th>
                  <th>Fecha</th><th>Cliente</th><th>Pedido</th><th>Estado Actual</th><th>Acción</th>
                </tr>
              </thead>
              <tbody>
                ${itemsVisibles.map(item => {
                  let badge = 'bg-secondary';
                  let textoEstado = item.estadoItem;

                  if(item.estadoItem === 'En cola de impresión') {
                    badge = 'bg-warning text-dark';
                    textoEstado = 'En cola';
                  }
                  if(item.estadoItem === 'Imprimiendo / Armando') {
                    badge = 'bg-info text-dark';
                    textoEstado = 'Imprimiendo';
                  }
                  if(item.estadoItem === 'Encuadernando') badge = 'bg-primary';
                  if(item.estadoItem === 'Terminado') badge = 'bg-success';

                  return `
                  <tr>
                    <td><input type="checkbox" class="form-check-input check-item-produccion" value="${item.pedidoId}|${item.itemIndex}" data-group-key="${key}"></td>
                    <td><small>${item.fecha}</small></td>
                    <td>${item.cliente}</td>
                    <td>${item.pedidoCodigo}</td>
                    <td><span class="badge ${badge}">${textoEstado}</span></td>
                    <td>
                      <select class="form-select form-select-sm select-estado-item" data-pedido-id="${item.pedidoId}" data-item-index="${item.itemIndex}" data-group-key="${key}">
                        <option value="En cola de impresión" ${item.estadoItem === 'En cola de impresión' ? 'selected' : ''}>En cola</option>
                        <option value="Imprimiendo / Armando" ${item.estadoItem === 'Imprimiendo / Armando' ? 'selected' : ''}>Imprimiendo</option>
                        <option value="Encuadernando" ${item.estadoItem === 'Encuadernando' ? 'selected' : ''}>Encuadernando</option>
                        <option value="Terminado" ${item.estadoItem === 'Terminado' ? 'selected' : ''}>Terminado</option>
                      </select>
                    </td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  });

  html += '</div>'; // Cierre accordion
  tablaProduccionContainer.innerHTML = html;
};

tablaProduccionContainer.addEventListener('click', async (e) => {
  // 0. Checkbox "Seleccionar Todos" del grupo
  if (e.target.classList.contains('check-todos-grupo')) {
    const groupKey = e.target.dataset.groupKey;
    // Buscar solo los checkboxes dentro de este acordeón/tabla específico
    const checkboxes = tablaProduccionContainer.querySelectorAll(`.check-item-produccion[data-group-key="${groupKey}"]`);
    checkboxes.forEach(cb => cb.checked = e.target.checked);
  }

  // Desmarcar "Seleccionar Todos" si uno individual se desmarca
  if (e.target.classList.contains('check-item-produccion')) {
    // Lógica opcional para UX, por ahora simple
  }

  // 2. Botón Masivo por Grupo
  const btnMasivo = e.target.closest('.btn-aplicar-masivo-grupo');
  if (btnMasivo) {
    const key = btnMasivo.dataset.groupKey;
    const select = btnMasivo.previousElementSibling; // El select está justo antes del botón
    const nuevoEstado = select.value;

    // Buscar checkboxes seleccionados en este grupo
    const checkboxes = tablaProduccionContainer.querySelectorAll(`.check-item-produccion[data-group-key="${key}"]:checked`);
    const seleccionados = Array.from(checkboxes).map(cb => {
      const [pedidoId, itemIndex] = cb.value.split('|');
      return { pedidoId, itemIndex: parseInt(itemIndex) };
    });

    if (!nuevoEstado) { alert("Seleccioná un estado destino."); return; }
    if (seleccionados.length === 0) { alert("Seleccioná al menos un libro de la lista."); return; }

    if (!confirm(`¿Cambiar ${seleccionados.length} libros a estado "${nuevoEstado}"?`)) return;

    btnMasivo.disabled = true;
    btnMasivo.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';

    // Ejecutar actualización masiva optimizada (agrupada por pedido)
    await actualizarEstadoItemsMasivo(seleccionados, nuevoEstado);
    
    await cargarColaProduccion(key); // Recargar manteniendo el grupo abierto
  }
});

tablaProduccionContainer.addEventListener('change', async (e) => {
  // Cambio de estado individual via Select
  if (e.target.classList.contains('select-estado-item')) {
    const select = e.target;
    const pedidoId = select.dataset.pedidoId;
    const itemIndex = parseInt(select.dataset.itemIndex);
    const groupKey = select.dataset.groupKey;
    const nuevoEstado = select.value;

    // Visual feedback: Spinner en la columna de estado
    const row = select.closest('tr');
    let originalBadgeHTML = '';
    if (row && row.cells[4]) {
      originalBadgeHTML = row.cells[4].innerHTML;
      row.cells[4].innerHTML = '<div class="spinner-border spinner-border-sm text-primary" role="status"></div>';
    }

    select.disabled = true;
    await actualizarEstadoItem(pedidoId, itemIndex, nuevoEstado, true, groupKey);
    
    // Si el elemento sigue existiendo (por error o falta de refresh), restauramos
    if (document.body.contains(select)) {
      select.disabled = false;
      if (row && row.cells[4] && originalBadgeHTML) row.cells[4].innerHTML = originalBadgeHTML;
    }
  }
});

// Función auxiliar para actualizar un item en Firebase
const actualizarEstadoItem = async (pedidoId, itemIndex, nuevoEstado, recargar = true, groupKey = null) => {
  try {
    // 1. Obtener el pedido actualizado de Firebase
    const pedidoRef = doc(db, "pedidos", pedidoId);
    const pedidoSnap = await getDoc(pedidoRef);

    if (pedidoSnap.exists()) {
      const pedidoData = pedidoSnap.data();
      const items = pedidoData.items;

      // 2. Cambiar el estado
      items[itemIndex].estado = nuevoEstado;

      // 3. Guardar cambios
      await updateDoc(pedidoRef, { items: items });

      if (recargar) {
        // Verificar si el pedido se completó totalmente
        const itemsTerminados = items.filter(i => i.estado === 'Terminado').length;
        if (itemsTerminados === items.length && nuevoEstado === 'Terminado') {
           // Buscar nombre cliente en memoria para el alert
           const clienteNombre = clientesEnMemoria.find(c => c.id === pedidoData.id_cliente)?.nombre || 'Cliente';
           alert(`🎉 ¡Atención! El pedido de ${clienteNombre} se ha completado en su totalidad.`);
        }
        await cargarColaProduccion(groupKey);
      }
    }
  } catch (error) {
    console.error("Error al actualizar item:", error);
    if(recargar) alert("Error al actualizar el estado del libro.");
  }
};

// Función optimizada para actualización masiva (evita condiciones de carrera)
const actualizarEstadoItemsMasivo = async (listaItems, nuevoEstado) => {
  // 1. Agrupar items por Pedido ID
  const itemsPorPedido = {};
  listaItems.forEach(item => {
    if (!itemsPorPedido[item.pedidoId]) {
      itemsPorPedido[item.pedidoId] = [];
    }
    itemsPorPedido[item.pedidoId].push(item.itemIndex);
  });

  // 2. Procesar cada pedido UNA sola vez
  const promesas = Object.keys(itemsPorPedido).map(async (pedidoId) => {
    try {
      const pedidoRef = doc(db, "pedidos", pedidoId);
      const pedidoSnap = await getDoc(pedidoRef);

      if (pedidoSnap.exists()) {
        const pedidoData = pedidoSnap.data();
        const items = pedidoData.items;
        const indicesAActualizar = itemsPorPedido[pedidoId];

        // Actualizar todos los índices solicitados para este pedido
        indicesAActualizar.forEach(index => {
          if (items[index]) items[index].estado = nuevoEstado;
        });

        // Guardar una sola vez
        await updateDoc(pedidoRef, { items: items });
        
        // Verificar si se completó el pedido (opcional, sin alert masivo para no spammear)
      }
    } catch (error) {
      console.error(`Error actualizando pedido ${pedidoId}:`, error);
    }
  });

  await Promise.all(promesas);
};

btnRefrescarProduccion.addEventListener('click', () => cargarColaProduccion());
filtroProduccionLibro.addEventListener('input', renderizarProduccion);

// Event listener para los nuevos checkboxes de filtro
document.querySelectorAll('.check-filtro-estado').forEach(check => {
  check.addEventListener('change', () => renderizarProduccion());
});