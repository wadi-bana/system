package com.wadibana.service;

import com.wadibana.model.Passenger;
import com.wadibana.model.ExtraPassenger;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * خدمة إدارة تذاكر الركاب والركاب الإضافيين لشركة وادي بناء للنقل البري.
 */
public class PassengerService {

    // محاكاة مستودع البيانات المحلي (يمكن استبداله بـ Repository أو Database لاحقاً)
    private List<Passenger> passengerDatabase = new ArrayList<>();
    private long ticketSequenceCounter = 141; // يبدأ التسلسل من 141 كما في النظام

    /**
     * إصدار تذكرة جديدة للركاب
     */
    public Passenger createTicket(Passenger passenger) {
        if (passenger.getId() == null || passenger.getId().isEmpty()) {
            passenger.setId(String.valueOf(ticketSequenceCounter++));
        }
        
        // حساب التكلفة الافتراضية إذا لم تحدد (350 درهم لكل راكب كقاعدة عامة)
        int totalPax = 1 + (passenger.getExtraPassengers() != null ? passenger.getExtraPassengers().size() : 0);
        passenger.setPassengerCount(totalPax);
        
        if (passenger.getFare() <= 0) {
            passenger.setFare(totalPax * 350.0);
        }

        passengerDatabase.add(0, passenger); // إضافة في البداية لتظهر أحدث التذاكر أولاً
        return passenger;
    }

    /**
     * جلب جميع التذاكر المسجلة
     */
    public List<Passenger> getAllPassengers() {
        return passengerDatabase;
    }

    /**
     * البحث عن تذكرة برقم البوليصة
     */
    public Optional<Passenger> getPassengerById(String id) {
        return passengerDatabase.stream()
                .filter(p -> p.getId().equals(id))
                .findFirst();
    }

    /**
     * تصفية التذاكر حسب الفرع
     */
    public List<Passenger> getPassengersByBranch(String branch) {
        return passengerDatabase.stream()
                .filter(p -> branch.equals(p.getBranch()))
                .collect(Collectors.toList());
    }

    /**
     * تصفية التذاكر حسب تاريخ الرحلة (لكشوف المانفيستو)
     */
    public List<Passenger> getPassengersByDate(String date) {
        return passengerDatabase.stream()
                .filter(p -> date.equals(p.getDate()))
                .collect(Collectors.toList());
    }

    /**
     * تحديث بيانات تذكرة قائمة
     */
    public boolean updatePassenger(String id, Passenger updatedData) {
        Optional<Passenger> existingOpt = getPassengerById(id);
        if (existingOpt.isPresent()) {
            Passenger p = existingOpt.get();
            p.setAgent(updatedData.getAgent());
            p.setName(updatedData.getName());
            p.setPhone(updatedData.getPhone());
            p.setPassport(updatedData.getPassport());
            p.setPassengerCount(updatedData.getPassengerCount());
            p.setExtraPassengers(updatedData.getExtraPassengers());
            p.setOrigin(updatedData.getOrigin());
            p.setDestination(updatedData.getDestination());
            p.setDate(updatedData.getDate());
            p.setReportingTime(updatedData.getReportingTime());
            p.setFare(updatedData.getFare());
            p.setPayMethod(updatedData.getPayMethod());
            p.setBranch(updatedData.getBranch());
            return true;
        }
        return false;
    }

    /**
     * حذف تذكرة
     */
    public boolean deletePassenger(String id) {
        return passengerDatabase.removeIf(p -> p.getId().equals(id));
    }

    /**
     * حساب إجمالي إيرادات التذاكر
     */
    public double calculateTotalRevenue() {
        return passengerDatabase.stream()
                .mapToDouble(Passenger::getFare)
                .sum();
    }
}
