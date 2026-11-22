async function ensureAuthenticatedSession() {
  const auth = firebase.auth();

  // إذا كانت الجلسة موجودة، نحدّث التوكن لضمان عدم انتهائه
  if (auth.currentUser) {
    try {
      await auth.currentUser.getIdToken(false);
      return auth.currentUser;
    } catch (_) {
      // إذا فشل التوكن الحالي ننتقل لإعادة المصادقة بالأسفل
    }
  }

  // محاولة إعادة تسجيل الدخول تلقائياً من ذاكرة الجلسة الحالية
  if (sessionAuthCache.authEmail && sessionAuthCache.authPassword) {
    const cred = await auth.signInWithEmailAndPassword(
      sessionAuthCache.authEmail,
      sessionAuthCache.authPassword
    );
    return cred.user;
  }

  throw new Error("انتهت جلسة المصادقة ولا توجد بيانات جلسة نشطة لإعادة الدخول تلقائياً. يرجى تسجيل الدخول مجدداً.");
}