package com.wadibina.transport;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public class WadiBinaApplication {

    // ==========================================
    // 1. نموذج المستخدم (User Entity & Role)
    // ==========================================
    public static class User {
        private String username;
        private String password;
        private String role; // "مدير" أو "موظف"

        public User(String username, String password, String role) {
            this.username = username;
            this.password = password;
            this.role = role;
        }

        public String getUsername() { return username; }
        public String getPassword() { return password; }
        public String getRole() { return role; }
        public boolean isManager() { return "مدير".equals(role); }
        public boolean hasPassword(String password) { return this.password.equals(password); }
    }

    // ==========================================
    // 2. نموذج سجل التعديلات (Audit Log)
    // ==========================================
    public static class AuditLog {
        private String username;
        private String action;
        private String timestamp;

        public AuditLog(String username, String action) {
            this.username = username;
            this.action = action;
            this.timestamp = LocalDateTime.now().toString();
        }

        public String getUsername() { return username; }
        public String getAction() { return action; }
        public String getTimestamp() { return timestamp; }
    }

    // ==========================================
    // 3. نموذج تذكرة حجز الركاب (Passenger Booking)
    // ==========================================
    public static class PassengerBooking {
        private String id;
        private String passengerName;
        private String passportNo;
        private String phone;
        private String origin;
        private String destination;
        private LocalDate tripDate;
        private String reportingTime;
        private BigDecimal fare;
        private String paymentMethod;
        private List<AuditLog> logs = new ArrayList<>();

        public PassengerBooking(String id, String passengerName, String passportNo, String phone,
                                String origin, String destination, LocalDate tripDate,
                                String reportingTime, BigDecimal fare, String paymentMethod) {
            this.id = id;
            this.passengerName = passengerName;
            this.passportNo = passportNo;
            this.phone = phone;
            this.origin = origin;
            this.destination = destination;
            this.tripDate = tripDate;
            this.reportingTime = reportingTime;
            this.fare = fare;
            this.paymentMethod = paymentMethod;
        }

        public String getId() { return id; }
        public String getPassengerName() { return passengerName; }
        public String getPassportNo() { return passportNo; }
        public String getPhone() { return phone; }
        public String getOrigin() { return origin; }
        public String getDestination() { return destination; }
        public LocalDate getTripDate() { return tripDate; }
        public String getReportingTime() { return reportingTime; }
        public BigDecimal getFare() { return fare; }
        public String getPaymentMethod() { return paymentMethod; }
        public List<AuditLog> getLogs() { return logs; }
        public void addLog(AuditLog log) { this.logs.add(log); }

        public void updateDetails(String name, String passport, String phone, String origin, 
                                  String destination, LocalDate tripDate, String time, 
                                  BigDecimal fare, String payMethod) {
            this.passengerName = name;
            this.passportNo = passport;
            this.phone = phone;
            this.origin = origin;
            this.destination = destination;
            this.tripDate = tripDate;
            this.reportingTime = time;
            this.fare = fare;
            this.paymentMethod = payMethod;
        }
    }

    // ==========================================
    // 4. نموذج فاتورة الشحن (Cargo Invoice)
    // ==========================================
    public static class CargoInvoice {
        private String id;
        private LocalDate invoiceDate;
        private LocalDate tripDate; // تاريخ الرحلة والتحريك
        private String senderName;
        private String senderPhone;
        private String receiverName;
        private String receiverPhone;
        private String origin;
        private String destination;
        private BigDecimal grandTotal;
        private String paymentStatus;
        private List<AuditLog> logs = new ArrayList<>();

        public CargoInvoice(String id, LocalDate invoiceDate, LocalDate tripDate, String senderName,
                            String senderPhone, String receiverName, String receiverPhone,
                            String origin, String destination, BigDecimal grandTotal, String paymentStatus) {
            this.id = id;
            this.invoiceDate = invoiceDate;
            this.tripDate = tripDate;
            this.senderName = senderName;
            this.senderPhone = senderPhone;
            this.receiverName = receiverName;
            this.receiverPhone = receiverPhone;
            this.origin = origin;
            this.destination = destination;
            this.grandTotal = grandTotal;
            this.paymentStatus = paymentStatus;
        }

        public String getId() { return id; }
        public LocalDate getInvoiceDate() { return invoiceDate; }
        public LocalDate getTripDate() { return tripDate; }
        public String getSenderName() { return senderName; }
        public String getSenderPhone() { return senderPhone; }
        public String getReceiverName() { return receiverName; }
        public String getReceiverPhone() { return receiverPhone; }
        public String getOrigin() { return origin; }
        public String getDestination() { return destination; }
        public BigDecimal getGrandTotal() { return grandTotal; }
        public String getPaymentStatus() { return paymentStatus; }
        public List<AuditLog> getLogs() { return logs; }
        public void addLog(AuditLog log) { this.logs.add(log); }
    }

    // ==========================================
    // 5. إدارة الصلاحيات والعمليات (Service Layer)
    // ==========================================
    public static class WadiBinaService {
        private List<PassengerBooking> passengers = new ArrayList<>();
        private List<CargoInvoice> cargoInvoices = new ArrayList<>();

        public void addPassenger(PassengerBooking booking) {
            if (booking == null) {
                throw new IllegalArgumentException("يجب توفير تذكرة حجز صالحة.");
            }
            passengers.add(booking);
            booking.addLog(new AuditLog("النظام", "إضافة تذكرة حجز جديدة"));
        }

        public List<PassengerBooking> getPassengers() {
            return passengers;
        }

        public void addCargoInvoice(CargoInvoice invoice) {
            cargoInvoices.add(invoice);
            invoice.addLog(new AuditLog("النظام", "إضافة فاتورة شحن جديدة"));
        }

        public List<CargoInvoice> getCargoInvoices() {
            return cargoInvoices;
        }

        // التحقق مما إذا كان مسموحاً التعديل أو الحذف بناءً على تاريخ الرحلة والدور
        public boolean canModifyOrDelete(User user, LocalDate tripDate) {
            if (user == null || tripDate == null) {
                return false;
            }
            if (user.isManager() || "مدير".equals(user.getRole())) {
                return true; // المدير يمتلك صلاحية مطلقة في أي وقت
            }
            // الموظف العادي: مسموح فقط إذا كان تاريخ الرحلة اليوم أو في المستقبل
            LocalDate today = LocalDate.now();
            return !tripDate.isBefore(today);
        }

        public void updatePassenger(User user, String ticketId, String name, String passport, 
                                    String phone, String origin, String destination, 
                                    LocalDate tripDate, String time, BigDecimal fare, String payMethod) {
            if (user == null) {
                throw new IllegalArgumentException("يجب تسجيل الدخول قبل إجراء التعديل.");
            }

            Optional<PassengerBooking> opt = passengers.stream().filter(p -> p.getId().equals(ticketId)).findFirst();
            if (!opt.isPresent()) {
                throw new IllegalArgumentException("تذكرة الحجز غير موجودة: " + ticketId);
            }

            PassengerBooking booking = opt.get();

            // فحص صلاحية التاريخ بناءً على تاريخ الرحلة الجديد/المحدّث
            if (!canModifyOrDelete(user, tripDate)) {
                throw new SecurityException("عفواً! انقضى تاريخ رحلة هذه التذكرة. التعديل متاح للمدير فقط.");
            }

            booking.updateDetails(name, passport, phone, origin, destination, tripDate, time, fare, payMethod);
            booking.addLog(new AuditLog(user.getUsername(), "تعديل بيانات التذكرة بواسطة " + user.getUsername()));
            System.out.println("تم تحديث التذكرة #" + ticketId + " بنجاح.");
        }
    }

    // ==========================================
    // نقطة التشغيل الرئيسية للاختبار
    // ==========================================
    public static void main(String[] args) {
        System.out.println("=== نظام شركة وادي بناء للنقل البري VIP - Java Backend ===");
        
        User employee = new User("محمود", "102030", "موظف");
        User manager = new User("وليد السيد", "708090", "مدير");

        WadiBinaService service = new WadiBinaService();

        // تجربة إنشاء تذكرة برحلة قادمة
        LocalDate futureTrip = LocalDate.now().plusDays(3);
        PassengerBooking ticket = new PassengerBooking("100", "عبدالله اليافعي", "A123456", 
                "0501234567", "عجمان", "عدن", futureTrip, "07:00 صباحاً", new BigDecimal("400"), "مدفوع");

        service.passengers.add(ticket);

        // التحقق من صلاحيات المدير قبل تنفيذ التعديلات
        System.out.println("صلاحية المدير: " + manager.getUsername() + " | يمكن التعديل؟ " + service.canModifyOrDelete(manager, futureTrip));

        // محاولة تعديل من موظف لتذكرة رحلتها قادمة (تتم بنجاح)
        try {
            service.updatePassenger(employee, "100", "عبدالله أحمد اليافعي", "A123456", 
                    "0501234567", "عجمان", "عدن (شارع تعز)", futureTrip, "08:00 صباحاً", new BigDecimal("400"), "مدفوع");
            System.out.println("سجل التعديلات المتاحة: " + ticket.getLogs().get(0).getAction());
        } catch (Exception e) {
            System.out.println(e.getMessage());
        }
    }
}