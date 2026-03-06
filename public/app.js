// 1. Importar funciones de Firebase desde el CDN
import { getFirestore, collection, query, where, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { db } from './modules/firebase.js';
import { limpiarTelefono } from './modules/utils.js';

// 2. Selección de elementos del DOM
const trackingForm = document.getElementById('tracking-form');
const trackingInput = document.getElementById('tracking-code');
const trackingPhoneInput = document.getElementById('tracking-phone');
const resultDiv = document.getElementById('resultado-pedido');
const searchButton = trackingForm.querySelector('button');

// Función para obtener la clase del badge según el estado
const getBadgeClass = (status) => {
    // Normalizamos el status a minúsculas para una comparación más robusta
    const normalizedStatus = status ? status.toLowerCase() : '';
    switch (normalizedStatus) {
        case 'en cola de impresión':
            return 'bg-warning text-dark';
        case 'imprimiendo / armando':
            return 'bg-info text-dark';
        case 'listo para retirar':
            return 'bg-success';
        case 'entregado':
            return 'bg-secondary';
        default:
            return 'bg-light text-dark';
    }
};

// Función reutilizable para mostrar el resultado
const mostrarResultado = (pedidoData, trackingCode) => {
    const { estado_general, saldo_pendiente, total, sena_pagada, items } = pedidoData;
    const badgeClass = getBadgeClass(estado_general);
    const formatter = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });

    // Agrupar ítems para mostrar cantidades (ej: Libro x2)
    const itemsMap = new Map();
    if (items && Array.isArray(items)) {
        items.forEach(item => {
            const id = item.id || item.titulo;
            if (itemsMap.has(id)) {
                itemsMap.get(id).cantidad++;
            } else {
                itemsMap.set(id, { ...item, cantidad: 1 });
            }
        });
    }
    
    let itemsHtml = '';
    itemsMap.forEach(item => {
        const placeholder = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='60' viewBox='0 0 40 60'%3E%3Crect width='40' height='60' fill='%23e9ecef'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='10' fill='%236c757d'%3ESin%3C/text%3E%3C/svg%3E";
        const imgUrl = item.imageUrl || placeholder;
        itemsHtml += `
            <li class="list-group-item d-flex justify-content-between align-items-center px-0">
                <div class="d-flex align-items-center">
                    <img src="${imgUrl}" class="rounded me-3 border" style="width: 40px; height: 60px; object-fit: cover;" onerror="this.src='${placeholder}'">
                    <div><span class="fw-bold">${item.titulo}</span>
                    ${item.cantidad > 1 ? `<span class="badge bg-secondary ms-2 rounded-pill">x${item.cantidad}</span>` : ''}
                    <br><small class="text-muted">${item.editorial || ''}</small></div>
                </div>
            </li>`;
    });

    resultDiv.innerHTML = `
<div class="card border-primary shadow-sm">
  <div class="card-header bg-primary text-white d-flex justify-content-between align-items-center">
    <h5 class="mb-0"><i class="bi bi-box-seam"></i> Tu Pedido</h5>
    <span class="badge bg-light text-primary">#${trackingCode}</span>
  </div>
  <div class="card-body">
    <div class="text-center mb-4 mt-2">
        <h2 class="mb-1"><span class="badge ${badgeClass}">${estado_general || 'No especificado'}</span></h2>
        <p class="text-muted small">Estado actual</p>
    </div>
    
    <h6 class="border-bottom pb-2 mb-3 text-primary">📚 Libros encargados</h6>
    <ul class="list-group list-group-flush mb-4">
        ${itemsHtml}
    </ul>
    
    <div class="bg-light p-3 rounded border">
        <div class="d-flex justify-content-between mb-1">
            <span>Total:</span>
            <strong>${formatter.format(total || 0)}</strong>
        </div>
        <div class="d-flex justify-content-between mb-1 text-success">
            <span>Seña abonada:</span>
            <strong>- ${formatter.format(sena_pagada || 0)}</strong>
        </div>
        <hr class="my-2">
        <div class="d-flex justify-content-between fs-5">
            <span>Saldo pendiente:</span>
            <strong class="text-danger">${formatter.format(saldo_pendiente || 0)}</strong>
        </div>
    </div>
    
    <div class="mt-3 text-center text-muted small">
        <i class="bi bi-info-circle"></i> Presentá tu número de pedido al retirar.
    </div>
  </div>
</div>`;
};

