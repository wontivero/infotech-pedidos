import { db } from "./firebase.js";
import { collection, addDoc, onSnapshot, query, where, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { librosEnMemoria, clientesEnMemoria, guardarReferenciaSiNoExiste, colegiosEnMemoria } from "./data.js";
import { capitalizarTexto, limpiarTelefono } from "./utils.js";

const formNuevoGrupo = document.getElementById('form-nuevo-grupo');
const inputGrupoLibro = document.getElementById('grupo-input-libro');
const inputGrupoLibroId = document.getElementById('grupo-libro-id');
const listaResultadosLibros = document.getElementById('grupo-lista-libros');
const listaGruposContainer = document.getElementById('lista-grupos-container');

let campañasActivas = [];
let solicitudesPendientes = [];

export const inicializarGruposCompra = () => {
    setupSearchListeners();
    setupEventListeners();
    iniciarEscuchas();
};

const iniciarEscuchas = () => {
    const qCampañas = query(collection(db, "campañas"), where("activa", "==", true));
    onSnapshot(qCampañas, (snapshot) => {
        campañasActivas = [];
        snapshot.forEach(doc => campañasActivas.push({ id: doc.id, ...doc.data() }));
        renderGrupos();
    });

    const qSolicitudes = query(collection(db, "solicitudes_grupo"), where("estado", "==", "pendiente"));
    onSnapshot(qSolicitudes, (snapshot) => {
        solicitudesPendientes = [];
        snapshot.forEach(doc => solicitudesPendientes.push({ id: doc.id, ...doc.data() }));
        renderGrupos();
    });
};

const renderGrupos = () => {
    if (campañasActivas.length === 0) {
        listaGruposContainer.innerHTML = '<div class="alert alert-info">No hay grupos de compra activos.</div>';
        return;
    }

    const basePath = window.location.pathname.includes('/public/') ? '/public' : '';

    let html = '<div class="accordion">';
    campañasActivas.forEach((campaña, index) => {
        const solicitudes = solicitudesPendientes.filter(s => s.idCampaña === campaña.id);
        const badgeCount = solicitudes.length > 0 ? `<span class="badge bg-danger rounded-pill ms-2">${solicitudes.length}</span>` : '';
        
        html += `
            <div class="card mb-2">
                <div class="card-header">
                    <h2 class="mb-0">
                        <button class="btn btn-link btn-block text-start text-decoration-none w-100" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-grupo-">
                            <div class="d-flex justify-content-between align-items-center">
                                <span><strong>${campaña.colegio}</strong> - ${campaña.curso}</span>
                                <span>${campaña.libroTitulo} </span>
                            </div>
                        </button>
                    </h2>
                </div>
                <div id="collapse-grupo-" class="collapse">
                    <div class="card-body">
                        <p><strong>Link para compartir:</strong> <input type="text" class="form-control form-control-sm" value="${window.location.origin}/grupo.html?id=${campaña.id}" readonly></p>
                        <h6>Solicitudes Pendientes de Aprobación</h6>
                        ${renderTablaSolicitudes(solicitudes)}
                    </div>
                </div>
            </div>
        `;
    });
    html += '</div>';
    listaGruposContainer.innerHTML = html;
};

const renderTablaSolicitudes = (solicitudes) => {
    if (solicitudes.length === 0) return '<p class="text-muted">No hay solicitudes pendientes para este grupo.</p>';

    let tabla = '<table class="table table-sm table-hover"><thead><tr><th>Alumno</th><th>Teléfono</th><th>Comprobante</th><th>Acción</th></tr></thead><tbody>';
    solicitudes.forEach(s => {
        tabla += `
            <tr>
                <td>${s.nombreAlumno}</td>
                <td>${s.telefono}</td>
                <td><button class="btn btn-sm btn-outline-primary" data-bs-toggle="modal" data-bs-target="#modalImagen" data-img-url="${s.comprobanteUrl}"><i class="bi bi-receipt"></i> Ver</button></td>
                <td><button class="btn btn-sm btn-success btn-aprobar-solicitud" data-id="${s.id}"><i class="bi bi-check-lg"></i> Aprobar</button></td>
            </tr>
        `;
    });
    tabla += '</tbody></table>';
    return tabla;
};

const setupSearchListeners = () => {
    inputGrupoLibro.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        inputGrupoLibroId.value = ''; // Resetear ID si edita el texto
        
        if (term.length < 1) {
            listaResultadosLibros.style.display = 'none';
            return;
        }
        
        const filtrados = librosEnMemoria.filter(l => l.titulo.toLowerCase().includes(term));
        
        listaResultadosLibros.innerHTML = '';
        if (filtrados.length === 0) {
            listaResultadosLibros.style.display = 'none';
            return;
        }

        filtrados.forEach(l => {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'list-group-item list-group-item-action';
            item.innerHTML = `<strong>${l.titulo}</strong> <small class="text-muted">(${l.editorial || '-'})</small>`;
            item.addEventListener('click', () => {
                inputGrupoLibro.value = l.titulo;
                inputGrupoLibroId.value = l.id;
                // Autocompletar precio si está vacío
                const precioInput = document.getElementById('grupo-precio');
                if(precioInput) precioInput.value = l.precio;
                
                listaResultadosLibros.style.display = 'none';
            });
            listaResultadosLibros.appendChild(item);
        });
        listaResultadosLibros.style.display = 'block';
    });

    // Ocultar lista al hacer clic fuera
    document.addEventListener('click', (e) => {
        if (!inputGrupoLibro.contains(e.target) && !listaResultadosLibros.contains(e.target)) {
            listaResultadosLibros.style.display = 'none';
        }
    });
};

