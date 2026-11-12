# Telemetry and units
FactoryPulse reads saved operational telemetry from MySQL. Preserve sensor names and units: RPM in RPM, vibration in mm/s, temperature in degrees C, pressure in bar, current in A, coolant flow in L/min, torque in Nm, and explicitly named power channels in kW. Motor temperature is not coolant temperature; current is not power; vibration velocity is not acceleration. Never convert between different physical quantities by relabeling values.

# Thresholds and freshness
Compare a GOOD numeric sensor value only with the expected_min and expected_max recorded for that same sensor and unit. A configured expected range is not a certified safety cutoff or a diagnosis. Check the reading timestamp; an old last-known value is not evidence that a machine is currently running. Missing or bad-quality samples must not be presented as healthy measurements. Follow approved site procedures and manufacturer instructions for safety decisions; this project knowledge is not a manufacturer-verified SOP.

# Downtime and machine status
FactoryPulse observed downtime is based on recorded explicit STOPPED status intervals within the requested window. IDLE, MAINTENANCE and missing telemetry are distinct states; they must not automatically be counted as explicit STOPPED downtime. Unobserved gaps are unknown. A stopped-time summary does not prove a root cause, technician attendance or financial loss.
