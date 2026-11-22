package com.wadibana.model;

import java.io.Serializable;
import java.util.List;

public class DriverAccount implements Serializable {
    private static final long serialVersionUID = 1L;

    private String id;
    private String date;
    private String busNo;
    private String driverName;
    private List<DriverItem> items;
    private double totalExpenses;
    private double tripDue;
    private double remaining;
    private double netDue;
    private String branch;

    public DriverAccount() {}

    // Getters & Setters ...
}
