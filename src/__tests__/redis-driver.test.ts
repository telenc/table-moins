import { RedisDriver } from '../database/drivers/redis-driver';
import { DriverFactory } from '../database/drivers/driver-factory';
import { DatabaseConnection } from '../shared/types/database';

describe('RedisDriver', () => {
  const mockRedisConnection: DatabaseConnection = {
    id: 'test-redis',
    name: 'Test Redis',
    type: 'redis',
    host: 'localhost',
    port: 6379,
    username: '',
    password: '',
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: true
  };

  test('should create RedisDriver instance', () => {
    const driver = new RedisDriver(mockRedisConnection);
    expect(driver).toBeInstanceOf(RedisDriver);
    expect(driver.getConnectionInfo().type).toBe('redis');
  });

  test('should be supported by DriverFactory', () => {
    expect(DriverFactory.isSupported('redis')).toBe(true);
    expect(DriverFactory.getSupportedTypes()).toContain('redis');
  });

  test('should create RedisDriver via DriverFactory', () => {
    const driver = DriverFactory.createDriver(mockRedisConnection);
    expect(driver).toBeInstanceOf(RedisDriver);
  });

  test('should have proper connection info', () => {
    const driver = new RedisDriver(mockRedisConnection);
    const info = driver.getConnectionInfo();
    
    expect(info.type).toBe('redis');
    expect(info.host).toBe('localhost');
    expect(info.port).toBe(6379);
    expect(info.name).toBe('Test Redis');
  });

  test('should not be connected initially', () => {
    const driver = new RedisDriver(mockRedisConnection);
    expect(driver.isConnectionActive()).toBe(false);
  });

  // Note: Integration tests requiring actual Redis instance would go in separate test suite
});

describe('Redis Type System', () => {
  test('should include redis in DatabaseType', () => {
    const types = DriverFactory.getSupportedTypes();
    expect(types).toContain('redis');
    expect(types).toContain('postgresql');
    expect(types).toContain('mysql');
  });
});