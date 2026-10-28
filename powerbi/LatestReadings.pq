let
    Source = MySQL.Database("127.0.0.1:3306", "ziro_manufacturing", [ReturnSingleDatabase=true]),
    LatestReadings = Source{[Schema="ziro_manufacturing", Item="v_factorypulse_latest_readings"]}[Data],
    Selected = Table.SelectColumns(LatestReadings, {"reading_id", "machine_id", "machine_code", "reading_timestamp", "sensor_name", "sensor_unit", "sensor_value_json", "expected_min", "expected_max", "machine_status", "data_quality"}),
    NumericValue = Table.AddColumn(Selected, "sensor_value", each try Number.From(Json.Document([sensor_value_json])) otherwise null, type nullable number)
in
    NumericValue
