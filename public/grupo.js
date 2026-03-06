import { db, storage } from './modules/firebase.js';
import { getDoc, doc, collection, addDoc } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-storage.js";

const mainContent = document.getElementById('main-content');
const loadingState = document.getElementById('loading-state');

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const campaignId = params.get('id');

    if (!campaignId) {
        showError("No se especificó un grupo de compra.");
        return;
    }

    try {
        const campaignRef = doc(db, "campañas", campaignId);
        const campaignSnap = await getDoc(campaignRef);

        if (!campaignSnap.exists() || !campaignSnap.data().activa) {
            showError("Este grupo de compra no existe o ya no está activo.");
            return;
        }

        const campaignData = campaignSnap.data();
        renderCampaignForm(campaignData, campaignId);
        loadingState.classList.add('d-none');
        mainContent.classList.remove('d-none');

    } catch (error) {
        console.error("Error loading campaign:", error);
        showError("Ocurrió un error al cargar la información.");
    }
});

function showError(message) {
    loadingState.classList.add('d-none');
    mainContent.classList.remove('d-none');
    mainContent.innerHTML = `<div class="alert alert-danger text-center">${message}</div>`;
}

function renderCampaignForm(data, campaignId) {
    const formatter = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });
    mainContent.innerHTML = `
        <div class="text-center mb-4">
            <img src="logoCompleto.png" alt="Logo InfoTech" class="img-fluid mb-3" style="max-height: 70px;">
            <h2 class="h4 mb-1">${data.colegio || 'Grupo de Compra'}</h2>
            <p class="text-muted">${data.curso || ''}</p>
        </div>

        <div class="card mb-4">
            <div class="card-body">
                <h5 class="card-title">${data.libroTitulo}</h5>
                <p class="card-text fs-3 fw-bold text-primary">${formatter.format(data.precio)}</p>
            </div>
        </div>

        <form id="signup-form">
            <h5 class="mb-3">Completá tus datos para sumarte</h5>
            <div class="form-floating mb-3">
                <input type="text" class="form-control" id="nombre-alumno" required placeholder="Nombre del Alumno/a">
                <label for="nombre-alumno">Nombre del Alumno/a</label>
            </div>
            <div class="form-floating mb-3">
                <input type="tel" class="form-control" id="telefono" required placeholder="Tu Teléfono">
                <label for="telefono">Tu Teléfono (con código de área)</label>
            </div>
            <div class="mb-3">
                <label for="comprobante" class="form-label">Adjuntar Comprobante de Pago</label>
                <input class="form-control" type="file" id="comprobante" accept="image/*" required>
            </div>
            <button type="submit" class="w-100 btn btn-lg btn-primary rounded-pill fw-bold">
                <i class="bi bi-check-circle-fill"></i> Enviar y Unirme al Grupo
            </button>
        </form>
    `;

    document.getElementById('signup-form').addEventListener('submit', (e) => handleFormSubmit(e, campaignId));
}

async function handleFormSubmit(e, campaignId) {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Enviando...`;

    const fileInput = document.getElementById('comprobante');
    const file = fileInput.files[0];

    if (!file) {
        Swal.fire('Error', 'Por favor, adjuntá el comprobante de pago.', 'error');
        btn.disabled = false;
        btn.innerHTML = originalText;
        return;
    }

    try {
        const storageRef = ref(storage, `comprobantes/${campaignId}/${Date.now()}-${file.name}`);
        const uploadResult = await uploadBytes(storageRef, file);
        const comprobanteUrl = await getDownloadURL(uploadResult.ref);

        await addDoc(collection(db, "solicitudes_grupo"), {
            idCampaña: campaignId,
            nombreAlumno: document.getElementById('nombre-alumno').value,
            telefono: document.getElementById('telefono').value,
            comprobanteUrl: comprobanteUrl,
            estado: 'pendiente',
            fechaSolicitud: new Date()
        });

        mainContent.innerHTML = `
            <div class="text-center py-5">
                <i class="bi bi-check-circle-fill text-success" style="font-size: 4rem;"></i>
                <h3 class="mt-3">¡Listo!</h3>
                <p class="lead">Recibimos tus datos correctamente.</p>
                <p>En las próximas horas verificaremos el pago y te agregaremos al pedido. ¡Gracias!</p>
            </div>
        `;

    } catch (error) {
        console.error("Error submitting form:", error);
        Swal.fire('Error', 'No se pudo enviar tu solicitud. Por favor, intentá de nuevo.', 'error');
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}