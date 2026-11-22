async function handleSystemLoginSubmit(event) {
  if (event && event.preventDefault) event.preventDefault();

  const usernameInput = document.getElementById("loginUsername")?.value || "";
  const passwordInput = document.getElementById("loginPassword")?.value || "";

  const result = await loginAndSyncSystemData(usernameInput, passwordInput, {
    // مرّر قائمة أو كائن المستخدمين الموجود حالياً في صفحتك إن وُجد
    localUsers: typeof currentUsers !== "undefined" ? currentUsers : null,
    // استقبل أي تحديث حي لـ systemUnifiedData ومرّره لدالة المزامنة الموجودة لديك
    onUnifiedData: (latestData) => {
      if (typeof applyUnifiedDataSync === "function") {
        applyUnifiedDataSync(latestData);
      }
    }
  });

  // استخدم result.user (بنفس role و branchId الحاليين) لتشغيل واجهة النظام
  console.log("تم تسجيل الدخول ومزامنة البيانات بنجاح:", result.user);
}