const http = require('http');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

console.log('\n' + '='.repeat(80));
console.log('   TEST: TIPO_ABONO FIELD FEATURE');
console.log('='.repeat(80) + '\n');

const testResults = [];
let totalTests = 0;
let totalPassed = 0;

function recordTest(name, result, details) {
  totalTests++;
  if (result) totalPassed++;
  testResults.push({ name, result: result ? 'PASS' : 'FAIL', details });
  const mark = result ? '✓' : '✗';
  console.log(mark + ' ' + name);
  if (details) console.log('    ' + details);
}

async function httpPost(path, body) {
  return new Promise((resolve) => {
    const postData = JSON.stringify(body);
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve({ error: data });
        }
      });
    });
    req.on('error', () => resolve({ error: 'Connection error' }));
    req.write(postData);
    req.end();
  });
}

async function httpPut(path, body) {
  return new Promise((resolve) => {
    const postData = JSON.stringify(body);
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve({ error: data });
        }
      });
    });
    req.on('error', () => resolve({ error: 'Connection error' }));
    req.write(postData);
    req.end();
  });
}

function queryDB(query) {
  return new Promise((resolve) => {
    const db = new sqlite3.Database(path.join(__dirname, 'backend', 'piletero.db'), (err) => {
      if (err) {
        resolve(null);
        return;
      }
      db.all(query, (err, rows) => {
        db.close();
        resolve(rows);
      });
    });
  });
}

async function runAllTests() {
  console.log('TEST 1: CREATE PAGO WITH TIPO_ABONO\n');

  const pagoData = {
    cliente_id: 1,
    monto: 5000,
    fecha: new Date().toISOString().split('T')[0],
    metodo_pago: 'efectivo',
    estado: 'pagado',
    mes: null,
    tipo_abono: 'Mano de obra'
  };

  const pagoResponse = await httpPost('/api/pagos', pagoData);
  recordTest('Pago creation with tipo_abono', pagoResponse.id !== undefined, 'Pago ID: ' + pagoResponse.id);

  const pagoId = pagoResponse.id;

  if (pagoId) {
    recordTest('Tipo_abono field persisted', pagoResponse.tipo_abono === 'Mano de obra',
      'Expected: Mano de obra, Got: ' + pagoResponse.tipo_abono);
  }

  console.log('\nTEST 2: VERIFY IN DATABASE\n');

  if (pagoId) {
    const dbRows = await queryDB('SELECT id, cliente_id, monto, tipo_abono FROM pagos WHERE id = ' + pagoId);
    const savedPago = dbRows && dbRows.length > 0 ? dbRows[0] : null;
    recordTest('Pago saved to database', savedPago !== null, 'Found in SQLite');

    if (savedPago) {
      recordTest('Tipo_abono in database', savedPago.tipo_abono === 'Mano de obra',
        'Database value: ' + savedPago.tipo_abono);
    }
  }

  console.log('\nTEST 3: UPDATE PAGO TIPO_ABONO\n');

  if (pagoId) {
    const updateResponse = await httpPut('/api/pagos/' + pagoId, {
      tipo_abono: 'Todo incluido'
    });

    recordTest('Update pago tipo_abono', updateResponse.pago && updateResponse.pago.tipo_abono === 'Todo incluido',
      'Expected: Todo incluido, Got: ' + (updateResponse.pago ? updateResponse.pago.tipo_abono : 'null'));

    const dbRows = await queryDB('SELECT tipo_abono FROM pagos WHERE id = ' + pagoId);
    const updatedPago = dbRows && dbRows.length > 0 ? dbRows[0] : null;
    recordTest('Updated value in database', updatedPago && updatedPago.tipo_abono === 'Todo incluido',
      'Database value: ' + (updatedPago ? updatedPago.tipo_abono : 'null'));
  }

  console.log('\nTEST 4: NULL TIPO_ABONO\n');

  const pagoNullData = {
    cliente_id: 1,
    monto: 3000,
    fecha: new Date().toISOString().split('T')[0],
    metodo_pago: 'transferencia',
    estado: 'pagado'
  };

  const pagoNullResponse = await httpPost('/api/pagos', pagoNullData);
  recordTest('Pago creation without tipo_abono', pagoNullResponse.id !== undefined, 'Pago ID: ' + pagoNullResponse.id);

  if (pagoNullResponse.id) {
    recordTest('Tipo_abono defaults to null', pagoNullResponse.tipo_abono === null || pagoNullResponse.tipo_abono === undefined,
      'Expected: null, Got: ' + pagoNullResponse.tipo_abono);
  }

  console.log('\nTEST 5: ALL TIPO_ABONO OPTIONS\n');

  const options = ['Mano de obra', 'Todo incluido', 'Eventual', 'Otro'];
  let optionsTestsPassed = 0;

  for (const option of options) {
    const testData = {
      cliente_id: 1,
      monto: 2000 + Math.random() * 1000,
      fecha: new Date().toISOString().split('T')[0],
      metodo_pago: 'efectivo',
      tipo_abono: option
    };

    const testResponse = await httpPost('/api/pagos', testData);
    if (testResponse.id && testResponse.tipo_abono === option) {
      optionsTestsPassed++;
    }
  }

  recordTest('All tipo_abono options work', optionsTestsPassed === options.length,
    'Passed: ' + optionsTestsPassed + '/' + options.length);

  console.log('\n' + '='.repeat(80));
  console.log('   FINAL RESULTS');
  console.log('='.repeat(80) + '\n');

  const percentage = Math.round((totalPassed / totalTests) * 100);
  console.log('Total Tests: ' + totalTests);
  console.log('Passed: ' + totalPassed);
  console.log('Failed: ' + (totalTests - totalPassed));
  console.log('Success Rate: ' + percentage + '%\n');

  if (percentage === 100) {
    console.log('STATUS: DONE');
    console.log('TIPO_ABONO_FEATURE: VERIFIED\n');
  } else {
    console.log('STATUS: FAILED');
    console.log('Some tests did not pass.\n');
  }

  process.exit(percentage === 100 ? 0 : 1);
}

runAllTests().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
