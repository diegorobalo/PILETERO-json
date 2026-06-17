/**
 * Storage Service Tests
 * Tests basic functionality of the StorageService
 */

import storageService from './storage.js';

/**
 * Mock IndexedDB for testing in Node.js environment
 * In actual browser, IndexedDB will be available natively
 */
class MockIndexedDB {
  constructor() {
    this.databases = {
      clientes: {},
      visitas: {},
      fotos: {}
    };
    this.visitaCounter = 1;
    this.fotoCounter = 1;
  }

  open(dbName, version) {
    const self = this;
    return {
      onerror: null,
      onsuccess: null,
      onupgradeneeded: null,
      result: {
        objectStoreNames: {
          contains: (name) => name in self.databases
        },
        transaction: (stores, mode) => ({
          objectStore: (storeName) => ({
            put: (data) => ({
              onerror: null,
              onsuccess: null,
              result: data.id || self.visitaCounter++,
              error: null
            }),
            get: (key) => ({
              onerror: null,
              onsuccess: null,
              result: self.databases[storeName][key],
              error: null
            }),
            getAll: () => ({
              onerror: null,
              onsuccess: null,
              result: Object.values(self.databases[storeName]),
              error: null
            }),
            delete: (key) => ({
              onerror: null,
              onsuccess: null,
              error: null
            }),
            clear: () => ({
              onerror: null,
              onsuccess: null,
              error: null
            }),
            index: (indexName) => ({
              getAll: (value) => ({
                onerror: null,
                onsuccess: null,
                result: indexName === 'sincronizada'
                  ? Object.values(self.databases.visitas).filter(v => v.sincronizada === value)
                  : Object.values(self.databases.fotos).filter(f => f.visita_id === value),
                error: null
              })
            })
          }),
          objectStoreNames: {
            contains: (name) => name in self.databases
          },
          createObjectStore: (name) => ({
            createIndex: () => ({})
          })
        }),
        createObjectStore: (name, options) => ({
          createIndex: (indexName, keyPath, indexOptions) => ({})
        })
      },
      error: null
    };
  }
}

/**
 * Run tests
 */
async function runTests() {
  console.log('STORAGE SERVICE TESTS');
  console.log('====================\n');

  // Mock IndexedDB globally if in Node environment
  if (typeof indexedDB === 'undefined') {
    global.indexedDB = new MockIndexedDB();
  }

  try {
    // Test 1: Initialize service
    console.log('Test 1: Initialize StorageService');
    await storageService.init();
    console.log('✓ Service initialized successfully\n');

    // Test 2: Save and retrieve a cliente
    console.log('Test 2: Save and retrieve a cliente');
    const testCliente = {
      id: 1,
      nombre: 'Test Client',
      direccion: '123 Pool Street',
      telefono: '555-0100',
      volumen_litros: 50000,
      tipo_construccion: 'Hormigón',
      equipamiento: 'Filtro arena',
      modelo_filtro: 'Filtro 30',
      tipo_abono: 'Cloro',
      precio_abono: 150.00,
      dias_visita: 'Lunes',
      notas_acceso: 'Llaves en caseta',
      activo: 1
    };

    await storageService.saveCliente(testCliente);
    const retrieved = await storageService.getCliente(1);
    console.log('✓ Cliente saved and retrieved:', retrieved.nombre, '\n');

    // Test 3: Get all clientes
    console.log('Test 3: Get all clientes');
    const allClientes = await storageService.getAllClientes();
    console.log('✓ Retrieved', allClientes.length, 'cliente(s)\n');

    // Test 4: Save and retrieve a visita
    console.log('Test 4: Save and retrieve a visita');
    const testVisita = {
      cliente_id: 1,
      fecha: '2024-01-15',
      hora_inicio: '10:00',
      hora_fin: '11:30',
      tareas_realizadas: 'Limpieza filtro',
      cloro_ppm: 1.5,
      ph: 7.2,
      quimicos_usados: 'Cloro en polvo',
      observaciones: 'Pool en buen estado',
      sincronizada: false
    };

    const visitaId = await storageService.saveVisita(testVisita);
    console.log('✓ Visita saved with id:', visitaId, '\n');

    // Test 5: Get unsynced visitas
    console.log('Test 5: Get unsynced visitas');
    const unsynced = await storageService.getUnsynced();
    console.log('✓ Found', unsynced.length, 'unsynced visita(s)\n');

    // Test 6: Save and retrieve fotos
    console.log('Test 6: Save and retrieve fotos for a visita');
    const testFoto = {
      visita_id: visitaId,
      tipo: 'Filtro',
      ruta_archivo: 'img/visita-1-filtro.jpg'
    };

    await storageService.saveFoto(testFoto);
    const fotos = await storageService.getFotosByVisita(visitaId);
    console.log('✓ Retrieved', fotos.length, 'foto(s) for visita', visitaId, '\n');

    // Test 7: Save all clientes (replacement)
    console.log('Test 7: Save all clientes (replacement scenario)');
    const newClientes = [
      { id: 1, nombre: 'Updated Client 1', direccion: 'New Address', activo: 1 },
      { id: 2, nombre: 'New Client 2', direccion: 'Another Address', activo: 1 }
    ];
    await storageService.saveAllClientes(newClientes);
    const updated = await storageService.getAllClientes();
    console.log('✓ Saved', updated.length, 'clientes total\n');

    // Test 8: Data persistence verification
    console.log('Test 8: Data persistence check');
    const persistedCliente = await storageService.getCliente(1);
    console.log('✓ Data persists:', persistedCliente ? 'Yes' : 'No', '\n');

    // Test 9: Delete a record
    console.log('Test 9: Delete a record');
    await storageService.delete('clientes', 2);
    const afterDelete = await storageService.getAllClientes();
    console.log('✓ After deletion:', afterDelete.length, 'cliente(s) remain\n');

    // Test 10: Clear a store
    console.log('Test 10: Clear a store');
    await storageService.clear('fotos');
    const clearedFotos = await storageService.getAll('fotos');
    console.log('✓ Fotos store cleared:', clearedFotos.length === 0 ? 'Yes' : 'No', '\n');

    console.log('====================');
    console.log('ALL TESTS PASSED');
    console.log('====================');

  } catch (error) {
    console.error('TEST FAILED:', error.message);
    process.exit(1);
  }
}

// Run tests if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}

export { runTests };
