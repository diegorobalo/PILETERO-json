/**
 * StorageService - IndexedDB implementation for offline data storage
 * Provides methods to store and retrieve clients, visits, and photos
 * Tracks sync queue for unsynced items
 */

class StorageService {
  constructor() {
    this.dbName = 'piletero_db';
    this.version = 1;
    this.db = null;
    // Initialize storage immediately on instance creation
    this.initPromise = this.init();
  }

  /**
   * Initialize the IndexedDB connection
   * Creates object stores on first open
   * @returns {Promise<void>}
   */
  init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create clientes object store
        if (!db.objectStoreNames.contains('clientes')) {
          const clientesStore = db.createObjectStore('clientes', { keyPath: 'id' });
          clientesStore.createIndex('nombre', 'nombre', { unique: false });
        }

        // Create visitas object store
        if (!db.objectStoreNames.contains('visitas')) {
          const visitasStore = db.createObjectStore('visitas', { keyPath: 'id', autoIncrement: true });
          visitasStore.createIndex('cliente_id', 'cliente_id', { unique: false });
          visitasStore.createIndex('fecha', 'fecha', { unique: false });
          visitasStore.createIndex('sincronizada', 'sincronizada', { unique: false });
        }

        // Create fotos object store
        if (!db.objectStoreNames.contains('fotos')) {
          const fotosStore = db.createObjectStore('fotos', { keyPath: 'id', autoIncrement: true });
          fotosStore.createIndex('visita_id', 'visita_id', { unique: false });
        }
      };
    });
  }

  /**
   * Helper: Store data using put operation
   * @param {string} storeName - Name of the object store
   * @param {object} data - Data to store
   * @returns {Promise<any>} The key of the stored data
   */
  set(storeName, data) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(data);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  /**
   * Helper: Retrieve a single record by key
   * @param {string} storeName - Name of the object store
   * @param {any} key - The key to retrieve
   * @returns {Promise<object|undefined>} The stored record or undefined
   */
  get(storeName, key) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  /**
   * Helper: Retrieve all records from a store
   * @param {string} storeName - Name of the object store
   * @returns {Promise<array>} Array of all records in the store
   */
  getAll(storeName) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  /**
   * Helper: Delete a record by key
   * @param {string} storeName - Name of the object store
   * @param {any} key - The key to delete
   * @returns {Promise<void>}
   */
  delete(storeName, key) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * Helper: Clear all records from a store
   * @param {string} storeName - Name of the object store
   * @returns {Promise<void>}
   */
  clear(storeName) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  // ============== CLIENTES METHODS ==============

  /**
   * Save a single cliente
   * @param {object} cliente - Cliente object with id, nombre, etc.
   * @returns {Promise<number>} The cliente id
   */
  saveCliente(cliente) {
    return this.set('clientes', cliente);
  }

  /**
   * Retrieve a single cliente by id
   * @param {number} id - The cliente id
   * @returns {Promise<object|undefined>} The cliente object or undefined
   */
  getCliente(id) {
    return this.get('clientes', id);
  }

  /**
   * Retrieve all clientes
   * @returns {Promise<array>} Array of all cliente objects
   */
  getAllClientes() {
    return this.getAll('clientes');
  }

  /**
   * Save all clientes (replaces existing list)
   * Used when sync receives updated list from server
   * @param {array} clientes - Array of cliente objects
   * @returns {Promise<void>}
   */
  async saveAllClientes(clientes) {
    await this.clear('clientes');
    for (const cliente of clientes) {
      await this.saveCliente(cliente);
    }
  }

  // ============== VISITAS METHODS ==============

  /**
   * Save a single visita
   * @param {object} visita - Visita object with cliente_id, fecha, etc.
   * @returns {Promise<number>} The visita id
   */
  saveVisita(visita) {
    return this.set('visitas', visita);
  }

  /**
   * Retrieve a single visita by id
   * @param {number} id - The visita id
   * @returns {Promise<object|undefined>} The visita object or undefined
   */
  getVisita(id) {
    return this.get('visitas', id);
  }

  /**
   * Retrieve all visitas
   * @returns {Promise<array>} Array of all visita objects
   */
  getAllVisitas() {
    return this.getAll('visitas');
  }

  /**
   * Retrieve all unsynced visitas
   * Critical for mobile sync - returns all visitas with sincronizada=false
   * @returns {Promise<array>} Array of unsynced visita objects
   */
  async getUnsynced() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['visitas'], 'readonly');
      const store = transaction.objectStore('visitas');
      const index = store.index('sincronizada');
      const request = index.getAll(false);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async markVisitaSincronizada(id) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['visitas'], 'readwrite')
      const store = tx.objectStore('visitas')
      const req = store.get(id)
      req.onsuccess = () => {
        const v = req.result
        if (v) {
          v.sincronizada = true
          const putReq = store.put(v)
          putReq.onsuccess = () => resolve()
          putReq.onerror = () => reject(putReq.error)
        } else {
          resolve()
        }
      }
      req.onerror = () => reject(req.error)
    })
  }

  // ============== FOTOS METHODS ==============

  /**
   * Save a single foto
   * @param {object} foto - Foto object with visita_id, tipo, ruta_archivo, etc.
   * @returns {Promise<number>} The foto id
   */
  saveFoto(foto) {
    return this.set('fotos', foto);
  }

  /**
   * Retrieve all fotos for a given visita
   * @param {number} visitaId - The visita id
   * @returns {Promise<array>} Array of foto objects for this visita
   */
  async getFotosByVisita(visitaId) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['fotos'], 'readonly');
      const store = transaction.objectStore('fotos');
      const index = store.index('visita_id');
      const request = index.getAll(visitaId);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }
}

// Export single instance
const storageService = new StorageService();
export default storageService;
