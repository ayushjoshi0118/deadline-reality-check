/**
 * Test Runner for Deadline Reality Check
 * Runs all unit test suites and exits with code 0 on success or 1 on failure.
 */
const { getSummary } = require('./test-helper.js');

console.log('\x1b[1m\x1b[36m====================================================');
console.log('  Deadline Reality Check - Test Suite Execution');
console.log('====================================================\x1b[0m');

// Require test files
require('./date-utils.test.js');
require('./tasks.test.js');
require('./scheduler.test.js');
require('./recommendations.test.js');
require('./storage.test.js');
require('./edge-cases.test.js');
require('./dom-integration.test.js');

const summary = getSummary();

console.log('\n\x1b[1m\x1b[36m====================================================');
console.log('  Test Summary');
console.log('====================================================\x1b[0m');
console.log(`  Passed: \x1b[32m${summary.passed}\x1b[0m`);
console.log(`  Failed: ${summary.failed > 0 ? '\x1b[31m' : '\x1b[32m'}${summary.failed}\x1b[0m`);

if (summary.failed > 0) {
  console.log('\n\x1b[31mFailures details:\x1b[0m');
  summary.failures.forEach((f, i) => {
    console.log(`\n  ${i + 1}) [${f.suite}] ${f.test}`);
    console.log(`     ${f.error.stack || f.error.message}`);
  });
  process.exit(1);
} else {
  console.log('\n\x1b[1m\x1b[32m✔ ALL TESTS PASSED SUCCESSFULLY!\x1b[0m\n');
  process.exit(0);
}
