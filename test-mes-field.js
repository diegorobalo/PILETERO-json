/**
 * Test for Mes field in Recibos (v1.2.1)
 * Tests:
 * 1. Create pago with mes field
 * 2. Retrieve pago and verify mes is stored
 * 3. Update pago with mes field
 */

import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, 'backend', 'piletero.db');
const db = new sqlite3.Database(dbPath);

function queryOne(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function execute(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

async function runTests() {
  try {
    console.log('Starting Mes Field Tests...\n');

    // Test 1: Check if mes column exists
    console.log('Test 1: Checking if mes column exists in pagos table...');
    const tableInfo = await queryOne("PRAGMA table_info(pagos)");
    const hasColumn = await new Promise((resolve, reject) => {
      db.all("PRAGMA table_info(pagos)", (err, rows) => {
        if (err) reject(err);
        resolve(rows.some(r => r.name === 'mes'));
      });
    });

    if (hasColumn) {
      console.log('✓ mes column exists in pagos table\n');
    } else {
      console.log('✗ mes column NOT found in pagos table\n');
      console.log('Run migrations first: ALTER TABLE pagos ADD COLUMN mes VARCHAR(20) DEFAULT NULL\n');
    }

    // Test 2: Insert pago with mes
    console.log('Test 2: Creating pago with mes field...');
    const result = await execute(
      'INSERT INTO pagos (cliente_id, monto, fecha, metodo_pago, estado, mes) VALUES (?, ?, ?, ?, ?, ?)',
      [1, 5000, '2025-06-30', 'efectivo', 'pagado', 'Junio']
    );
    const pagoId = result.lastID;
    console.log(`✓ Created pago with ID ${pagoId}\n`);

    // Test 3: Retrieve and verify mes field
    console.log('Test 3: Retrieving pago and verifying mes field...');
    const pago = await queryOne('SELECT * FROM pagos WHERE id = ?', [pagoId]);
    if (pago) {
      console.log('✓ Pago retrieved:');
      console.log(`  ID: ${pago.id}`);
      console.log(`  Monto: $${pago.monto}`);
      console.log(`  Fecha: ${pago.fecha}`);
      console.log(`  Mes: ${pago.mes || '(no specified)'}`);
      console.log(`  Estado: ${pago.estado}\n`);

      if (pago.mes === 'Junio') {
        console.log('✓ Mes field correctly stored!\n');
      } else {
        console.log('✗ Mes field NOT correctly stored!\n');
      }
    } else {
      console.log('✗ Failed to retrieve pago\n');
    }

    // Test 4: Update pago mes field
    console.log('Test 4: Updating pago mes field...');
    await execute('UPDATE pagos SET mes = ? WHERE id = ?', ['Julio', pagoId]);
    const updatedPago = await queryOne('SELECT * FROM pagos WHERE id = ?', [pagoId]);
    if (updatedPago.mes === 'Julio') {
      console.log('✓ Mes field successfully updated to "Julio"\n');
    } else {
      console.log('✗ Failed to update mes field\n');
    }

    // Test 5: Create pago without mes (should work with NULL)
    console.log('Test 5: Creating pago without mes field (should be NULL)...');
    const result2 = await execute(
      'INSERT INTO pagos (cliente_id, monto, fecha, metodo_pago, estado) VALUES (?, ?, ?, ?, ?)',
      [2, 3000, '2025-06-25', 'transferencia', 'pagado']
    );
    const pago2 = await queryOne('SELECT * FROM pagos WHERE id = ?', [result2.lastID]);
    if (pago2.mes === null) {
      console.log('✓ Pago created without mes field (NULL as expected)\n');
    } else {
      console.log('✗ Mes field should be NULL\n');
    }

    // Cleanup
    console.log('Test 6: Cleanup (deleting test pagos)...');
    await execute('DELETE FROM pagos WHERE id = ?', [pagoId]);
    await execute('DELETE FROM pagos WHERE id = ?', [result2.lastID]);
    console.log('✓ Test records deleted\n');

    console.log('All tests completed successfully!');
  } catch (error) {
    console.error('Error during tests:', error.message);
    process.exit(1);
  } finally {
    db.close();
  }
}

runTests();
