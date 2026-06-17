/**
 * API Client Service Tests
 * Tests the axios instance configuration and apiClient methods
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { apiClient } from './api.js';

describe('apiClient', () => {
  // Test health endpoint
  it('should have a health method', () => {
    expect(apiClient.health).toBeDefined();
    expect(typeof apiClient.health).toBe('function');
  });

  // Test clientes endpoints exist
  it('should have getClientes method', () => {
    expect(apiClient.getClientes).toBeDefined();
    expect(typeof apiClient.getClientes).toBe('function');
  });

  it('should have getCliente method', () => {
    expect(apiClient.getCliente).toBeDefined();
    expect(typeof apiClient.getCliente).toBe('function');
  });

  it('should have createCliente method', () => {
    expect(apiClient.createCliente).toBeDefined();
    expect(typeof apiClient.createCliente).toBe('function');
  });

  it('should have updateCliente method', () => {
    expect(apiClient.updateCliente).toBeDefined();
    expect(typeof apiClient.updateCliente).toBe('function');
  });

  // Test visitas endpoints exist
  it('should have getVisitasByFecha method', () => {
    expect(apiClient.getVisitasByFecha).toBeDefined();
    expect(typeof apiClient.getVisitasByFecha).toBe('function');
  });

  it('should have getVisitasByCliente method', () => {
    expect(apiClient.getVisitasByCliente).toBeDefined();
    expect(typeof apiClient.getVisitasByCliente).toBe('function');
  });

  it('should have createVisita method', () => {
    expect(apiClient.createVisita).toBeDefined();
    expect(typeof apiClient.createVisita).toBe('function');
  });

  it('should have updateVisita method', () => {
    expect(apiClient.updateVisita).toBeDefined();
    expect(typeof apiClient.updateVisita).toBe('function');
  });

  // Test pagos endpoints exist
  it('should have createPago method', () => {
    expect(apiClient.createPago).toBeDefined();
    expect(typeof apiClient.createPago).toBe('function');
  });

  it('should have getPagosByCliente method', () => {
    expect(apiClient.getPagosByCliente).toBeDefined();
    expect(typeof apiClient.getPagosByCliente).toBe('function');
  });
});
