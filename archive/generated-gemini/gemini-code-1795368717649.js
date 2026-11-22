/**
 * تسجيل حركة إدارية في audit_logs بشكل غير معطّل للعملية الأساسية
 * @param {Object} params
 * @param {string} params.action - نوع الحركة (مثل: CREATE_USER, UPDATE_PERMISSIONS, TOGGLE_USER_STATUS)
 * @param {string} params.targetUid - معرف المستخدم المستهدف
 * @param {string} params.targetUsername - اسم المستخدم المستهدف
 * @param {Object} [params.details] - تفاصيل إضافية مثل القيم القديمة والجديدة
 */
async function writeAuditLog({ action, targetUid, targetUsername, details = {} }) {
  const actor = firebase.auth().currentUser;
  if (!actor) return;

  const actorRole = (typeof currentSessionUser !== "undefined" && currentSessionUser?.role) || "unknown";
  const actorName = (typeof currentSessionUser !== "undefined" && currentSessionUser?.fullName) || actor.email || actor.uid;

  const logEntry = {
    uid: actor.uid,
    actorName: actorName,
    actorRole: actorRole,
    action: action,
    targetUid: targetUid || null,
    targetUsername: targetUsername || null,
    details: details,
    timestamp: firebase.database.ServerValue.TIMESTAMP
  };

  try {
    await firebase.database().ref("audit_logs").push(logEntry);
  } catch (err) {
    // لا نُفشل العملية الأساسية بسبب خطأ في سجل المراقبة، لكن نُسجّل التنبيه في Console
    console.warn("تعذر تسجيل حركة المراقبة في audit_logs:", err.message);
  }
}