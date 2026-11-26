const test = require('node:test');
const assert = require('node:assert/strict');
const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require('@firebase/rules-unit-testing');
const fs = require('node:fs');

const rules = fs.readFileSync('firebase.database.rules.json', 'utf8');

async function setup() {
  return initializeTestEnvironment({
    projectId: 'demo-wadi-bina',
    database: { rules },
  });
}

test('canonical branches are readable only within the verified profile scope', async () => {
  const env = await setup();
  await env.withSecurityRulesDisabled(async context => {
    await context.database().ref('users/bm').set({
      active: true, role: 'branch_manager', branchId: 'ajman',
    });
  });
  const bm = env.authenticatedContext('bm', { role: 'branch_manager', branchId: 'ajman', username: 'manager-ajman' });
  await assertSucceeds(bm.database().ref('branches/ajman/staff/employees').get());
  await assertFails(bm.database().ref('branches/aden/staff/employees').get());
  await env.clearDatabase();
  await env.cleanup();
});

test('branch accountant cannot write another branch payroll', async () => {
  const env = await setup();
  await env.withSecurityRulesDisabled(async context => {
    await context.database().ref('users/ba').set({
      active: true, role: 'branch_accountant', branchId: 'ajman',
    });
  });
  const ba = env.authenticatedContext('ba', { role: 'branch_accountant', branchId: 'ajman', username: 'accountant-ajman' });
  await assertSucceeds(ba.database().ref('branches/ajman/finance/payroll/emp-1').set({
    branchId: 'ajman', createdByUid: 'ba', baseRate: 3000,
  }));
  await assertFails(ba.database().ref('branches/aden/finance/payroll/emp-1').set({
    branchId: 'aden', createdByUid: 'ba', baseRate: 3000,
  }));
  await env.clearDatabase();
  await env.cleanup();
});
