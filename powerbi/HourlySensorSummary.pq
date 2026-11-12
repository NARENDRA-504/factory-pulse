let
    Source = MySQL.Database("127.0.0.1:3306", "ziro_manufacturing", [ReturnSingleDatabase=true]),
    Summary = Value.NativeQuery(Source, "SELECT machine_id,sensor_name,sensor_unit,hour_utc,sample_count,good_numeric_count,numeric_sum/NULLIF(good_numeric_count,0) AS numeric_average,numeric_min,numeric_max FROM telemetry_hourly_summary ORDER BY hour_utc DESC LIMIT 50000")
in
    Summary
