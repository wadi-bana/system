<?php
// إعدادات الاتصال بقاعدة البيانات MySQL
$host = 'localhost';
$db   = 'wadi_bina_db';
$user = 'root';
$pass = ''; // كلمة المرور الافتراضية في XAMPP تكون فارغة
$charset = 'utf8mb4';

$dsn = "mysql:host=$host;dbname=$db;charset=$charset";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
    $pdo = new PDO($dsn, $user, $pass, $options);
} catch (\PDOException $e) {
    // في حال فشل الاتصال، يتم إرجاع رسالة خطأ بصيغة JSON
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'status' => 'error', 
        'message' => 'فشل الاتصال بقاعدة البيانات: ' . $e->getMessage()
    ]);
    exit;
}
?>