// 1. Importaciones del SDK de Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, where, deleteDoc, doc, updateDoc, orderBy, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
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

// --- UTILIDADES Y REFERENCIAS (Colegios/Editoriales) ---

let colegiosEnMemoria = [];
let editorialesEnMemoria = [];

/**
 * Convierte un texto a Title Case (Primera Letra Mayúscula).
 * Ej: "juan perez" -> "Juan Perez"
 */
const capitalizarTexto = (texto) => {
  if (!texto) return '';
  return texto.toLowerCase().replace(/(?:^|\s|["'([{])+\S/g, match => match.toUpperCase());
};

/**
 * Carga las listas de referencia para los datalists.
 */
const cargarListasReferencia = async () => {
  try {
    // Cargar Colegios
    const colSnap = await getDocs(collection(db, "colegios"));
    colegiosEnMemoria = [];
    const datalistColegios = document.getElementById('datalist-colegios');
    datalistColegios.innerHTML = '';
    colSnap.forEach(doc => {
      const nombre = doc.data().nombre;
      colegiosEnMemoria.push(nombre);
      const option = document.createElement('option');
      option.value = nombre;
      datalistColegios.appendChild(option);
    });

    // Cargar Editoriales
    const edSnap = await getDocs(collection(db, "editoriales"));
    editorialesEnMemoria = [];
    const datalistEditoriales = document.getElementById('datalist-editoriales');
    datalistEditoriales.innerHTML = '';
    edSnap.forEach(doc => {
      const nombre = doc.data().nombre;
      editorialesEnMemoria.push(nombre);
      const option = document.createElement('option');
      option.value = nombre;
      datalistEditoriales.appendChild(option);
    });
  } catch (error) {
    console.error("Error cargando referencias:", error);
  }
};

const guardarReferenciaSiNoExiste = async (coleccion, listaMemoria, valor) => {
  if (!valor) return;
  // Verificar si ya existe (ignorando mayúsculas/minúsculas)
  const existe = listaMemoria.some(item => item.toLowerCase() === valor.toLowerCase());
  if (!existe) {
    await addDoc(collection(db, coleccion), { nombre: valor });
    await cargarListasReferencia(); // Recargar listas
  }
};

const actualizarDatalistTitulos = () => {
  const datalist = document.getElementById('datalist-titulos-libros');
  if (!datalist) return;
  datalist.innerHTML = '';
  const titulos = [...new Set(librosEnMemoria.map(l => l.titulo))].sort();
  titulos.forEach(titulo => {
    const option = document.createElement('option');
    option.value = titulo;
    datalist.appendChild(option);
  });
};

// --- LÓGICA DE CONFIGURACIÓN ---

let configuracionGlobal = {
  alias: 'INFOTECH.PAGOS', // Valor por defecto
  banco: '',
  titular: ''
};

const actualizarVistaConfiguracion = () => {
  const lblAlias = document.getElementById('lbl-config-alias');
  const lblBanco = document.getElementById('lbl-config-banco');
  const lblTitular = document.getElementById('lbl-config-titular');
  const container = document.getElementById('config-actual-info');

  if (lblAlias) lblAlias.textContent = configuracionGlobal.alias || 'No configurado';
  if (lblBanco) lblBanco.textContent = configuracionGlobal.banco || '-';
  if (lblTitular) lblTitular.textContent = configuracionGlobal.titular || '-';
  if (container) container.classList.remove('d-none');
};

const cargarConfiguracion = async () => {
  try {
    const docRef = doc(db, "configuracion", "general");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      configuracionGlobal = { ...configuracionGlobal, ...docSnap.data() };
      
      // Llenar formulario si existe en el DOM
      const inputAlias = document.getElementById('config-alias');
      if (inputAlias) {
        inputAlias.value = configuracionGlobal.alias || '';
        document.getElementById('config-banco').value = configuracionGlobal.banco || '';
        document.getElementById('config-titular').value = configuracionGlobal.titular || '';
      }

      // Actualizar el recuadro informativo
      actualizarVistaConfiguracion();
    }
  } catch (error) {
    console.error("Error cargando configuración:", error);
  }
};

const formConfiguracion = document.getElementById('form-configuracion');
if (formConfiguracion) {
  formConfiguracion.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nuevoConfig = {
      alias: document.getElementById('config-alias').value,
      banco: document.getElementById('config-banco').value,
      titular: document.getElementById('config-titular').value
    };

    try {
      await setDoc(doc(db, "configuracion", "general"), nuevoConfig);
      configuracionGlobal = nuevoConfig;
      actualizarVistaConfiguracion(); // Refrescar el recuadro visual
      Swal.fire('Guardado', 'La configuración se actualizó correctamente.', 'success');
    } catch (error) {
      console.error("Error guardando configuración:", error);
      Swal.fire('Error', 'No se pudo guardar la configuración.', 'error');
    }
  });
}

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

    const editorial = capitalizarTexto(document.getElementById('libro-editorial').value);

    const libroData = {
      titulo: capitalizarTexto(document.getElementById('libro-titulo').value),
      paginas: Number(document.getElementById('libro-paginas').value) || 0,
      editorial: editorial,
      precio: parseFloat(document.getElementById('libro-precio').value),
      imageUrl: imageUrl,
      fecha_creacion: new Date() // Guardamos fecha para ordenar por "Nuevos"
    };

    await guardarReferenciaSiNoExiste("editoriales", editorialesEnMemoria, editorial);
    await addDoc(collection(db, "libros"), libroData);
    Swal.fire('¡Guardado!', 'El libro se cargó correctamente.', 'success');
    formNuevoLibro.reset();
    await cargarLibros(); // Actualizar la lista de libros
    await cargarLibrosEnMemoria(); // Actualizar memoria y autocompletado (Esperamos a que termine)
  } catch (error) {
    console.error("Error al guardar el libro: ", error);
    Swal.fire('Error', 'No se pudo guardar el libro.', 'error');
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
    
    const result = await Swal.fire({
      title: '¿Eliminar libro?',
      text: "No podrás revertir esto.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      try {
        await deleteDoc(doc(db, "libros", id));
        cargarLibros();
        cargarLibrosEnMemoria();
        Swal.fire('Eliminado', 'El libro ha sido eliminado.', 'success');
      } catch (error) {
        console.error("Error al eliminar libro:", error);
        Swal.fire('Error', 'No se pudo eliminar el libro.', 'error');
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
  const editorial = capitalizarTexto(document.getElementById('edit-libro-editorial').value);
  
  const datosActualizados = {
    titulo: capitalizarTexto(document.getElementById('edit-libro-titulo').value),
    paginas: Number(document.getElementById('edit-libro-paginas').value),
    editorial: editorial,
    precio: parseFloat(document.getElementById('edit-libro-precio').value)
  };

  await guardarReferenciaSiNoExiste("editoriales", editorialesEnMemoria, editorial);
  await updateDoc(doc(db, "libros", id), datosActualizados);
  Swal.fire('Actualizado', 'Los datos del libro se guardaron.', 'success');
  cargarLibros();
  await cargarLibrosEnMemoria(); // Actualizar memoria para reflejar cambios en el buscador
  bootstrap.Modal.getInstance(document.getElementById('modalEditarLibro')).hide();
});

// Carga inicial de libros cuando el DOM está listo
document.addEventListener('DOMContentLoaded', () => {
  cargarLibros();
  cargarClientes();
  cargarClientesEnMemoria();
  cargarLibrosEnMemoria();
  cargarPedidos(); // Cargar pedidos al inicio
  cargarListasReferencia(); // Cargar autocompletado
  cargarConfiguracion(); // Cargar configuración del sistema (Alias, etc.)
  inputSena.value = ""; // Limpiar seña al recargar
  actualizarTotales();

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
let pedidosEnMemoria = []; // Historial de pedidos (Global)

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
    mostrarLibrosSugeridos(); // Actualizar sugerencias si ya cargaron los pedidos
    actualizarDatalistTitulos(); // Actualizar autocompletado de títulos
  } catch (error) {
    console.error("Error al cargar libros en memoria:", error);
  }
};

const actualizarTotales = () => {
  // Calcular total sumando (precio * cantidad) de cada item
  totalPedido = carrito.reduce((acc, item) => acc + (item.precio * item.cantidad), 0);
  
  let sena = parseFloat(inputSena.value) || 0;

  // Validación visual: La seña no puede ser mayor al total ni negativa
  if (sena > totalPedido || sena < 0) {
    inputSena.classList.add('is-invalid');
  } else {
    inputSena.classList.remove('is-invalid');
  }

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
      <td><img src="${item.imageUrl || 'https://via.placeholder.com/50x75'}" alt="Img" width="30" height="45" class="rounded" style="object-fit: cover;"></td>
      <td>
        <div class="text-truncate" style="max-width: 150px;" title="${item.titulo}">${item.titulo}</div>
        <small class="text-muted" style="font-size: 0.75rem;">${item.editorial || ''}</small>
      </td>
      <td class="text-center">
        <div class="input-group input-group-sm" style="width: 80px; margin: 0 auto;">
          <button class="btn btn-outline-secondary px-1 btn-restar-cantidad" data-index="${index}" type="button">-</button>
          <input type="text" class="form-control text-center px-0 input-cantidad" value="${item.cantidad}" readonly style="font-size: 0.8rem;">
          <button class="btn btn-outline-secondary px-1 btn-sumar-cantidad" data-index="${index}" type="button">+</button>
        </div>
      </td>
      <td class="text-end small">${formatter.format(item.precio * item.cantidad)}</td>
      <td><button class="btn btn-link text-danger btn-sm p-0 btn-eliminar-item" data-index="${index}"><i class="bi bi-x-circle-fill"></i></button></td>
    `;
    tablaCarrito.appendChild(row);
  });

  // Eventos para botones de cantidad y eliminar
  document.querySelectorAll('.btn-restar-cantidad').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.dataset.index);
      if (carrito[index].cantidad > 1) {
        carrito[index].cantidad--;
        renderizarCarrito();
        actualizarTotales();
      }
    });
  });

  document.querySelectorAll('.btn-sumar-cantidad').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.dataset.index);
      carrito[index].cantidad++;
      renderizarCarrito();
      actualizarTotales();
    });
  });

  document.querySelectorAll('.btn-eliminar-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.closest('button').dataset.index);
      carrito.splice(index, 1);
      renderizarCarrito();
      actualizarTotales();
    });
  });
};

// Función auxiliar para agregar al carrito
const agregarAlCarrito = (libro) => {
  // Buscar si el libro ya existe en el carrito
  const indexExistente = carrito.findIndex(item => item.id === libro.id);

  if (indexExistente !== -1) {
    carrito[indexExistente].cantidad++;
  } else {
    carrito.push({ id: libro.id, titulo: libro.titulo, editorial: libro.editorial, precio: libro.precio, imageUrl: libro.imageUrl, cantidad: 1 });
  }
  
  renderizarCarrito();
  actualizarTotales();
  
  // Feedback visual tipo Toast (no intrusivo) para que la lista no desaparezca
  const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 1500,
    timerProgressBar: false
  });
  
  Toast.fire({
    icon: 'success',
    title: 'Agregado al pedido'
  });

  // Mantener el foco para seguir buscando o agregando
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

const renderizarResultadosBusqueda = (libros, titulo = '') => {
  listaResultados.innerHTML = '';

  if (titulo) {
    const titleDiv = document.createElement('div');
    titleDiv.className = 'col-12 mb-2';
    titleDiv.innerHTML = `<h6 class="text-muted border-bottom pb-2 small text-uppercase fw-bold"><i class="bi bi-graph-up-arrow text-primary"></i> ${titulo}</h6>`;
    listaResultados.appendChild(titleDiv);
  }

  if (libros.length === 0) {
    listaResultados.innerHTML = '<div class="col-12 text-center text-muted py-4">No se encontraron libros.</div>';
    return;
  }

  // Limitamos a 10 resultados para no saturar la vista
  const librosLimitados = libros.slice(0, 10);
  const formatter = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0, maximumFractionDigits: 0 });

  librosLimitados.forEach((libro, index) => {
    const col = document.createElement('div');
    col.className = 'col-md-6'; // 2 columnas de cards
    
    const activeClass = index === selectedIndex ? 'border-primary shadow' : 'border-light';
    
    const item = document.createElement('div');
    item.className = `card h-100 search-card-book ${activeClass}`;
    item.style.transition = 'transform 0.1s';
    
    item.innerHTML = `
      <div class="card-body p-2 d-flex flex-column h-100">
        <h6 class="card-title mb-2 text-center text-dark fw-bold" style="font-size: 0.95rem; line-height: 1.2;">${libro.titulo || 'Sin Título'}</h6>
        <div class="d-flex align-items-center justify-content-center mt-auto">
          <div class="position-relative">
            <img src="${libro.imageUrl || 'https://via.placeholder.com/50x75'}" class="rounded me-3 shadow-sm" alt="Portada" style="height: 80px; width: 55px; object-fit: cover; cursor: zoom-in;" data-bs-toggle="modal" data-bs-target="#modalImagen" data-img-url="${libro.imageUrl || 'https://via.placeholder.com/50x75'}" title="Ver portada grande">
          </div>
          <div class="text-start">
            <p class="card-text mb-1 lh-1"><small class="text-muted">${libro.editorial || 'Sin Ed.'}<br>${libro.paginas || '?'} pág.</small></p>
            <p class="card-text text-primary fw-bold fs-5 mb-0">${formatter.format(libro.precio)}</p>
          </div>
        </div>
        <div class="d-flex gap-2 mt-3">
          <button class="btn btn-success btn-sm flex-grow-1 fw-bold btn-agregar-carrito"><i class="bi bi-cart-plus"></i> Agregar</button>
          <button class="btn btn-outline-secondary btn-sm btn-ver-info"><i class="bi bi-info-circle"></i></button>
        </div>
      </div>
    `;
    
    // Efecto hover simple
    item.onmouseover = () => item.classList.add('shadow-sm');
    item.onmouseout = () => { if(index !== selectedIndex) item.classList.remove('shadow-sm'); };

    // Eventos de botones
    item.querySelector('.btn-agregar-carrito').addEventListener('click', () => agregarAlCarrito(libro));
    item.querySelector('.btn-ver-info').addEventListener('click', () => verDetalleLibro(libro));
    
    col.appendChild(item);
    listaResultados.appendChild(col);
  });
};

// Función para ver detalles y estadísticas del libro
const verDetalleLibro = (libro) => {
  const modalTitle = document.getElementById('detalle-libro-titulo');
  const modalContent = document.getElementById('detalle-libro-contenido');
  const formatter = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 });

  modalTitle.textContent = libro.titulo;

  // Calcular estadísticas basadas en pedidosEnMemoria
  let totalPedidos = 0;
  let estados = { 'En cola de impresión': 0, 'Imprimiendo / Armando': 0, 'Encuadernando': 0, 'Terminado': 0, 'Entregado': 0 };

  pedidosEnMemoria.forEach(pedido => {
    // Buscamos si este libro está en el pedido
    const itemsLibro = pedido.items.filter(item => item.id === libro.id);
    itemsLibro.forEach(item => {
      totalPedidos++; // Contamos cada unidad pedida
      // Usamos el estado del item si existe, sino el del pedido (para compatibilidad)
      const estadoItem = item.estado || pedido.estado_general; 
      if (estados[estadoItem] !== undefined) estados[estadoItem]++;
    });
  });

  // Generar HTML del gráfico (Barras de progreso)
  const generarBarra = (label, valor, color) => {
    if (valor === 0) return '';
    const porcentaje = Math.round((valor / totalPedidos) * 100);
    return `
      <div class="mb-2">
        <div class="d-flex justify-content-between small mb-1">
          <span>${label}</span>
          <span>${valor} (${porcentaje}%)</span>
        </div>
        <div class="progress" style="height: 8px;">
          <div class="progress-bar bg-${color}" role="progressbar" style="width: ${porcentaje}%"></div>
        </div>
      </div>
    `;
  };

  modalContent.innerHTML = `
    <div class="text-center mb-3">
      <img src="${libro.imageUrl || 'https://via.placeholder.com/150'}" class="img-thumbnail shadow-sm" style="max-height: 200px;">
    </div>
    <ul class="list-group list-group-flush mb-3">
      <li class="list-group-item d-flex justify-content-between"><span>Precio:</span> <strong>${formatter.format(libro.precio)}</strong></li>
      <li class="list-group-item d-flex justify-content-between"><span>Editorial:</span> <span>${libro.editorial || '-'}</span></li>
      <li class="list-group-item d-flex justify-content-between"><span>Páginas:</span> <span>${libro.paginas || '-'}</span></li>
    </ul>
    
    <h6 class="border-bottom pb-2 mb-3"><i class="bi bi-bar-chart-line"></i> Estadísticas Históricas</h6>
    <div class="alert alert-light border text-center">
      <h2 class="mb-0">${totalPedidos}</h2>
      <small class="text-muted">Unidades pedidas en total</small>
    </div>
    
    ${generarBarra('En cola / Pendiente', estados['En cola de impresión'], 'warning')}
    ${generarBarra('En Producción (Imp/Enc)', estados['Imprimiendo / Armando'] + estados['Encuadernando'], 'primary')}
    ${generarBarra('Terminado / Entregado', estados['Terminado'] + estados['Entregado'], 'success')}
  `;

  const modal = new bootstrap.Modal(document.getElementById('modalLibroDetalle'));
  modal.show();
};

// Función para mostrar libros sugeridos (Más vendidos últimos 30 días)
const mostrarLibrosSugeridos = () => {
  if (librosEnMemoria.length === 0) return;

  let sugeridos = [];
  
  if (pedidosEnMemoria.length > 0) {
    // Calcular Top 10 de los últimos 30 días
    const hace30Dias = new Date();
    hace30Dias.setDate(hace30Dias.getDate() - 30);
    const conteo = {};
    
    pedidosEnMemoria.forEach(p => {
       const fecha = p.fecha_creacion ? new Date(p.fecha_creacion.seconds * 1000) : new Date();
       if (fecha >= hace30Dias) {
         p.items.forEach(item => {
           if(item.id) conteo[item.id] = (conteo[item.id] || 0) + 1;
         });
       }
    });
    
    // Ordenar libros por popularidad y luego por fecha (Nuevos primero)
    sugeridos = [...librosEnMemoria].sort((a, b) => {
      const ventasA = conteo[a.id] || 0;
      const ventasB = conteo[b.id] || 0;
      
      if (ventasA !== ventasB) return ventasB - ventasA; // Primero por ventas
      
      // Si tienen mismas ventas, el más nuevo primero (Manejo de Timestamp de Firebase o Date nativo)
      const fechaA = a.fecha_creacion ? (a.fecha_creacion.seconds || new Date(a.fecha_creacion).getTime()) : 0;
      const fechaB = b.fecha_creacion ? (b.fecha_creacion.seconds || new Date(b.fecha_creacion).getTime()) : 0;
      return fechaB - fechaA;
    });
  } else {
    // Si no hay pedidos, mostrar los más nuevos primero
    sugeridos = [...librosEnMemoria].sort((a, b) => {
      const fechaA = a.fecha_creacion ? (a.fecha_creacion.seconds || new Date(a.fecha_creacion).getTime()) : 0;
      const fechaB = b.fecha_creacion ? (b.fecha_creacion.seconds || new Date(b.fecha_creacion).getTime()) : 0;
      return fechaB - fechaA;
    });
  }
  
  renderizarResultadosBusqueda(sugeridos.slice(0, 10), 'Sugeridos / Más Vendidos');
};

inputBuscarLibro.addEventListener('input', (e) => {
  const userInput = e.target.value.toLowerCase();
  selectedIndex = -1; // Resetear selección al escribir

  if (userInput.length === 0) {
    mostrarLibrosSugeridos();
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
  // const items = listaResultados.querySelectorAll('.search-card-book'); // No se usa directamente pero sirve de referencia
  
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
    inputBuscarLibro.value = '';
    mostrarLibrosSugeridos();
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

  if (carrito.length === 0) {
    Swal.fire('Carrito vacío', 'Por favor, agregá al menos un libro al pedido.', 'warning');
    return;
  }

  if (!idCliente) {
    Swal.fire('Falta Cliente', 'Para confirmar un pedido es necesario seleccionar un cliente.', 'warning');
    return;
  }

  const codigo = generarCodigo();
  const sena = parseFloat(inputSena.value) || 0;

  if (sena > totalPedido || sena < 0) {
    Swal.fire('Error en la seña', 'El monto de la seña no puede ser mayor al total del pedido.', 'error');
    return;
  }

  // Feedback visual (Spinner)
  const originalText = btnGenerarPedido.innerHTML;
  btnGenerarPedido.disabled = true;
  btnGenerarPedido.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Procesando...';

  const saldo = totalPedido - sena;

  // "Aplanar" el carrito: Convertir items agrupados (cantidad > 1) en items individuales para la base de datos
  // Esto es necesario para que la Cola de Producción pueda marcar cada libro individualmente como terminado.
  const itemsExpandidos = carrito.flatMap(item => {
    const itemsIndividuales = [];
    for (let i = 0; i < item.cantidad; i++) {
      const { cantidad, ...itemSinCantidad } = item; // Creamos copia sin la propiedad cantidad
      itemsIndividuales.push(itemSinCantidad);
    }
    return itemsIndividuales;
  });

  const nuevoPedido = {
    codigo_seguimiento: codigo,
    id_cliente: idCliente,
    items: itemsExpandidos,
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
    mensajeCliente += `📚 *Detalle:*\n`;
    carrito.forEach(item => {
      mensajeCliente += `   • ${item.titulo} (x${item.cantidad})\n`;
    });
    mensajeCliente += `\n`;
    mensajeCliente += `� *Total:* ${formatter.format(totalPedido)}\n`;
    mensajeCliente += `✅ *Seña:* ${formatter.format(sena)}\n`;
    mensajeCliente += `❗ *Saldo:* ${formatter.format(saldo)}\n\n`;
    mensajeCliente += `Te avisamos cuando esté listo para retirar!\n`;
    mensajeCliente += `Muchas gracias por elegirnos.`;

    // Copiar al portapapeles y avisar
    navigator.clipboard.writeText(mensajeCliente);
    Swal.fire({
      title: '¡Pedido Creado!',
      html: `Código: <strong>${codigo}</strong><br><br>El mensaje para el cliente fue copiado al portapapeles.`,
      icon: 'success'
    });
    
    // Resetear estado
    carrito = [];
    totalPedido = 0;
    inputSena.value = ""; // Limpiar explícitamente el campo de seña
    renderizarCarrito();
    actualizarTotales();
    clienteSeleccionado = null;
    inputBuscarCliente.value = "";
    inputBuscarLibro.value = "";
  } catch (error) {
    console.error("Error al generar pedido:", error);
    Swal.fire('Error', 'Hubo un problema al generar el pedido.', 'error');
  } finally {
    btnGenerarPedido.disabled = false;
    btnGenerarPedido.innerHTML = originalText;
  }
});

btnGenerarPresupuesto.addEventListener('click', async () => {
  if (carrito.length === 0) {
    Swal.fire('Carrito vacío', 'Agregá libros antes de presupuestar.', 'warning');
    return;
  }

  // Feedback visual (Spinner)
  const originalText = btnGenerarPresupuesto.innerHTML;
  btnGenerarPresupuesto.disabled = true;
  btnGenerarPresupuesto.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Generando...';

  try {
    const formatter = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 });
    const senaSugerida = totalPedido / 2;
    const codigoPresupuesto = generarCodigo('P'); // Generamos un código único para el presupuesto (Ej: P12345)

    // Expandir items para guardar en BD (mismo formato que pedidos)
    const itemsExpandidos = carrito.flatMap(item => {
      const itemsIndividuales = [];
      for (let i = 0; i < item.cantidad; i++) {
        const { cantidad, ...itemSinCantidad } = item;
        itemsIndividuales.push(itemSinCantidad);
      }
      return itemsIndividuales;
    });

    // Guardar presupuesto en Firestore
    try {
      const presupuestoData = {
        codigo: codigoPresupuesto,
        items: itemsExpandidos,
        total: totalPedido,
        cliente: clienteSeleccionado ? { id: clienteSeleccionado.id, nombre: clienteSeleccionado.nombre, telefono: clienteSeleccionado.telefono } : null,
        fecha: new Date()
      };
      await addDoc(collection(db, "presupuestos"), presupuestoData);
    } catch (error) {
      console.error("Error al guardar presupuesto:", error);
      // No bloqueamos el flujo si falla el guardado, solo avisamos en consola
    }

    let mensaje = `Hola! 👋 Te paso el presupuesto solicitado (Ref: ${codigoPresupuesto}):\n\n`;

    carrito.forEach(item => {
      const totalItem = item.precio * item.cantidad;
      mensaje += `📚 *${item.titulo}* (x${item.cantidad})\n   _${item.editorial || 'Ed. Varios'}_ — ${formatter.format(totalItem)}\n`;
    });

    mensaje += `\n✅ *Impresión a color y anillado incluido.*\n`;
    mensaje += `💰 *Total: ${formatter.format(totalPedido)}*\n`;
    mensaje += `-----------------------------------\n`;
    mensaje += `📝 Para encargarlo necesitamos:\n`;
    mensaje += `   • Nombre del alumno\n`;
    mensaje += `   • Colegio\n`;
    mensaje += `   • Seña de ${formatter.format(senaSugerida)} (50%)\n\n`;
    mensaje += `💳 *Alias:* ${configuracionGlobal.alias}\n`;
    if (configuracionGlobal.banco) mensaje += `🏦 *Banco:* ${configuracionGlobal.banco}\n`;
    if (configuracionGlobal.titular) mensaje += `👤 *Titular:* ${configuracionGlobal.titular}\n`;
    
    mensaje += `(Por favor enviar comprobante)`;

    // Copiar al portapapeles y avisar
    navigator.clipboard.writeText(mensaje);
    Swal.fire({
      title: '¡Presupuesto Listo!',
      html: `Referencia: <strong>${codigoPresupuesto}</strong><br>Copiado al portapapeles para enviar por WhatsApp.`,
      icon: 'success'
    });
  } finally {
    btnGenerarPresupuesto.disabled = false;
    btnGenerarPresupuesto.innerHTML = originalText;
  }
});

// Atajos de teclado (F1 y F2)
document.addEventListener('keydown', (e) => {
  if (e.key === 'F1') {
    e.preventDefault(); // Evitar ayuda del navegador
    if (btnGenerarPedido && !btnGenerarPedido.disabled) btnGenerarPedido.click();
  }
  if (e.key === 'F2') {
    e.preventDefault();
    if (btnGenerarPresupuesto && !btnGenerarPresupuesto.disabled) btnGenerarPresupuesto.click();
  }
});

// --- LÓGICA PARA CARGAR PRESUPUESTO ---

btnCargarPresupuesto.addEventListener('click', async () => {
  const codigo = inputPresupuestoCodigo.value.trim().toUpperCase();
  if (!codigo) {
    Swal.fire('Atención', 'Ingresá un código de presupuesto.', 'warning');
    return;
  }

  btnCargarPresupuesto.disabled = true;
  btnCargarPresupuesto.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';

  try {
    const q = query(collection(db, "presupuestos"), where("codigo", "==", codigo));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      Swal.fire('No encontrado', 'No existe un presupuesto con ese código.', 'error');
    } else {
      const presupuesto = querySnapshot.docs[0].data();
      
      // Cargar datos al carrito
      // Como vienen desagrupados de la BD, usamos agregarAlCarrito para reagruparlos visualmente
      carrito = [];
      const itemsBD = presupuesto.items || [];
      itemsBD.forEach(item => {
        agregarAlCarrito(item); // Esto se encarga de agrupar y sumar totales
      });
      
      // Cargar cliente si existe en el presupuesto
      if (presupuesto.cliente) {
        seleccionarCliente(presupuesto.cliente);
      }

      renderizarCarrito();
      actualizarTotales();
      Swal.fire('Cargado', 'Presupuesto recuperado con éxito.', 'success');
      inputPresupuestoCodigo.value = "P"; // Limpiar input (manteniendo el prefijo)
    }
  } catch (error) {
    console.error("Error al cargar presupuesto:", error);
    Swal.fire('Error', 'Ocurrió un error al buscar.', 'error');
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
  const nombre = capitalizarTexto(document.getElementById('cliente-nombre').value);
  const telefono = document.getElementById('cliente-telefono').value;
  const colegio = capitalizarTexto(document.getElementById('cliente-colegio').value);

  try {
    await guardarReferenciaSiNoExiste("colegios", colegiosEnMemoria, colegio);
    await addDoc(collection(db, "clientes"), { nombre, telefono, colegio });
    Swal.fire('Registrado', 'Cliente guardado correctamente.', 'success');
    formNuevoCliente.reset();
    cargarClientes();
    cargarClientesEnMemoria(); // Actualizar el buscador también
  } catch (error) {
    console.error("Error al guardar cliente: ", error);
    Swal.fire('Error', 'No se pudo guardar el cliente.', 'error');
  }
});

// --- LÓGICA DE NUEVO CLIENTE RÁPIDO (MODAL) ---
const formNuevoClienteRapido = document.getElementById('form-nuevo-cliente-rapido');

formNuevoClienteRapido.addEventListener('submit', async (e) => {
  e.preventDefault();
  const nombre = capitalizarTexto(document.getElementById('rapido-cliente-nombre').value);
  const telefono = document.getElementById('rapido-cliente-telefono').value;
  const colegio = capitalizarTexto(document.getElementById('rapido-cliente-colegio').value);

  try {
    await guardarReferenciaSiNoExiste("colegios", colegiosEnMemoria, colegio);
    const docRef = await addDoc(collection(db, "clientes"), { nombre, telefono, colegio });
    // Seleccionar automáticamente el cliente creado
    seleccionarCliente({ id: docRef.id, nombre, telefono, colegio });
    
    // Cerrar modal y limpiar
    bootstrap.Modal.getInstance(document.getElementById('modalNuevoClienteRapido')).hide();
    formNuevoClienteRapido.reset();
    cargarClientesEnMemoria(); // Actualizar lista global
  } catch (error) {
    console.error("Error al guardar cliente rápido: ", error);
    Swal.fire('Error', 'No se pudo guardar el cliente.', 'error');
  }
});

// --- LÓGICA DE EDICIÓN Y ELIMINACIÓN DE CLIENTES ---

listaClientesDiv.addEventListener('click', async (e) => {
  // Eliminar Cliente
  if (e.target.closest('.btn-eliminar-cliente')) {
    const id = e.target.closest('.btn-eliminar-cliente').dataset.id;
    
    const result = await Swal.fire({
      title: '¿Eliminar cliente?',
      text: "Se borrará de la lista.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Sí, eliminar'
    });

    if (result.isConfirmed) {
      try {
        await deleteDoc(doc(db, "clientes", id));
        cargarClientes();
        cargarClientesEnMemoria();
        Swal.fire('Eliminado', 'Cliente eliminado.', 'success');
      } catch (error) {
        console.error("Error al eliminar cliente:", error);
        Swal.fire('Error', 'No se pudo eliminar.', 'error');
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
  const colegio = capitalizarTexto(document.getElementById('edit-cliente-colegio').value);

  const datosActualizados = {
    nombre: capitalizarTexto(document.getElementById('edit-cliente-nombre').value),
    telefono: document.getElementById('edit-cliente-telefono').value,
    colegio: colegio
  };

  await guardarReferenciaSiNoExiste("colegios", colegiosEnMemoria, colegio);
  await updateDoc(doc(db, "clientes", id), datosActualizados);
  Swal.fire('Actualizado', 'Datos del cliente guardados.', 'success');
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
    mostrarLibrosSugeridos(); // Actualizar sugerencias con la data fresca

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
      Swal.fire('Error', 'No se pudo actualizar el estado.', 'error');
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
    Swal.fire('Copiado', 'Mensaje listo para pegar en WhatsApp.', 'success');
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

  const result = await Swal.fire({
    title: '¿Actualización Masiva?',
    text: `Se cambiarán ${ids.length} pedidos a "${nuevoEstado}".`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Sí, aplicar'
  });

  if (!result.isConfirmed) return;

  btnAplicarMasivo.disabled = true;
  btnAplicarMasivo.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';

  try {
    const promesas = ids.map(id => updateDoc(doc(db, "pedidos", id), { estado_general: nuevoEstado }));
    await Promise.all(promesas);
    Swal.fire('¡Listo!', 'Estados actualizados correctamente.', 'success');
    cargarPedidos(); // Recargar para ver cambios
    selectAccionMasiva.value = ""; // Resetear select
  } catch (error) {
    console.error("Error en actualización masiva:", error);
    Swal.fire('Error', 'Hubo un error en la actualización masiva.', 'error');
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
    const pendientes = totalLibros - totalTerminados;
    const porcentaje = totalLibros > 0 ? Math.round((totalTerminados / totalLibros) * 100) : 0;

    statsContainer.innerHTML = `
      <div class="row g-3">
        <div class="col-md-4">
          <div class="p-3 bg-white border rounded shadow-sm d-flex justify-content-between align-items-center border-start border-4 border-primary">
            <div>
              <small class="text-muted text-uppercase fw-bold">Total en Lista</small>
              <div class="fs-3 fw-bold text-primary">${totalLibros}</div>
            </div>
            <i class="bi bi-journal-bookmark fs-1 text-primary opacity-25"></i>
          </div>
        </div>
        <div class="col-md-4">
          <div class="p-3 bg-white border rounded shadow-sm d-flex justify-content-between align-items-center border-start border-4 border-success">
            <div>
              <small class="text-muted text-uppercase fw-bold">Terminados</small>
              <div class="fs-3 fw-bold text-success">${totalTerminados} <span class="fs-6 text-muted">(${porcentaje}%)</span></div>
            </div>
            <i class="bi bi-check-circle-fill fs-1 text-success opacity-25"></i>
          </div>
        </div>
        <div class="col-md-4">
          <div class="p-3 bg-white border rounded shadow-sm d-flex justify-content-between align-items-center border-start border-4 border-warning">
            <div>
              <small class="text-muted text-uppercase fw-bold">Pendientes</small>
              <div class="fs-3 fw-bold text-warning">${pendientes}</div>
            </div>
            <i class="bi bi-hourglass-split fs-1 text-warning opacity-25"></i>
          </div>
        </div>
      </div>
    `;
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
                <span class="badge bg-secondary rounded-pill mb-1">${grupo.stats.total} copias</span>
                <div class="d-flex gap-1 justify-content-end">
                  <span class="badge bg-warning text-dark" title="En Cola">${grupo.stats.pendientes} Cola</span>
                  <span class="badge bg-info text-dark" title="Imprimiendo">${grupo.stats.imprimiendo} Imp</span>
                  <span class="badge bg-primary" title="Encuadernando">${grupo.stats.encuadernando} Enc</span>
                  <span class="badge bg-success" title="Terminados">${grupo.stats.terminados} OK</span>
                </div>
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

    if (!nuevoEstado) { Swal.fire('Atención', 'Seleccioná un estado destino.', 'warning'); return; }
    if (seleccionados.length === 0) { Swal.fire('Atención', 'Seleccioná al menos un libro.', 'warning'); return; }

    const result = await Swal.fire({
      title: '¿Cambiar estados?',
      text: `Se actualizarán ${seleccionados.length} libros a "${nuevoEstado}".`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, cambiar'
    });

    if (!result.isConfirmed) return;

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
           Swal.fire({
             title: '¡Pedido Completo! 🎉',
             text: `El pedido de ${clienteNombre} se ha completado en su totalidad.`,
             icon: 'success'
           });
        }
        await cargarColaProduccion(groupKey);
      }
    }
  } catch (error) {
    console.error("Error al actualizar item:", error);
    if(recargar) Swal.fire('Error', 'No se pudo actualizar el estado.', 'error');
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