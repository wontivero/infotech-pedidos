// --- MÓDULO DE CONEXIÓN A FIREBASE ---
// Se encarga de inicializar la app y exportar las referencias a la BD y Storage.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-storage.js";

// Configuración de Firebase (Tus credenciales)
const firebaseConfig = {
  apiKey: "AIzaSyBEhGpYnI0Pl1yN7lDFAqr5Z2fz956x6UE",
  authDomain: "infotech-pedidos.firebaseapp.com",
  projectId: "infotech-pedidos",
  storageBucket: "infotech-pedidos.firebasestorage.app",
  messagingSenderId: "439969283194",
  appId: "1:439969283194:web:6f65e5a01cd7efed6e0fc3"
};

// Inicializar y exportar
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);