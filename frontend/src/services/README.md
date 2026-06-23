# Frontend Services

## StorageService (storage.js)

The StorageService provides an IndexedDB-based offline storage solution for the PILETERO mobile app, enabling complete offline functionality with automatic sync when reconnected.

### Features

- **Offline-First Storage**: All data stored in browser's IndexedDB
- **Automatic Sync Tracking**: Tracks unsynced items for server synchronization
- **Three Data Stores**: Clientes (clients), Visitas (visits), and Fotos (photos)
- **Promise-Based API**: All operations return Promises for async/await usage

### Database Schema

#### clientes (Clients)
- **keyPath**: `id` (primary key)
- **Index**: `nombre` (client name for search)
- **Fields**: id, nombre, direccion, telefono, volumen_litros, tipo_construccion, equipamiento, modelo_filtro, tipo_abono, precio_abono, dias_visita, notas_acceso, activo

#### visitas (Visits)
- **keyPath**: `id` (autoIncrement)
- **Indexes**: 
  - `cliente_id` (link to client)
  - `fecha` (visit date)
  - `sincronizada` (sync status flag)
- **Fields**: id, cliente_id, fecha, hora_inicio, hora_fin, tareas_realizadas, cloro_ppm, ph, quimicos_usados, observaciones, sincronizada

#### fotos (Photos)
- **keyPath**: `id` (autoIncrement)
- **Index**: `visita_id` (link to visit)
- **Fields**: id, visita_id, tipo, ruta_archivo, uploaded_at

### API Reference

#### Initialization

```javascript
import storageService from './services/storage.js';

// Initialize database on app startup
await storageService.init();
```

#### Clientes Operations

```javascript
// Save a single client
await storageService.saveCliente({
  id: 1,
  nombre: 'Pool Complex',
  direccion: '123 Pool St',
  // ... other fields
});

// Get a single client by ID
const cliente = await storageService.getCliente(1);

// Get all clients
const allClientes = await storageService.getAllClientes();

// Replace all clients (used during server sync)
await storageService.saveAllClientes([
  { id: 1, nombre: 'Client 1' },
  { id: 2, nombre: 'Client 2' }
]);
```

#### Visitas Operations

```javascript
// Save a visit (marked as unsynced by default)
const visitaId = await storageService.saveVisita({
  cliente_id: 1,
  fecha: '2024-01-15',
  hora_inicio: '10:00',
  sincronizada: false,
  // ... other fields
});

// Get a visit by ID
const visita = await storageService.getVisita(visitaId);

// Get all visits
const allVisitas = await storageService.getAllVisitas();

// Get unsynced visits (critical for sync process)
const unsyncedVisitas = await storageService.getUnsynced();
```

#### Fotos Operations

```javascript
// Save a photo for a visit
await storageService.saveFoto({
  visita_id: 1,
  tipo: 'Filtro',
  ruta_archivo: 'img/visita-1-filtro.jpg'
});

// Get all photos for a visit
const fotos = await storageService.getFotosByVisita(visitaId);
```

#### General Operations

```javascript
// Clear all records from a store
await storageService.clear('clientes');

// Delete a specific record
await storageService.delete('clientes', 1);
```

### Typical Mobile Workflow

1. **Offline Entry**: User fills out visit form
   ```javascript
   const visita = { cliente_id: 1, sincronizada: false, ... };
   await storageService.saveVisita(visita);
   ```

2. **Detect WiFi**: Check connection and sync
   ```javascript
   const unsyncedVisitas = await storageService.getUnsynced();
   if (unsyncedVisitas.length > 0) {
     // Send to server
     await api.syncVisitas(unsyncedVisitas);
   }
   ```

3. **Server Response**: Update local clients list
   ```javascript
   const updatedClientes = await api.getClientes();
   await storageService.saveAllClientes(updatedClientes);
   ```

### Testing

The `storage.test.js` file includes comprehensive tests:
- Creating and retrieving data
- Verifying persistence
- Testing the sync queue (getUnsynced)
- Clearing and deleting records

To run tests in a browser environment, load the test file and execute `runTests()`.

### Implementation Notes

- The service is exported as a singleton instance
- All operations are Promise-based (async/await compatible)
- Error handling is delegated to the caller
- Initialize the service once on app startup
- The database structure mirrors the backend SQLite schema from Task 2
