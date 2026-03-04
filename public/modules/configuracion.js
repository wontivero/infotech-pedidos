// --- MÓDULO CONFIGURACIÓN ---
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { db } from "./firebase.js";

export let configuracionGlobal = { alias: 'INFOTECH.PAGOS', banco: '', titular: '' };

export const inicializarConfiguracion = () => {
  cargarConfiguracion();
  const form = document.getElementById('form-configuracion');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nuevo = {
        alias: document.getElementById('config-alias').value,
        banco: document.getElementById('config-banco').value,
        titular: document.getElementById('config-titular').value
      };
      try {
        await setDoc(doc(db, "configuracion", "general"), nuevo);
        configuracionGlobal = nuevo;
        actualizarVista();
        Swal.fire('Guardado', '', 'success');
      } catch (e) { console.error(e); Swal.fire('Error', '', 'error'); }
    });
  }
};

export const cargarConfiguracion = async () => {
  try {
    const snap = await getDoc(doc(db, "configuracion", "general"));
    if (snap.exists()) {
      configuracionGlobal = { ...configuracionGlobal, ...snap.data() };
      actualizarVista();
    }
  } catch (e) { console.error(e); }
};

const actualizarVista = () => {
  document.getElementById('lbl-config-alias').textContent = configuracionGlobal.alias || '-';
  document.getElementById('config-alias').value = configuracionGlobal.alias || '';
  // ... resto de campos
};