/**
 * API Client Service - HTTP client for backend API calls
 * Provides methods for CRUD operations on clientes, visitas, and pagos
 * Uses axios with base configuration for the backend API
 */

import axios from 'axios';

const axiosInstance = axios.create({
  baseURL: '/api',
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Convierte errores de red/timeout en un error amigable con flag sinConexion
axiosInstance.interceptors.response.use(
  res => res,
  err => {
    if (!err.response) {
      const e = new Error('Sin conexión al servidor');
      e.sinConexion = true;
      return Promise.reject(e);
    }
    return Promise.reject(err);
  }
);

/**
 * API Client object with methods for all backend endpoints
 * Each method returns a Promise with the response data
 */
const apiClient = {
  /**
   * Health check endpoint - tests connection to server
   * @returns {Promise<object>} Server health status
   */
  health() {
    return axiosInstance.get('/health').then((res) => res.data);
  },

  // ============== CLIENTES ENDPOINTS ==============

  /**
   * Get all clientes
   * @returns {Promise<array>} Array of all clientes
   */
  getClientes() {
    return axiosInstance.get('/clientes').then((res) => res.data);
  },

  /**
   * Get a single cliente by id
   * @param {number} id - The cliente id
   * @returns {Promise<object>} The cliente object
   */
  getCliente(id) {
    return axiosInstance.get(`/clientes/${id}`).then((res) => res.data);
  },

  /**
   * Create a new cliente
   * @param {object} data - Cliente data (nombre, telefono, email, direccion, etc.)
   * @returns {Promise<object>} The created cliente with id
   */
  createCliente(data) {
    return axiosInstance.post('/clientes', data).then((res) => res.data);
  },

  /**
   * Update an existing cliente
   * @param {number} id - The cliente id
   * @param {object} data - Updated cliente data
   * @returns {Promise<object>} The updated cliente
   */
  updateCliente(id, data) {
    return axiosInstance.put(`/clientes/${id}`, data).then((res) => res.data);
  },

  // ============== VISITAS ENDPOINTS ==============

  /**
   * Get all visitas for a specific date
   * @param {string} fecha - Date in YYYY-MM-DD format
   * @returns {Promise<array>} Array of visitas for that date
   */
  getVisitas() {
    return axiosInstance.get('/visitas').then((r) => r.data);
  },

  getVisitasByFecha(fecha) {
    return axiosInstance
      .get(`/visitas/fecha/${fecha}`)
      .then((res) => res.data);
  },

  /**
   * Get all visitas for a specific cliente
   * @param {number} clienteId - The cliente id
   * @returns {Promise<array>} Array of visitas for that cliente
   */
  getVisitasByCliente(clienteId) {
    return axiosInstance
      .get(`/visitas/cliente/${clienteId}`)
      .then((res) => res.data);
  },

  /**
   * Create a new visita
   * @param {object} data - Visita data (cliente_id, fecha, observaciones, etc.)
   * @returns {Promise<object>} The created visita with id
   */
  createVisita(data) {
    return axiosInstance.post('/visitas', data).then((res) => res.data);
  },

  /**
   * Update an existing visita
   * @param {number} id - The visita id
   * @param {object} data - Updated visita data
   * @returns {Promise<object>} The updated visita
   */
  updateVisita(id, data) {
    return axiosInstance.put(`/visitas/${id}`, data).then((res) => res.data);
  },

  /**
   * Delete a visita
   * @param {number} id - The visita id
   */
  deleteVisita(id) {
    return axiosInstance.delete(`/visitas/${id}`).then((res) => res.data);
  },

  // ============== PAGOS ENDPOINTS ==============

  getPagosByCliente(clienteId) {
    return axiosInstance.get(`/pagos/cliente/${clienteId}`).then((res) => res.data);
  },

  aumentoPreciosMasivo(porcentaje) {
    return axiosInstance.patch('/clientes/aumento-masivo', { porcentaje }).then(r => r.data);
  },

  getFotosCliente(clienteId) {
    return axiosInstance.get(`/clientes/${clienteId}/fotos-cliente`).then(r => r.data);
  },
  saveFotoCliente(clienteId, { tipo, data }) {
    return axiosInstance.post(`/clientes/${clienteId}/fotos-cliente`, { tipo, data }).then(r => r.data);
  },
  deleteFotoCliente(id) {
    return axiosInstance.delete(`/fotos-cliente/${id}`).then(r => r.data);
  },

  // ============== INVENTARIO ENDPOINTS ==============

  getInventario() {
    return axiosInstance.get('/inventario').then((r) => r.data);
  },
  createInsumo(data) {
    return axiosInstance.post('/inventario', data).then((r) => r.data);
  },
  updateInsumo(id, data) {
    return axiosInstance.put(`/inventario/${id}`, data).then((r) => r.data);
  },
  ajustarStock(id, cantidad) {
    return axiosInstance.patch(`/inventario/${id}/ajustar`, { cantidad }).then((r) => r.data);
  },
  deleteInsumo(id) {
    return axiosInstance.delete(`/inventario/${id}`).then((r) => r.data);
  },

  // ============== FOTOS ENDPOINTS ==============

  getFotosByVisita(visitaId) {
    return axiosInstance.get(`/visitas/${visitaId}/fotos`).then((r) => r.data);
  },

  // ============== PAGOS ENDPOINTS ==============

  getPagos() {
    return axiosInstance.get('/pagos').then((r) => r.data);
  },
  createPago(data) {
    return axiosInstance.post('/pagos', data).then((r) => r.data);
  },
  deletePago(id) {
    return axiosInstance.delete(`/pagos/${id}`).then((r) => r.data);
  },

  // ============== CONFIGURACION ENDPOINTS ==============

  getConfiguracion() {
    return axiosInstance.get('/configuracion').then(r => r.data);
  },
  setConfiguracion(clave, valor) {
    return axiosInstance.put('/configuracion', { clave, valor }).then(r => r.data);
  },

  // ============== GASTOS ENDPOINTS ==============

  getGastos() {
    return axiosInstance.get('/gastos').then(r => r.data);
  },
  createGasto(data) {
    return axiosInstance.post('/gastos', data).then(r => r.data);
  },
  deleteGasto(id) {
    return axiosInstance.delete(`/gastos/${id}`).then(r => r.data);
  },
};

export default axiosInstance;
export { apiClient };
