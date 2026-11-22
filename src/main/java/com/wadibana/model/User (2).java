package com.wadibana.model;

import java.io.Serializable;

public class User implements Serializable {
    private static final long serialVersionUID = 1L;

    private String username;
    private String password;
    private String role;     // مدير, موظف
    private String branch;   // فرع عجمان, فرع ابوظبي, فرع عمان, فرع اليمن

    public User() {}

    public User(String username, String password, String role, String branch) {
        this.username = username;
        this.password = password;
        this.role = role;
        this.branch = branch;
    }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public String getBranch() { return branch; }
    public void setBranch(String branch) { this.branch = branch; }
}
