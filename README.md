# شركة وادي بناء للنقل الدولي — دليل التشغيل

## ملفات التطبيق

- `index.html`: نقطة الدخول للتطبيق الثابت أحادي الصفحة.
- `assets/css/app.css`: أنماط الواجهة وتنسيقات الطباعة.
- `assets/js/app.js`: منطق التطبيق بوحدة JavaScript وتهيئة Firebase Realtime Database.
- `assets/images/wadi-bina-logo.jpeg`: شعار وادي بناء المستخدم في الواجهة والتقارير.
- `app-compat.js`: ملف توافق قديم مستقل؛ لا تضفه إلى الصفحة الرئيسية، إذ يكرر أسماء دوال موجودة في التطبيق.
- `wadi_bana_unified.php` و`api.php`: بدائل PHP تتصل بـFirebase عبر REST، وتحتاج استضافة PHP مع امتداد cURL.
- لوحة إدارة المستخدمين تدعم الأدوار الإدارية الموسعة، تفعيل/إيقاف الحسابات، وحماية حسابات المالك، مع تسجيل عمليات الإدارة في `systemAuditLogs` داخل Firebase.
- تسجيل الدخول ومزامنة البيانات يستخدمان Firebase Authentication. من Firebase Console فعّل Authentication → Sign-in method → Email/Password، وأنشئ حساباً لكل مستخدم. بعد إنشاء الحساب، انسخ UID وأنشئ في Realtime Database ملف `users/{uid}` بهذه البنية:

  ```json
  {
    "username": "اسم المستخدم",
    "fullName": "الاسم الكامل",
    "role": "owner",
    "branchId": "all",
    "active": true,
    "hidden": false
  }
  ```

  الأدوار المدعومة: `owner`, `gm`, `chief_accountant`, `branch_manager_accountant`, `branch_manager`, `branch_accountant`, `employee`. الفروع: `all`, `ajman`, `abudhabi`, `yemen`, `muscat`, `oman`, `ain`, `mukalla`, `aden`. أنشئ ملف المالك الأول من محرر Firebase Console بامتيازات المشروع، ثم سجّل دخوله؛ لا تسمح للواجهة بإنشاء مستخدم Firebase أو تخزين كلمات المرور في قاعدة البيانات.
- قواعد بداية متوافقة مع مسارات التطبيق موجودة في `firebase.database.rules.json`. راجعها ثم انسخها إلى Firebase Console → Realtime Database → Rules وانشرها. بعد ترحيل الحسابات إلى Authentication و`users/{uid}`، احذف بيانات `systemUsers` القديمة من محرر Firebase Console لأنها قد تحتوي كلمات مرور سابقة.
- مخطط `systemUnifiedData` الحالي موحد على كل الفروع؛ لذلك القواعد تسمح للمستخدم النشط ذي الدور المسجل بقراءة وكتابة هذا المسار كاملاً، ولا توفر عزل فروع على مستوى الخادم. صلاحيات الفرع في الواجهة ليست حاجزاً أمنياً. يلزم تقسيم البيانات إلى مسارات مستقلة حسب الفرع قبل فرض عزل فرعي موثوق.

## التشغيل

1. من مجلد المشروع شغّل `python -m http.server 8000`، ثم افتح `http://localhost:8000/index.html`؛ لا تفتح الصفحة من `file://` لأن المتصفح قد يمنع وحدات JavaScript واتصال Firebase.
2. تأكد من تحميل CDN resources (Tailwind, Chart.js, html2canvas, jsPDF, PDF.js, XLSX, JsBarcode) ومن إعداد Firebase Realtime Database.
3. تبقى بدائل PHP منفصلة؛ شغّلها باستضافة PHP مع cURL، ولا تنقل إعداداتها أو ملفاتها إلى التطبيق الثابت.
4. اختبر الدخول، حفظ البيانات وإعادة تحميلها، انقطاع/عودة الشبكة، الطباعة والتصدير، واستعادة نسخة احتياطية قبل استخدام بيانات فعلية.

تحتوي الصفحة على تحويل مشروط من `wadibana.system.github.io` إلى `https://wadi-bana.github.io/system/` دون تحويل زوار العنوان الجديد. لكي يعمل العنوان القديم، يجب أن يوجَّه من إعدادات النطاق أو GitHub Pages إلى هذه الصفحة؛ الكود وحده لا ينشئ سجل DNS أو يربط نطاقاً غير متاح.

## تنبيه أمني مهم

الواجهة الحالية تتضمن تسجيل دخول محلياً وكلمات مرور افتراضية، كما أن مفاتيح Firebase الموجودة في الواجهة ليست بديلاً عن المصادقة أو قواعد الأمان. لا تستخدمها لحماية بيانات العملاء أو تمنح قواعد Realtime Database قراءة/كتابة عامة. قبل إدخال بيانات حقيقية، انقل تسجيل الدخول إلى Firebase Authentication أو خادم موثوق، وطبّق قواعد قاعدة بيانات تتحقق من الهوية والصلاحيات على الخادم، وغيّر بيانات الدخول الافتراضية. لا تضع Database Secret أو أي اعتماد خاص في JavaScript أو مستودع عام.

> هذا الملف المساعد يكمل دوال الطباعة وأسماء التصدير فقط، ولا يحل محل تهيئة Firebase أو تأمين النظام.
