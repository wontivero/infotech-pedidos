// --- ARCHIVO PRINCIPAL (ORQUESTADOR) ---
// Importa los módulos y ejecuta sus inicializadores cuando el DOM está listo.

import { iniciarEscuchaLibros, iniciarEscuchaClientes, iniciarEscuchaPedidos, iniciarEscuchaReferencias } from "./modules/data.js";
import { inicializarLibros } from "./modules/libros.js";
import { inicializarClientes } from "./modules/clientes.js";
import { inicializarGestorPedidos } from "./modules/gestor-pedidos.js";
import { inicializarListaPedidos } from "./modules/lista-pedidos.js";
import { inicializarProduccion } from "./modules/produccion.js";
import { inicializarConfiguracion } from "./modules/configuracion.js";

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Iniciar escuchas en tiempo real (Data Layer)
  iniciarEscuchaLibros();
  iniciarEscuchaClientes();
  iniciarEscuchaPedidos();
  iniciarEscuchaReferencias();
  inicializarConfiguracion();

  // 2. Inicializar módulos de UI
  inicializarLibros();
  inicializarClientes();
  inicializarGestorPedidos();
  inicializarListaPedidos();
  inicializarProduccion();
});