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

      // Create Socket.io connection
      this.socket = io('http://localhost:3000', {
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

      // Socket event: sync data from server
      this.socket.on('sync:data', (data) => {
        console.log('Received sync:data from server', data);
        this.handleSyncData(data);
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
        this.emit('clientes_synced', data.clientes);
      }
    } catch (error) {
      console.error('Error handling sync data:', error);
      this.emit('error', error);
    }
  }

  /**
   * Request a manual sync with the server
   * Checks if socket is connected, retrieves unsynced visitas from storage,
   * and sends them to server for synchronization
   * @returns {Promise<boolean>} True if sync was requested, false if socket not connected
   */
  async requestSync() {
    if (!this.socket || !this.socket.connected) {
      console.warn('Socket not connected, cannot sync');
      return false;
    }

    this.isSyncing = true;

    try {
      // Get unsynced visitas from local storage
      const unsynced = await storageService.getUnsynced();

      if (unsynced.length > 0) {
        console.log(`Syncing ${unsynced.length} unsynced visitas`);
        this.socket.emit('sync:visitas', { visitas: unsynced });
      }

      this.emit('sync_requested');
      return true;
    } catch (error) {
      console.error('Error requesting sync:', error);
      this.emit('error', error);
      return false;
    } finally {
      this.isSyncing = false;
    }
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
