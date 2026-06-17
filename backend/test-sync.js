import { io as ioClient } from 'socket.io-client';

/**
 * Test script for sync service Socket.io events
 * Connects to the server and tests each sync event
 */

const socket = ioClient('http://localhost:3000');

socket.on('connect', () => {
  console.log('[CLIENT] Connected to server:', socket.id);
  console.log('\n=== TESTING SYNC EVENTS ===\n');

  // Test 1: sync:request (get client data)
  console.log('TEST 1: Sending sync:request');
  socket.emit('sync:request', {});

  socket.on('sync:data', (data) => {
    console.log('✓ Received sync:data');
    console.log('  Success:', data.success);
    console.log('  Clients received:', data.clientes?.length || 0);
    console.log('  Timestamp:', data.timestamp);
    console.log('');

    // Test 2: sync:visitas (send visit data)
    console.log('TEST 2: Sending sync:visitas with test data');

    // Create test visit (simulating what mobile would send)
    const testVisita = {
      cliente_id: 1,
      fecha: '2025-06-17',
      hora_inicio: '10:00',
      hora_fin: '10:30',
      tareas_realizadas: JSON.stringify(['Limpiar filtro', 'Vacuuming']),
      cloro_ppm: 1.5,
      ph: 7.2,
      quimicos_usados: JSON.stringify(['Cloro']),
      observaciones: 'Test visit from Socket.io',
      sincronizada: 0
    };

    socket.emit('sync:visitas', { visitas: [testVisita] });
  });

  socket.on('sync:visitas:ack', (data) => {
    console.log('✓ Received sync:visitas:ack');
    console.log('  Success:', data.success);
    console.log('  Results:', JSON.stringify(data.results, null, 2));
    console.log('');

    // Test 3: debug:unsynced (check unsynced visits)
    console.log('TEST 3: Sending debug:unsynced');
    socket.emit('debug:unsynced', {});
  });

  socket.on('debug:unsynced:response', (data) => {
    console.log('✓ Received debug:unsynced:response');
    console.log('  Success:', data.success);
    console.log('  Unsynced count:', data.count);
    console.log('  First unsynced visit:', data.unsynced[0] ? `ID: ${data.unsynced[0].id}` : 'None');
    console.log('');

    // Test 4: sync:photos (placeholder test)
    console.log('TEST 4: Sending sync:photos');
    socket.emit('sync:photos', { photos: [] });
  });

  socket.on('sync:photos:ack', (data) => {
    console.log('✓ Received sync:photos:ack');
    console.log('  Success:', data.success);
    console.log('  Message:', data.message);
    console.log('');

    console.log('=== ALL TESTS COMPLETED ===\n');
    socket.disconnect();
  });

  socket.on('sync:error', (error) => {
    console.error('✗ Received sync:error');
    console.error('  Error:', error.error);
    socket.disconnect();
  });
});

socket.on('connect_error', (error) => {
  console.error('[ERROR] Connection failed:', error.message);
  process.exit(1);
});

socket.on('disconnect', () => {
  console.log('[CLIENT] Disconnected from server');
  process.exit(0);
});

// Timeout after 10 seconds
setTimeout(() => {
  console.error('\n[TIMEOUT] Test did not complete within 10 seconds');
  socket.disconnect();
  process.exit(1);
}, 10000);
