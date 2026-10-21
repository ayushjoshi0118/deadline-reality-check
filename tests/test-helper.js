/**
 * Lightweight test assertion helper for Node.js test runner
 */
const assert = require('assert');

let currentSuite = '';
let passed = 0;
let failed = 0;
const failures = [];

function suite(name, fn) {
  currentSuite = name;
  console.log(`\n\x1b[1m\x1b[34m[SUITE] ${name}\x1b[0m`);
  try {
    fn();
  } catch (err) {
    console.error(`\x1b[31mSuite crash in "${name}":\x1b[0m`, err);
    failed++;
    failures.push({ suite: name, test: 'Suite Crash', error: err });
  }
}

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  \x1b[32m✔\x1b[0m ${name}`);
  } catch (err) {
    failed++;
    console.log(`  \x1b[31m✘ ${name}\x1b[0m`);
    console.error(`    \x1b[31mError:\x1b[0m ${err.message}`);
    failures.push({ suite: currentSuite, test: name, error: err });
  }
}

function expect(actual) {
  return {
    toBe(expected) {
      assert.strictEqual(actual, expected);
    },
    toEqual(expected) {
      assert.deepStrictEqual(actual, expected);
    },
    toBeTruthy() {
      assert.ok(actual);
    },
    toBeFalsy() {
      assert.ok(!actual);
    },
    toBeGreaterThan(expected) {
      assert.ok(actual > expected, `Expected ${actual} > ${expected}`);
    },
    toBeGreaterThanOrEqual(expected) {
      assert.ok(actual >= expected, `Expected ${actual} >= ${expected}`);
    },
    toBeLessThan(expected) {
      assert.ok(actual < expected, `Expected ${actual} < ${expected}`);
    },
    toContain(expected) {
      if (typeof actual === 'string' || Array.isArray(actual)) {
        assert.ok(actual.includes(expected), `Expected ${JSON.stringify(actual)} to contain ${JSON.stringify(expected)}`);
      } else {
        throw new Error('toContain requires string or array');
      }
    },
    toThrow(regexOrMsg) {
      assert.throws(actual, regexOrMsg);
    }
  };
}

function getSummary() {
  return { passed, failed, failures };
}

module.exports = {
  suite,
  test,
  expect,
  getSummary
};
