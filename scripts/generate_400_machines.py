#!/usr/bin/env python3
"""
Generate the master dataset of exactly 400 CNC machines for FactoryPulse.
Validates uniqueness across:
- machineId
- machineCode
- displayName
- telemetryKey

Outputs:
- .aistudio/artifacts/brain/8b23569c-25c3-41d0-83f7-563f8d4b12fc/machine-name.json
- .aistudio/artifacts/brain/8b23569c-25c3-41d0-83f7-563f8d4b12fc/machine-name
- public/machine-name.json
- src/data/machinesData.ts
"""

import json
import os
import random

random.seed(42)

CATEGORIES = [
    "CNC Vertical Machining Center",
    "CNC Horizontal Machining Center",
    "CNC Turning Center",
    "5-Axis CNC Machining Center",
    "CNC Grinding Machine",
    "CNC Drilling and Tapping Center",
    "CNC Mill-Turn Center"
]

PLANTS = {
    "Plant A: Precision Machining": {
        "shopFloors": [
            "Floor A1: Aerospace Micro-Milling",
            "Floor A2: Medical Implant Fabrication",
            "Floor A3: High-Speed Precision Drilling"
        ],
        "allocations": [
            ("5-Axis CNC Machining Center", 35, "CNC-5AX", "5-Axis"),
            ("CNC Vertical Machining Center", 40, "CNC-VMC", "VMC"),
            ("CNC Drilling and Tapping Center", 25, "CNC-DRILL", "Drill Tap")
        ]
    },
    "Plant B: Powertrain Components": {
        "shopFloors": [
            "Floor B1: Transmission Gear & Shaft Line",
            "Floor B2: Engine Block Machining",
            "Floor B3: Drivetrain Mill-Turn Cells"
        ],
        "allocations": [
            ("CNC Turning Center", 40, "CNC-TURN", "Turning Center"),
            ("CNC Horizontal Machining Center", 35, "CNC-HMC", "HMC"),
            ("CNC Mill-Turn Center", 25, "CNC-MT", "Mill-Turn")
        ]
    },
    "Plant C: Heavy Machining": {
        "shopFloors": [
            "Floor C1: Turbine & Casing Machining",
            "Floor C2: Heavy Structural Frames",
            "Floor C3: Large Prismatics & Tooling"
        ],
        "allocations": [
            ("CNC Horizontal Machining Center", 40, "CNC-HMC", "HMC"),
            ("5-Axis CNC Machining Center", 30, "CNC-5AX", "5-Axis"),
            ("CNC Vertical Machining Center", 30, "CNC-VMC", "VMC")
        ]
    },
    "Plant D: Finishing and Grinding": {
        "shopFloors": [
            "Floor D1: Cylindrical & Surface Grinding",
            "Floor D2: Precision Bore & Internal Grinding",
            "Floor D3: Finishing Turning & Mill-Turn"
        ],
        "allocations": [
            ("CNC Grinding Machine", 50, "CNC-GRIND", "Grinding Cell"),
            ("CNC Turning Center", 25, "CNC-TURN", "Turning Center"),
            ("CNC Mill-Turn Center", 25, "CNC-MT", "Mill-Turn")
        ]
    }
}

REALISTIC_MODELS = {
    "CNC Vertical Machining Center": [
        ("Haas", "VF-4SS"),
        ("Haas", "VF-2"),
        ("Okuma", "GENOS M560-V"),
        ("Makino", "Slim5n"),
        ("DMG MORI", "NVX 5080"),
        ("Mazak", "VCN-530C"),
        ("Haas", "VF-3YT"),
        ("Okuma", "GENOS M460V-5AX")
    ],
    "CNC Horizontal Machining Center": [
        ("Makino", "a51nx"),
        ("Makino", "a61nx"),
        ("Mazak", "HCN-5000"),
        ("Okuma", "MA-500H"),
        ("DMG MORI", "NHX 5000"),
        ("Haas", "EC-400"),
        ("Makino", "a81nx")
    ],
    "CNC Turning Center": [
        ("DMG MORI", "NLX 2500"),
        ("Mazak", "QT-Compact 200"),
        ("Okuma", "LB3000 EX II"),
        ("Haas", "ST-20"),
        ("Doosan", "Puma 2600"),
        ("Mazak", "Quick Turn 250MSY"),
        ("Haas", "ST-30Y")
    ],
    "5-Axis CNC Machining Center": [
        ("Mazak", "VARIAXIS C-600"),
        ("DMG MORI", "DMU 50"),
        ("Haas", "UMC-750"),
        ("Makino", "D500"),
        ("Okuma", "MU-5000V"),
        ("Grob", "G350"),
        ("Hermle", "C 400")
    ],
    "CNC Grinding Machine": [
        ("Studer", "S33"),
        ("Studer", "S41"),
        ("Studer", "favorit"),
        ("Okuma", "GP26W"),
        ("Okamoto", "ACC-1224DX"),
        ("Kellenberger", "100"),
        ("Blohm", "Planomat XT")
    ],
    "CNC Drilling and Tapping Center": [
        ("Brother", "Speedio S700X2"),
        ("Brother", "Speedio M140X2"),
        ("Brother", "Speedio W1000Xd1"),
        ("Fanuc", "Robodrill \u03b1-D21LiB5"),
        ("Brother", "Speedio U500Xd1"),
        ("Fanuc", "Robodrill \u03b1-D14MiB5")
    ],
    "CNC Mill-Turn Center": [
        ("Okuma", "Multus U3000"),
        ("Mazak", "INTEGREX i-200"),
        ("DMG MORI", "CTX beta 800 TC"),
        ("Nakamura-Tome", "WT-150II"),
        ("Okuma", "Multus B250II"),
        ("Mazak", "INTEGREX e-420H")
    ]
}

