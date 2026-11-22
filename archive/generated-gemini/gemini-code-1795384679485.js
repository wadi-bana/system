const DEFAULT_SYSTEM_USERS = {
  tryr: {
    id: "tryr",
    fullName: "ترير",
    username: "tryr",
    password: "1288",
    role: "مالك",
    branch: "جميع الفروع",
    branchId: "all",
    hidden: true,
    active: true
  },
  waleed: {
    id: "waleed",
    fullName: "وليد السيد",
    username: "waleed",
    password: "708090",
    role: "مدير عام",
    branch: "جميع الفروع",
    branchId: "all",
    hidden: false,
    active: true
  },
  khaled_waleed: {
    id: "khaled_waleed",
    fullName: "خالد وليد السيد",
    username: "khaled waleed",
    password: "908070",
    role: "مدير عام",
    branch: "جميع الفروع",
    branchId: "all",
    hidden: false,
    active: true
  },
  yusef: {
    id: "yusef",
    fullName: "يوسف مختار",
    username: "yusef",
    password: "405060",
    role: "مدير فرع ومحاسب",
    branch: "فرع اليمن",
    branchId: "yemen",
    hidden: false,
    active: true
  },
  mohammed: {
    id: "mohammed",
    fullName: "محمد ياسر",
    username: "mohammed",
    password: "302010",
    role: "مدير فرع ومحاسب",
    branch: "فرع ابوظبي",
    branchId: "abudhabi",
    hidden: false,
    active: true
  },
  abod: {
    id: "abod",
    fullName: "عبدالله",
    username: "abod",
    password: "605040",
    role: "موظف",
    branch: "فرع اليمن",
    branchId: "yemen",
    hidden: false,
    active: true
  },
  mohamod: {
    id: "mohamod",
    fullName: "محمود عبد الكريم",
    username: "mohamod",
    password: "102030",
    role: "مدير فرع ومحاسب",
    branch: "فرع عجمان",
    branchId: "ajman",
    hidden: false,
    active: true
  }
};

// ضمان تسجيل الدخول المجهول (signInAnonymously) قبل قراءة أو كتابة قاعدة البيانات
async function ensureAnonymousSignedIn() {
  if (!auth) throw new Error("Firebase Auth غير مهيأ.");
  if (auth.currentUser) return auth.currentUser;

  const existing = await new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (u) => {
      unsub();
      resolve(u);
    });
  });
  if (existing) return existing;

  const cred = await signInAnonymously(auth);
  return cred.user;
}

// تهيئة جدول /users في Firebase إذا كان فارغاً
async function ensureUsersSeededInFirebase() {
  const snap = await get(ref(rtdb, "users"));
  if (!snap.exists()) {
    await set(ref(rtdb, "users"), sanitizeForFirebase(DEFAULT_SYSTEM_USERS));
  }
}

// تسجيل الدخول باسم المستخدم وكلمة المرور بعد تفعيل signInAnonymously
window.handleLogin = async function (e) {
  e.preventDefault();
  if (!useFirebase || !auth || !rtdb) {
    showCloudError("تعذر تهيئة Firebase Realtime Database.");
    return;
  }

  const enteredUsername = document.getElementById("loginUser").value.trim().toLowerCase();
  const enteredPassword = document.getElementById("loginPass").value.trim();

  try {
    document.getElementById("cloudInitError")?.classList.add("hidden");
    const anonUser = await ensureAnonymousSignedIn();
    await ensureUsersSeededInFirebase();

    const usersSnap = await get(ref(rtdb, "users"));
    const usersObj = usersSnap.val() || {};

    let matchedKey = null;
    let matchedProfile = null;

    for (const [key, prof] of Object.entries(usersObj)) {
      if (!prof) continue;
      const uName = String(prof.username || "").trim().toLowerCase();
      const uPass = String(prof.password || "").trim();
      if (uName === enteredUsername && uPass === enteredPassword) {
        matchedKey = key;
        matchedProfile = prof;
        break;
      }
    }

    if (!matchedProfile) {
      showCloudError("اسم المستخدم أو كلمة المرور غير صحيحة.");
      return;
    }

    if (matchedProfile.active === false) {
      showCloudError("هذا الحساب موقوف حالياً. راجع الإدارة.");
      return;
    }

    currentUser = {
      ...matchedProfile,
      id: matchedProfile.id || matchedKey,
      username: matchedProfile.username || matchedKey,
      fullName: matchedProfile.fullName || matchedProfile.username || matchedKey,
      role: matchedProfile.role || "موظف",
      branch: matchedProfile.branch || "فرع عجمان",
      hidden: matchedProfile.role === "مالك" ? true : Boolean(matchedProfile.hidden),
      active: true,
      authUid: anonUser.uid
    };

    activeAuthUid = anonUser.uid;
    sessionStorage.setItem("wadi_bana_user_session", JSON.stringify(currentUser));
    document.getElementById("loginPass").value = "";
    updateUserBadge();
    initSync();
  } catch (err) {
    console.error("Login error:", err);
    showCloudError(err?.message || "تعذر تسجيل الدخول. تحقق من مفتاح API وتفعيل Anonymous في Firebase.");
  }
};

