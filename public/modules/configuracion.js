// --- MÓDULO CONFIGURACIÓN ---
import { doc, getDoc, setDoc, collection, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
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

  // Botón de Borrado Masivo (Zona de Peligro)
  const btnBorrar = document.getElementById('btn-borrar-datos');
  if (btnBorrar) {
    btnBorrar.addEventListener('click', async () => {
      const result = await Swal.fire({
        title: '¿Estás seguro?',
        html: "Se borrarán TODOS los pedidos, presupuestos y clientes.<br>Esta acción es irreversible.",
        icon: 'warning',
        input: 'password',
        inputLabel: 'Ingresá la clave de seguridad para confirmar',
        inputPlaceholder: 'Clave',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sí, borrar todo',
        preConfirm: (value) => {
          if (value !== '2628') Swal.showValidationMessage('Clave incorrecta');
        }
      });

      if (result.isConfirmed) {
        await borrarColeccion("pedidos");
        await borrarColeccion("presupuestos");
        await borrarColeccion("clientes");
        Swal.fire('¡Limpieza Completa!', 'La base de datos está lista para producción.', 'success').then(() => window.location.reload());
      }
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

// Función auxiliar para borrar todos los documentos de una colección
const borrarColeccion = async (nombreColeccion) => {
  const q = collection(db, nombreColeccion);
  const snapshot = await getDocs(q);
  const promesas = snapshot.docs.map(doc => deleteDoc(doc.ref));
  await Promise.all(promesas);
};