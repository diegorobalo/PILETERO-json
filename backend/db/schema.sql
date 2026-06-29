-- PILETERO Database Schema
-- Pool maintenance registration and management system

-- Clients table
CREATE TABLE IF NOT EXISTS clientes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  direccion TEXT,
  telefono TEXT,
  volumen_litros INTEGER,
  tipo_construccion TEXT,
  equipamiento TEXT,
  modelo_filtro TEXT,
  tipo_abono TEXT,
  precio_abono REAL,
  dias_visita TEXT,
  frecuencia_visita TEXT DEFAULT 'semanal',
  grupo_semana TEXT DEFAULT 'A',
  notas_acceso TEXT,
  activo BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Visits table
CREATE TABLE IF NOT EXISTS visitas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_id INTEGER NOT NULL,
  fecha DATE NOT NULL,
  hora_inicio TIME,
  hora_fin TIME,
  tareas_realizadas TEXT,
  cloro_ppm REAL,
  ph REAL,
  quimicos_usados TEXT,
  observaciones TEXT,
  sincronizada BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
);

-- Photos table
CREATE TABLE IF NOT EXISTS fotos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  visita_id INTEGER NOT NULL,
  tipo TEXT,
  ruta_archivo TEXT NOT NULL,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (visita_id) REFERENCES visitas(id) ON DELETE CASCADE
);

-- Payments table
CREATE TABLE IF NOT EXISTS pagos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_id INTEGER NOT NULL,
  monto REAL NOT NULL,
  fecha DATE NOT NULL,
  estado TEXT DEFAULT 'pendiente',
  metodo_pago TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
);

-- Inventory/Stock table
CREATE TABLE IF NOT EXISTS inventario (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  unidad TEXT NOT NULL DEFAULT 'g',
  stock_actual REAL NOT NULL DEFAULT 0,
  stock_minimo REAL NOT NULL DEFAULT 0,
  precio_unitario REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Client reference photos table
CREATE TABLE IF NOT EXISTS fotos_clientes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_id INTEGER NOT NULL,
  tipo TEXT,
  ruta_archivo TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
);

-- Create indexes on commonly queried fields
CREATE INDEX IF NOT EXISTS idx_visitas_cliente_id ON visitas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_visitas_fecha ON visitas(fecha);
CREATE INDEX IF NOT EXISTS idx_visitas_sincronizada ON visitas(sincronizada);
CREATE INDEX IF NOT EXISTS idx_fotos_visita_id ON fotos(visita_id);
CREATE INDEX IF NOT EXISTS idx_pagos_cliente_id ON pagos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_fotos_clientes_cliente_id ON fotos_clientes(cliente_id);
CREATE INDEX IF NOT EXISTS idx_pagos_fecha ON pagos(fecha);
CREATE INDEX IF NOT EXISTS idx_clientes_activo ON clientes(activo);

-- Migration: Add estado column for client suspension feature (v1.1)
ALTER TABLE clientes ADD COLUMN estado TEXT DEFAULT 'activo';
CREATE INDEX IF NOT EXISTS idx_clientes_estado ON clientes(estado);
