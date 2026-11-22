package com.wadibana.model;

import java.io.Serializable;
import java.util.List;

public class Passenger implements Serializable {
    private static final long serialVersionUID = 1L;

    private String id;
    private String tripId;
    private String agent;
    private String name;
    private String phone;
    private String passport;
    private int passengerCount;
    private List<ExtraPassenger> extraPassengers;
    private String origin;
    private String destination;
    private String date;
    private String reportingTime;
    private double fare;
    private String payMethod;
    private String branch;

    public Passenger() {}

    // Getters & Setters ...
}
