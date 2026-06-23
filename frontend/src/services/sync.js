/**
 * Sync Service - Real-time sync via Socket.io + WiFi detection
 * Manages connection to backend, handles sync events, and offline capabilities
 * Singleton instance exported for app-wide use
 */

import { io } from 'socket.io-client';
import { apiClient } from './api.js';
import storageService from './storage.js';

/**
 * SyncService class - manages real-time synchronization
 * Handles Socket.io connection, event listeners, and sync logic
 */
class SyncService {
  constructor() {
    this.socket = null;
    this.isConnecting = false;
    this.isSyncing = false;
    this.listeners = [];
  }

  /**
   * Register an event listener
   * Stores listener so it can be called when events are emitted
   * @param {string} event - Event name (e.g., 'connected', 'clientes_synced')
   * @param {function} callback - Function to call when event fires (receives data)
   */
  on(event, callback) {
    this.listeners.push({ event, callback });
  }

  /**
   * Emit an event to all registered listeners
   * Calls all callbacks for this event with the provided data
   * @param {string} event - Event name
   * @param {any} data - Data to pass to listeners
   */
  emit(event, data) {
    const eventListeners = this.listeners.filter((l) => l.event === event);
    eventListeners.forEach((listener) => {
      try {
        listener.callback(data);
      } catch (error) {
        console.error(`Error in listener for ${event}:`, error);
      }
    });
  }

  /**
   * Initialize Socket.io connection to backend
   * First checks if server is available via health endpoint
   * Sets up socket handlers for connect, disconnect, and sync events
   * @returns {Promise<void>}
   */
  async connect() {
    if (this.isConnecting || this.socket?.connected) {
      return;
    }

    this.isConnecting = true;

    try {
      // Check if server is available
      try {
        await apiClient.health();
      } catch (error) {
        console.warn('Server not available, running offline mode');
        this.emit('offline');
        this.isConnecting = false;
        return;
      }

      // Connect using same protocol as page (http in dev, https in prod)
      const serverUrl = `${window.location.protocol}//${window.location.hostname}:3000`;
      this.socket = io(serverUrl, {
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
      });

      // Socket event: connected
      this.socket.on('connect', () => {
        console.log('Socket connected');
        this.emit('connected');
      });

      // Socket event: disconnected
      this.socket.on('disconnect', () => {
        console.log('Socket disconnected');
        this.emit('disconnected');
      });

      // Socket event: sync error
      this.socket.on('sync:error', (data) => {
        console.error('Sync error:', data);
        this.emit('error', data);
      });

      this.isConnecting = false;
    } catch (error) {
      console.error('Error connecting socket:', error);
      this.emit('error', error);
      this.isConnecting = false;
    }
  }

  /**
   * Handle sync data received from server
   * Processes updated client list and saves to local storage
   * @param {object} data - Data from server (may contain clientes, etc.)
   * @returns {Promise<void>}
   */
  async handleSyncData(data) {
    try {
      if (data.clientes && Array.isArray(data.clientes)) {
        await storageService.saveAllClientes(data.clientes);
        // Backup en localStorage para acceso offline confiable
        try {
          localStorage.setItem('piletero_clientes_cache', JSON.stringify(data.clientes));
        } catch {}
        this.emit('clientes_synced', data.clientes);
      }
    } catch (error) {
      console.error('Error handling sync data:', error);
      this.emit('error', error);
    }
  }

