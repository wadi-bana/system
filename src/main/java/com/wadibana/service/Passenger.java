package com.wadibana.service;

import java.util.ArrayList;
import java.util.List;

public class Passenger {
    private String id;
    private String agent;
    private String name;
    private String phone;
    private String passport;
    private int passengerCount;
    private List<String> extraPassengers = new ArrayList<>();
    private String origin;
    private String destination;
    private String date;
    private String reportingTime;
    private double fare;
    private String payMethod;
    private String branch;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getAgent() { return agent; }
    public void setAgent(String agent) { this.agent = agent; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getPassport() { return passport; }
    public void setPassport(String passport) { this.passport = passport; }

    public int getPassengerCount() { return passengerCount; }
    public void setPassengerCount(int passengerCount) { this.passengerCount = passengerCount; }

    public List<String> getExtraPassengers() { return extraPassengers; }
    public void setExtraPassengers(List<String> extraPassengers) { this.extraPassengers = extraPassengers; }

    public String getOrigin() { return origin; }
    public void setOrigin(String origin) { this.origin = origin; }

    public String getDestination() { return destination; }
    public void setDestination(String destination) { this.destination = destination; }

    public String getDate() { return date; }
    public void setDate(String date) { this.date = date; }

    public String getReportingTime() { return reportingTime; }
    public void setReportingTime(String reportingTime) { this.reportingTime = reportingTime; }

    public double getFare() { return fare; }
    public void setFare(double fare) { this.fare = fare; }

    public String getPayMethod() { return payMethod; }
    public void setPayMethod(String payMethod) { this.payMethod = payMethod; }

    public String getBranch() { return branch; }
    public void setBranch(String branch) { this.branch = branch; }
}
