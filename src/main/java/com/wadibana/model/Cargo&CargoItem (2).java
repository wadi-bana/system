package com.wadibana.model;

import java.io.Serializable;
import java.util.List;

public class Cargo implements Serializable {
    private static final long serialVersionUID = 1L;

    private String id;
    private String date;
    private String sender;
    private String senderPhone;
    private String senderAddress;
    private String receiver;
    private String receiverPhone;
    private String receiverAddress;
    private List<CargoItem> items;
    private double grandTotal;
    private String paymentStatus;
    private String branch;

    public Cargo() {}

    // Getters & Setters ...
}
