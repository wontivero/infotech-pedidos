// --- ARCHIVO PRINCIPAL (ORQUESTADOR) ---
// Importa los módulos y ejecuta sus inicializadores cuando el DOM está listo.

import { cargarLibrosEnMemoria, cargarClientesEnMemoria, cargarPedidosEnMemoria, cargarListasReferencia } from "./modules/data.js";
import { inicializarLibros } from "./modules/libros.js";
import { inicializarClientes } from "./modules/clientes.js";
import { inicializarGestorPedidos } from "./modules/gestor-pedidos.js";
import { inicializarListaPedidos } from "./modules/lista-pedidos.js";
import { inicializarProduccion } from "./modules/produccion.js";
import { inicializarConfiguracion } from "./modules/configuracion.js";

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Cargar datos globales en memoria (paralelo para velocidad)
  await Promise.all([
    cargarLibrosEnMemoria(),
    cargarClientesEnMemoria(),
    cargarPedidosEnMemoria(),
    cargarListasReferencia(),
    inicializarConfiguracion() // Carga la config y activa el form
  ]);

  // 2. Inicializar módulos de UI
  inicializarLibros();
  inicializarClientes();
  inicializarGestorPedidos();
  inicializarListaPedidos();
  inicializarProduccion();
});