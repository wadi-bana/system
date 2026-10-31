<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST, GET, PUT, DELETE");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

$host = "localhost";
$db_name = "wadi_bina_db";
$username = "root";
$password = "";

try {
    $conn = new PDO("mysql:host=$host;dbname=$db_name;charset=utf8mb4", $username, $password);
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch(PDOException $e) {
    echo json_encode(["status" => "error", "message" => "فشل الاتصال بقاعدة البيانات: " . $e->getMessage()]);
    exit();
}

$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

// 1. جلب كافة البيانات (التذاكر، الفواتير، الأمانات)
if ($action === 'get_all' && $method === 'GET') {
    $passengerStmt = $conn->prepare(
        "SELECT id, ticket_code, created_by, passenger_name, phone, passport_no, boarding_from, dropoff_to, trip_date, reporting_time, price_value, payment_method, audit_logs FROM bus_bookings ORDER BY id DESC"
    );
    $passengerStmt->execute();
    $passengers = $passengerStmt->fetchAll(PDO::FETCH_ASSOC);

    $cargoStmt = $conn->prepare(
        "SELECT id, invoice_no, created_by, invoice_date, trip_date, pay_location, paid_status, sender_name, sender_phone, receiver_name, receiver_phone, items_json, grand_total, audit_logs FROM cargo_invoices ORDER BY id DESC"
    );
    $cargoStmt->execute();
    $cargo = $cargoStmt->fetchAll(PDO::FETCH_ASSOC);

    $trustsStmt = $conn->prepare("SELECT id FROM trusts_and_amanat ORDER BY id DESC");
    $trustsStmt->execute();
    $trusts = $trustsStmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        "status" => "success",
        "passengers" => $passengers,
        "cargo" => $cargo,
        "trusts" => $trusts
    ]);
} 

