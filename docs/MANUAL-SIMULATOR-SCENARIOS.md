# Manual machine incident tests

The separate AI Simulator now starts with all generation and background delivery stopped. The local stack launcher starts services only; it does not start machine streams. Existing accounts, environment files, MySQL records, SQLite history and pending outbox entries are preserved.

## Use the controls

1. Open http://127.0.0.1:5174/ and select a machine. The same controls appear inside Machines → selected machine.
2. Use the red **STOP ALL** button first if continuous streams were previously started.
3. Under **Send a machine incident**, leave **Once · one sensor round** selected for minimal storage.
4. Select the scenario, then press **Send once**. Selecting or searching never sends data. Six recommended conditions appear first; category tabs and search expose all 18 choices. Its affected sensors are listed on the button. Check the saved, receiver-acknowledged, queued and failed counts in the result.
5. Open the same authorized machine in FactoryPulse at http://localhost:3000/. Its current readings update through the existing MySQL-backed endpoints.
6. For an automatic incident demonstration, explicitly choose **60 seconds · up to 13 rounds**. Samples are spaced five seconds apart. This can meet the receiver's sustained-fault rule; a single isolated sample does not force a ticket.
7. **Stop this test** cancels remaining rounds. The sidebar **STOP ALL** also revokes manual delivery and waits for active requests. Requests already accepted by FactoryPulse cannot be recalled.

There are 18 scenario choices, filtered to each machine's supported sensors: normal, temperature watch, overheating, motor heat/current, vibration watch, severe vibration, spindle over/underspeed, low/high pressure, low/hot coolant, overcurrent, under/overvoltage, excess torque, combined heat/vibration and a missing temperature signal.

## Storage and data behavior

- A single click sends one complete sensor round for the selected machine, including the affected readings. Current configuration emits 32 records per round.
- A 60-second test has at most 13 rounds (416 records with the current sensor set), excluding network retry attempts of the same reading IDs. It cannot run indefinitely.
- Only newly created reading IDs are eligible for that manual send. Historical pending records are not drained, and background delivery stays paused.
- If any round is not fully acknowledged, generation ends immediately. Unsent records remain locally queued for later investigation; they are not deleted.
- Production counters are preserved. Incident pulses do not invent elapsed production time or completed parts. Shaft power is derived from the scenario's torque and RPM.
- Critical/suspect labels describe simulated test scenarios. Missing sensor values are marked NOISY, not valid measurements. FactoryPulse still applies its own threshold, quality, permission and incident rules.
- Existing explicit continuous controls remain available for deliberate demonstrations. They require resuming delivery and pressing Start. Neither opening a page nor restarting the backend starts them.
- Actual MySQL transaction persistence remains FactoryPulse's responsibility; a successful sender acknowledgement alone is not a substitute for database verification.

## Verified on 2026-11-12

- 61 isolated Simulator backend tests passed, including selected-ID delivery with an untouched old queue, sensor overrides, derived-power consistency, one-round termination, cancellation and stopping on receiver failure.
- Simulator frontend production build passed; existing bundle-size warning remains.
- Real MCH-001 overheating test: 32 saved, 32 acknowledged; its relevant temperature value/status matched MySQL by reading ID.
- Real normal restoration: 32 saved, 32 acknowledged; its RPM and temperature matched MySQL by reading ID.
- MySQL received exactly 64 new records for these two tests; its newest ID stayed unchanged during the subsequent six-second idle check.
- Live desktop/mobile preview passed: 18 controls, one-round default, machine-detail integration and no mobile overflow. Browser preview did not start telemetry.
- A complete live 60-second incident/notification workflow was not exercised in this change. Its bounded-loop failure/cancellation behavior is covered by isolated tests.

No credentials were displayed, no operational data was deleted, and no Simulator files were pushed to GitHub.

## Simplified controls

The top workflow banner explains the three steps, provides machine search and a link to FactoryPulse. Continuous fleet controls, production settings and replay controls are collapsed under Advanced sections. Resuming background delivery requires confirmation because it can retry historical queued records. Error messages now show the backend's explanation instead of only an HTTP number. Manual test results show progress, acknowledged/queued/failed counts and a separate cancel button. The status bar reports the actual API connection and running-machine count.

Additional browser checks passed on desktop and mobile for machine search/switching, six recommended and 18 total scenarios, sensor search, preview-only selection, explicit one-round request, and collapsed advanced settings. The send was intercepted in this UI check; no live telemetry was generated. Existing telemetry endpoints, MySQL storage and authentication were unchanged by this interface update.