window.handleLogout = function () {
  sessionStorage.removeItem("wadi_bana_user_session");
  currentUser = null;
  activeAuthUid = null;
  if (auth && auth.currentUser) {
    signOut(auth).finally(() => location.reload());
  } else {
    location.reload();
  }
};

// عرض جدول المستخدمين مع إخفاء المالك (tryr) نهائياً عن أي مستخدم آخر
window.renderUsersTable = function () {
  const tbody = document.querySelector("#usersTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  const list = (cloudUsers || []).filter((u) => {
    if (!u) return false;
    const isOwnerAccount = u.role === "مالك" || u.username === "tryr" || u.id === "tryr" || u.hidden === true;
    if (isOwnerAccount && !isMahmoud()) {
      return false;
    }
    return true;
  });

  list.forEach((u) => {
    const isOwnerAccount = u.role === "مالك" || u.username === "tryr" || u.id === "tryr";
    const canEditThisUser = isMahmoud() || (!isOwnerAccount && isMahmoudOrGeneralManager());

    const tr = tbody.insertRow();
    tr.innerHTML = `
      <td>
        <strong>${u.fullName || u.username}</strong>
        <div class="text-[11px] text-zinc-400">مستخدم: ${u.username}</div>
      </td>
      <td><span class="bg-amber-950/70 text-gold px-2.5 py-1 rounded text-xs font-bold">${u.role}</span></td>
      <td><span class="bg-zinc-800 text-zinc-200 px-2.5 py-1 rounded text-xs">${u.branch || "جميع الفروع"}</span></td>
      <td>
        <span class="${u.active !== false ? "text-emerald-400" : "text-red-400"} text-xs font-bold">
          ${u.active !== false ? "نشط" : "موقوف"}
        </span>
      </td>
      <td class="space-x-1 space-x-reverse">
        ${canEditThisUser
          ? `<button type="button" onclick="editSystemUser('${u.id || u.username}')" class="bg-amber-600 text-black px-2.5 py-1 rounded text-xs font-bold"><i class="fa-solid fa-pen ml-1"></i> تعديل</button>`
          : `<span class="text-[11px] text-zinc-500">محمي</span>`
        }
      </td>
    `;
  });
};

// تعبئة نموذج تعديل مستخدم للمدير العام أو المالك (مع منع لمس المالك لغير المالك)
window.editSystemUser = function (userKey) {
  if (!canManageSystemUsers()) {
    alert("غير مصرح لك بتعديل المستخدمين.");
    return;
  }
  const target = (cloudUsers || []).find((u) => (u.id || u.username) === userKey);
  if (!target) return;

  const isOwnerAccount = target.role === "مالك" || target.username === "tryr" || target.id === "tryr";
  if (isOwnerAccount && !isMahmoud()) {
    alert("غير مصرح بتعديل حساب المالك.");
    return;
  }

  document.getElementById("userEditOriginalName").value = target.id || target.username;
  document.getElementById("manageUsername").value = target.username || "";
  document.getElementById("manageRole").value = target.role || "موظف";
  document.getElementById("manageBranch").value = target.branch || "فرع عجمان";
};

// إضافة مستخدم جديد أو تعديل مستخدم قائم في /users
window.handleSaveUser = async function (e) {
  e.preventDefault();
  if (!canManageSystemUsers()) {
    alert("إضافة وتعديل المستخدمين متاح للمدير العام والمالك فقط.");
    return;
  }

  await ensureAnonymousSignedIn();

  const editKey = document.getElementById("userEditOriginalName").value.trim();
  const usernameInput = document.getElementById("manageUsername").value.trim();
  const roleInput = document.getElementById("manageRole").value;
  const branchInput = document.getElementById("manageBranch").value;

  if (!usernameInput) {
    alert("يرجى إدخال اسم المستخدم.");
    return;
  }

  // منع المدير العام من إنشاء أو تعديل حساب المالك
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

  const updatedUser = {
    ...existingData,
    id: targetKey,
    fullName: existingData.fullName || usernameInput,
    username: usernameInput,
    password: existingData.password || "123456",
    role: roleInput,
    branch: roleInput === "مدير عام" ? "جميع الفروع" : branchInput,
    branchId: BRANCH_FIREBASE_VALUES[roleInput === "مدير عام" ? "جميع الفروع" : branchInput] || "ajman",
    hidden: roleInput === "مالك",
    active: existingData.active !== false
  };

  await set(ref(rtdb, `users/${targetKey}`), sanitizeForFirebase(updatedUser));
  const freshUsersSnap = await get(ref(rtdb, "users"));
  const allObj = freshUsersSnap.val() || {};
  cloudUsers = Object.entries(allObj).map(([k, v]) => ({ id: k, ...v }));

  renderUsersTable();
  resetUserForm();
  alert("تم حفظ بيانات المستخدم بنجاح.");
};