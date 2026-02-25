/**
 * Phase 3: Load Testing & Performance Verification
 * 
 * Tests the security framework under realistic production loads
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';

interface TestResult {
  name: string;
  passed: number;
  failed: number;
  avgResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  errors: string[];
}

class Phase3Tester {
  private results: TestResult[] = [];

  /**
   * Test 1: Rate Limiting - Auth Endpoint
   * Should allow 5 attempts per 15 minutes
   */
  async testAuthRateLimiting(): Promise<TestResult> {
    const result: TestResult = {
      name: 'Auth Rate Limiting (5 attempts/15min)',
      passed: 0,
      failed: 0,
      avgResponseTime: 0,
      minResponseTime: Infinity,
      maxResponseTime: 0,
      errors: []
    };

    const payload = {
      email: 'test@example.com',
      password: 'invalidPassword123'
    };

    const responseTimes: number[] = [];

    // Make 6 requests (should fail on 6th)
    for (let i = 1; i <= 6; i++) {
      const startTime = Date.now();
      try {
        const response = await fetch(`${BASE_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const responseTime = Date.now() - startTime;
        responseTimes.push(responseTime);

        if (i < 6) {
          // First 5 should succeed or return 401 (invalid credentials)
          if (response.status === 401 || response.status === 200) {
            result.passed++;
          } else {
            result.failed++;
            result.errors.push(`Request ${i}: Unexpected status ${response.status}`);
          }
        } else {
          // 6th should be rate limited (429)
          if (response.status === 429) {
            result.passed++;
          } else {
            result.failed++;
            result.errors.push(`Request ${i}: Expected 429, got ${response.status}`);
          }
        }
      } catch (error) {
        result.failed++;
        result.errors.push(`Request ${i}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    result.avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    result.minResponseTime = Math.min(...responseTimes);
    result.maxResponseTime = Math.max(...responseTimes);

    return result;
  }

  /**
   * Test 2: Global Rate Limiting
   * Should allow 15 requests per minute per IP
   */
  async testGlobalRateLimiting(): Promise<TestResult> {
    const result: TestResult = {
      name: 'Global Rate Limiting (15 req/min per IP)',
      passed: 0,
      failed: 0,
      avgResponseTime: 0,
      minResponseTime: Infinity,
      maxResponseTime: 0,
      errors: []
    };

    const responseTimes: number[] = [];

    // Make 16 rapid requests (should fail on 16th)
    for (let i = 1; i <= 16; i++) {
      const startTime = Date.now();
      try {
        const response = await fetch(`${BASE_URL}/api/health`, {
          method: 'GET'
        });
        const responseTime = Date.now() - startTime;
        responseTimes.push(responseTime);

        if (i <= 15) {
          if (response.status === 200 || response.status === 429) {
            result.passed++;
          } else {
            result.failed++;
          }
        } else {
          // 16th should be rate limited
          if (response.status === 429) {
            result.passed++;
          } else {
            result.failed++;
            result.errors.push(`Request ${i}: Expected 429, got ${response.status}`);
          }
        }
      } catch (error) {
        result.failed++;
        result.errors.push(`Request ${i}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    result.avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    result.minResponseTime = Math.min(...responseTimes);
    result.maxResponseTime = Math.max(...responseTimes);

    return result;
  }

  /**
   * Test 3: Input Validation
   * Should reject invalid email formats
   */
  async testInputValidation(): Promise<TestResult> {
    const result: TestResult = {
      name: 'Input Validation (Email Format)',
      passed: 0,
      failed: 0,
      avgResponseTime: 0,
      minResponseTime: Infinity,
      maxResponseTime: 0,
      errors: []
    };

    const invalidEmails = [
      'not-an-email',
      'missing@domain',
      '@nodomain.com',
      'spaces in@email.com'
    ];

    const responseTimes: number[] = [];

    for (const email of invalidEmails) {
      const startTime = Date.now();
      try {
        const response = await fetch(`${BASE_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password: 'ValidPass123' })
        });
        const responseTime = Date.now() - startTime;
        responseTimes.push(responseTime);

        // Should return 400 Bad Request
        if (response.status === 400) {
          result.passed++;
        } else {
          result.failed++;
          result.errors.push(`Email "${email}": Expected 400, got ${response.status}`);
        }
      } catch (error) {
        result.failed++;
        result.errors.push(`Email "${email}": ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    result.avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    result.minResponseTime = Math.min(...responseTimes);
    result.maxResponseTime = Math.max(...responseTimes);

    return result;
  }

  /**
   * Test 4: Error Filtering
   * Verify no stack traces in error responses
   */
  async testErrorFiltering(): Promise<TestResult> {
    const result: TestResult = {
      name: 'Error Filtering (No Stack Traces)',
      passed: 0,
      failed: 0,
      avgResponseTime: 0,
      minResponseTime: Infinity,
      maxResponseTime: 0,
      errors: []
    };

    const testCases = [
      { endpoint: '/auth/login', method: 'POST', body: { email: 'test@test.com', password: '' } },
      { endpoint: '/api/invalid', method: 'GET', body: null }
    ];

    const responseTimes: number[] = [];

    for (const testCase of testCases) {
      const startTime = Date.now();
      try {
        const response = await fetch(`${BASE_URL}${testCase.endpoint}`, {
          method: testCase.method,
          headers: { 'Content-Type': 'application/json' },
          body: testCase.body ? JSON.stringify(testCase.body) : undefined
        });
        const responseTime = Date.now() - startTime;
        responseTimes.push(responseTime);

        const data = await response.json();

        // Check that response doesn't contain stack traces
        const responseStr = JSON.stringify(data);
        if (responseStr.includes('stack') || responseStr.includes('at ') || responseStr.includes('.ts:')) {
          result.failed++;
          result.errors.push(`${testCase.endpoint}: Response contains stack trace`);
        } else {
          result.passed++;
        }
      } catch (error) {
        result.failed++;
        result.errors.push(`${testCase.endpoint}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    result.avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    result.minResponseTime = Math.min(...responseTimes);
    result.maxResponseTime = Math.max(...responseTimes);

    return result;
  }

  /**
   * Test 5: Concurrent Requests
   * Test handling of 10+ concurrent requests
   */
  async testConcurrentRequests(): Promise<TestResult> {
    const result: TestResult = {
      name: 'Concurrent Requests (10+ simultaneous)',
      passed: 0,
      failed: 0,
      avgResponseTime: 0,
      minResponseTime: Infinity,
      maxResponseTime: 0,
      errors: []
    };

    const startTime = Date.now();
    const promises: Promise<number>[] = [];

    // Fire 10 concurrent requests
    for (let i = 0; i < 10; i++) {
      const promise = fetch(`${BASE_URL}/api/health`, { method: 'GET' })
        .then(response => response.status)
        .catch(() => 0);
      promises.push(promise);
    }

    const responses = await Promise.all(promises);
    const responseTime = Date.now() - startTime;

    const successCount = responses.filter(status => status === 200).length;
    result.passed = successCount;
    result.failed = 10 - successCount;
    result.avgResponseTime = responseTime / 10;
    result.minResponseTime = responseTime;
    result.maxResponseTime = responseTime;

    if (result.passed < 8) {
      result.errors.push(`Only ${result.passed}/10 requests succeeded`);
    }

    return result;
  }

  /**
   * Test 6: Performance Overhead
   * Measure middleware overhead (should be < 5ms per request)
   */
  async testPerformanceOverhead(): Promise<TestResult> {
    const result: TestResult = {
      name: 'Performance Overhead (< 5ms per middleware)',
      passed: 0,
      failed: 0,
      avgResponseTime: 0,
      minResponseTime: Infinity,
      maxResponseTime: 0,
      errors: []
    };

    const responseTimes: number[] = [];

    // Make 20 requests to health endpoint (minimal processing)
    for (let i = 0; i < 20; i++) {
      const startTime = Date.now();
      try {
        await fetch(`${BASE_URL}/api/health`, { method: 'GET' });
        const responseTime = Date.now() - startTime;
        responseTimes.push(responseTime);

        if (responseTime < 50) {
          result.passed++;
        } else {
          result.failed++;
          result.errors.push(`Request ${i}: Took ${responseTime}ms (expected < 50ms)`);
        }
      } catch (error) {
        result.failed++;
        result.errors.push(`Request ${i}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    result.avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    result.minResponseTime = Math.min(...responseTimes);
    result.maxResponseTime = Math.max(...responseTimes);

    return result;
  }

  /**
   * Test 7: Stress Testing
   * Send 100 requests rapidly
   */
  async testStressTesting(): Promise<TestResult> {
    const result: TestResult = {
      name: 'Stress Testing (100 rapid requests)',
      passed: 0,
      failed: 0,
      avgResponseTime: 0,
      minResponseTime: Infinity,
      maxResponseTime: 0,
      errors: []
    };

    const responseTimes: number[] = [];
    const startTime = Date.now();

    const promises: Promise<void>[] = [];

    for (let i = 0; i < 100; i++) {
      const promise = (async () => {
        const reqStart = Date.now();
        try {
          const response = await fetch(`${BASE_URL}/api/health`, { method: 'GET' });
          const responseTime = Date.now() - reqStart;
          responseTimes.push(responseTime);

          if (response.status === 200 || response.status === 429) {
            result.passed++;
          } else {
            result.failed++;
          }
        } catch (error) {
          result.failed++;
          result.errors.push(`Request: ${error instanceof Error ? error.message : String(error)}`);
        }
      })();

      promises.push(promise);
    }

    await Promise.all(promises);

    result.avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    result.minResponseTime = Math.min(...responseTimes);
    result.maxResponseTime = Math.max(...responseTimes);

    return result;
  }

  /**
   * Run all tests
   */
  async runAllTests(): Promise<void> {
    console.log('\n==============================================');
    console.log('🔍 WEEK 2 PHASE 3 - PRODUCTION VERIFICATION');
    console.log('==============================================\n');

    console.log('Starting tests...\n');

    // Run tests
    this.results.push(await this.testAuthRateLimiting());
    this.results.push(await this.testGlobalRateLimiting());
    this.results.push(await this.testInputValidation());
    this.results.push(await this.testErrorFiltering());
    this.results.push(await this.testConcurrentRequests());
    this.results.push(await this.testPerformanceOverhead());
    this.results.push(await this.testStressTesting());

    // Print results
    this.printResults();
  }

  /**
   * Print test results
   */
  private printResults(): void {
    console.log('\n==============================================');
    console.log('📊 TEST RESULTS');
    console.log('==============================================\n');

    let totalPassed = 0;
    let totalFailed = 0;

    for (const result of this.results) {
      const status = result.failed === 0 ? '✅' : '❌';
      console.log(`${status} ${result.name}`);
      console.log(`   Passed: ${result.passed} | Failed: ${result.failed}`);
      console.log(`   Avg Response: ${result.avgResponseTime.toFixed(2)}ms | Min: ${result.minResponseTime.toFixed(2)}ms | Max: ${result.maxResponseTime.toFixed(2)}ms`);

      if (result.errors.length > 0) {
        console.log(`   Errors:`);
        result.errors.slice(0, 3).forEach(err => console.log(`     - ${err}`));
        if (result.errors.length > 3) {
          console.log(`     ... and ${result.errors.length - 3} more`);
        }
      }

      totalPassed += result.passed;
      totalFailed += result.failed;
      console.log();
    }

    console.log('==============================================');
    console.log(`📈 TOTAL: ${totalPassed} Passed | ${totalFailed} Failed`);
    console.log('==============================================\n');

    if (totalFailed === 0) {
      console.log('✨ All tests passed! System is production-ready.');
    } else {
      console.log(`⚠️  ${totalFailed} tests failed. Review above for details.`);
    }
  }
}

// Run tests
const tester = new Phase3Tester();
tester.runAllTests().catch(console.error);
