// --- MÓDULO DE DATOS (ESTADO GLOBAL) ---
// Maneja la carga de datos en memoria para búsquedas rápidas y referencias cruzadas.

import { collection, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { db } from "./firebase.js";

// Variables de estado global (exportadas para que otros módulos las lean)
export let librosEnMemoria = [];
export let clientesEnMemoria = [];
export let pedidosEnMemoria = [];
export let colegiosEnMemoria = [];
export let editorialesEnMemoria = [];

// --- FUNCIONES DE CARGA ---

export const cargarLibrosEnMemoria = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, "libros"));
    librosEnMemoria = [];
    querySnapshot.forEach((doc) => {
      librosEnMemoria.push({ id: doc.id, ...doc.data() });
    });
    actualizarDatalistTitulos(); // Actualizar autocompletado
  } catch (error) {
    console.error("Error al cargar libros en memoria:", error);
  }
};

export const cargarClientesEnMemoria = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, "clientes"));
    clientesEnMemoria = [];
    querySnapshot.forEach((doc) => {
      clientesEnMemoria.push({ id: doc.id, ...doc.data() });
    });
  } catch (error) {
    console.error("Error al cargar clientes en memoria:", error);
  }
};

export const cargarPedidosEnMemoria = async () => {
  try {
    // Cargamos pedidos para estadísticas y sugerencias
    const querySnapshot = await getDocs(collection(db, "pedidos"));
    pedidosEnMemoria = [];
    querySnapshot.forEach((doc) => {
      pedidosEnMemoria.push({ id: doc.id, ...doc.data() });
    });
  } catch (error) {
    console.error("Error al cargar pedidos en memoria:", error);
  }
};

export const cargarListasReferencia = async () => {
  try {
    // Cargar Colegios
    const colSnap = await getDocs(collection(db, "colegios"));
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
    const edSnap = await getDocs(collection(db, "editoriales"));
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
  } catch (error) {
    console.error("Error cargando referencias:", error);
  }
};

export const guardarReferenciaSiNoExiste = async (coleccion, listaMemoria, valor) => {
  if (!valor) return;
  const existe = listaMemoria.some(item => item.toLowerCase() === valor.toLowerCase());
  if (!existe) {
    await addDoc(collection(db, coleccion), { nombre: valor });
    await cargarListasReferencia();
  }
};

const actualizarDatalistTitulos = () => {
  const datalist = document.getElementById('datalist-titulos-libros');
  if (!datalist) return;
  datalist.innerHTML = '';
  const titulos = [...new Set(librosEnMemoria.map(l => l.titulo))].sort();
  titulos.forEach(titulo => datalist.appendChild(new Option(titulo, titulo)));
};