// 3.5 Auto-búsqueda si hay parámetros en la URL (ID o Code+Phone)
document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get('id');

    // Caso A: Búsqueda por ID (Link seguro)
    if (orderId) {
        // Ocultamos el formulario para evitar confusión visual
        trackingForm.classList.add('d-none');
        
        // Mostramos un loader claro
        resultDiv.innerHTML = `
            <div class="text-center py-5">
                <div class="spinner-border text-primary" role="status" style="width: 3rem; height: 3rem;"></div>
                <p class="mt-3 text-muted fs-5">Cargando tu pedido...</p>
            </div>`;
        
        try {
            const docRef = doc(db, "pedidos", orderId);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
                mostrarResultado(docSnap.data(), docSnap.data().codigo_seguimiento);
                
                // Botón para volver a buscar (limpia la URL y muestra el form)
                const btnVolver = document.createElement('div');
                btnVolver.className = 'text-center mt-4';
                btnVolver.innerHTML = `<button class="btn btn-link text-muted text-decoration-none"><i class="bi bi-arrow-left"></i> Consultar otro pedido</button>`;
                btnVolver.querySelector('button').addEventListener('click', () => {
                    trackingForm.classList.remove('d-none');
                    resultDiv.innerHTML = '';
                    window.history.replaceState({}, document.title, window.location.pathname);
                });
                resultDiv.appendChild(btnVolver);
            } else {
                // Si no existe, mostramos el formulario y el error
                trackingForm.classList.remove('d-none');
                resultDiv.innerHTML = `<div class="alert alert-danger" role="alert"><i class="bi bi-exclamation-triangle-fill"></i> El pedido no existe o el enlace es incorrecto.</div>`;
            }
        } catch (error) {
            console.error(error);
            trackingForm.classList.remove('d-none');
            resultDiv.innerHTML = `<div class="alert alert-danger" role="alert">Error al buscar el pedido.</div>`;
        }
        return; // Terminamos aquí si había ID
    }

    // Caso B: Búsqueda por Código + Teléfono (Legacy)
    const code = params.get('code');
    const phone = params.get('phone');
    if (code && phone) {
        trackingInput.value = code;
        trackingPhoneInput.value = phone;
        searchButton.click(); // Simular clic para buscar
    }
});

// 4. Evento 'submit' para el formulario
trackingForm.addEventListener('submit', async (e) => {
    e.preventDefault(); // Evitar recarga de la página

    // 5. Tomar y limpiar el valor del input
    const trackingCode = trackingInput.value.trim().toUpperCase();
    const trackingPhone = limpiarTelefono(trackingPhoneInput.value);

    if (!trackingCode || !trackingPhone) {
        resultDiv.innerHTML = `<div class="alert alert-warning" role="alert">Por favor, ingresá el código y tu número de teléfono.</div>`;
        return;
    }

    // Estado de "Cargando..."
    const originalButtonText = searchButton.innerHTML;
    searchButton.disabled = true;
    searchButton.innerHTML = `
    <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
    Buscando...
  `;
    resultDiv.innerHTML = ''; // Limpiar resultados anteriores

    try {
        // 6. Consulta a Firestore
        const pedidosRef = collection(db, 'pedidos');
        const q = query(pedidosRef, where("codigo_seguimiento", "==", trackingCode));
        const querySnapshot = await getDocs(q);

        // 7. Manejar la respuesta
        if (querySnapshot.empty) {
            resultDiv.innerHTML = `<div class="alert alert-danger" role="alert">Código no encontrado. Por favor, verificá e intentá nuevamente.</div>`;
        } else {
            const pedidoData = querySnapshot.docs[0].data();
            
            // --- VALIDACIÓN DE SEGURIDAD (TELÉFONO) ---
            const idCliente = pedidoData.id_cliente;
            if (!idCliente) {
                resultDiv.innerHTML = `<div class="alert alert-danger" role="alert">No pudimos validar tu identidad. Contactanos.</div>`;
                return;
            }

            const clienteRef = doc(db, "clientes", idCliente);
            const clienteSnap = await getDoc(clienteRef);
            
            // Normalizamos el teléfono guardado (solo números) para comparar
            const telefonoRegistrado = clienteSnap.exists() ? limpiarTelefono(clienteSnap.data().telefono) : '';

            if (trackingPhone !== telefonoRegistrado) {
                resultDiv.innerHTML = `<div class="alert alert-danger" role="alert"><strong>Datos incorrectos.</strong><br>El teléfono ingresado no coincide con el registrado en el pedido.<br>Recordá usar el código de área (ej: 351...) sin el 15.</div>`;
                return;
            }
            // ------------------------------------------

            mostrarResultado(pedidoData, pedidoData.codigo_seguimiento);
        }
    } catch (error) {
        console.error("Error al buscar el pedido:", error);
        resultDiv.innerHTML = `<div class="alert alert-danger" role="alert">Ocurrió un error al realizar la búsqueda. Por favor, intentá más tarde.</div>`;
    } finally {
        searchButton.disabled = false;
        searchButton.innerHTML = originalButtonText;
    }
});
