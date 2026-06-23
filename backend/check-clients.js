import sqlite3 from 'sqlite3';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, 'piletero.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
    process.exit(1);
  }

  db.all('SELECT id, nombre, direccion, activo FROM clientes ORDER BY id DESC LIMIT 5', (err, rows) => {
    if (err) {
      console.error('Error querying:', err);
    } else {
      console.log('Clientes in database:');
      rows.forEach(row => {
        console.log(`ID: ${row.id}, Nombre: ${row.nombre}, Direccion: ${row.direccion}, Activo: ${row.activo}`);
      });
    }
    db.close();
    process.exit(0);
  });
});
