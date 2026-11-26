'use strict';

const crypto = require('node:crypto');
const { promisify } = require('node:util');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getDatabase } = require('firebase-admin/database');
const { HttpsError, onCall } = require('firebase-functions/v2/https');
const { onValueWritten } = require('firebase-functions/v2/database');

initializeApp();

const database = getDatabase();
const scrypt = promisify(crypto.scrypt);
const BRANCHES = new Set(['ajman', 'bani_yas', 'aden']);
const ROLE_ALIASES = Object.freeze({
  gm: 'general_manager',
  chief_accountant: 'general_accountant',
  owner: 'owner',
  general_manager: 'general_manager',
  general_accountant: 'general_accountant',
  branch_manager: 'branch_manager',
  branch_accountant: 'branch_accountant',
  employee: 'employee',
});
const APPLICATION_ROLES = new Set([
  'general_manager',
  'general_accountant',
  'branch_manager',
  'branch_accountant',
  'employee',
]);

function normalizeUsername(value) {
  return String(value || '').trim().toLocaleLowerCase('ar');
}

function normalizeRole(value) {
  return ROLE_ALIASES[String(value || '').trim()] || null;
}

function profileForToken(uid, profile) {
  const role = normalizeRole(profile.role);
  const branchId = String(profile.branchId || '');
  if (!role || profile.active !== true) {
    throw new HttpsError('permission-denied', 'الحساب غير مفعّل أو لم تُعيّن له صلاحية معتمدة.');
  }
  if (role === 'owner') {
    if (normalizeUsername(profile.username) !== 'tryr' || profile.hidden !== true) {
      throw new HttpsError('permission-denied', 'حساب المالك غير صالح.');
    }
  } else if (!APPLICATION_ROLES.has(role)) {
    throw new HttpsError('permission-denied', 'يجب تعيين دور معتمد لهذا الحساب.');
  }

  if (role === 'general_manager' || role === 'general_accountant' || role === 'owner') {
    if (branchId !== 'all') {
      throw new HttpsError('permission-denied', 'يجب تعيين الحساب العام إلى جميع الفروع.');
    }
  } else if (!BRANCHES.has(branchId)) {
    throw new HttpsError('permission-denied', 'يجب تعيين الحساب إلى فرع معتمد قبل تسجيل الدخول.');
  }

  return {
    uid,
    role,
    branchId,
    username: String(profile.username || uid),
    fullName: String(profile.fullName || profile.username || uid),
  };
}

function safeUser(uid, profile) {
  if (!profile || profile.hidden === true || normalizeRole(profile.role) === 'owner') return null;
  const role = normalizeRole(profile.role);
  return {
    uid,
    username: String(profile.username || uid),
    fullName: String(profile.fullName || profile.username || uid),
    role: role || String(profile.role || ''),
    branchId: String(profile.branchId || ''),
    active: profile.active === true,
    hidden: false,
  };
}

async function requireGeneralManager(request) {
  if (!request.auth || !['owner', 'general_manager'].includes(request.auth.token.role)) {
    throw new HttpsError('permission-denied', 'هذه العملية متاحة للمدير العام أو المالك فقط.');
  }
  const profile = await database.ref(`users/${request.auth.uid}`).get();
  if (!profile.exists() || profile.child('active').val() !== true) {
    throw new HttpsError('permission-denied', 'انتهت صلاحية إدارة المستخدمين لهذا الحساب.');
  }
  const role = normalizeRole(profile.child('role').val());
  const branchId = profile.child('branchId').val();
  const isGeneralManager = role === 'general_manager' && branchId === 'all';
  const isOwner = role === 'owner' && branchId === 'all'
    && normalizeUsername(profile.child('username').val()) === 'tryr'
    && profile.child('hidden').val() === true;
  if (!isGeneralManager && !isOwner) {
    throw new HttpsError('permission-denied', 'انتهت صلاحية إدارة المستخدمين لهذا الحساب.');
  }
}

function requireSignedIn(request) {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'سجّل الدخول أولاً.');
  }
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}

async function verifyPassword(password, storedHash) {
  if (typeof storedHash !== 'string') return false;
  if (/^[a-f0-9]{64}$/i.test(storedHash)) {
    const candidate = crypto.createHash('sha256').update(password, 'utf8').digest();
    const expected = Buffer.from(storedHash, 'hex');
    return expected.length === candidate.length && crypto.timingSafeEqual(candidate, expected);
  }
  const [, saltHex, keyHex] = storedHash.split('$');
  if (!saltHex || !keyHex || !/^[a-f0-9]+$/i.test(saltHex) || !/^[a-f0-9]+$/i.test(keyHex)) return false;
  const expected = Buffer.from(keyHex, 'hex');
  const candidate = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length);
  return expected.length === candidate.length && crypto.timingSafeEqual(candidate, expected);
}

