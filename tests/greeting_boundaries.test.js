/**
 * Comprehensive Boundary and Regression Tests for Time-Based Greetings
 * Verifies exact 24-hour boundary transitions and name formatting rules
 * for the Unified Assessment Platform (UAP).
 */

const assert = require('assert');

// Greeting module transpiled / imported
// We can define the test logic matching frontend/src/utils/greeting.js directly
// or load it via simple node require if CommonJS, or define equivalent.
// Since frontend uses ES modules, let's test the logic identically and also import dynamically.

async function runGreetingTests() {
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      passed++;
      console.log(`  ✓ ${name}`);
    } catch (err) {
      failed++;
      console.error(`  ✗ ${name}:`, err.message);
    }
  }

  console.log('\n--- UAP Dynamic Greeting Boundary Verification ---\n');

  // Dynamic import of ES Module
  const greetingModule = await import('../frontend/src/utils/greeting.js');
  const { getTimeOfDay, getTimeBasedGreeting } = greetingModule;

  // Helper to build a Date at specified hour and minute
  function makeDate(hours, minutes, seconds = 0) {
    const d = new Date(2026, 9, 13, hours, minutes, seconds);
    return d;
  }

  // 1. Time boundary tests
  test('00:00 (Midnight) should be evening', () => {
    assert.strictEqual(getTimeOfDay(makeDate(0, 0)), 'evening');
    assert.strictEqual(getTimeBasedGreeting('Admin', makeDate(0, 0)), 'Good evening, Admin 👋');
  });

  test('04:59:59 (Last second before morning) should be evening', () => {
    assert.strictEqual(getTimeOfDay(makeDate(4, 59, 59)), 'evening');
    assert.strictEqual(getTimeBasedGreeting('Admin', makeDate(4, 59, 59)), 'Good evening, Admin 👋');
  });

  test('05:00:00 (Morning boundary start) should be morning', () => {
    assert.strictEqual(getTimeOfDay(makeDate(5, 0, 0)), 'morning');
    assert.strictEqual(getTimeBasedGreeting('Admin', makeDate(5, 0, 0)), 'Good morning, Admin 👋');
  });

  test('08:30:00 (Mid-morning) should be morning', () => {
    assert.strictEqual(getTimeOfDay(makeDate(8, 30)), 'morning');
    assert.strictEqual(getTimeBasedGreeting('Admin', makeDate(8, 30)), 'Good morning, Admin 👋');
  });

  test('11:59:59 (Last second before afternoon) should be morning', () => {
    assert.strictEqual(getTimeOfDay(makeDate(11, 59, 59)), 'morning');
    assert.strictEqual(getTimeBasedGreeting('Admin', makeDate(11, 59, 59)), 'Good morning, Admin 👋');
  });

  test('12:00:00 (Noon / Afternoon boundary start) should be afternoon', () => {
    assert.strictEqual(getTimeOfDay(makeDate(12, 0, 0)), 'afternoon');
    assert.strictEqual(getTimeBasedGreeting('Admin', makeDate(12, 0, 0)), 'Good afternoon, Admin 👋');
  });

  test('14:45:00 (Mid-afternoon) should be afternoon', () => {
    assert.strictEqual(getTimeOfDay(makeDate(14, 45)), 'afternoon');
    assert.strictEqual(getTimeBasedGreeting('Admin', makeDate(14, 45)), 'Good afternoon, Admin 👋');
  });

  test('16:59:59 (Last second before evening) should be afternoon', () => {
    assert.strictEqual(getTimeOfDay(makeDate(16, 59, 59)), 'afternoon');
    assert.strictEqual(getTimeBasedGreeting('Admin', makeDate(16, 59, 59)), 'Good afternoon, Admin 👋');
  });

  test('17:00:00 (Evening boundary start) should be evening', () => {
    assert.strictEqual(getTimeOfDay(makeDate(17, 0, 0)), 'evening');
    assert.strictEqual(getTimeBasedGreeting('Admin', makeDate(17, 0, 0)), 'Good evening, Admin 👋');
  });

  test('20:00:00 (Mid-evening) should be evening', () => {
    assert.strictEqual(getTimeOfDay(makeDate(20, 0)), 'evening');
    assert.strictEqual(getTimeBasedGreeting('Admin', makeDate(20, 0)), 'Good evening, Admin 👋');
  });

  test('23:59:59 (Final second of the day) should be evening', () => {
    assert.strictEqual(getTimeOfDay(makeDate(23, 59, 59)), 'evening');
    assert.strictEqual(getTimeBasedGreeting('Admin', makeDate(23, 59, 59)), 'Good evening, Admin 👋');
  });

  // 2. Name formatting and edge cases
  test('Null user name yields greeting without comma', () => {
    assert.strictEqual(getTimeBasedGreeting(null, makeDate(9, 0)), 'Good morning 👋');
  });

  test('Undefined user name yields greeting without comma', () => {
    assert.strictEqual(getTimeBasedGreeting(undefined, makeDate(14, 0)), 'Good afternoon 👋');
  });

  test('Empty string user name yields greeting without comma', () => {
    assert.strictEqual(getTimeBasedGreeting('', makeDate(19, 0)), 'Good evening 👋');
  });

  test('Whitespace-only user name yields greeting without comma', () => {
    assert.strictEqual(getTimeBasedGreeting('     ', makeDate(9, 0)), 'Good morning 👋');
  });

  test('Non-string user name (number/object) yields greeting without comma', () => {
    assert.strictEqual(getTimeBasedGreeting(12345, makeDate(14, 0)), 'Good afternoon 👋');
    assert.strictEqual(getTimeBasedGreeting({}, makeDate(19, 0)), 'Good evening 👋');
  });

  test('Leading and trailing whitespace in name is properly trimmed', () => {
    assert.strictEqual(getTimeBasedGreeting('  Prof. Charles Xavier  ', makeDate(10, 0)), 'Good morning, Prof. Charles Xavier 👋');
  });

  test('Accepts ISO date string parameter safely', () => {
    const isoMorning = '2026-10-13T09:30:00';
    assert.strictEqual(getTimeOfDay(isoMorning), 'morning');
  });

  test('Accepts numeric timestamp safely', () => {
    const timestamp = makeDate(15, 30).getTime();
    assert.strictEqual(getTimeOfDay(timestamp), 'afternoon');
  });

  test('Invalid date safely falls back without throwing error', () => {
    const fallback = getTimeOfDay('invalid-date-string');
    assert(['morning', 'afternoon', 'evening'].includes(fallback));
  });

  console.log(`\nGreeting Tests completed: ${passed} passed, ${failed} failed.\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runGreetingTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
