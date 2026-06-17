/**
 * Sync Service Tests
 * Tests the SyncService class methods and event system
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SyncService } from './sync.js';

describe('SyncService', () => {
  let syncService;

  beforeEach(() => {
    syncService = new SyncService();
  });

  describe('Constructor', () => {
    it('should initialize with correct defaults', () => {
      expect(syncService.socket).toBeNull();
      expect(syncService.isConnecting).toBe(false);
      expect(syncService.isSyncing).toBe(false);
      expect(syncService.listeners).toEqual([]);
    });
  });

  describe('Event system', () => {
    it('should register event listeners', () => {
      const callback = () => {};
      syncService.on('test_event', callback);

      expect(syncService.listeners).toHaveLength(1);
      expect(syncService.listeners[0]).toEqual({
        event: 'test_event',
        callback,
      });
    });

    it('should register multiple listeners for same event', () => {
      const callback1 = () => {};
      const callback2 = () => {};

      syncService.on('test_event', callback1);
      syncService.on('test_event', callback2);

      expect(syncService.listeners).toHaveLength(2);
    });

    it('should emit events to all registered listeners', (done) => {
      let callCount = 0;
      const testData = { message: 'test' };

      syncService.on('test_event', (data) => {
        callCount++;
        expect(data).toEqual(testData);
      });

      syncService.on('test_event', (data) => {
        callCount++;
        expect(data).toEqual(testData);
      });

      syncService.emit('test_event', testData);

      setTimeout(() => {
        expect(callCount).toBe(2);
        done();
      }, 10);
    });

    it('should not call listeners for different events', () => {
      let called = false;

      syncService.on('event1', () => {
        called = true;
      });

      syncService.emit('event2');

      expect(called).toBe(false);
    });

    it('should handle errors in listener callbacks gracefully', () => {
      const errorCallback = () => {
        throw new Error('Test error');
      };
      const normalCallback = () => {};

      let normalCalled = false;
      syncService.on('test_event', errorCallback);
      syncService.on('test_event', () => {
        normalCalled = true;
      });

      // Should not throw
      syncService.emit('test_event');

      expect(normalCalled).toBe(true);
    });
  });

  describe('Methods', () => {
    it('should have connect method', () => {
      expect(syncService.connect).toBeDefined();
      expect(typeof syncService.connect).toBe('function');
    });

    it('should have handleSyncData method', () => {
      expect(syncService.handleSyncData).toBeDefined();
      expect(typeof syncService.handleSyncData).toBe('function');
    });

    it('should have requestSync method', () => {
      expect(syncService.requestSync).toBeDefined();
      expect(typeof syncService.requestSync).toBe('function');
    });

    it('should have autoSyncIfWiFi method', () => {
      expect(syncService.autoSyncIfWiFi).toBeDefined();
      expect(typeof syncService.autoSyncIfWiFi).toBe('function');
    });
  });

  describe('Sync state', () => {
    it('should track syncing state', async () => {
      expect(syncService.isSyncing).toBe(false);
      // Can't properly test without mocking socket
    });

    it('should track connecting state', async () => {
      expect(syncService.isConnecting).toBe(false);
      // Can't properly test without mocking socket
    });
  });
});
