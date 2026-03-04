// --- MÓDULO DE CONEXIÓN A FIREBASE ---
// Se encarga de inicializar la app y exportar las referencias a la BD y Storage.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getFirestore, onSnapshot } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-storage.js";

// 1. Configuración de PRODUCCIÓN (Tu proyecto real - NO TOCAR)
const firebaseConfigProd = {
  apiKey: "AIzaSyBEhGpYnI0Pl1yN7lDFAqr5Z2fz956x6UE",
  authDomain: "infotech-pedidos.firebaseapp.com",
  projectId: "infotech-pedidos",
  storageBucket: "infotech-pedidos.firebasestorage.app",
  messagingSenderId: "439969283194",
  appId: "1:439969283194:web:6f65e5a01cd7efed6e0fc3"
};

// 2. Configuración de DESARROLLO (Proyecto de pruebas)
// TODO: Pegá acá las credenciales de tu NUEVO proyecto de pruebas de Firebase.
// Mientras no lo crees, usará la de producción, pero te avisará con una alerta.
const firebaseConfigDev = {
  apiKey: "AIzaSyDKLQpWNUJ9OwcGknx8ZKkR5WeoyHkm_7Q",
  authDomain: "infotech-pedidos-dev.firebaseapp.com",
  projectId: "infotech-pedidos-dev",
  storageBucket: "infotech-pedidos-dev.firebasestorage.app",
  messagingSenderId: "491637313930",
  appId: "1:491637313930:web:51690eb464fb8e93983873"
};

// 3. Detección automática de entorno
const hostname = window.location.hostname;
const esLocal = hostname === "localhost" || hostname === "127.0.0.1";

// Si estamos en localhost, usa DEV. Si estamos en la web, usa PROD.
const firebaseConfig = esLocal ? firebaseConfigDev : firebaseConfigProd;

// Inicializar y exportar
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export { onSnapshot }; // Exportamos onSnapshot para usarlo en otros módulos
export const storage = getStorage(app);