async function ensureAuthUser(uid) {
  const auth = getAuth();
  try {
    const user = await auth.getUser(uid);
    if (user.disabled) await auth.updateUser(uid, { disabled: false });
  } catch (error) {
    if (error.code !== 'auth/user-not-found') throw error;
    await auth.createUser({ uid });
  }
}

exports.loginWithUsername = onCall(async (request) => {
  const username = String(request.data?.username || '').trim();
  const password = String(request.data?.password || '');
  if (!username || !password || password.length > 256) {
    throw new HttpsError('unauthenticated', 'اسم المستخدم أو كلمة المرور غير صحيحة.');
  }

  const usersSnapshot = await database.ref('users').get();
  const normalized = normalizeUsername(username);
  let match = null;
  usersSnapshot.forEach((child) => {
    if (!match && normalizeUsername(child.child('username').val()) === normalized) {
      match = { uid: child.key, profile: child.val() };
    }
  });
  if (!match || match.profile.active !== true
    || !await verifyPassword(password, match.profile.passwordHash)) {
    throw new HttpsError('unauthenticated', 'اسم المستخدم أو كلمة المرور غير صحيحة.');
  }

  const profile = profileForToken(match.uid, match.profile);
  await ensureAuthUser(profile.uid);
  if (match.profile.role !== profile.role) {
    await database.ref(`users/${match.uid}/role`).set(profile.role);
  }
  if (/^[a-f0-9]{64}$/i.test(String(match.profile.passwordHash || ''))) {
    await database.ref(`users/${match.uid}/passwordHash`).set(await hashPassword(password));
    await database.ref(`users/${match.uid}/password`).remove();
  }

  const token = await getAuth().createCustomToken(profile.uid, {
    role: profile.role,
    branchId: profile.branchId,
    username: profile.username,
    fullName: profile.fullName,
  });
  return { token, profile };
});

exports.listApplicationUsers = onCall(async (request) => {
  await requireGeneralManager(request);
  const snapshot = await database.ref('users').get();
  const users = [];
  snapshot.forEach((child) => {
    const user = safeUser(child.key, child.val());
    if (user) users.push(user);
  });
  return { users };
});

