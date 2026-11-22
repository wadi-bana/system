// إضافة مدير أو موظف جديد + تسجيل في audit_logs
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

  const secondaryApp = firebase.apps.find(app => app.name === "Secondary")
    || firebase.initializeApp(firebase.app().options, "Secondary");

  const cleanUsername = username.trim().toLowerCase();
  const normalizedBranch = role === "gm" ? "all" : branchId;

  try {
    const email = usernameToEmail(cleanUsername);
    const userCred = await secondaryApp.auth().createUserWithEmailAndPassword(email, password);
    const newUid = userCred.user.uid;

    const newUserRecord = {
      fullName: fullName.trim(),
      username: cleanUsername,
      role: role,
      branchId: normalizedBranch,
      hidden: false,
      active: true,
      createdAt: firebase.database.ServerValue.TIMESTAMP
    };

    await firebase.database().ref(`users/${newUid}`).set(newUserRecord);
    await secondaryApp.auth().signOut();

    await writeAuditLog({
      action: "CREATE_USER",
      targetUid: newUid,
      targetUsername: cleanUsername,
      details: {
        fullName: newUserRecord.fullName,
        role: newUserRecord.role,
        branchId: newUserRecord.branchId,
        active: true
      }
    });

    return newUid;
  } finally {
    await secondaryApp.delete();
  }
}

// تعديل صلاحيات أو فرع أو حالة مستخدم + تسجيل في audit_logs
async function updateUserPermissions(currentUserRole, targetUid, updates) {
  if (currentUserRole !== "owner" && currentUserRole !== "gm") {
    throw new Error("ليس لديك صلاحية تعديل الصلاحيات.");
  }

  const targetSnap = await firebase.database().ref(`users/${targetUid}`).once("value");
  const targetUser = targetSnap.val();

  if (!targetUser) {
    throw new Error("المستخدم غير موجود.");
  }

  if (targetUser.role === "owner" && currentUserRole !== "owner") {
    throw new Error("لا يمكن تعديل بيانات أو صلاحيات المالك.");
  }

  if (updates.role === "owner" && currentUserRole !== "owner") {
    throw new Error("غير مسموح بالترقية إلى رتبة مالك.");
  }

  const allowedUpdates = {};
  const changes = {};

  if (updates.fullName !== undefined && updates.fullName !== targetUser.fullName) {
    allowedUpdates.fullName = updates.fullName;
    changes.fullName = { from: targetUser.fullName, to: updates.fullName };
  }

  const nextRole = updates.role !== undefined ? updates.role : targetUser.role;
  const nextBranch = updates.branchId !== undefined
    ? (nextRole === "gm" ? "all" : updates.branchId)
    : (updates.role !== undefined && nextRole === "gm" ? "all" : targetUser.branchId);

  if (updates.role !== undefined && updates.role !== targetUser.role) {
    allowedUpdates.role = updates.role;
    changes.role = { from: targetUser.role, to: updates.role };
  }

  if (nextBranch !== targetUser.branchId) {
    allowedUpdates.branchId = nextBranch;
    changes.branchId = { from: targetUser.branchId, to: nextBranch };
  }

  if (updates.active !== undefined && Boolean(updates.active) !== Boolean(targetUser.active)) {
    allowedUpdates.active = Boolean(updates.active);
    changes.active = { from: Boolean(targetUser.active), to: Boolean(updates.active) };
  }

  if (Object.keys(allowedUpdates).length === 0) {
    return; // لا توجد تغييرات فعلية لتسجيلها
  }

  await firebase.database().ref(`users/${targetUid}`).update(allowedUpdates);

  // تحديد نوع العملية بدقة: إيقاف/تفعيل حساب أو تعديل صلاحيات/بيانات
  const isOnlyStatusChange = Object.keys(changes).length === 1 && changes.active !== undefined;
  const actionType = isOnlyStatusChange
    ? (changes.active.to ? "ACTIVATE_USER" : "DEACTIVATE_USER")
    : "UPDATE_PERMISSIONS";

  await writeAuditLog({
    action: actionType,
    targetUid: targetUid,
    targetUsername: targetUser.username || null,
    details: {
      fullName: targetUser.fullName || null,
      changes: changes
    }
  });
}