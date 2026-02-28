// 1. Importar funciones de Firebase desde el CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getFirestore, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

// 2. Configuración de Firebase (reemplazar con tus credenciales)
const firebaseConfig = {
    apiKey: "AIzaSyBEhGpYnI0Pl1yN7lDFAqr5Z2fz956x6UE",
    authDomain: "infotech-pedidos.firebaseapp.com",
    projectId: "infotech-pedidos",
    storageBucket: "infotech-pedidos.firebasestorage.app",
    messagingSenderId: "439969283194",
    appId: "1:439969283194:web:6f65e5a01cd7efed6e0fc3"

};

// Inicializar Firebase y Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 3. Selección de elementos del DOM
const trackingForm = document.getElementById('tracking-form');
const trackingInput = document.getElementById('tracking-code');
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

// 4. Evento 'submit' para el formulario
trackingForm.addEventListener('submit', async (e) => {
    e.preventDefault(); // Evitar recarga de la página

    // 5. Tomar y limpiar el valor del input
    const trackingCode = trackingInput.value.trim().toUpperCase();

    if (!trackingCode) {
        resultDiv.innerHTML = `<div class="alert alert-warning" role="alert">Por favor, ingresá un código de seguimiento.</div>`;
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
            const { estado_general, saldo_pendiente } = pedidoData;
            const badgeClass = getBadgeClass(estado_general);
            const saldoFormateado = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(saldo_pendiente || 0);

            resultDiv.innerHTML = `
        <div class="card border-primary">
          <div class="card-header">Resultado del Pedido</div>
          <div class="card-body">
            <p><strong>Estado:</strong> <span class="badge ${badgeClass} fs-6">${estado_general || 'No especificado'}</span></p>
            <p class="mb-0"><strong>Saldo pendiente:</strong> ${saldoFormateado}</p>
          </div>
        </div>`;
        }
    } catch (error) {
        console.error("Error al buscar el pedido:", error);
        resultDiv.innerHTML = `<div class="alert alert-danger" role="alert">Ocurrió un error al realizar la búsqueda. Por favor, intentá más tarde.</div>`;
    } finally {
        searchButton.disabled = false;
        searchButton.innerHTML = originalButtonText;
    }
});