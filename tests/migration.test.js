'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { migrateLegacyData } = require('../scripts/migrate-legacy-data');

test('migration requires explicit mappings for legacy branch identifiers', () => {
  const result = migrateLegacyData({
    trips: [{ id: 'trip-1', branch: 'old-west' }],
    passengers: [{ id: 'ticket-1', tripId: 'trip-1', branch: 'old-west' }],
  }, {});

  assert.equal(result.report.migratedRecords, 0);
  assert.deepEqual(result.report.unresolved.map(({ collection }) => collection), ['trips', 'passengers']);
});

test('migration applies explicit mappings and derives a linked record branch from its trip', () => {
  const result = migrateLegacyData({
    trips: [{ id: 'trip-1', branch: 'old-west' }],
    passengers: [{ id: 'ticket-1', tripId: 'trip-1' }],
  }, { 'old-west': 'aden' });

  assert.equal(result.report.migratedRecords, 2);
  assert.equal(result.report.unresolved.length, 0);
  assert.equal(result.branches.aden.operations.passengers['ticket-1'].branchId, 'aden');
});

test('migration does not infer a branch for records without a branch or linked trip', () => {
  const result = migrateLegacyData({
    cargo: [{ id: 'cargo-1', branch: 'unknown-branch' }],
  }, {});

  assert.equal(result.report.migratedRecords, 0);
  assert.equal(result.report.unresolved[0].reason, 'missing-explicit-branch-mapping');
});

test('migration separates employee identity from payroll fields', () => {
  const result = migrateLegacyData({
    employees: [{ id: 'emp-1', name: 'موظف', branch: 'ajman', baseRate: 3000, workUnits: 2, advances: 100 }],
  }, {});

  const employee = result.branches.ajman.staff.employees['emp-1'];
  const payroll = result.branches.ajman.finance.payroll['emp-1'];
  assert.equal(employee.baseRate, undefined);
  assert.equal(employee.workUnits, undefined);
  assert.equal(payroll.baseRate, 3000);
  assert.equal(payroll.workUnits, 2);
  assert.equal(payroll.advances, 100);
});
