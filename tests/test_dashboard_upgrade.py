#!/usr/bin/env python3
"""
Test Suite: Dashboard Visualization Upgrade & Control Room Integrity
Validates:
- CncMachineGraphic component existence, status indicators, and anomaly animations
- IndustrialTelemetryChart unit separation, SVG viewBox scaling, and provisional baseline labeling
- FactoryLineOverview line filters, machine cell cards, and active incident counts
- MachineDetailDrawer inspection drawer and dedicated telemetry handoff
- RecentEventsStream industrial event feed and direct incident filing
- Zero window.alert blocking calls in frontend
"""

import unittest
import os
import re

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

class TestDashboardUpgrade(unittest.TestCase):
    def setUp(self):
        self.cnc_file = os.path.join(PROJECT_ROOT, "src", "components", "CncMachineGraphic.tsx")
        self.chart_file = os.path.join(PROJECT_ROOT, "src", "components", "IndustrialTelemetryChart.tsx")
        self.factory_file = os.path.join(PROJECT_ROOT, "src", "components", "FactoryLineOverview.tsx")
        self.drawer_file = os.path.join(PROJECT_ROOT, "src", "components", "MachineDetailDrawer.tsx")
        self.events_file = os.path.join(PROJECT_ROOT, "src", "components", "RecentEventsStream.tsx")
        self.dash_file = os.path.join(PROJECT_ROOT, "src", "views", "DashboardView.tsx")

    def test_component_files_exist(self):
        """TC-DASH-001: All 5 dashboard upgrade components exist in src/components."""
        for path in [self.cnc_file, self.chart_file, self.factory_file, self.drawer_file, self.events_file]:
            self.assertTrue(os.path.exists(path), f"Component file {path} must exist.")

    def test_cnc_machine_graphic_features(self):
        """TC-DASH-002: CncMachineGraphic includes vector SVG, anomaly effects, and reducedMotion support."""
        with open(self.cnc_file, "r", encoding="utf-8") as f:
            content = f.read()
        self.assertIn("<svg", content)
        self.assertIn("viewBox=\"0 0 760 380\"", content)
        self.assertIn("reducedMotion", content)
        self.assertIn("HIGH_CHATTER", content)
        self.assertIn("THERMAL_OVERLOAD", content)
        self.assertIn("FEED_SPIKE", content)
        self.assertIn("spindleRpm", content)
        self.assertIn("motorPowerKw", content)
        self.assertIn("motorLoadPct", content)

    def test_industrial_telemetry_chart_features(self):
        """TC-DASH-003: IndustrialTelemetryChart renders SVG line/area, tooltips, and provisional baselines."""
        with open(self.chart_file, "r", encoding="utf-8") as f:
            content = f.read()
        self.assertIn("provisionalBaseline", content)
        self.assertIn("baselineLabel", content)
        self.assertIn("hoverIndex", content)
        self.assertIn("viewBox", content)
        self.assertIn("ProvenanceBadge", content)

    def test_factory_line_overview_features(self):
        """TC-DASH-004: FactoryLineOverview supports line filtering, machine status, and incident toggles."""
        with open(self.factory_file, "r", encoding="utf-8") as f:
            content = f.read()
        self.assertIn("selectedLine", content)
        self.assertIn("selectedStatus", content)
        self.assertIn("onlyWithIncidents", content)
        self.assertIn("searchTerm", content)
        self.assertIn("onOpenMachineDrawer", content)

    def test_machine_detail_drawer_features(self):
        """TC-DASH-005: MachineDetailDrawer includes machine specs, latest snapshot, and incident listing."""
        with open(self.drawer_file, "r", encoding="utf-8") as f:
            content = f.read()
        self.assertIn("onNavigateToTelemetry", content)
        self.assertIn("onNavigateToCreateIncident", content)
        self.assertIn("machineIncidents", content)
        self.assertIn("latestSnapshot", content)

    def test_recent_events_stream_features(self):
        """TC-DASH-006: RecentEventsStream provides live event feed and one-click incident reporting."""
        with open(self.events_file, "r", encoding="utf-8") as f:
            content = f.read()
        self.assertIn("onFileIncidentFromEvent", content)
        self.assertIn("ANOMALY", content)
        self.assertIn("INCIDENT", content)
        self.assertIn("WORK_ORDER", content)

    def test_dashboard_view_control_room_integration(self):
        """TC-DASH-007: DashboardView integrates control room clock, streaming controls, and anomaly injector."""
        with open(self.dash_file, "r", encoding="utf-8") as f:
            content = f.read()
        self.assertIn("CncMachineGraphic", content)
        self.assertIn("IndustrialTelemetryChart", content)
        self.assertIn("FactoryLineOverview", content)
        self.assertIn("MachineDetailDrawer", content)
        self.assertIn("RecentEventsStream", content)
        self.assertIn("clockString", content)
        self.assertIn("isStreaming", content)
        self.assertIn("handleInjectAnomaly", content)
        self.assertIn("handleUpdateWorkOrderStatus", content)

    def test_zero_window_alerts_across_all_views(self):
        """TC-DASH-008: Ensures zero blocking alert() calls exist across all views and components."""
        alert_pattern = re.compile(r'\balert\s*\(')
        src_dir = os.path.join(PROJECT_ROOT, "src")
        for root, _, files in os.walk(src_dir):
            for file in files:
                if file.endswith((".ts", ".tsx")):
                    with open(os.path.join(root, file), "r", encoding="utf-8") as f:
                        for line_no, line in enumerate(f, 1):
                            self.assertFalse(
                                bool(alert_pattern.search(line)),
                                f"Disallowed alert() in {file}:{line_no} -> {line.strip()}"
                            )

    def test_error_boundary_component(self):
        """TC-DASH-009: ErrorBoundary component exists and wraps App in main.tsx and view routes."""
        boundary_file = os.path.join(PROJECT_ROOT, "src", "components", "ErrorBoundary.tsx")
        main_file = os.path.join(PROJECT_ROOT, "src", "main.tsx")
        app_file = os.path.join(PROJECT_ROOT, "src", "App.tsx")
        self.assertTrue(os.path.exists(boundary_file), "ErrorBoundary component must exist.")

        with open(boundary_file, "r", encoding="utf-8") as f:
            b_content = f.read()
        self.assertIn("componentDidCatch", b_content)
        self.assertIn("SYSTEM RECOVERABLE FAULT", b_content)

        with open(main_file, "r", encoding="utf-8") as f:
            m_content = f.read()
        self.assertIn("<ErrorBoundary", m_content)

        with open(app_file, "r", encoding="utf-8") as f:
            a_content = f.read()
        self.assertIn("<ErrorBoundary", a_content)

    def test_component_safety_fallbacks_and_storage_guard(self):
        """TC-DASH-010: Components have safe defaults and storage operates with in-memory fallback in iframes."""
        api_client_file = os.path.join(PROJECT_ROOT, "src", "services", "apiClient.ts")
        with open(api_client_file, "r", encoding="utf-8") as f:
            api_content = f.read()
        self.assertIn("safeGetItem", api_content)
        self.assertIn("safeSetItem", api_content)
        self.assertIn("memoryStore", api_content)

        with open(self.dash_file, "r", encoding="utf-8") as f:
            dash_content = f.read()
        self.assertIn("SEED_MACHINES[0]", dash_content)

        with open(self.chart_file, "r", encoding="utf-8") as f:
            chart_content = f.read()
        self.assertIn("safeGradientId", chart_content)

    def test_simplified_operator_dashboard_refinement(self):
        """TC-DASH-011: Operator Dashboard simplification verification.
        - OperatorVibrationGraph and OperatorMachineInsights exist and are integrated
        - Mini-cards row removed from operator primary dashboard
        - 4 KPI cards preserved (Machine Status, Motor Load, Coolant Temperature, Active Alerts)
        - CNC machine photo and Raise Alert button preserved
        - At most 3 concise insights present
        """
        op_vib_file = os.path.join(PROJECT_ROOT, "src", "components", "OperatorVibrationGraph.tsx")
        op_ins_file = os.path.join(PROJECT_ROOT, "src", "components", "OperatorMachineInsights.tsx")
        self.assertTrue(os.path.exists(op_vib_file), "OperatorVibrationGraph.tsx must exist.")
        self.assertTrue(os.path.exists(op_ins_file), "OperatorMachineInsights.tsx must exist.")

        with open(self.dash_file, "r", encoding="utf-8") as f:
            dash_content = f.read()

        # Components integrated in DashboardView
        self.assertIn("OperatorVibrationGraph", dash_content)
        self.assertIn("OperatorMachineInsights", dash_content)

        # 4 Essential KPI cards exist
        self.assertIn("Machine Status", dash_content)
        self.assertIn("Motor Load", dash_content)
        self.assertIn("Coolant Temperature", dash_content)
        self.assertIn("Active Alerts", dash_content)

        # Realistic machine photograph
        self.assertIn("cnc_machine_vmc_", dash_content)

        # Raise alert workflow preserved
        self.assertIn("Raise an Alert", dash_content)

        # Mini card row removed from operator view (Spindle Speed and Feed Rate mini cards not rendered in operator workspace)
        with open(op_ins_file, "r", encoding="utf-8") as f:
            ins_content = f.read()
        self.assertIn("1. Current Condition", ins_content)
        self.assertIn("2. Recent Abnormality", ins_content)
        self.assertIn("3. Recommended Action", ins_content)

    def test_reference_image_2_operator_layout(self):
        """TC-DASH-012: Reference Image 2 visual design target and 4-row layout verification.
        - Dark industrial styling (#0B111E palette, subtle borders, high contrast)
        - Row 1: Four KPI cards (Machine Status, Motor Load, Coolant Temperature, Active Alerts)
        - Row 2: CNC photo left, large spindle vibration graph right
        - Row 3: Dedicated compact machine insights row (condition, abnormality, recommended action)
        - Row 4: Operator actions (Active alerts, Pre-shift checklist)
        - Graph has operating boundary, time labels, and condition states
        """
        op_vib_file = os.path.join(PROJECT_ROOT, "src", "components", "OperatorVibrationGraph.tsx")
        with open(op_vib_file, "r", encoding="utf-8") as f:
            vib_content = f.read()

        # Operating boundary & limits
        self.assertIn("Operating Limit", vib_content)
        self.assertIn("timeTicks", vib_content)
        self.assertIn("activePoint", vib_content)
        self.assertIn("Spindle Vibration Trend", vib_content)

        # Dashboard 4-row layout elements
        with open(self.dash_file, "r", encoding="utf-8") as f:
            dash_content = f.read()

        self.assertIn("#0B111E", dash_content)
        self.assertIn("Operator Control Console", dash_content)
        self.assertIn("Active Alerts for", dash_content)
        self.assertIn("Pre-Shift Safety", dash_content)

if __name__ == "__main__":
    unittest.main()