// 2. حفظ أو تعديل تذكرة ركاب
else if ($action === 'save_passenger' && $method === 'POST') {
    $input = json_decode(file_get_contents("php://input"), true);
    
    $ticketId = $input['id'] ?? null;
    $user = $input['currentUser'] ?? ['username' => 'مستخدم', 'role' => 'موظف'];
    $tripDate = $input['tripDate'];

    // التحقق من صلاحية تاريخ الرحلة للموظف
    if ($user['role'] !== 'مدير') {
        $today = date('YYYY-MM-DD');
        if ($tripDate < date('Y-m-d')) {
            echo json_encode(["status" => "error", "message" => "عفواً! انقضى تاريخ الرحلة، التعديل متاح للمدير فقط."]);
            exit();
        }
    }

    $logEntry = [
        "user" => $user['username'],
        "time" => date('Y-m-d H:i:s'),
        "action" => isset($input['isEdit']) ? "تعديل بيانات التذكرة" : "إصدار التذكرة"
    ];

    if (isset($input['isEdit']) && $input['isEdit'] == true) {
        // تحديث تذكرة قائمة
        $stmtCheck = $conn->prepare("SELECT audit_logs FROM bus_bookings WHERE ticket_code = ?");
        $stmtCheck->execute([$ticketId]);
        $existing = $stmtCheck->fetch(PDO::FETCH_ASSOC);
        $logs = $existing ? json_decode($existing['audit_logs'], true) : [];
        $logs[] = $logEntry;

        $stmt = $conn->prepare("UPDATE bus_bookings SET passenger_name = :name, phone = :phone, passport_no = :passport, 
                                boarding_from = :origin, dropoff_to = :destination, trip_date = :tripDate, 
                                reporting_time = :reporting_time, price_value = :fare, payment_method = :payMethod, 
                                audit_logs = :logs WHERE ticket_code = :code");
        
        $stmt->execute([
            ':code' => $ticketId,
            ':name' => $input['name'],
            ':phone' => $input['phone'],
            ':passport' => $input['passport'],
            ':origin' => $input['origin'],
            ':destination' => $input['destination'],
            ':tripDate' => $tripDate,
            ':reporting_time' => $input['reportingTime'],
            ':fare' => $input['fare'],
            ':payMethod' => $input['payMethod'],
            ':logs' => json_encode($logs, JSON_UNESCAPED_UNICODE)
        ]);

        echo json_encode(["status" => "success", "message" => "تم تحديث التذكرة بنجاح"]);
    } else {
        // إضافة تذكرة جديدة
        $logs = [$logEntry];
        $stmt = $conn->prepare("INSERT INTO bus_bookings (ticket_code, created_by, passenger_name, phone, passport_no, boarding_from, dropoff_to, trip_date, reporting_time, price_value, payment_method, audit_logs) 
                                VALUES (:code, :created_by, :name, :phone, :passport, :origin, :destination, :tripDate, :reporting_time, :fare, :payMethod, :logs)");
        
        $stmt->execute([
            ':code' => $input['id'],
            ':created_by' => $user['username'],
            ':name' => $input['name'],
            ':phone' => $input['phone'],
            ':passport' => $input['passport'],
            ':origin' => $input['origin'],
            ':destination' => $input['destination'],
            ':tripDate' => $tripDate,
            ':reporting_time' => $input['reportingTime'],
            ':fare' => $input['fare'],
            ':payMethod' => $input['payMethod'],
            ':logs' => json_encode($logs, JSON_UNESCAPED_UNICODE)
        ]);

        echo json_encode(["status" => "success", "message" => "تم إصدار وحفظ التذكرة بنجاح"]);
    }
}

// 3. حفظ أو تعديل فاتورة شحن
else if ($action === 'save_cargo' && $method === 'POST') {
    $input = json_decode(file_get_contents("php://input"), true);
    $user = $input['currentUser'] ?? ['username' => 'مستخدم', 'role' => 'موظف'];
    $tripDate = $input['tripDate'];

    if ($user['role'] !== 'مدير' && $tripDate < date('Y-m-d')) {
        echo json_encode(["status" => "error", "message" => "عفواً! انقضى تاريخ رحلة الشحن، التعديل متاح للمدير فقط."]);
        exit();
    }

    $logEntry = [
        "user" => $user['username'],
        "time" => date('Y-m-d H:i:s'),
        "action" => isset($input['isEdit']) ? "تعديل فاتورة الشحن" : "إصدار فاتورة الشحن"
    ];

    $itemsJson = json_encode($input['items'], JSON_UNESCAPED_UNICODE);

    if (isset($input['isEdit']) && $input['isEdit'] == true) {
        $stmtCheck = $conn->prepare("SELECT audit_logs FROM cargo_invoices WHERE invoice_no = ?");
        $stmtCheck->execute([$input['id']]);
        $existing = $stmtCheck->fetch(PDO::FETCH_ASSOC);
        $logs = $existing ? json_decode($existing['audit_logs'], true) : [];
        $logs[] = $logEntry;

        $stmt = $conn->prepare("UPDATE cargo_invoices SET invoice_date = :invDate, trip_date = :tripDate, pay_location = :payLoc, 
                                paid_status = :status, sender_name = :sName, sender_phone = :sPhone, receiver_name = :rName, 
                                receiver_phone = :rPhone, items_json = :items, grand_total = :total, audit_logs = :logs WHERE invoice_no = :invNo");
        
        $stmt->execute([
            ':invNo' => $input['id'],
            ':invDate' => $input['date'],
            ':tripDate' => $tripDate,
            ':payLoc' => $input['payLocation'],
            ':status' => $input['paidStatus'],
            ':sName' => $input['senderName'],
            ':sPhone' => $input['senderPhone'],
            ':rName' => $input['receiverName'],
            ':rPhone' => $input['receiverPhone'],
            ':items' => $itemsJson,
            ':total' => $input['grandTotal'],
            ':logs' => json_encode($logs, JSON_UNESCAPED_UNICODE)
        ]);

        echo json_encode(["status" => "success", "message" => "تم تحديث فاتورة الشحن بنجاح"]);
    } else {
        $logs = [$logEntry];
        $stmt = $conn->prepare("INSERT INTO cargo_invoices (invoice_no, created_by, invoice_date, trip_date, pay_location, paid_status, sender_name, sender_phone, receiver_name, receiver_phone, items_json, grand_total, audit_logs) 
                                VALUES (:invNo, :user, :invDate, :tripDate, :payLoc, :status, :sName, :sPhone, :rName, :rPhone, :items, :total, :logs)");
        
        $stmt->execute([
            ':invNo' => $input['id'],
            ':user' => $user['username'],
            ':invDate' => $input['date'],
            ':tripDate' => $tripDate,
            ':payLoc' => $input['payLocation'],
            ':status' => $input['paidStatus'],
            ':sName' => $input['senderName'],
            ':sPhone' => $input['senderPhone'],
            ':rName' => $input['receiverName'],
            ':rPhone' => $input['receiverPhone'],
            ':items' => $itemsJson,
            ':total' => $input['grandTotal'],
            ':logs' => json_encode($logs, JSON_UNESCAPED_UNICODE)
        ]);

        echo json_encode(["status" => "success", "message" => "تم حفظ فاتورة الشحن بنجاح"]);
    }
}
else {
    echo json_encode(["status" => "error", "message" => "طلب غير صالح"]);
}
?>