  /**
   * Request a full bidirectional sync with the server:
   * 1. Ask server for all clients → save to IndexedDB
   * 2. Send unsynced visits from IndexedDB → server saves to SQLite
   * @returns {Promise<boolean>} True if sync succeeded
   */
  async requestSync() {
    if (!this.socket || !this.socket.connected) {
      console.warn('Socket not connected, cannot sync');
      return false;
    }

    this.isSyncing = true;

    return new Promise(async (resolve) => {
      const timeout = setTimeout(() => {
        console.warn('Sync timed out');
        this.isSyncing = false;
        resolve(false);
      }, 10000);

      try {
        // Step 1: ask server for clients, wait for response
        this.socket.once('sync:data', async (data) => {
          // Rescatar clientes creados offline antes de que handleSyncData los borre
          let pendingClientes = [];
          try {
            await storageService.initPromise;
            const all = await storageService.getAllClientes();
            pendingClientes = all.filter(c => c.pendiente_sync);
          } catch {}

          try {
            await this.handleSyncData(data);
          } catch (err) {
            console.error('Error saving sync data:', err);
          }

          // Re-guardar los pendientes (handleSyncData los borró con clear)
          for (const pc of pendingClientes) {
            await storageService.saveCliente(pc).catch(() => {});
          }

          // Subir clientes pendientes al servidor
          if (pendingClientes.length > 0) {
            console.log(`Uploading ${pendingClientes.length} pending client(s) to server`);
            this.socket.once('sync:clientes:ack', async () => {
              // Borrar los temporales (IDs negativos) del IndexedDB
              for (const pc of pendingClientes) {
                await storageService.delete('clientes', pc.id).catch(() => {});
              }
              console.log('Pending clients synced');
              // El servidor va a mandar sync:clientes_refreshed con la lista real actualizada
              this.socket.once('sync:clientes_refreshed', async (freshData) => {
                if (freshData?.clientes) {
                  await this.handleSyncData(freshData);
                  this.emit('clientes_synced', freshData.clientes);
                  console.log(`Got ${freshData.clientes.length} clients with real IDs`);
                }
              });
            });
            this.socket.emit('sync:clientes', { clientes: pendingClientes });
          }

          // Step 2: send ALL visits to server (not just unsynced — server deduplicates by cliente+fecha)
          // This ensures visits incorrectly marked as synced still reach the server
          try {
            const todasVisitas = await storageService.getAllVisitas();
            if (todasVisitas.length > 0) {
              console.log(`Uploading ${todasVisitas.length} visit(s) to server`);
              // Listen for ack first, then send
              this.socket.once('sync:visitas:ack', async (ack) => {
                // Mark all visits as synced in IndexedDB
                for (const v of todasVisitas) {
                  await storageService.markVisitaSincronizada(v.id).catch(() => {});
                }

                // Sync photos for each visit the server confirmed
                const fotosToSync = [];
                for (const result of (ack.results || [])) {
                  if (result.action === 'error' || !result.id) continue;
                  const visita = todasVisitas.find(v => v.id === result.mobileId);
                  if (!visita) continue;
                  try {
                    const fotos = await storageService.getFotosByVisita(visita.id);
                    for (const f of fotos) {
                      fotosToSync.push({
                        visita_id_server: result.id,
                        tipo: f.tipo || f.type || 'general',
                        data: f.data,
                      });
                    }
                  } catch {}
                }
                if (fotosToSync.length > 0) {
                  console.log(`Syncing ${fotosToSync.length} photo(s) to server`);
                  this.socket.emit('sync:fotos', { fotos: fotosToSync });
                }
              });
              this.socket.emit('sync:visitas', { visitas: todasVisitas });
            }
          } catch (err) {
            console.error('Error sending visits:', err);
          }

          // Step 3: apply queued offline stock adjustments
          try {
            const stockQueue = JSON.parse(localStorage.getItem('piletero_q_stock') || '[]');
            for (const item of stockQueue) {
              await apiClient.ajustarStock(item.insumo_id, item.delta).catch(() => {});
            }
            if (stockQueue.length > 0) {
              localStorage.removeItem('piletero_q_stock');
              console.log(`Applied ${stockQueue.length} queued stock adjustment(s)`);
            }
          } catch {}

          // Step 4: apply queued offline payments
          try {
            const pagoQueue = JSON.parse(localStorage.getItem('piletero_q_pagos') || '[]');
            for (const item of pagoQueue) {
              await apiClient.createPago(item).catch(() => {});
            }
            if (pagoQueue.length > 0) {
              localStorage.removeItem('piletero_q_pagos');
              console.log(`Applied ${pagoQueue.length} queued payment(s)`);
            }
          } catch {}

          clearTimeout(timeout);
          this.isSyncing = false;
          this.emit('sync_requested');
          resolve(true);
        });

        this.socket.emit('sync:request');
      } catch (error) {
        console.error('Error requesting sync:', error);
        clearTimeout(timeout);
        this.emit('error', error);
        this.isSyncing = false;
        resolve(false);
      }
    });
  }

  /**
   * Automatically trigger sync if device is on WiFi
   * Uses navigator.connection to detect WiFi availability
   * @returns {Promise<boolean>} True if sync was triggered, false otherwise
   */
  async autoSyncIfWiFi() {
    try {
      const connection =
        navigator.connection || navigator.mozConnection || navigator.webkitConnection;

      if (connection && connection.type === 'wifi') {
        console.log('WiFi detected, requesting sync');
        return await this.requestSync();
      }

      return false;
    } catch (error) {
      console.warn('Error checking WiFi connection:', error);
      return false;
    }
  }
}

// Export singleton instance
const syncService = new SyncService();
export default syncService;
export { SyncService };
