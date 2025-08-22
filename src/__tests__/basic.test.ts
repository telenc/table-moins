/**
 * Basic test to ensure Jest is working
 * and GitHub Actions can pass
 */

describe('TableMoins Basic Tests', () => {
  test('should pass basic test', () => {
    expect(true).toBe(true);
  });

  test('should have proper environment', () => {
    expect(process.env.NODE_ENV).toBeDefined();
  });

  test('should handle basic math operations', () => {
    // Simple test to ensure Jest is working properly
    expect(2 + 2).toBe(4);
    expect(10 / 2).toBe(5);
  });
});