OPERATOR_NAMES = [
    "Marcus Vance", "Elena Rostova", "Frank Kowalski", "David Sterling", "Sarah Chen",
    "Alex Rivera", "Chen Wei", "Liam Scott", "Carlos Mendez", "Vikram Patel",
    "Noah Taylor", "Mason Reed", "Lucas Vance", "Aiden Clark", "Emma Watson",
    "Sophia Dubois", "James Kowalski", "Oliver Hansen", "Benjamin Lee", "Lucas Rossi",
    "Daniel Tanaka", "Mateo Silva", "Leo Martin", "Gabriel Fischer", "Julian Beck",
    "Henry Cooper", "Ethan Wright", "Sebastian Klein", "Jack Murphy", "Samuel Adams"
]

WORKPIECES = {
    "CNC Vertical Machining Center": [
        "Turbine Impeller Blisk (Inconel 718)",
        "Hydraulic Manifold Block (Al 7075-T6)",
        "Aerospace Bracket (Ti-6Al-4V)",
        "Sensor Housing Flange (SS 316L)",
        "Robotic Arm Joint Bracket (Al 6061)"
    ],
    "CNC Horizontal Machining Center": [
        "Engine Block Casting (A380 Aluminum)",
        "Transmission Case Housing (Cast Iron G3000)",
        "Heavy Cylinder Head (Ductile Iron)",
        "Pump Body Pressure Valve (SS 304)",
        "Drive Axle Carrier (Forged 4140 Steel)"
    ],
    "CNC Turning Center": [
        "Drive Pinion Shaft (AISI 4340 Alloy)",
        "Splined Transmission Spindle (8620 Steel)",
        "High-Pressure Flange Coupling (316L)",
        "Brake Rotor Hub (Grey Cast Iron)",
        "Hydraulic Cylinder Piston Rod (1045 Chrome)"
    ],
    "5-Axis CNC Machining Center": [
        "Titanium Aero Impeller Rotor (Ti-6Al-4V)",
        "Orthopedic Femoral Knee Joint (CoCrMo)",
        "Rocket Nozzle Gimbal Ring (Inconel 625)",
        "Multi-Port Flow Injector (SS 316Ti)",
        "Aerospace Wing Spar Hinge (Al-Li 2195)"
    ],
    "CNC Grinding Machine": [
        "Precision Spindle Taper Arbor (Bearing Steel 52100)",
        "Hydraulic Valve Spool Sleeve (\u00b10.5\u00b5m)",
        "Ceramic Seal Ring Face (Silicon Carbide)",
        "Needle Roller Bearing Race (Case Hardened)",
        "Linear Guideway Precision Rail (Induction Hardened)"
    ],
    "CNC Drilling and Tapping Center": [
        "Smartphone Unibody Chassis (6000 Series Al)",
        "EV Battery Thermal Plate (Al 3003)",
        "ECU Controller Enclosure (Die-Cast Al)",
        "Multi-Hole Fuel Rail (Forged Steel)",
        "Telecom Heat Sink Mount (Al 6063)"
    ],
    "CNC Mill-Turn Center": [
        "Aircraft Landing Gear Trunnion (300M Steel)",
        "Offshore Subsea Valve Stem (Super Duplex 2507)",
        "Turbine Rotor Stub Shaft (Nimonic 90)",
        "Helicopter Swashplate Bushing (Titanium 6-4)",
        "High-Torque Planetary Sun Gear (17CrNiMo6)"
    ]
}

