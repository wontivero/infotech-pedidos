// --- MÓDULO DE DATOS (ESTADO GLOBAL) ---
// Maneja la carga de datos en memoria para búsquedas rápidas y referencias cruzadas.

import { collection, addDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { db, onSnapshot } from "./firebase.js";

// Variables de estado global (exportadas para que otros módulos las lean)
export let librosEnMemoria = [];
export let clientesEnMemoria = [];
export let pedidosEnMemoria = [];
export let colegiosEnMemoria = [];
export let editorialesEnMemoria = [];

// Sistema de Suscripciones (Callbacks)
const suscriptores = {
  libros: [],
  clientes: [],
  pedidos: [],
  referencias: []
};

export const suscribirCambios = (tipo, callback) => {
  if (suscriptores[tipo]) {
    suscriptores[tipo].push(callback);
  }
};

const notificarSuscriptores = (tipo) => {
  if (suscriptores[tipo]) {
    suscriptores[tipo].forEach(cb => cb());
  }
};

// --- FUNCIONES DE CARGA EN TIEMPO REAL ---

export const iniciarEscuchaLibros = () => {
  const q = query(collection(db, "libros"), orderBy("titulo"));
  return onSnapshot(q, (snapshot) => {
    librosEnMemoria = [];
    snapshot.forEach((doc) => librosEnMemoria.push({ id: doc.id, ...doc.data() }));
    actualizarDatalistTitulos();
    notificarSuscriptores('libros');
  });
};

export const iniciarEscuchaClientes = () => {
  const q = query(collection(db, "clientes"), orderBy("nombre"));
  return onSnapshot(q, (snapshot) => {
    clientesEnMemoria = [];
    snapshot.forEach((doc) => clientesEnMemoria.push({ id: doc.id, ...doc.data() }));
    notificarSuscriptores('clientes');
  });
};

export const iniciarEscuchaPedidos = () => {
  // Traemos todos los pedidos. El ordenamiento específico lo hará cada vista.
  const q = query(collection(db, "pedidos")); 
  return onSnapshot(q, (snapshot) => {
    pedidosEnMemoria = [];
    snapshot.forEach((doc) => pedidosEnMemoria.push({ id: doc.id, ...doc.data() }));
    notificarSuscriptores('pedidos');
  });
};

export const iniciarEscuchaReferencias = () => {
  // Escuchar Colegios y Editoriales (Podemos hacerlo simple sin onSnapshot si no cambian mucho, 
  // pero para consistencia usaremos una carga simple reactiva si se agregan nuevos)
  // Nota: Para referencias simples, onSnapshot en cada colección es lo ideal.
  onSnapshot(collection(db, "colegios"), () => cargarListasReferenciaInterna());
  onSnapshot(collection(db, "editoriales"), () => cargarListasReferenciaInterna());
};

// Función interna para procesar las referencias cuando cambian
const cargarListasReferenciaInterna = async () => {
  try {
    // Cargar Colegios
    // Nota: Aquí usamos getDocs dentro del callback de onSnapshot o simplemente reutilizamos la lógica.
    // Para simplificar y evitar bucles, haremos una carga directa cuando se nos avise.
    // Mejor aún: Escuchar directamente.
    
    // Implementación simplificada:
    // Al ser tablas auxiliares, las recargamos completas.
    // (En una app real grande, esto se optimizaría, pero para este caso está perfecto).
    
    // Colegios
    const colSnap = await import("https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js").then(m => m.getDocs(collection(db, "colegios")));
    colegiosEnMemoria = [];
    const datalistColegios = document.getElementById('datalist-colegios');
    if(datalistColegios) datalistColegios.innerHTML = '';
    colSnap.forEach(doc => {
      const nombre = doc.data().nombre;
      colegiosEnMemoria.push(nombre);
      if(datalistColegios) {
        const option = document.createElement('option');
        option.value = nombre;
        datalistColegios.appendChild(option);
      }
    });

    // Cargar Editoriales
    const edSnap = await import("https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js").then(m => m.getDocs(collection(db, "editoriales")));
    editorialesEnMemoria = [];
    const datalistEditoriales = document.getElementById('datalist-editoriales');
    if(datalistEditoriales) datalistEditoriales.innerHTML = '';
    edSnap.forEach(doc => {
      const nombre = doc.data().nombre;
      editorialesEnMemoria.push(nombre);
      if(datalistEditoriales) {
        const option = document.createElement('option');
        option.value = nombre;
        datalistEditoriales.appendChild(option);
      }
    });
    
    notificarSuscriptores('referencias');
  } catch (error) {
    console.error("Error cargando referencias:", error);
  }
};

export const guardarReferenciaSiNoExiste = async (coleccion, listaMemoria, valor) => {
  if (!valor) return;
  const existe = listaMemoria.some(item => item.toLowerCase() === valor.toLowerCase());
  if (!existe) {
    await addDoc(collection(db, coleccion), { nombre: valor });
    // No hace falta llamar a cargarListasReferencia(), el onSnapshot lo detectará
  }
};

const actualizarDatalistTitulos = () => {
  const datalist = document.getElementById('datalist-titulos-libros');
  if (!datalist) return;
  datalist.innerHTML = '';
  const titulos = [...new Set(librosEnMemoria.map(l => l.titulo))].sort();
  titulos.forEach(titulo => datalist.appendChild(new Option(titulo, titulo)));
};