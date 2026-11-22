window.onManageRoleChanged = function () {
  const roleVal = document.getElementById("manageRole")?.value;
  const branchEl = document.getElementById("manageBranch");
  if (!branchEl) return;

  if (roleVal === "مدير عام" || roleVal === "محاسب رئيسي") {
    branchEl.value = "جميع الفروع";
  } else if (branchEl.value === "جميع الفروع") {
    branchEl.value = "فرع عجمان";
  }
};

window.resetUserForm = function () {
  const form = document.getElementById("userForm");
  if (form) form.reset();
  const editHidden = document.getElementById("userEditOriginalName");
  if (editHidden) editHidden.value = "";
  const activeChk = document.getElementById("manageActive");
  if (activeChk) activeChk.checked = true;
  const submitBtn = document.getElementById("userSubmitBtn");
  if (submitBtn) submitBtn.textContent = "حفظ ملف المستخدم";
};

window.editSystemUser = function (userKey) {
  if (!canManageSystemUsers()) {
    alert("غير مصرح لك بتعديل المستخدمين.");
    return;
  }

  const target = (cloudUsers || []).find((u) => (u.id || u.username) === userKey);
  if (!target) return;

  const isOwnerAccount =
    target.role === "مالك" || target.username === "tryr" || target.id === "tryr" || target.hidden === true;
  if (isOwnerAccount && !isMahmoud()) {
    alert("غير مصرح بتعديل حساب المالك.");
    return;
  }

  document.getElementById("userEditOriginalName").value = target.id || target.username;
  document.getElementById("manageFullName").value = target.fullName || target.username || "";
  document.getElementById("manageUsername").value = target.username || "";
  document.getElementById("managePassword").value = target.password || "";
  document.getElementById("manageRole").value = target.role || "موظف";
  document.getElementById("manageBranch").value = target.branch || "فرع عجمان";
  document.getElementById("manageActive").checked = target.active !== false;

  const submitBtn = document.getElementById("userSubmitBtn");
  if (submitBtn) submitBtn.textContent = "تحديث بيانات المستخدم";
};

window.handleSaveUser = async function (e) {
  e.preventDefault();
  if (!canManageSystemUsers()) {
    alert("إضافة وتعديل المستخدمين متاح للمدير العام والمالك فقط.");
    return;
  }

  await ensureAnonymousSignedIn();

  const editKey = document.getElementById("userEditOriginalName").value.trim();
  const fullNameInput = document.getElementById("manageFullName").value.trim();
  const usernameInput = document.getElementById("manageUsername").value.trim();
  const passwordInput = document.getElementById("managePassword").value.trim();
  const roleInput = document.getElementById("manageRole").value;
  const branchInput = document.getElementById("manageBranch").value;
  const isActive = document.getElementById("manageActive").checked;

  if (!fullNameInput || !usernameInput || !passwordInput) {
    alert("يرجى إدخال الاسم الكامل واسم المستخدم وكلمة المرور.");
    return;
  }

  // حماية حساب المالك tryr من التعديل أو الإنشاء بواسطة أي مستخدم غير المالك
  if (!isMahmoud() && (editKey === "tryr" || usernameInput.toLowerCase() === "tryr" || roleInput === "مالك")) {
    alert("غير مصرح للمدير العام بإنشاء أو تعديل حساب المالك.");
    return;
  }

  const targetKey = editKey || usernameInput.toLowerCase().replace(/\s+/g, "_");
  const existingSnap = await get(ref(rtdb, `users/${targetKey}`));
  const existingData = existingSnap.exists() ? existingSnap.val() : {};

  if (!isMahmoud() && (existingData.role === "مالك" || existingData.hidden === true)) {
    alert("غير مصرح بتعديل بيانات المالك.");
    return;
  }

  // منع تكرار اسم المستخدم لحساب مختلف عند إضافة مستخدم جديد
  if (!editKey && existingSnap.exists()) {
    alert("اسم المستخدم مستخدم بالفعل، اختر اسم مستخدم آخر أو اضغط على تعديل من الجدول.");
    return;
  }

  const finalBranch = roleInput === "مدير عام" || roleInput === "محاسب رئيسي" ? "جميع الفروع" : branchInput;

  const userPayload = {
    id: targetKey,
    fullName: fullNameInput,
    username: usernameInput,
    password: passwordInput,
    role: roleInput,
    branch: finalBranch,
    branchId: BRANCH_FIREBASE_VALUES[finalBranch] || "ajman",
    hidden: roleInput === "مالك",
    active: isActive
  };

  await set(ref(rtdb, `users/${targetKey}`), sanitizeForFirebase(userPayload));
  await writeUserAuditLog(editKey ? "UPDATE_USER" : "CREATE_USER", usernameInput, {
    role: roleInput,
    branch: finalBranch,
    active: isActive
  });

  const freshUsersSnap = await get(ref(rtdb, "users"));
  const allObj = freshUsersSnap.val() || {};
  cloudUsers = Object.entries(allObj).map(([k, v]) => ({ id: k, ...v }));

  renderUsersTable();
  resetUserForm();
  alert(editKey ? "تم تحديث بيانات وكلمة مرور المستخدم بنجاح." : "تم إنشاء المستخدم الجديد وتعيين كلمة المرور بنجاح.");
};