// 1. Importaciones del SDK de Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, where, deleteDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
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