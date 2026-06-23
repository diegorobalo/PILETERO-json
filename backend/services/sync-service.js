import databaseService from './database.js';

/**
 * SyncService - Handles bidirectional sync between mobile app and server
 * Manages synchronization of clients and visits data
 */
class SyncService {
  constructor() {
    this.isInitialized = false;
  }

  /**
   * Initialize sync service (called after database is ready)
   */
  init() {
    this.isInitialized = true;
    console.log('SyncService initialized');
  }

  /**
   * Sync client data from mobile to server
   * Receives array of clients and creates/updates them in the database
   *
   * @param {Array} clientData - Array of client objects from mobile
   * @returns {Array} Results array with {id, action: "updated"|"created"}
   */
  async syncClientData(clientData) {
    const results = [];

    if (!Array.isArray(clientData)) {
      throw new Error('clientData must be an array');
    }

    for (const client of clientData) {
      try {
        // Check if client exists
        const existingCliente = await databaseService.getClienteById(client.id);

        let result;
        if (existingCliente) {
          // Update existing client
          await databaseService.updateCliente(client.id, client);
          result = { id: client.id, action: 'updated' };
        } else {
          // Create new client
          const newCliente = await databaseService.createCliente(client);
          result = { id: newCliente.id, action: 'created' };
        }

        results.push(result);
      } catch (error) {
        console.error(`Error syncing client ${client.id}:`, error);
        results.push({ id: client.id, action: 'error', error: error.message });
      }
    }

    return results;
  }

  /**
   * Sync visit data from mobile to server (MAIN SYNC METHOD)
   * Receives array of visits and creates/updates them in the database
   * Marks visits as synced after successful save
   *
   * @param {Array} visitData - Array of visit objects from mobile's IndexedDB
   * @returns {Array} Results array with {id, action: "updated"|"created"}
   */
  async syncVisitData(visitData) {
    const results = [];

    if (!Array.isArray(visitData)) {
      throw new Error('visitData must be an array');
    }

    for (const visit of visitData) {
      try {
        // Strip the IndexedDB id — it's meaningless in SQLite.
        // Use cliente_id + fecha as the dedup key instead.
        const { id: mobileId, sincronizada, ...fields } = visit;

        const existing = await databaseService.queryOne(
          'SELECT id FROM visitas WHERE cliente_id = ? AND fecha = ?',
          [fields.cliente_id, fields.fecha]
        );

        let result;
        if (existing) {
          await databaseService.updateVisita(existing.id, fields);
          result = { mobileId, id: existing.id, action: 'updated' };
        } else {
          const newVisita = await databaseService.createVisita(fields);
          result = { mobileId, id: newVisita.id, action: 'created' };
        }

        results.push(result);
      } catch (error) {
        console.error('Error syncing visit:', error);
        results.push({ mobileId: visit.id, action: 'error', error: error.message });
      }
    }

    return results;
  }

  /**
   * Get all client data for mobile to sync
   * Returns complete client list for the mobile app
   *
   * @returns {Array} Array of all active clients
   */
  async getClientDataForSync() {
    try {
      const clientes = await databaseService.getAllClientes();
      return clientes;
    } catch (error) {
      console.error('Error getting client data for sync:', error);
      throw error;
    }
  }

  /**
   * Get all unsynced visits (debug/monitoring method)
   * Returns visits that haven't been marked as synced yet
   *
   * @returns {Array} Array of unsynced visits
   */
  async getUnsynced() {
    try {
      const unsynced = await databaseService.getUnsynced();
      return unsynced;
    } catch (error) {
      console.error('Error getting unsynced visits:', error);
      throw error;
    }
  }
}

// Create and export singleton instance
const syncService = new SyncService();
export default syncService;
