'use strict';

const fs = require('node:fs');
const path = require('node:path');

const BRANCHES = new Set(['ajman', 'bani_yas', 'aden']);
const COLLECTIONS = [
  'buses',
  'trips',
  'drivers',
  'employees',
  'passengers',
  'cargo',
  'vouchers',
  'debtInvoices',
  'transitVisas',
];

function branchForRecord(record, mapping) {
  const raw = String(record.branchId || record.branch || '').trim();
  if (!raw) return null;
  if (BRANCHES.has(raw)) return raw;
  return BRANCHES.has(mapping[raw]) ? mapping[raw] : null;
}

function migrateLegacyData(source, mapping) {
  const result = {
    branches: {},
    report: { migratedRecords: 0, unresolved: [] },
  };
  const tripBranches = new Map();
  for (const trip of Array.isArray(source.trips) ? source.trips : []) {
    const branchId = branchForRecord(trip, mapping);
    if (branchId && trip.id !== undefined) tripBranches.set(String(trip.id), branchId);
  }

  for (const collection of COLLECTIONS) {
    const records = Array.isArray(source[collection]) ? source[collection] : [];
    for (const record of records) {
      if (!record || record.id === undefined || record.id === null) {
        result.report.unresolved.push({ collection, id: null, reason: 'missing-record-id' });
        continue;
      }
      const branchId = branchForRecord(record, mapping)
        || (record.tripId !== undefined ? tripBranches.get(String(record.tripId)) : null);
      if (!branchId) {
        result.report.unresolved.push({
          collection,
          id: String(record.id),
          reason: 'missing-explicit-branch-mapping',
          legacyBranch: String(record.branchId || record.branch || ''),
        });
        continue;
      }
      if (!result.branches[branchId]) result.branches[branchId] = { operations: {}, staff: {}, finance: {} };
      const section = collection === 'employees'
        ? 'staff'
        : ['drivers', 'vouchers', 'debtInvoices'].includes(collection) ? 'finance' : 'operations';
      const bucket = collection === 'employees' ? 'employees' : collection;
      if (!result.branches[branchId][section][bucket]) result.branches[branchId][section][bucket] = {};
      const migratedRecord = { ...record, branchId };
      if (collection === 'employees') {
        for (const key of ['baseRate', 'workUnits', 'advances', 'totalPaid', 'totalExpenses', 'account', 'balance']) {
          delete migratedRecord[key];
        }
        if (!result.branches[branchId].finance.payroll) result.branches[branchId].finance.payroll = {};
        result.branches[branchId].finance.payroll[String(record.id)] = {
          id: record.id,
          branchId,
          baseRate: record.baseRate ?? 0,
          workUnits: record.workUnits ?? 0,
          advances: record.advances ?? 0,
          totalPaid: record.totalPaid ?? 0,
          totalExpenses: record.totalExpenses ?? 0,
          account: record.account ?? null,
          balance: record.balance ?? 0,
        };
      }
      result.branches[branchId][section][bucket][String(record.id)] = migratedRecord;
      result.report.migratedRecords += 1;
    }
  }
  return result;
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--apply') options.apply = true;
    else if (arg === '--confirm-migration') options.confirm = true;
    else if (['--input', '--mapping', '--output'].includes(arg)) options[arg.slice(2)] = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function main(argv) {
  const options = parseArgs(argv);
  if (!options.input) throw new Error('Provide --input with an exported legacy systemUnifiedData JSON file.');
  const inputPath = path.resolve(options.input);
  const source = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const mapping = options.mapping ? JSON.parse(fs.readFileSync(path.resolve(options.mapping), 'utf8')) : {};
  for (const [legacyId, branchId] of Object.entries(mapping)) {
    if (!BRANCHES.has(branchId)) throw new Error(`Invalid target branch "${branchId}" for "${legacyId}".`);
  }
  const migrated = migrateLegacyData(source.systemUnifiedData || source, mapping);
  process.stdout.write(`${JSON.stringify(migrated.report, null, 2)}\n`);

  if (!options.apply) {
    process.stdout.write('Dry run only. No data was written.\n');
    return migrated.report.unresolved.length ? 2 : 0;
  }
  if (!options.confirm) throw new Error('--apply also requires --confirm-migration.');
  if (migrated.report.unresolved.length) throw new Error('Resolve every reported branch mapping before applying.');
  if (!options.output) throw new Error('Provide --output for the migrated JSON file.');
  fs.writeFileSync(path.resolve(options.output), `${JSON.stringify(migrated.branches, null, 2)}\n`, { flag: 'wx' });
  process.stdout.write(`Wrote migrated data to ${path.resolve(options.output)}. No Firebase connection was used.\n`);
  return 0;
}

if (require.main === module) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { branchForRecord, migrateLegacyData, parseArgs };
