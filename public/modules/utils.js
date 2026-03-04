// --- MÓDULO DE UTILIDADES ---
// Funciones genéricas de ayuda para formateo, subida de archivos, etc.

import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-storage.js";
import { storage } from "./firebase.js";

/**
 * Convierte un texto a Title Case (Primera Letra Mayúscula).
 * Ej: "juan perez" -> "Juan Perez"
 */
export const capitalizarTexto = (texto) => {
  if (!texto) return '';
  return texto.toLowerCase().replace(/(?:^|\s|["'([{])+\S/g, match => match.toUpperCase());
};

/**
 * Genera un código aleatorio numérico de 5 dígitos con un prefijo opcional.
 * Ej: generarCodigo('P') -> "P12345"
 */
export const generarCodigo = (prefix = '') => {
  const numero = Math.floor(10000 + Math.random() * 90000);
  return `${prefix}${numero}`;
};

/**
 * Sube un archivo a Firebase Storage y devuelve la URL de descarga.
 */
export const subirImagen = async (file) => {
  if (!file) return '';
  const storageRef = ref(storage, `libros/${Date.now()}-${file.name}`);
  const uploadResult = await uploadBytes(storageRef, file);
  return getDownloadURL(uploadResult.ref);
};

/**
 * Formateador de moneda para Pesos Argentinos.
 */
export const formatter = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 });