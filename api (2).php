<?php
/**
 * ============================================================================
 * شركة وادي بناء للنقل الدولي - الخلفية البرمجية (PHP Backend API)
 * متوافقة بالكامل مع هيكل بيانات النظام الموحد وقاعدة بيانات Firebase RTDB
 * الرابط: https://wadi-bana-b585b-default-rtdb.firebaseio.com/
 * ============================================================================
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// إعدادات الاتصال بقاعدة بيانات Firebase Realtime Database
define('FIREBASE_DB_URL', 'https://wadi-bana-b585b-default-rtdb.firebaseio.com');
// ضع رمز السرية (Database Secret) أو Auth Token هنا إذا كانت قواعد الأمان في فيربيس مقيدة
define('FIREBASE_AUTH_SECRET', '');

/**
 * دالة إرسال الطلبات إلى Firebase REST API عبر cURL
 */
function firebaseRequest(string $path, string $method = 'GET', $data = null): array
{
    $cleanPath = trim($path, '/');
    $url = FIREBASE_DB_URL . ($cleanPath !== '' ? '/' . $cleanPath : '') . '.json';

    if (FIREBASE_AUTH_SECRET !== '') {
        $url .= '?auth=' . urlencode(FIREBASE_AUTH_SECRET);
    }

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, strtoupper($method));
    curl_setopt($ch, CURLOPT_TIMEOUT, 20);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);

    $headers = ['Content-Type: application/json; charset=utf-8'];

    if ($data !== null && in_array(strtoupper($method), ['POST', 'PUT', 'PATCH'], true)) {
        $jsonPayload = json_encode($data, JSON_UNESCAPED_UNICODE);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $jsonPayload);
        $headers[] = 'Content-Length: ' . strlen($jsonPayload);
    }

    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($curlError) {
        return [
            'success' => false,
            'status' => 500,
            'error' => 'خطأ في الاتصال بـ Firebase: ' . $curlError
        ];
    }

    $decoded = json_decode($response, true);

    if ($httpCode >= 400) {
        return [
            'success' => false,
            'status' => $httpCode,
            'error' => $decoded['error'] ?? 'فشل طلب Firebase',
            'raw' => $decoded
        ];
    }

    return [
        'success' => true,
        'status' => $httpCode,
        'data' => $decoded
    ];
}

/**
 * قراءة مدخلات JSON من الطلب
 */
