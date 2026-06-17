import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Seed script for PILETERO database
 * Populates database with test clients for development and testing
 * Run: node backend/db/seed.js
 */

// Initialize SQLite database
const dbPath = join(__dirname, '..', 'piletero.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
    process.exit(1);
  }
  console.log('Connected to SQLite database at:', dbPath);
});

// Initialize database schema
const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema, (err) => {
  if (err) {
    console.error('Error initializing database schema:', err);
    process.exit(1);
  }
  console.log('Database schema initialized');
});

/**
 * Promise wrapper for db.run
 */
function execute(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

/**
 * Get client by ID (for verification)
 */
function getClienteById(id) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM clientes WHERE id = ?', [id], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

/**
 * Create a new client
 */
async function createCliente(data) {
  const {
    nombre,
    direccion,
    telefono,
    volumen_litros,
    tipo_construccion,
    equipamiento,
    modelo_filtro,
    tipo_abono,
    precio_abono,
    dias_visita,
    notas_acceso
  } = data;

  const sql = `
    INSERT INTO clientes (
      nombre, direccion, telefono, volumen_litros, tipo_construccion,
      equipamiento, modelo_filtro, tipo_abono, precio_abono,
      dias_visita, notas_acceso
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const params = [
    nombre,
    direccion || null,
    telefono || null,
    volumen_litros || null,
    tipo_construccion || null,
    equipamiento || null,
    modelo_filtro || null,
    tipo_abono || null,
    precio_abono || null,
    dias_visita || null,
    notas_acceso || null
  ];

  const result = await execute(sql, params);
  return getClienteById(result.lastID);
}

/**
 * Test clients data
 */
const testClientes = [
  {
    nombre: 'Juan Martínez',
    direccion: 'Av. Principal 123',
    telefono: '1234567890',
    volumen_litros: 50000,
    tipo_construccion: 'fibra',
    equipamiento: 'con_filtro',
    modelo_filtro: 'Hayward',
    tipo_abono: 'mano_de_obra',
    precio_abono: 5000,
    dias_visita: 'Lunes, Miércoles, Viernes',
    notas_acceso: 'Entrar por portón lateral'
  },
  {
    nombre: 'María López',
    direccion: 'Calle 7 456',
    telefono: '0987654321',
    volumen_litros: 40000,
    tipo_construccion: 'material',
    equipamiento: 'con_filtro',
    modelo_filtro: 'Pentair',
    tipo_abono: 'todo_incluido',
    precio_abono: 8000,
    dias_visita: 'Martes, Jueves',
    notas_acceso: 'Cuidado con el perro'
  },
  {
    nombre: 'Carlos Rodríguez',
    direccion: 'Barrio Norte 789',
    telefono: '1122334455',
    volumen_litros: 60000,
    tipo_construccion: 'pintada',
    equipamiento: 'sin_filtro',
    modelo_filtro: null,
    tipo_abono: 'mano_de_obra',
    precio_abono: 4500,
    dias_visita: 'Miércoles, Sábado',
    notas_acceso: 'Llamar antes de entrar'
  }
];

/**
 * Main seed function
 */
async function seed() {
  try {
    console.log('\n=== PILETERO Database Seeding ===\n');

    let createdCount = 0;

    for (const cliente of testClientes) {
      const created = await createCliente(cliente);
      console.log(`✓ Created cliente: ${created.nombre} (ID: ${created.id})`);
      createdCount++;
    }

    console.log(`\n✓ Seed data loaded successfully`);
    console.log(`✓ Total clients created: ${createdCount}`);
    console.log('\n=== Seeding Complete ===\n');

    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err);
        process.exit(1);
      }
      process.exit(0);
    });
  } catch (error) {
    console.error('\n✗ Error during seeding:', error.message);
    console.error(error);
    db.close();
    process.exit(1);
  }
}

// Run seed
seed();