def generate():
    machines = []
    global_id = 1
    
    category_counters = {cat: 1 for cat in CATEGORIES}
    
    for plant_name, plant_info in PLANTS.items():
        floors = plant_info["shopFloors"]
        for cat_name, count, prefix, label_prefix in plant_info["allocations"]:
            models = REALISTIC_MODELS[cat_name]
            workpieces = WORKPIECES[cat_name]
            
            for i in range(count):
                cat_idx = category_counters[cat_name]
                category_counters[cat_name] += 1
                
                # Zero-padded machine codes e.g. CNC-VMC-001
                code = f"{prefix}-{cat_idx:03d}"
                machine_id = f"MCH-{global_id:03d}"
                telemetry_key = f"telemetry_{prefix.lower().replace('-', '_')}_{cat_idx:03d}"
                
                # Pick model deterministically
                m_make, m_model = models[(cat_idx - 1) % len(models)]
                
                # Display name: e.g. "VMC-01 \u2013 Haas VF-4SS"
                display_name = f"{label_prefix}-{cat_idx:02d} \u2013 {m_make} {m_model}"
                
                # Distribute across floors and production lines
                floor = floors[i % len(floors)]
                line_idx = (i // len(floors)) + 1
                prod_line = f"Line {prefix.replace('CNC-', '')}-{line_idx:02d}"
                
                # Realistic operator assignment
                op_name = OPERATOR_NAMES[(global_id - 1) % len(OPERATOR_NAMES)]
                shift = "Shift A" if (global_id % 3 == 1) else ("Shift B" if (global_id % 3 == 2) else "Night Shift")
                
                # Status distribution (realistic plant health: ~82% Nominal, 11% Warning, 4% Critical, 3% Offline)
                if global_id in [4, 18, 45, 92, 142, 204, 260, 312, 375]:
                    status = "Critical"
                    active_alerts = random.choice([2, 3])
                elif global_id in [10, 25, 60, 77, 105, 120, 160, 195, 230, 275, 305, 340, 385]:
                    status = "Offline"
                    active_alerts = 0
                elif global_id % 8 == 0:
                    status = "Warning"
                    active_alerts = 1
                else:
                    status = "Nominal"
                    active_alerts = 0
                
                # Baseline telemetry parameters tailored by machine type
                if "Turning" in cat_name or "Mill-Turn" in cat_name:
                    spindle_rpm = 1800 + (global_id * 17) % 1400
                    base_power = 15.0 + (global_id % 12)
                elif "5-Axis" in cat_name:
                    spindle_rpm = 10000 + (global_id * 31) % 6000
                    base_power = 18.0 + (global_id % 15)
                elif "Drilling" in cat_name:
                    spindle_rpm = 8000 + (global_id * 23) % 4000
                    base_power = 8.5 + (global_id % 6)
                elif "Grinding" in cat_name:
                    spindle_rpm = 5500 + (global_id * 19) % 2500
                    base_power = 11.0 + (global_id % 8)
                elif "Horizontal" in cat_name:
                    spindle_rpm = 6000 + (global_id * 29) % 3000
                    base_power = 22.0 + (global_id % 14)
                else: # Vertical
                    spindle_rpm = 4500 + (global_id * 13) % 2500
                    base_power = 12.0 + (global_id % 10)
                
                if status == "Offline":
                    spindle_rpm = 0
                    motor_load = 0.0
                    power_kw = 0.4
                    vib_rms = 0.02
                    coolant_temp = 20.5
                elif status == "Critical":
                    spindle_rpm = max(100, spindle_rpm - 350)
                    motor_load = 94.5 + round(random.uniform(0.5, 4.5), 1)
                    power_kw = round(base_power * 1.6, 1)
                    vib_rms = round(4.8 + random.uniform(0.2, 1.8), 2)
                    coolant_temp = round(42.0 + random.uniform(1.0, 8.0), 1)
                elif status == "Warning":
                    motor_load = 81.0 + round(random.uniform(0.5, 5.0), 1)
                    power_kw = round(base_power * 1.25, 1)
                    vib_rms = round(3.4 + random.uniform(0.1, 0.7), 2)
                    coolant_temp = round(32.5 + random.uniform(0.5, 3.5), 1)
                else: # Nominal
                    motor_load = 50.0 + round(random.uniform(2.0, 18.0), 1)
                    power_kw = round(base_power * 0.95, 1)
                    vib_rms = round(1.20 + random.uniform(0.1, 0.8), 2)
                    coolant_temp = round(23.0 + random.uniform(0.5, 3.0), 1)
                
                working_time = 180 + (global_id * 7) % 280
                shift_target = 180 + (global_id % 5) * 20
                jobs_produced = min(shift_target, int(shift_target * (working_time / 480.0) * (0.85 + (global_id % 20) * 0.01)))
                coolant_level = 82 + (global_id * 3) % 17
                
                workpiece = workpieces[global_id % len(workpieces)]
                cut_hours = round(350.0 + (global_id * 19.3) % 4500.0, 1)
                current_cuts = 40 + (global_id * 11) % 420
                
                machine_obj = {
                    "machineId": machine_id,
                    "machineCode": code,
                    "displayName": display_name,
                    "machineType": cat_name,
                    "manufacturer": m_make,
                    "model": m_model,
                    "plant": plant_name,
                    "shopFloor": floor,
                    "productionLine": prod_line,
                    "status": status,
                    "assignedOperator": op_name,
                    "shift": shift,
                    "telemetryKey": telemetry_key,
                    "spindleRpm": spindle_rpm,
                    "coolantTemperatureC": coolant_temp,
                    "motorLoadPercent": motor_load,
                    "vibrationMmS": vib_rms,
                    "powerKw": power_kw,
                    "workingTimeMinutes": working_time,
                    "jobsProducedThisShift": jobs_produced,
                    "shiftJobsTarget": shift_target,
                    "coolantLevelPercent": coolant_level,
                    "activeAlertCount": active_alerts,
                    "lastMaintenanceDate": f"2026-09-{(global_id % 28) + 1:02d}",
                    "nextMaintenanceDate": f"2026-11-{(global_id % 28) + 1:02d}",
                    # Backward-compatibility aliases
                    "code": code,
                    "name": display_name,
                    "lineId": prod_line,
                    "lastInspectionDate": f"2026-09-{(global_id % 28) + 1:02d}",
                    "cutHours": cut_hours,
                    "currentToolCuts": current_cuts,
                    "operatorWorkId": f"OP-{(global_id % 30) + 101}",
                    "activeWorkpiece": workpiece
                }
                
                machines.append(machine_obj)
                global_id += 1
                
    return machines

def validate_machines(machines):
    total = len(machines)
    assert total == 400, f"Expected 400 machines, got {total}"
    
    ids = [m["machineId"] for m in machines]
    codes = [m["machineCode"] for m in machines]
    names = [m["displayName"] for m in machines]
    keys = [m["telemetryKey"] for m in machines]
    
    assert len(set(ids)) == 400, f"Duplicate machineIds found! Unique: {len(set(ids))}"
    assert len(set(codes)) == 400, f"Duplicate machineCodes found! Unique: {len(set(codes))}"
    assert len(set(names)) == 400, f"Duplicate displayNames found! Unique: {len(set(names))}"
    assert len(set(keys)) == 400, f"Duplicate telemetryKeys found! Unique: {len(set(keys))}"
    
    # Check categories
    cat_counts = {}
    for m in machines:
        cat = m["machineType"]
        cat_counts[cat] = cat_counts.get(cat, 0) + 1
        
    # Check plants
    plant_counts = {}
    for m in machines:
        p = m["plant"]
        plant_counts[p] = plant_counts.get(p, 0) + 1
        
    print("=== VALIDATION SUCCESSFUL ===")
    print(f"Total Machines: {total}")
    print("\n--- Distribution by Plant ---")
    for p, c in plant_counts.items():
        print(f"  {p}: {c} machines")
        
    print("\n--- Distribution by Machine Category ---")
    for cat, c in cat_counts.items():
        print(f"  {cat}: {c} machines")
        
    return plant_counts, cat_counts

if __name__ == "__main__":
    machines = generate()
    plant_counts, cat_counts = validate_machines(machines)
    
    # Output 1: Artifact directory
    artifact_dir = ".aistudio/artifacts/brain/8b23569c-25c3-41d0-83f7-563f8d4b12fc"
    os.makedirs(artifact_dir, exist_ok=True)
    
    # Required artifact name exactly: machine-name
    artifact_exact_path = os.path.join(artifact_dir, "machine-name")
    with open(artifact_exact_path, "w", encoding="utf-8") as f:
        json.dump(machines, f, indent=2)
    print(f"Wrote artifact to: {artifact_exact_path}")
    
    # Also save machine-name.json in artifact dir
    artifact_json_path = os.path.join(artifact_dir, "machine-name.json")
    with open(artifact_json_path, "w", encoding="utf-8") as f:
        json.dump(machines, f, indent=2)
    print(f"Wrote artifact JSON to: {artifact_json_path}")
    
    # Output 2: public/machine-name.json for in-app download and fetching
    os.makedirs("public", exist_ok=True)
    with open("public/machine-name.json", "w", encoding="utf-8") as f:
        json.dump(machines, f, indent=2)
    print("Wrote public file to: public/machine-name.json")
    
    # Output 3: src/data/machinesData.ts
    ts_content = f"""/**
 * FactoryPulse 400 CNC Machines Master Dataset
 * Exactly 400 realistic CNC machines organized across 4 plants and 7 categories.
 * Single source of truth for all machine IDs, codes, display names, and telemetry keys.
 */

import {{ Machine }} from '../types';

export const ALL_400_MACHINES: Machine[] = {json.dumps(machines, indent=2)};
"""
    with open("src/data/machinesData.ts", "w", encoding="utf-8") as f:
        f.write(ts_content)
    print("Wrote TypeScript data to: src/data/machinesData.ts")