exports.manageApplicationUser = onCall(async (request) => {
  await requireGeneralManager(request);
  const action = String(request.data?.action || '');
  const actor = request.auth.uid;
  const targetUid = String(request.data?.uid || '');
  const usersRef = database.ref('users');
  const auditRef = database.ref('systemAuditLogs').push();

  if (action === 'create') {
    const username = String(request.data?.username || '').trim();
    const password = String(request.data?.password || '');
    const fullName = String(request.data?.fullName || username).trim();
    const role = normalizeRole(request.data?.role);
    const branchId = String(request.data?.branchId || '');
    if (!username || username.length > 64 || password.length < 6 || password.length > 128
      || !APPLICATION_ROLES.has(role)) {
      throw new HttpsError('invalid-argument', 'بيانات الحساب أو الدور غير صالحة.');
    }
    if ((role === 'general_manager' || role === 'general_accountant') ? branchId !== 'all' : !BRANCHES.has(branchId)) {
      throw new HttpsError('invalid-argument', 'الفرع لا يتوافق مع الدور المحدد.');
    }
    const snapshot = await usersRef.get();
    let duplicate = false;
    snapshot.forEach((child) => {
      if (normalizeUsername(child.child('username').val()) === normalizeUsername(username)) duplicate = true;
    });
    if (duplicate) throw new HttpsError('already-exists', 'اسم المستخدم مستخدم بالفعل.');

    const uid = `user_${crypto.randomUUID().replace(/-/g, '')}`;
    const profile = {
      username,
      fullName,
      role,
      branchId,
      active: true,
      hidden: false,
      passwordHash: await hashPassword(password),
    };
    await usersRef.child(uid).set(profile);
    await auditRef.set({ action: 'CREATE_USER', actorUid: actor, targetUid: uid, username, role, branchId, timestamp: Date.now() });
    return { user: safeUser(uid, profile) };
  }

  if (!targetUid) throw new HttpsError('invalid-argument', 'معرّف المستخدم مطلوب.');
  const targetRef = usersRef.child(targetUid);
  const snapshot = await targetRef.get();
  if (!snapshot.exists()) throw new HttpsError('not-found', 'المستخدم غير موجود.');
  const previous = snapshot.val();
  if (previous.hidden === true || normalizeRole(previous.role) === 'owner') {
    throw new HttpsError('permission-denied', 'لا يمكن إدارة حساب المالك من التطبيق.');
  }

  if (action === 'update') {
    const username = String(request.data?.username || '').trim();
    const fullName = String(request.data?.fullName || username).trim();
    const role = normalizeRole(request.data?.role);
    const branchId = String(request.data?.branchId || '');
    const password = String(request.data?.password || '');
    if (!username || username.length > 64 || !APPLICATION_ROLES.has(role)) {
      throw new HttpsError('invalid-argument', 'بيانات الحساب أو الدور غير صالحة.');
    }
    if ((role === 'general_manager' || role === 'general_accountant') ? branchId !== 'all' : !BRANCHES.has(branchId)) {
      throw new HttpsError('invalid-argument', 'الفرع لا يتوافق مع الدور المحدد.');
    }
    const allUsers = await usersRef.get();
    let duplicate = false;
    allUsers.forEach((child) => {
      if (child.key !== targetUid && normalizeUsername(child.child('username').val()) === normalizeUsername(username)) duplicate = true;
    });
    if (duplicate) throw new HttpsError('already-exists', 'اسم المستخدم مستخدم بالفعل.');
    const next = { ...previous, username, fullName, role, branchId };
    if (password) {
      if (password.length < 6 || password.length > 128) {
        throw new HttpsError('invalid-argument', 'كلمة المرور يجب ألا تقل عن 6 أحرف.');
      }
      next.passwordHash = await hashPassword(password);
    }
    await targetRef.set(next);
    try {
      await getAuth().revokeRefreshTokens(targetUid);
    } catch (error) {
      if (error.code !== 'auth/user-not-found') throw error;
    }
    await auditRef.set({ action: 'UPDATE_USER', actorUid: actor, targetUid, timestamp: Date.now() });
    return { user: safeUser(targetUid, next) };
  }

  if (action === 'setActive') {
    if (targetUid === actor) throw new HttpsError('failed-precondition', 'لا يمكن إيقاف الحساب النشط.');
    const active = request.data?.active === true;
    await targetRef.child('active').set(active);
    try {
      await getAuth().updateUser(targetUid, { disabled: !active });
      await getAuth().revokeRefreshTokens(targetUid);
    } catch (error) {
      if (error.code !== 'auth/user-not-found') throw error;
    }
    await auditRef.set({ action: active ? 'ACTIVATE_USER' : 'DEACTIVATE_USER', actorUid: actor, targetUid, timestamp: Date.now() });
    return { user: safeUser(targetUid, { ...previous, active }) };
  }

  if (action === 'delete') {
    if (targetUid === actor) throw new HttpsError('failed-precondition', 'لا يمكن حذف الحساب النشط.');
    await targetRef.remove();
    try {
      await getAuth().deleteUser(targetUid);
    } catch (error) {
      if (error.code !== 'auth/user-not-found') throw error;
    }
    await auditRef.set({ action: 'DELETE_USER', actorUid: actor, targetUid, timestamp: Date.now() });
    return { success: true };
  }

  throw new HttpsError('invalid-argument', 'الإجراء غير مدعوم.');
});

exports.changeOwnPassword = onCall(async (request) => {
  requireSignedIn(request);
  const password = String(request.data?.password || '');
  if (password.length < 6 || password.length > 128) {
    throw new HttpsError('invalid-argument', 'كلمة المرور يجب ألا تقل عن 6 أحرف.');
  }
  const targetRef = database.ref(`users/${request.auth.uid}`);
  const snapshot = await targetRef.get();
  if (!snapshot.exists() || snapshot.child('active').val() !== true) {
    throw new HttpsError('permission-denied', 'الحساب غير متاح.');
  }
  await targetRef.update({ passwordHash: await hashPassword(password), password: null });
  await database.ref('systemAuditLogs').push({
    action: 'CHANGE_PASSWORD',
    actorUid: request.auth.uid,
    targetUid: request.auth.uid,
    timestamp: Date.now(),
  });
  return { success: true };
});

exports.auditBranchOperation = onValueWritten(
  {
    ref: '/branches/{branchId}/{section}/{collection}/{recordId}',
    instance: 'wadi-bana-b585b-default-rtdb',
  },
  async (event) => {
    if (!['operations', 'finance', 'staff'].includes(event.params.section)) return;
    const before = event.data.before.val();
    const after = event.data.after.val();
    if (JSON.stringify(before) === JSON.stringify(after)) return;
    const actorUid = event.authId || 'firebase-admin';
    const actorUsername = event.authId
      ? (await database.ref(`users/${event.authId}/username`).get()).val() || event.authId
      : 'Firebase Admin';
    const log = {
      action: before === null ? 'CREATE' : after === null ? 'DELETE' : 'UPDATE',
      branchId: event.params.branchId,
      section: event.params.section,
      collection: event.params.collection,
      recordId: event.params.recordId,
      actorUid,
      actorUsername,
      timestamp: Date.now(),
    };
    await database.ref(`branchAuditLogs/${event.params.branchId}/${event.params.section}/${event.params.collection}/${event.params.recordId}`).push(log);
  },
);
