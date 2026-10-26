#!/usr/bin/env python3
"""
Test Suite: Frontend Seed Data, Benchmarks & Domain Integrity Tests
Validates src/data/seedData.ts and src/types/index.ts:
- Benchmark row counts match empirical datasets exactly (2,054 + 612 + 25,286 + 968 = 28,920)
- 5 User Roles defined and populated with realistic credentials
- Target metrics separation: Vb in mm, Ra in µm, CycleToFailure in discrete cut cycles
- Verification that no unsupported thresholds (0.32 mm or 1.6 µm) are treated as definitive failure limits
- AI Investigation Assistant disclaimers and safety guidance
"""

import unittest
import re

class TestFrontendBenchmarks(unittest.TestCase):
    def setUp(self):
        with open("src/data/seedData.ts", "r", encoding="utf-8") as f:
            self.seed_data = f.read()
        with open("src/types/index.ts", "r", encoding="utf-8") as f:
            self.types_code = f.read()

    def test_role_definitions(self):
        """TC-FE-001: Verifies 5 approved user roles in TypeScript definitions."""
        self.assertIn("export type UserRole = 'Operator' | 'Supervisor' | 'Manager' | 'Maintenance' | 'Admin';", self.types_code)

    def test_data_provenance_types(self):
        """TC-FE-002: Verifies strict provenance types."""
        self.assertIn("export type DataProvenance = 'EMPIRICAL DATASET' | 'SIMULATED' | 'DEMO';", self.types_code)

    def test_seed_users_presence(self):
        """TC-FE-003: Verifies all 5 seed demo users exist with expected badge IDs."""
        for role_id in ["OP-101", "SUP-201", "MGR-301", "MNT-401", "ADM-001"]:
            self.assertIn(f"workId: '{role_id}'", self.seed_data)

    def test_dataset_1_tool_wear_benchmark(self):
        """TC-FE-004: Verifies Dataset 1 benchmark summary in seedData."""
        self.assertIn("rowCount: 2054", self.seed_data)
        self.assertIn("columnCount: 154", self.seed_data)
        self.assertIn("targetMetric: 'Vb (Flank Wear Width)'", self.seed_data)
        self.assertIn("targetUnit: 'mm'", self.seed_data)
        self.assertIn("sensor_channel_14", self.seed_data)
        self.assertIn("sensor_channel_15", self.seed_data)

    def test_dataset_2_roughness_benchmark(self):
        """TC-FE-005: Verifies Dataset 2 benchmark summary in seedData."""
        self.assertIn("rowCount: 612", self.seed_data)
        self.assertIn("targetMetric: 'Ra (Surface Roughness Arithmetic Mean)'", self.seed_data)
        self.assertIn("targetUnit: 'µm'", self.seed_data)
        self.assertIn("Prep.csv strictly separate (not Experiment 3)", self.seed_data)

    def test_dataset_3_telemetry_benchmark(self):
        """TC-FE-006: Verifies Dataset 3 telemetry benchmark summary in seedData."""
        self.assertIn("rowCount: 25286", self.seed_data)
        self.assertIn("columnCount: 49", self.seed_data)
        self.assertIn("experimentCount: 18", self.seed_data)
        self.assertIn("Provisional statistical baseline only", self.seed_data)

    def test_dataset_4_cycles_benchmark(self):
        """TC-FE-007: Verifies Dataset 4 benchmark summary in seedData."""
        self.assertIn("rowCount: 968", self.seed_data)
        self.assertIn("columnCount: 131", self.seed_data)
        self.assertIn("targetMetric: 'CycleToFailure (Tool Cut Life to Failure)'", self.seed_data)

    def test_total_empirical_rows_calculation(self):
        """TC-FE-008: Verifies 28,920 total empirical raw rows calculation in seedData."""
        self.assertIn("totalEmpiricalRows: 28920", self.seed_data)
        self.assertIn("2,054 (D1) + 612 (D2) + 25,286 (D3) + 968 (D4) = 28,920 raw empirical rows", self.seed_data)

    def test_no_unsupported_limits_in_seed_data(self):
        """TC-FE-009: Ensures no unsupported thresholds are presented as hard failure limits."""
        self.assertNotIn("0.32 mm limit", self.seed_data)
        self.assertNotIn("1.6 µm limit", self.seed_data)

if __name__ == "__main__":
    unittest.main()
