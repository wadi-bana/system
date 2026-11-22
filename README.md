# شركة وادي بناء للنقل الدولي — دليل التشغيل

## ملفات التطبيق

- `index.html`: نقطة الدخول للتطبيق الثابت أحادي الصفحة.
- `assets/css/app.css`: أنماط الواجهة وتنسيقات الطباعة.
- `assets/js/app.js`: ملف JavaScript التشغيلي المرتبط بالصفحة، ويهيئ Firebase Authentication وRealtime Database.
- `assets/images/wadi-bina-logo.jpeg`: شعار وادي بناء المستخدم في الواجهة والتقارير.
- تستخدم الصفحة الملفات ذات الأسماء الأساسية أعلاه؛ الملفات التي تحمل `(2)` نسخ مكررة غير مرتبطة.
- `app-compat.js`: ملف توافق قديم مستقل؛ لا تضفه إلى الصفحة الرئيسية، إذ يكرر أسماء دوال موجودة في التطبيق.
- `wadi_bana_unified.php` و`api.php`: بدائل PHP تتصل بـFirebase عبر REST، وتحتاج استضافة PHP مع امتداد cURL.
- لوحة إدارة المستخدمين تدعم الأدوار الإدارية الموسعة، تفعيل/إيقاف الحسابات، وحماية حسابات المالك، مع تسجيل عمليات الإدارة في `systemAuditLogs` داخل Firebase.
- واجهة الدخول تقبل اسم المستخدم وكلمة المرور، وتحوّل اسم المستخدم داخلياً إلى معرّف Email/Password في Firebase Authentication: `username@wadibana.local`، مع تحويل المسافات إلى نقاط (مثال `khaled waleed` يصبح `khaled.waleed@wadibana.local`). فعّل Authentication → Sign-in method → Email/Password، وأنشئ حسابات المصادقة بهذه العناوين. بعد إنشاء كل حساب، انسخ UID وأنشئ ملفه في Realtime Database تحت `users/{uid}`؛ لا تستخدم اسم المستخدم كمفتاح ولا تخزن كلمة المرور في قاعدة البيانات:

  ```json
  {
    "username": "tryr",
    "fullName": "ترير",
    "role": "owner",
    "branchId": "all",
    "active": true,
    "hidden": true
  }
  ```

  العناوين المرتبطة بأسماء المستخدمين هي `tryr@wadibana.local`, `waleed@wadibana.local`, `khaled.waleed@wadibana.local`, `yusef@wadibana.local`, `mohammed@wadibana.local`, `mohamod@wadibana.local`, و`abod@wadibana.local`. أدخل كلمات المرور التي اخترتها في Firebase Authentication فقط؛ Firebase يتطلب كلمة مرور من 6 أحرف على الأقل، لذا كلمة المرور ذات 4 أرقام في القائمة تحتاج إلى تغيير. الأدوار المدعومة: `owner`, `gm`, `chief_accountant`, `branch_manager_accountant`, `branch_manager`, `branch_accountant`, `employee`. قيم الفروع هي `all`, `ajman`, `abudhabi`, `yemen`, `muscat`, `oman`, `ain`, `mukalla`, `aden`. أنشئ حساب المالك وملفه أولاً من Firebase Console، ثم سجّل دخوله.
- قواعد بداية متوافقة مع مسارات التطبيق موجودة في `firebase.database.rules.json`. راجعها ثم انسخها إلى Firebase Console → Realtime Database → Rules وانشرها. بعد ترحيل الحسابات إلى Authentication و`users/{uid}`، احذف بيانات `systemUsers` القديمة من محرر Firebase Console لأنها قد تحتوي كلمات مرور سابقة.
- مخطط `systemUnifiedData` الحالي موحد على كل الفروع؛ لذلك القواعد تسمح للمستخدم النشط ذي الدور المسجل بقراءة وكتابة هذا المسار كاملاً، ولا توفر عزل فروع على مستوى الخادم. صلاحيات الفرع في الواجهة ليست حاجزاً أمنياً. يلزم تقسيم البيانات إلى مسارات مستقلة حسب الفرع قبل فرض عزل فرعي موثوق.

## التشغيل

1. من مجلد المشروع شغّل `python -m http.server 8000`، ثم افتح `http://localhost:8000/index.html`؛ لا تفتح الصفحة من `file://` لأن المتصفح قد يمنع وحدات JavaScript واتصال Firebase.
2. تأكد من تحميل CDN resources (Tailwind, Chart.js, html2canvas, jsPDF, PDF.js, XLSX, JsBarcode) ومن إعداد Firebase Realtime Database.
3. تبقى بدائل PHP منفصلة؛ شغّلها باستضافة PHP مع cURL، ولا تنقل إعداداتها أو ملفاتها إلى التطبيق الثابت.
4. اختبر الدخول، حفظ البيانات وإعادة تحميلها، انقطاع/عودة الشبكة، الطباعة والتصدير، واستعادة نسخة احتياطية قبل استخدام بيانات فعلية.

تحتوي الصفحة على تحويل مشروط من `wadibana.system.github.io` إلى `https://wadi-bana.github.io/system/` دون تحويل زوار العنوان الجديد. لكي يعمل العنوان القديم، يجب أن يوجَّه من إعدادات النطاق أو GitHub Pages إلى هذه الصفحة؛ الكود وحده لا ينشئ سجل DNS أو يربط نطاقاً غير متاح.

## تنبيه أمني مهم

إعداد Firebase للويب (بما فيه `apiKey`) يُحمّل في المتصفح، لذلك لا يُعد مفتاح API سراً ولا بديلاً عن المصادقة وقواعد قاعدة البيانات. يجب استخدام مفتاح Web API صالح للمشروع، وتفعيل Email/Password، ونشر قواعد Realtime Database المناسبة. لا تستخدم قواعد قراءة/كتابة عامة، ولا تضع Database Secret أو Service Account في JavaScript أو المستودع.

> هذا الملف المساعد يكمل دوال الطباعة وأسماء التصدير فقط، ولا يحل محل تهيئة Firebase أو تأمين النظام.
