await saveSystemUnifiedDataSafe({
  status: "departed",
  locked: true
}, { mode: "update", subPath: "trips/sun_trip_01" });