function getJsonInput(): array
{
    $raw = file_get_contents('php://input');
    if (!$raw) {
        return [];
    }
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

/**
 * إرسال استجابة JSON موحدة
 */
function sendResponse(array $payload, int $statusCode = 200): void
{
    http_response_code($statusCode);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

/**
 * تهيئة المصفوفات القادمة من Firebase (تجنب القيم الفارغة أو المفاتيح المتقطعة)
 */
function normalizeList(mixed $val): array
{
    if (!is_array($val)) {
        return [];
    }
    return array_values(array_filter($val, fn($item) => $item !== null));
}

/**
 * حساب الأرقام التسلسلية التالية تلقائياً بنفس منطق الواجهة الأمامية
 */
function recalculateSequenceNumbers(array &$db): void
{
    // 1. التذاكر (تبدأ من 115 كحد أدنى)
    $maxTicket = 114;
    foreach ($db['passengers'] ?? [] as $p) {
        $idNum = (int)($p['id'] ?? 0);
        if ($idNum > $maxTicket) {
            $maxTicket = $idNum;
        }
        if (!empty($p['extraPassengers']) && is_array($p['extraPassengers'])) {
            foreach ($p['extraPassengers'] as $ex) {
                $exNum = (int)($ex['ticketNo'] ?? 0);
                if ($exNum > $maxTicket) {
                    $maxTicket = $exNum;
                }
            }
        }
    }
    $db['nextTicketNo'] = $maxTicket + 1;

    // 2. فواتير الشحن (تبدأ من 158 كحد أدنى)
    $maxCargo = 157;
    foreach ($db['cargo'] ?? [] as $c) {
        $cNum = (int)($c['id'] ?? 0);
        if ($cNum > $maxCargo) {
            $maxCargo = $cNum;
        }
    }
    $db['nextCargoNo'] = $maxCargo + 1;

    // 3. فواتير الذمم الآجلة
    $maxDebt = 0;
    foreach ($db['debtInvoices'] ?? [] as $d) {
        $dNum = (int)($d['id'] ?? 0);
        if ($dNum > $maxDebt) {
            $maxDebt = $dNum;
        }
    }
    $db['nextDebtInvNo'] = $maxDebt + 1;

    // 4. تأشيرات العبور
    $maxTransit = 0;
    foreach ($db['transitVisas'] ?? [] as $t) {
        $tNum = (int)($t['id'] ?? 0);
        if ($tNum > $maxTransit) {
            $maxTransit = $tNum;
        }
    }
    $db['nextTransitNo'] = $maxTransit + 1;
}

/**
 * جلب هيكل البيانات الكامل من العقدة الرئيسية systemUnifiedData
 */
function fetchUnifiedData(): array
{
    $res = firebaseRequest('systemUnifiedData', 'GET');
    if (!$res['success']) {
        sendResponse($res, $res['status']);
    }

    $raw = is_array($res['data']) ? $res['data'] : [];
    return [
        'trips'         => normalizeList($raw['trips'] ?? []),
        'drivers'       => normalizeList($raw['drivers'] ?? []),
        'employees'     => normalizeList($raw['employees'] ?? []),
        'passengers'    => normalizeList($raw['passengers'] ?? []),
        'cargo'         => normalizeList($raw['cargo'] ?? []),
        'vouchers'      => normalizeList($raw['vouchers'] ?? []),
        'debtInvoices'  => normalizeList($raw['debtInvoices'] ?? []),
        'transitVisas'  => normalizeList($raw['transitVisas'] ?? []),
        'nextTicketNo'  => $raw['nextTicketNo'] ?? 141,
        'nextCargoNo'   => $raw['nextCargoNo'] ?? 158,
        'nextDebtInvNo' => $raw['nextDebtInvNo'] ?? 2,
        'nextTransitNo' => $raw['nextTransitNo'] ?? 1,
        '_lastUpdated'  => $raw['_lastUpdated'] ?? (int)(microtime(true) * 1000),
    ];
}

/**
 * حفظ هيكل البيانات الكامل إلى Firebase
 */
function saveUnifiedData(array $db): array
{
    recalculateSequenceNumbers($db);
    $db['_lastUpdated'] = (int)(microtime(true) * 1000);
    return firebaseRequest('systemUnifiedData', 'PUT', $db);
}

// ============================================================================
// موجه الطلبات (API Router)
// ============================================================================
$action = $_GET['action'] ?? 'status';
$method = $_SERVER['REQUEST_METHOD'];
$input  = getJsonInput();

// الأقسام المدعومة داخل systemUnifiedData
$allowedCollections = [
    'trips',
    'drivers',
    'employees',
    'passengers',
    'cargo',
    'vouchers',
    'debtInvoices',
    'transitVisas'
];

switch ($action) {
    // 1. فحص حالة الاتصال بقاعدة بيانات Firebase
    case 'status':
        $ping = firebaseRequest('systemUnifiedData/_lastUpdated', 'GET');
        sendResponse([
            'success' => $ping['success'],
            'service' => 'Wadi Bina International Transport PHP Backend',
            'firebase_url' => FIREBASE_DB_URL,
            'connected' => $ping['success'],
            'last_updated' => $ping['data'] ?? null,
            'endpoints' => [
                'GET  ?action=sync' => 'جلب جميع بيانات النظام الموحد',
                'POST ?action=sync' => 'مزامنة وحفظ بيانات النظام الموحد بالكامل',
                'POST ?action=login' => 'تسجيل الدخول والتحقق من المستخدمين في systemUsers',
                'GET  ?action=users' => 'جلب قائمة المستخدمين',
                'POST ?action=save_user' => 'إضافة أو تعديل مستخدم',
                'GET  ?action=list&collection=passengers' => 'جلب سجلات قسم معين (trips, passengers, cargo, drivers, employees, vouchers, debtInvoices, transitVisas)',
                'POST ?action=save_item&collection=passengers' => 'إضافة أو تعديل سجل داخل قسم معين',
                'POST ?action=delete_item&collection=passengers' => 'حذف سجل عبر id',
                'GET  ?action=dashboard_stats' => 'حساب إحصائيات لوحة التحكم والصندوق المالي'
            ]
        ]);
        break;

    // 2. جلب أو مزامنة كامل قاعدة البيانات (systemUnifiedData)
    case 'sync':
        if ($method === 'GET') {
            $db = fetchUnifiedData();
            sendResponse(['success' => true, 'data' => $db]);
        } elseif ($method === 'POST' || $method === 'PUT') {
            if (empty($input)) {
                sendResponse(['success' => false, 'error' => 'لا توجد بيانات مرسلة للمزامنة'], 400);
            }
            $db = [
                'trips'         => normalizeList($input['trips'] ?? []),
                'drivers'       => normalizeList($input['drivers'] ?? []),
                'employees'     => normalizeList($input['employees'] ?? []),
                'passengers'    => normalizeList($input['passengers'] ?? []),
                'cargo'         => normalizeList($input['cargo'] ?? []),
                'vouchers'      => normalizeList($input['vouchers'] ?? []),
                'debtInvoices'  => normalizeList($input['debtInvoices'] ?? []),
                'transitVisas'  => normalizeList($input['transitVisas'] ?? []),
                'nextTicketNo'  => $input['nextTicketNo'] ?? 141,
                'nextCargoNo'   => $input['nextCargoNo'] ?? 158,
                'nextDebtInvNo' => $input['nextDebtInvNo'] ?? 2,
                'nextTransitNo' => $input['nextTransitNo'] ?? 1,
            ];
            $saveRes = saveUnifiedData($db);
            sendResponse($saveRes, $saveRes['status']);
        }
        break;

    // 3. تسجيل الدخول والتحقق من المستخدمين (systemUsers)
    case 'login':
        $username = trim($input['username'] ?? $_POST['username'] ?? '');
        $password = trim($input['password'] ?? $_POST['password'] ?? '');

        if ($username === '' || $password === '') {
            sendResponse(['success' => false, 'error' => 'يرجى إدخال اسم المستخدم وكلمة المرور'], 400);
        }

        $usersRes = firebaseRequest('systemUsers', 'GET');
        $users = normalizeList($usersRes['data'] ?? []);

        // المستخدمون الافتراضيون في حال كانت العقدة فارغة لأول مرة
        if (empty($users)) {
            $users = [
                ['username' => 'محمود', 'password' => '102030', 'role' => 'مدير عام', 'branch' => 'فرع عجمان'],
                ['username' => 'وليد السيد', 'password' => '708090', 'role' => 'مدير عام', 'branch' => 'فرع عجمان'],
                ['username' => 'يوسف', 'password' => '405060', 'role' => 'موظف', 'branch' => 'فرع اليمن']
            ];
            firebaseRequest('systemUsers', 'PUT', $users);
        }

        foreach ($users as $u) {
            if (($u['username'] ?? '') === $username && ($u['password'] ?? '') === $password) {
                $safeUser = $u;
                unset($safeUser['password']);
                sendResponse([
                    'success' => true,
                    'message' => 'تم تسجيل الدخول بنجاح',
                    'user' => $safeUser
                ]);
            }
        }

        sendResponse(['success' => false, 'error' => 'بيانات الدخول غير صحيحة'], 401);
        break;

    // 4. جلب المستخدمين
    case 'users':
        $usersRes = firebaseRequest('systemUsers', 'GET');
        $users = normalizeList($usersRes['data'] ?? []);
        sendResponse(['success' => true, 'users' => $users]);
        break;

    // 5. إضافة أو تعديل مستخدم
    case 'save_user':
        $username = trim($input['username'] ?? '');
        $password = trim($input['password'] ?? '');
        $role     = trim($input['role'] ?? 'موظف');
        $branch   = trim($input['branch'] ?? 'فرع عجمان');
        $origName = trim($input['originalUsername'] ?? $username);

        if ($username === '' || $password === '') {
            sendResponse(['success' => false, 'error' => 'اسم المستخدم وكلمة المرور مطلوبان'], 400);
        }

        $usersRes = firebaseRequest('systemUsers', 'GET');
        $users = normalizeList($usersRes['data'] ?? []);
        $updated = false;

        foreach ($users as &$u) {
            if (($u['username'] ?? '') === $origName) {
                $u['username'] = $username;
                $u['password'] = $password;
                $u['role']     = $role;
                $u['branch']   = $branch;
                $updated = true;
                break;
            }
        }
        unset($u);

        if (!$updated) {
            $users[] = [
                'username' => $username,
                'password' => $password,
                'role'     => $role,
                'branch'   => $branch
            ];
        }

        $saveRes = firebaseRequest('systemUsers', 'PUT', $users);
        sendResponse([
            'success' => $saveRes['success'],
            'message' => $updated ? 'تم تحديث بيانات المستخدم' : 'تم إضافة المستخدم بنجاح',
            'users' => $users
        ]);
        break;

    // 6. جلب سجلات قسم محدد مع دعم الفلترة حسب الفرع أو البحث
    case 'list':
        $collection = $_GET['collection'] ?? '';
        if (!in_array($collection, $allowedCollections, true)) {
            sendResponse(['success' => false, 'error' => 'اسم القسم غير صالح'], 400);
        }

        $db = fetchUnifiedData();
        $items = $db[$collection];

        $branch = trim($_GET['branch'] ?? '');
        if ($branch !== '' && $branch !== 'ALL') {
            $items = array_values(array_filter($items, fn($row) => ($row['branch'] ?? '') === $branch));
        }

        $q = mb_strtolower(trim($_GET['q'] ?? ''), 'UTF-8');
        if ($q !== '') {
            $items = array_values(array_filter($items, function ($row) use ($q) {
                $haystack = mb_strtolower(json_encode($row, JSON_UNESCAPED_UNICODE), 'UTF-8');
                return mb_strpos($haystack, $q) !== false;
            }));
        }

        sendResponse([
            'success' => true,
            'collection' => $collection,
            'count' => count($items),
            'items' => $items
        ]);
        break;

    // 7. إضافة أو تعديل سجل داخل أي قسم (تذكرة، فاتورة شحن، رحلة، سند، إلخ)
    case 'save_item':
        $collection = $_GET['collection'] ?? ($input['collection'] ?? '');
        if (!in_array($collection, $allowedCollections, true)) {
            sendResponse(['success' => false, 'error' => 'اسم القسم غير صالح'], 400);
        }

        $item = $input['item'] ?? $input;
        unset($item['collection']);

        if (empty($item) || !is_array($item)) {
            sendResponse(['success' => false, 'error' => 'بيانات السجل فارغة'], 400);
        }

        $db = fetchUnifiedData();
        $nowStr = date('Y-m-d H:i');
        $author = $item['updatedBy'] ?? $item['createdBy'] ?? 'PHP Backend';

        // توليد رقم معرف تلقائي إذا لم يكن موجوداً
        if (empty($item['id'])) {
            if ($collection === 'passengers') {
                $item['id'] = (string)$db['nextTicketNo'];
            } elseif ($collection === 'cargo') {
                $item['id'] = (string)$db['nextCargoNo'];
            } elseif ($collection === 'debtInvoices') {
                $item['id'] = (string)$db['nextDebtInvNo'];
            } elseif ($collection === 'transitVisas') {
                $item['id'] = (string)$db['nextTransitNo'];
            } else {
                $item['id'] = substr($collection, 0, 3) . '_' . (int)(microtime(true) * 1000);
            }
        } else {
            $item['id'] = (string)$item['id'];
        }

        $foundIndex = -1;
        foreach ($db[$collection] as $idx => $existing) {
            if ((string)($existing['id'] ?? '') === $item['id']) {
                $foundIndex = $idx;
                break;
            }
        }

        if ($foundIndex !== -1) {
            $existing = $db[$collection][$foundIndex];
            $auditLog = $existing['auditLog'] ?? [];
            $auditLog[] = [
                'action' => 'تعديل عبر الخلفية البرمجية (API)',
                'user'   => $author,
                'time'   => $nowStr
            ];
            $item['createdBy'] = $existing['createdBy'] ?? $author;
            $item['createdAt'] = $existing['createdAt'] ?? $nowStr;
            $item['auditLog']  = $auditLog;
            $db[$collection][$foundIndex] = array_merge($existing, $item);
        } else {
            $item['createdBy'] = $item['createdBy'] ?? $author;
            $item['createdAt'] = $item['createdAt'] ?? $nowStr;
            $item['auditLog']  = $item['auditLog'] ?? [[
                'action' => 'إنشاء السجل',
                'user'   => $item['createdBy'],
                'time'   => $item['createdAt']
            ]];
            array_unshift($db[$collection], $item);
        }

        $saveRes = saveUnifiedData($db);
        sendResponse([
            'success' => $saveRes['success'],
            'message' => $foundIndex !== -1 ? 'تم تحديث السجل بنجاح' : 'تم إضافة السجل بنجاح',
            'item' => $item,
            'sequences' => [
                'nextTicketNo'  => $db['nextTicketNo'],
                'nextCargoNo'   => $db['nextCargoNo'],
                'nextDebtInvNo' => $db['nextDebtInvNo'],
                'nextTransitNo' => $db['nextTransitNo'],
            ]
        ], $saveRes['status']);
        break;

    // 8. حذف سجل من قسم معين
    case 'delete_item':
        $collection = $_GET['collection'] ?? ($input['collection'] ?? '');
        $id = (string)($_GET['id'] ?? ($input['id'] ?? ''));

        if (!in_array($collection, $allowedCollections, true) || $id === '') {
            sendResponse(['success' => false, 'error' => 'يرجى تحديد القسم ورقم السجل id'], 400);
        }

        $db = fetchUnifiedData();
        $beforeCount = count($db[$collection]);
        $db[$collection] = array_values(array_filter(
            $db[$collection],
            fn($row) => (string)($row['id'] ?? '') !== $id
        ));

        if (count($db[$collection]) === $beforeCount) {
            sendResponse(['success' => false, 'error' => 'السجل غير موجود'], 404);
        }

        $saveRes = saveUnifiedData($db);
        sendResponse([
            'success' => $saveRes['success'],
            'message' => "تم حذف السجل #{$id} بنجاح"
        ], $saveRes['status']);
        break;

    // 9. إحصائيات لوحة التحكم والصندوق المالي
    case 'dashboard_stats':
        $db = fetchUnifiedData();
        $branch = trim($_GET['branch'] ?? 'ALL');

        $filterByBranch = function (array $list) use ($branch): array {
            if ($branch === '' || $branch === 'ALL') {
                return $list;
            }
            return array_values(array_filter($list, fn($x) => ($x['branch'] ?? '') === $branch));
        };

        $passengers = $filterByBranch($db['passengers']);
        $cargo      = $filterByBranch($db['cargo']);
        $vouchers   = $filterByBranch($db['vouchers']);
        $drivers    = $filterByBranch($db['drivers']);
        $transit    = $filterByBranch($db['transitVisas']);

        $ticketRev = 0;
        foreach ($passengers as $p) {
            if (($p['payMethod'] ?? '') === 'مدفوع') {
                $ticketRev += (float)($p['fare'] ?? 0);
            }
        }

        $cargoRev = 0;
        foreach ($cargo as $c) {
            if (($c['paymentStatus'] ?? '') === 'مدفوع') {
                $cargoRev += (float)($c['grandTotal'] ?? 0);
            }
        }

        $transitRev = 0;
        foreach ($transit as $t) {
            if (($t['paymentStatus'] ?? '') === 'تم الدفع والاصدار') {
                $transitRev += (float)($t['amount'] ?? 0);
            }
        }

        $driversExp = array_reduce($drivers, fn($s, $d) => $s + (float)($d['totalExpenses'] ?? 0), 0.0);
        $voucherExp = 0.0;
        $voucherRec = 0.0;

        foreach ($vouchers as $v) {
            if (($v['type'] ?? '') === 'صرف') {
                $voucherExp += (float)($v['amount'] ?? 0);
            } elseif (($v['type'] ?? '') === 'قبض') {
                $voucherRec += (float)($v['amount'] ?? 0);
            }
        }

        $totalExpenses = $driversExp + $voucherExp;
        $netCashBox = ($ticketRev + $cargoRev + $transitRev + $voucherRec) - $totalExpenses;

        sendResponse([
            'success' => true,
            'branch' => $branch,
            'stats' => [
                'totalBookings' => count($passengers),
                'totalCargoInvoices' => count($cargo),
                'paidTicketsRevenue' => $ticketRev,
                'paidCargoRevenue' => $cargoRev,
                'paidTransitRevenue' => $transitRev,
                'vouchersReceipt' => $voucherRec,
                'driversExpenses' => $driversExp,
                'vouchersExpenses' => $voucherExp,
                'totalExpenses' => $totalExpenses,
                'netCashBoxBalance' => $netCashBox
            ]
        ]);
        break;

    default:
        sendResponse(['success' => false, 'error' => 'الأمر action غير مدعوم'], 400);
}
