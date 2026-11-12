# Shift production
FactoryPulse plans 12-hour shifts starting at 06:00 and 18:00 in the configured factory timezone. The demonstration target is 120 parts per machine per shift, equivalent to 10 parts per hour and a planned cycle time of 360 seconds per part. These are project planning assumptions, not a universal manufacturing capacity.

# Production calculations
Good Parts and Scrap Parts are cumulative counters. Shift output uses observed positive counter changes, including recorded resets; it must not sum cumulative samples. Actual parts equals good plus scrap. Quality equals good divided by good plus scrap when the denominator is positive. Missing baselines or gaps can undercount a shift; no observation means unavailable, not zero. Modeled production counts are not certified physical production totals.

# Costs and energy
Scrap loss equals material cost plus processing cost minus recovery value. Downtime contribution loss equals missed good parts times selling price minus variable cost per good part. Price for a contribution margin equals variable cost divided by one minus the margin fraction. Approved rates are required for factory financial claims. Shaft power derived from torque times RPM is not measured electrical consumption. Missing electricity tariffs or energy readings must remain unavailable.
