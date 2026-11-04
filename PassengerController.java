package com.wadibina.controller;

import com.wadibina.model.PassengerTicket;
import com.wadibina.repository.PassengerRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/passengers")
@CrossOrigin(origins = "*")
public class PassengerController {

    @Autowired
    private PassengerRepository passengerRepository;

    @GetMapping
    public List<PassengerTicket> getAllTickets() {
        return passengerRepository.findAll();
    }

    @PostMapping
    public ResponseEntity<PassengerTicket> createTicket(@RequestBody PassengerTicket ticket) {
        if (ticket == null) {
            return ResponseEntity.badRequest().build();
        }

        String calculatedReportingTime = calculateReportingTime(ticket.getOrigin(), ticket.getTripDate());
        ticket.setReportingTime(calculatedReportingTime);

        PassengerTicket savedTicket = passengerRepository.save(ticket);
        return ResponseEntity.ok(savedTicket);
    }

    private String calculateReportingTime(String origin, LocalDate tripDate) {
        String normalizedOrigin = origin == null ? "" : origin.trim();
        LocalDate safeTripDate = tripDate == null ? LocalDate.now() : tripDate;
        String timeOnly = "4:00 عصراً";
        LocalDate targetDate = safeTripDate;

        switch (normalizedOrigin) {
            case "عجمان":
                timeOnly = "4:00 عصراً";
                targetDate = safeTripDate;
                break;
            case "بني ياس":
                timeOnly = "7:30 مساءً";
                targetDate = safeTripDate;
                break;
            case "العين":
                timeOnly = "11:00 ليلاً";
                targetDate = safeTripDate;
                break;
            case "حفيت":
            case "نزوة":
            case "عبري":
            case "ثمريت":
                timeOnly = "1:30 صباحاً";
                targetDate = safeTripDate.plusDays(1);
                break;
            default:
                timeOnly = "4:00 عصراً";
                targetDate = safeTripDate;
                break;
        }
        return targetDate.toString() + " (" + timeOnly + ")";
    }
}