package com.wadibina.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Entity
@Table(name = "passengers")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PassengerTicket {
    @Id
    @Column(name = "id", nullable = false, unique = true)
    private String id;

    @Column(name = "agent", nullable = false)
    private String agent;

    @Column(name = "passenger_count", nullable = false)
    private int passengerCount;

    @Column(name = "main_name", nullable = false)
    private String mainName;

    @Column(name = "phone", nullable = false)
    private String phone;

    @Column(name = "passport", nullable = false)
    private String passport;

    @Column(name = "origin", nullable = false)
    private String origin;

    @Column(name = "destination", nullable = false)
    private String destination;

    @Column(name = "trip_date", nullable = false)
    private LocalDate tripDate;

    @Column(name = "reporting_time", nullable = false)
    private String reportingTime;

    @Column(name = "fare", nullable = false)
    private double fare;

    @Column(name = "pay_method", nullable = false)
    private String payMethod;
}