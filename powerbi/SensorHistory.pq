let
    Source = MySQL.Database("127.0.0.1:3306", "ziro_manufacturing", [ReturnSingleDatabase=true]),
    History = Value.NativeQuery(Source, "SELECT reading_id,machine_id,machine_code,reading_timestamp,sensor_name,sensor_unit,sensor_value_json,expected_min,expected_max,machine_status,data_quality FROM simulator_sensor_readings WHERE reading_timestamp >= UTC_TIMESTAMP() - INTERVAL 24 HOUR ORDER BY reading_timestamp DESC LIMIT 50000"),
    NumericValue = Table.AddColumn(History, "sensor_value", each try Number.From(Json.Document([sensor_value_json])) otherwise null, type nullable number)
in
    NumericValue
