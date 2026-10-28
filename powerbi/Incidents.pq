let
    Source = MySQL.Database("127.0.0.1:3306", "ziro_manufacturing", [ReturnSingleDatabase=true]),
    Incidents = Source{[Schema="ziro_manufacturing", Item="incidents"]}[Data],
    Selected = Table.SelectColumns(Incidents, {"id", "incident_code", "machine_code", "severity", "component_area", "status", "created_at", "closed_at"})
in
    Selected
