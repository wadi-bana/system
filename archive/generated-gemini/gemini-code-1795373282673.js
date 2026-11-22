/**
 * حفظ أو تحديث systemUnifiedData بأمان مع إعادة المصادقة تلقائياً عند انتهاء الجلسة
 * @param {Object|Function} payloadOrUpdater - كائن بيانات للكتابة/التحديث، أو دالة (currentData) => nextData للمعاملة الآمنة
 * @param {Object} options
 * @param {"set"|"update"|"transaction"} [options.mode="update"] - نوع العملية
 * @param {string} [options.subPath=""] - مسار فرعي داخل systemUnifiedData (مثال: "trips/trip_101")
 * @param {boolean} [options.stampMeta=true] - إضافة وقت ومستخدم آخر تحديث تلقائياً
 */
async function saveSystemUnifiedDataSafe(payloadOrUpdater, options = {}) {
  const mode = options.mode || "update";
  const subPath = String(options.subPath || "").replace(/^\/+|\/+$/g, "");
  const stampMeta = options.stampMeta !== false;

  const targetPath = subPath ? `systemUnifiedData/${subPath}` : "systemUnifiedData";
  const db = firebase.database();

  const executeWrite = async () => {
    const user = await ensureAuthenticatedSession();
    const ref = db.ref(targetPath);

    const metaFields = stampMeta
      ? {
          _lastUpdatedAt: firebase.database.ServerValue.TIMESTAMP,
          _lastUpdatedByUid: user.uid,
          _lastUpdatedByUsername: sessionAuthCache.username || null
        }
      : {};

    if (mode === "transaction" || typeof payloadOrUpdater === "function") {
      const result = await ref.transaction((currentVal) => {
        const nextVal = typeof payloadOrUpdater === "function"
          ? payloadOrUpdater(currentVal)
          : payloadOrUpdater;

        if (nextVal && typeof nextVal === "object" && !Array.isArray(nextVal) && stampMeta) {
          return { ...nextVal, ...metaFields };
        }
        return nextVal;
      });

      if (!result.committed) {
        throw new Error("تعذر إتمام معاملة حفظ systemUnifiedData.");
      }
      return result.snapshot.val();
    }

    if (mode === "set") {
      const dataToSet =
        payloadOrUpdater && typeof payloadOrUpdater === "object" && !Array.isArray(payloadOrUpdater) && stampMeta
          ? { ...payloadOrUpdater, ...metaFields }
          : payloadOrUpdater;

      await ref.set(dataToSet);
      return dataToSet;
    }

    // الوضع الافتراضي: update (يدمج الحقول المعدّلة فقط دون مسح بقية البيانات)
    if (!payloadOrUpdater || typeof payloadOrUpdater !== "object" || Array.isArray(payloadOrUpdater)) {
      throw new Error("في وضع update يجب تمرير كائن بيانات (Object).");
    }

    const dataToUpdate = { ...payloadOrUpdater, ...metaFields };
    await ref.update(dataToUpdate);
    return dataToUpdate;
  };

  try {
    return await executeWrite();
  } catch (err) {
    const isAuthOrPermissionError =
      err.code === "PERMISSION_DENIED" ||
      err.code === "auth/id-token-expired" ||
      err.code === "auth/network-request-failed" ||
      /permission_denied|permission denied|auth/i.test(err.message || "");

    // إذا انتهت الجلسة أثناء التنفيذ، نحاول إعادة المصادقة مرة واحدة ثم نعيد الحفظ
    if (isAuthOrPermissionError && sessionAuthCache.authEmail && sessionAuthCache.authPassword) {
      await firebase.auth().signInWithEmailAndPassword(
        sessionAuthCache.authEmail,
        sessionAuthCache.authPassword
      );
      return await executeWrite();
    }

    throw err;
  }
}