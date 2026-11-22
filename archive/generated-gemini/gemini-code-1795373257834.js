function buildInternalAuthEmail(username) {
  const normalized = String(username || "").trim().toLowerCase().replace(/\s+/g, ".");
  return `${normalized}@wadibana.local`;
}

// تطبيع كلمة المرور لتوافق حد Firebase Auth الأدنى (6 أحرف) إذا كانت أقل
function normalizeAuthPassword(password) {
  const raw = String(password || "");
  if (raw.length >= 6) return raw;
  return raw.padEnd(6, "0");
}

/**
 * تسجيل الدخول ومزامنة systemUsers و systemUnifiedData مع الحفاظ على الأدوار والصلاحيات الحالية
 * @param {string} username - اسم المستخدم الذي أدخله المستخدم
 * @param {string} password - كلمة المرور التي أدخلها المستخدم
 * @param {Object} options - خيارات اختيارية لربطها ببنيتك الحالية
 * @param {Array|Object} [options.localUsers] - قائمة أو كائن المستخدمين الحالي في الواجهة إن وُجد
 * @param {Function} [options.onUnifiedData] - دالة رد نداء لاستلام تحديثات systemUnifiedData الفورية
 */
async function loginAndSyncSystemData(username, password, options = {}) {
  const cleanUsername = String(username || "").trim().toLowerCase();
  const rawPassword = String(password || "");
  const authEmail = buildInternalAuthEmail(cleanUsername);
  const authPassword = normalizeAuthPassword(rawPassword);

  const auth = firebase.auth();
  const db = firebase.database();

  // 1. البحث عن سجل المستخدم في localUsers (إن مُرّر) أو في systemUsers
  let matchedUser = null;
  let matchedKey = null;

  if (Array.isArray(options.localUsers)) {
    matchedUser = options.localUsers.find(
      (u) => String(u.username || "").trim().toLowerCase() === cleanUsername
    ) || null;
  } else if (options.localUsers && typeof options.localUsers === "object") {
    const entry = Object.entries(options.localUsers).find(
      ([, u]) => u && String(u.username || "").trim().toLowerCase() === cleanUsername
    );
    if (entry) {
      matchedKey = entry[0];
      matchedUser = entry[1];
    }
  }

  // محاولة قراءة systemUsers إذا كانت مقروءة حالياً أو بعد المصادقة
  if (!matchedUser && auth.currentUser) {
    const snap = await db.ref("systemUsers").once("value");
    const allUsers = snap.val() || {};
    const entry = Object.entries(allUsers).find(
      ([, u]) => u && String(u.username || "").trim().toLowerCase() === cleanUsername
    );
    if (entry) {
      matchedKey = entry[0];
      matchedUser = entry[1];
    }
  }

  // التحقق من كلمة المرور إذا كان السجل المحلي/الحالي يحتوي عليها
  if (matchedUser && matchedUser.password !== undefined && String(matchedUser.password) !== rawPassword) {
    throw new Error("اسم المستخدم أو كلمة المرور غير صحيحة.");
  }

  if (matchedUser && matchedUser.active === false) {
    throw new Error("هذا الحساب موقوف حالياً.");
  }

  // 2. تسجيل الدخول في Firebase Auth (أو إنشاؤه لأول مرة إذا كان مستخدماً حالياً في النظام)
  let cred;
  try {
    cred = await auth.signInWithEmailAndPassword(authEmail, authPassword);
  } catch (err) {
    if (
      (err.code === "auth/user-not-found" || err.code === "auth/invalid-credential") &&
      matchedUser
    ) {
      cred = await auth.createUserWithEmailAndPassword(authEmail, authPassword);
    } else {
      throw err;
    }
  }

  const uid = cred.user.uid;

  // 3. قراءة systemUsers بعد المصادقة ومزامنة السجل المرتبط بـ uid دون تغيير الأدوار
  const usersSnap = await db.ref("systemUsers").once("value");
  const systemUsersObj = usersSnap.val() || {};

  if (!matchedUser) {
    const foundEntry = Object.entries(systemUsersObj).find(
      ([key, u]) => key === uid || (u && String(u.username || "").trim().toLowerCase() === cleanUsername)
    );
    if (foundEntry) {
      matchedKey = foundEntry[0];
      matchedUser = foundEntry[1];
    }
  }

  if (matchedUser && matchedUser.password !== undefined && String(matchedUser.password) !== rawPassword) {
    await auth.signOut();
    throw new Error("اسم المستخدم أو كلمة المرور غير صحيحة.");
  }

  if (matchedUser && matchedUser.active === false) {
    await auth.signOut();
    throw new Error("هذا الحساب موقوف حالياً.");
  }

  // الحفاظ على الدور والفرع وجميع الحقول الحالية كما هي
  const preservedProfile = {
    ...(matchedUser || {}),
    username: (matchedUser && matchedUser.username) || cleanUsername,
    role: (matchedUser && matchedUser.role) || "employee",
    branchId: (matchedUser && matchedUser.branchId) || "all",
    active: matchedUser && matchedUser.active !== undefined ? matchedUser.active : true,
    uid: uid,
    lastLoginAt: firebase.database.ServerValue.TIMESTAMP
  };

  // إذا كان السجل قديماً تحت مفتاح غير uid، ننسخه إلى systemUsers/{uid} مع إبقاء الأصلي سليماً
  await db.ref(`systemUsers/${uid}`).update(preservedProfile);

  // 4. قراءة ومزامنة systemUnifiedData بعد تحقق auth != null
  const unifiedSnap = await db.ref("systemUnifiedData").once("value");
  const unifiedData = unifiedSnap.val();

  if (typeof options.onUnifiedData === "function") {
    db.ref("systemUnifiedData").on("value", (snapshot) => {
      options.onUnifiedData(snapshot.val());
    });
  }

  return {
    uid: uid,
    user: preservedProfile,
    allSystemUsers: systemUsersObj,
    unifiedData: unifiedData
  };
}