// تحويل اسم المستخدم إلى بريد إلكتروني داخلي صالح لـ Firebase Auth
function usernameToEmail(username) {
  const clean = username.trim().toLowerCase().replace(/\s+/g, ".");
  return `${clean}@wadibana.local`;
}

// 1. تسجيل الدخول باسم المستخدم وكلمة المرور
async function loginWithUsername(username, password) {
  const email = usernameToEmail(username);
  const cred = await firebase.auth().signInWithEmailAndPassword(email, password);
  const snap = await firebase.database().ref(`users/${cred.user.uid}`).once("value");
  const profile = snap.val();

  if (!profile || profile.active !== true) {
    await firebase.auth().signOut();
    throw new Error("الحساب موقوف أو غير مسجل في النظام.");
  }
  return { uid: cred.user.uid, ...profile };
}

// 2. جلب قائمة المستخدمين لإدارتها (إخفاء المالك عن الجميع ما عدا المالك نفسه)
async function getManageableUsers(currentUserRole) {
  if (currentUserRole !== "owner" && currentUserRole !== "gm") {
    return []; // لا يملك صلاحية إدارة المستخدمين
  }

  const snap = await firebase.database().ref("users").once("value");
  const usersObj = snap.val() || {};

  return Object.entries(usersObj)
    .map(([uid, data]) => ({ uid, ...data }))
    .filter(user => {
      // إخفاء المالك تماماً عن أي مستخدم آخر
      if (user.role === "owner" && currentUserRole !== "owner") {
        return false;
      }
      return true;
    });
}

// 3. إضافة مدير أو موظف جديد (متاح للمدير العام والمالك فقط)
async function addNewSystemUser(currentUserRole, { fullName, username, password, role, branchId }) {
  if (currentUserRole !== "owner" && currentUserRole !== "gm") {
    throw new Error("ليس لديك صلاحية إضافة مستخدمين.");
  }
  if (role === "owner" && currentUserRole !== "owner") {
    throw new Error("لا يمكن منح صلاحية المالك.");
  }
  if (!password || password.length < 6) {
    throw new Error("كلمة المرور يجب أن تكون 6 أرقام أو أحرف على الأقل.");
  }

  // استخدام نسخة Firebase ثانوية لمنع خروج المدير العام الحالي
  const secondaryApp = firebase.apps.find(app => app.name === "Secondary")
    || firebase.initializeApp(firebase.app().options, "Secondary");

  try {
    const email = usernameToEmail(username);
    const userCred = await secondaryApp.auth().createUserWithEmailAndPassword(email, password);
    const newUid = userCred.user.uid;

    await firebase.database().ref(`users/${newUid}`).set({
      fullName: fullName.trim(),
      username: username.trim().toLowerCase(),
      role: role, // gm | branch_manager_accountant | branch_manager | branch_accountant | employee
      branchId: role === "gm" ? "all" : branchId, // all | yemen | abudhabi | ajman | muscat | ain | mukalla
      hidden: false,
      active: true,
      createdAt: firebase.database.ServerValue.TIMESTAMP
    });

    await secondaryApp.auth().signOut();
    return newUid;
  } finally {
    await secondaryApp.delete();
  }
}

// 4. تعديل صلاحيات أو فرع أو حالة أي مستخدم (باستثناء المالك)
async function updateUserPermissions(currentUserRole, targetUid, updates) {
  if (currentUserRole !== "owner" && currentUserRole !== "gm") {
    throw new Error("ليس لديك صلاحية تعديل الصلاحيات.");
  }

  const targetSnap = await firebase.database().ref(`users/${targetUid}`).once("value");
  const targetUser = targetSnap.val();

  if (!targetUser) {
    throw new Error("المستخدم غير موجود.");
  }

  // حماية حساب المالك من أي تعديل
  if (targetUser.role === "owner" && currentUserRole !== "owner") {
    throw new Error("لا يمكن تعديل بيانات أو صلاحيات المالك.");
  }

  if (updates.role === "owner" && currentUserRole !== "owner") {
    throw new Error("غير مسموح بالترقية إلى رتبة مالك.");
  }

  const allowedUpdates = {};
  if (updates.fullName !== undefined) allowedUpdates.fullName = updates.fullName;
  if (updates.role !== undefined) allowedUpdates.role = updates.role;
  if (updates.branchId !== undefined) {
    allowedUpdates.branchId = updates.role === "gm" ? "all" : updates.branchId;
  }
  if (updates.active !== undefined) allowedUpdates.active = Boolean(updates.active);

  await firebase.database().ref(`users/${targetUid}`).update(allowedUpdates);
}