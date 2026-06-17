/**
 * API Client Service - HTTP client for backend API calls
 * Provides methods for CRUD operations on clientes, visitas, and pagos
 * Uses axios with base configuration for the backend API
 */

import axios from 'axios';

/**
 * Axios instance configured for the backend API
 * Base URL: http://localhost:3000/api
 * Timeout: 10 seconds
 */
const axiosInstance = axios.create({
  baseURL: 'http://localhost:3000/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

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

  // ============== PAGOS ENDPOINTS ==============

  /**
   * Create a new pago (payment)
   * @param {object} data - Pago data (cliente_id, monto, fecha, metodo, etc.)
   * @returns {Promise<object>} The created pago with id
   */
  createPago(data) {
    return axiosInstance.post('/pagos', data).then((res) => res.data);
  },

  /**
   * Get all pagos for a specific cliente
   * @param {number} clienteId - The cliente id
   * @returns {Promise<array>} Array of pagos for that cliente
   */
  getPagosByCliente(clienteId) {
    return axiosInstance
      .get(`/pagos/cliente/${clienteId}`)
      .then((res) => res.data);
  },
};

export default axiosInstance;
export { apiClient };