const setupEventListeners = () => {
    formNuevoGrupo.addEventListener('submit', async (e) => {
        e.preventDefault();
        const libroId = inputGrupoLibroId.value;
        
        if (!libroId) {
            Swal.fire('Atención', 'Por favor seleccioná un libro de la lista.', 'warning');
            return;
        }

        const libroSeleccionado = librosEnMemoria.find(l => l.id === libroId);

        const nuevaCampaña = {
            libroId: libroId,
            libroTitulo: libroSeleccionado.titulo,
            precio: parseFloat(document.getElementById('grupo-precio').value),
            colegio: capitalizarTexto(document.getElementById('grupo-colegio').value),
            curso: document.getElementById('grupo-curso').value,
            activa: true,
            fechaCreacion: new Date()
        };

        try {
            const docRef = await addDoc(collection(db, "campañas"), nuevaCampaña);
            const basePath = window.location.pathname.includes('/public/') ? '/public' : '';
            const link = `${window.location.origin}/grupo.html?id=${docRef.id}`;
            
            Swal.fire({
                title: '¡Grupo Creado!',
                html: `El link para compartir con los padres es:<br><input type="text" value="" class="form-control mt-2" readonly>`,
                icon: 'success',
                confirmButtonText: 'Copiar Link y Cerrar'
            }).then(() => {
                navigator.clipboard.writeText(link);
            });
            formNuevoGrupo.reset();
            inputGrupoLibroId.value = ''; // Limpiar ID oculto
        } catch (error) {
            Swal.fire('Error', 'No se pudo crear el grupo.', 'error');
        }
    });

    listaGruposContainer.addEventListener('click', async (e) => {
        if (e.target.closest('.btn-aprobar-solicitud')) {
            const btn = e.target.closest('.btn-aprobar-solicitud');
            btn.disabled = true;
            const solicitudId = btn.dataset.id;
            const solicitud = solicitudesPendientes.find(s => s.id === solicitudId);
            
            if (!solicitud) return;

            const campaña = campañasActivas.find(c => c.id === solicitud.idCampaña);

            try {
                let clienteId = null;
                const telefonoLimpio = limpiarTelefono(solicitud.telefono);
                
                // 1. Buscar clientes con ese teléfono
                const clientesConMismoTelefono = clientesEnMemoria.filter(c => c.telefono && c.telefono.replace(/[^0-9]/g, '') === telefonoLimpio);
                // 2. De esos, buscar si alguno coincide en nombre (para diferenciar hermanos)
                let clienteExistente = clientesConMismoTelefono.find(c => c.nombre.toLowerCase() === solicitud.nombreAlumno.trim().toLowerCase());

                if (clienteExistente) {
                    clienteId = clienteExistente.id;
                } else {
                    const nuevoCliente = {
                        nombre: capitalizarTexto(solicitud.nombreAlumno),
                        telefono: telefonoLimpio,
                        colegio: capitalizarTexto(campaña.colegio || '')
                    };
                    // Guardar nuevo cliente en la base de datos
                    const clienteDocRef = await addDoc(collection(db, "clientes"), nuevoCliente);
                    clienteId = clienteDocRef.id;
                }

                const libro = librosEnMemoria.find(l => l.id === campaña.libroId);
                
                await addDoc(collection(db, "pedidos"), {
                    codigo_seguimiento: `G-${solicitud.nombreAlumno.substring(0,3).toUpperCase()}${Date.now().toString().slice(-4)}`,
                    id_cliente: clienteId,
                    items: [{...libro, id: libro.id}],
                    total: campaña.precio,
                    sena_pagada: campaña.precio,
                    saldo_pendiente: 0,
                    estado_general: 'En cola de impresión',
                    fecha_creacion: new Date(),
                    origen: 'Grupo de Compra'
                });

                await updateDoc(doc(db, "solicitudes_grupo", solicitudId), { estado: 'aprobado' });

                Swal.fire('Aprobado', `Se creó el pedido para ${solicitud.nombreAlumno}.`, 'success');

            } catch (error) {
                console.error("Error approving request:", error);
                Swal.fire('Error', 'No se pudo aprobar la solicitud.', 'error');
                btn.disabled = false;
            }
        }
    });
};
