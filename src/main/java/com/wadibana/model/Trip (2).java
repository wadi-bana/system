package com.wadibana.model;

import java.io.Serializable;

public class Trip implements Serializable {
    private static final long serialVersionUID = 1L;

    private String id;
    private String date;
    private String route;
    private String busInfo;
    private String branch;

    public Trip() {}

    public Trip(String id, String date, String route, String busInfo, String branch) {
        this.id = id;
        this.date = date;
        this.route = route;
        this.busInfo = busInfo;
        this.branch = branch;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getDate() { return date; }
    public void setDate(String date) { this.date = date; }

    public String getRoute() { return route; }
    public void setRoute(String route) { this.route = route; }

    public String getBusInfo() { return busInfo; }
    public void setBusInfo(String busInfo) { this.busInfo = busInfo; }

    public String getBranch() { return branch; }
    public void setBranch(String branch) { this.branch = branch; }
}
