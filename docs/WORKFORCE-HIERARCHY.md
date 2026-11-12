# FactoryPulse workforce hierarchy

Roster for Shift A. This is an assignment plan, not attendance or proof of a full second shift.

| Plant | Machines | Assigned supervisors | Primary operators | Operator accounts including alternates |
| --- | ---: | ---: | ---: | ---: |
| Plant A: Precision Machining | 10 | 3 | 10 | 11 |
| Plant B: Powertrain Components | 10 | 3 | 10 | 10 |
| Plant C: Heavy Machining | 10 | 3 | 10 | 10 |
| Plant D: Finishing and Grinding | 10 | 3 | 10 | 10 |

Total: 40 machines, 12 assigned supervisors, 40 primary operators and 1 preserved alternate.

```text
Plant A: Precision Machining — 3 supervisors / 11 Operator accounts
├── SUP-A01 — 4 machines / 5 operators
│   ├── MCH-001 / CNC-5AX-001 → OP-001, OPS-OPERATOR (alternate)
│   ├── MCH-002 / CNC-5AX-002 → OP-A002
│   ├── MCH-003 / CNC-5AX-003 → OP-A003
│   └── MCH-004 / CNC-5AX-004 → OP-A004
├── SUP-A02 — 4 machines / 4 operators
│   ├── MCH-036 / CNC-VMC-001 → OP-A005
│   ├── MCH-037 / CNC-VMC-002 → OP-A006
│   ├── MCH-038 / CNC-VMC-003 → OP-A007
│   └── MCH-076 / CNC-DRILL-001 → OP-A008
└── SUP-A03 — 2 machines / 2 operators
    ├── MCH-077 / CNC-DRILL-002 → OP-A009
    └── MCH-078 / CNC-DRILL-003 → OP-A010

Plant B: Powertrain Components — 3 supervisors / 10 Operator accounts
├── SUP-B01 — 4 machines / 4 operators
│   ├── MCH-101 / CNC-TURN-001 → OP-B001
│   ├── MCH-102 / CNC-TURN-002 → OP-B002
│   ├── MCH-103 / CNC-TURN-003 → OP-B003
│   └── MCH-104 / CNC-TURN-004 → OP-B004
├── SUP-B02 — 4 machines / 4 operators
│   ├── MCH-141 / CNC-HMC-001 → OP-B005
│   ├── MCH-142 / CNC-HMC-002 → OP-B006
│   ├── MCH-143 / CNC-HMC-003 → OP-B007
│   └── MCH-176 / CNC-MT-001 → OP-B008
└── SUP-B03 — 2 machines / 2 operators
    ├── MCH-177 / CNC-MT-002 → OP-B009
    └── MCH-178 / CNC-MT-003 → OP-B010

Plant C: Heavy Machining — 3 supervisors / 10 Operator accounts
├── SUP-C01 — 4 machines / 4 operators
│   ├── MCH-201 / CNC-HMC-036 → OP-C001
│   ├── MCH-202 / CNC-HMC-037 → OP-C002
│   ├── MCH-203 / CNC-HMC-038 → OP-C003
│   └── MCH-204 / CNC-HMC-039 → OP-C004
├── SUP-C02 — 4 machines / 4 operators
│   ├── MCH-241 / CNC-5AX-036 → OP-C005
│   ├── MCH-242 / CNC-5AX-037 → OP-C006
│   ├── MCH-243 / CNC-5AX-038 → OP-C007
│   └── MCH-271 / CNC-VMC-041 → OP-C008
└── SUP-C03 — 2 machines / 2 operators
    ├── MCH-272 / CNC-VMC-042 → OP-C009
    └── MCH-273 / CNC-VMC-043 → OP-C010

Plant D: Finishing and Grinding — 3 supervisors / 10 Operator accounts
├── SUP-D01 — 4 machines / 4 operators
│   ├── MCH-301 / CNC-GRIND-001 → OP-D001
│   ├── MCH-302 / CNC-GRIND-002 → OP-D002
│   ├── MCH-303 / CNC-GRIND-003 → OP-D003
│   └── MCH-304 / CNC-GRIND-004 → OP-D004
├── SUP-D02 — 4 machines / 4 operators
│   ├── MCH-351 / CNC-TURN-041 → OP-D005
│   ├── MCH-352 / CNC-TURN-042 → OP-D006
│   ├── MCH-353 / CNC-TURN-043 → OP-D007
│   └── MCH-376 / CNC-MT-026 → OP-D008
└── SUP-D03 — 2 machines / 2 operators
    ├── MCH-377 / CNC-MT-027 → OP-D009
    └── MCH-378 / CNC-MT-028 → OP-D010

```

Existing accounts outside these teams were preserved: OPS-SUPERVISOR (Supervisor), SUP-001 (Supervisor).

Membership is stored in MySQL users.department and users.assigned_machine; the non-secret config/workforce-teams.json defines the approved four-machine teams and primary/alternate labels. Admin → dashboard → Plant workforce hierarchy reads current active accounts from MySQL. Deactivated or moved accounts are not falsely counted as assigned.

Updated 2 November 2026: Supervisor machine lists, telemetry, downtime, intelligence, incidents and work orders are restricted to the approved team when both badge and department match. Unallocated Supervisors receive no machine scope. Operator single-machine restrictions remain enforced. Existing accounts and passwords are preserved.

New random passwords are stored only in the Git-ignored .local/WORKFORCE-LOGINS.txt; existing passwords were not replaced. No passwords are included here.

Validation: 51 new user logins passed; 39 new Operators fetched only their assigned machine; all 11 original accounts remain. Admin-only roster handler and non-Admin denial verified.
