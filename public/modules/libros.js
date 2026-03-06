// --- MÓDULO ABM LIBROS ---
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { db } from "./firebase.js";
import { capitalizarTexto, subirImagen, formatter } from "./utils.js";
import { suscribirCambios, guardarReferenciaSiNoExiste, editorialesEnMemoria, librosEnMemoria } from "./data.js";

const formNuevoLibro = document.getElementById('form-nuevo-libro');
const listaLibrosDiv = document.getElementById('lista-libros');

export const inicializarLibros = () => {
  // Renderizar inicialmente y cada vez que cambien los datos
  renderizarTablaLibros();
  suscribirCambios('libros', renderizarTablaLibros);
  setupEventListeners();
};

const renderizarTablaLibros = () => {
  if (librosEnMemoria.length === 0) {
    listaLibrosDiv.innerHTML = '<div class="alert alert-info">No hay libros cargados todavía.</div>';
    return;
  }
  let tableHTML = `<table class="table table-striped table-hover align-middle">
      <thead><tr><th>Portada</th><th>Título</th><th>Páginas</th><th>Editorial</th><th>Precio</th><th>Acciones</th></tr></thead>
      <tbody>`;
  const placeholder = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='50' height='75' viewBox='0 0 50 75'%3E%3Crect width='50' height='75' fill='%23e9ecef'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='12' fill='%236c757d'%3ESin Img%3C/text%3E%3C/svg%3E";
  librosEnMemoria.forEach((libro) => {
      const imgUrl = libro.imageUrl || placeholder;
      tableHTML += `<tr>
        <td><img src="${imgUrl}" width="50" class="img-thumbnail" style="cursor: pointer;" data-bs-toggle="modal" data-bs-target="#modalImagen" data-img-url="${imgUrl}" onerror="this.src='${placeholder}'"></td>
        <td>${libro.titulo || 'Sin Título'}</td>
        <td>${libro.paginas || 'N/A'}</td>
        <td>${libro.editorial || 'N/A'}</td>
        <td>${formatter.format(libro.precio || 0)}</td>
        <td>
          <button class="btn btn-warning btn-sm btn-editar-libro" data-id="${libro.id}"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-danger btn-sm btn-eliminar-libro" data-id="${libro.id}"><i class="bi bi-trash"></i></button>
        </td>
      </tr>`;
  });
  tableHTML += `</tbody></table>`;
  listaLibrosDiv.innerHTML = tableHTML;
};

const setupEventListeners = () => {
  // Guardar Nuevo Libro
  formNuevoLibro.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-guardar-libro');
    btn.disabled = true; btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Guardando...`;

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
        fecha_creacion: new Date()
      };

      await guardarReferenciaSiNoExiste("editoriales", editorialesEnMemoria, editorial);
      await addDoc(collection(db, "libros"), libroData);
      Swal.fire('¡Guardado!', 'El libro se cargó correctamente.', 'success');
      formNuevoLibro.reset();
    } catch (error) {
      Swal.fire('Error', 'No se pudo guardar el libro.', 'error');
    } finally {
      btn.disabled = false; btn.innerHTML = 'Guardar Libro';
    }
  });

  // Acciones de Tabla (Editar/Eliminar)
  listaLibrosDiv.addEventListener('click', async (e) => {
    if (e.target.closest('.btn-eliminar-libro')) {
      const id = e.target.closest('.btn-eliminar-libro').dataset.id;
      const result = await Swal.fire({ title: '¿Eliminar libro?', text: "No podrás revertir esto.", icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Sí, eliminar' });
      if (result.isConfirmed) {
        await deleteDoc(doc(db, "libros", id));
        Swal.fire('Eliminado', 'El libro ha sido eliminado.', 'success');
      }
    }
    if (e.target.closest('.btn-editar-libro')) {
      const id = e.target.closest('.btn-editar-libro').dataset.id;
      const libro = librosEnMemoria.find(l => l.id === id);
      if (libro) {
        document.getElementById('edit-libro-id').value = id;
        document.getElementById('edit-libro-titulo').value = libro.titulo;
        document.getElementById('edit-libro-paginas').value = libro.paginas;
        document.getElementById('edit-libro-editorial').value = libro.editorial;
        document.getElementById('edit-libro-precio').value = libro.precio;
        document.getElementById('edit-libro-imagen').value = ''; // Limpiar input file
        new bootstrap.Modal(document.getElementById('modalEditarLibro')).show();
      }
    }
  });

  // Guardar Edición
  document.getElementById('btn-guardar-edicion-libro').addEventListener('click', async () => {
    const btn = document.getElementById('btn-guardar-edicion-libro');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Guardando...';

    try {
      const id = document.getElementById('edit-libro-id').value;
      const editorial = capitalizarTexto(document.getElementById('edit-libro-editorial').value);
      const datos = { titulo: capitalizarTexto(document.getElementById('edit-libro-titulo').value), paginas: Number(document.getElementById('edit-libro-paginas').value), editorial: editorial, precio: parseFloat(document.getElementById('edit-libro-precio').value) };
      
      const imagenFile = document.getElementById('edit-libro-imagen').files[0];
      if (imagenFile) {
        const imageUrl = await subirImagen(imagenFile);
        datos.imageUrl = imageUrl;
      }

      await guardarReferenciaSiNoExiste("editoriales", editorialesEnMemoria, editorial);
      await updateDoc(doc(db, "libros", id), datos);
      Swal.fire('Actualizado', 'Datos guardados.', 'success');
      bootstrap.Modal.getInstance(document.getElementById('modalEditarLibro')).hide();
    } catch (error) {
      console.error(error);
      Swal.fire('Error', 'No se pudo actualizar.', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  });
};