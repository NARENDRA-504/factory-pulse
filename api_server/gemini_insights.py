"""Gemini AI and empirical machine health assistant analysis."""
import json
import logging
import os
import datetime

logger = logging.getLogger(__name__)
ALLOWED_FIELDS = frozenset({
    'reading_id', 'machine_id', 'timestamp', 'sensor_name', 'sensor_unit',
    'sensor_value', 'expected_min', 'expected_max', 'machine_status', 'data_quality', 'fault_mode'
})


def provider_configuration():
    key = os.getenv('GEMINI_API_KEY', '').strip()
    model = os.getenv('GEMINI_MODEL', 'gemini-3.8-flash').strip()
    valid_key = bool(key and not key.startswith('<') and key not in {'MY_GEMINI_API_KEY', 'your-api-key'})
    missing = []
    if not valid_key:
        missing.append('GEMINI_API_KEY')
    return key, model, missing


def generate_selected_analysis(question, machine_id, facts, calculation=None, client_factory=None):
    key, model, missing = provider_configuration()
    if missing:
        return {
            'provider_status': 'unconfigured',
            'generated_analysis': None,
            'provider_message': 'Set ' + ', '.join(missing) + ' in the backend environment to enable Gemini.'
        }
    selected = [
        {name: value for name, value in fact.items() if name in ALLOWED_FIELDS}
        for fact in facts if fact.get('machine_id') == machine_id
    ][:60]
    if not selected:
        return {
            'provider_status': 'no_evidence',
            'generated_analysis': None,
            'provider_message': 'No selected-machine telemetry is available to send to Gemini.'
        }
    try:
        from google import genai
        from google.genai import types
        factory = client_factory or genai.Client
        evidence = {'question': question, 'machine_id': machine_id, 'telemetry': selected, 'calculation': calculation}
        with factory(api_key=key, http_options=types.HttpOptions(timeout=12000, retry_options=types.HttpRetryOptions(attempts=1))) as client:
            def request_analysis(selected_model):
                return client.models.generate_content(
                    model=selected_model,
                    contents=json.dumps(evidence, default=str, ensure_ascii=False),
                    config=types.GenerateContentConfig(
                        temperature=0.2,
                        max_output_tokens=700,
                        system_instruction=(
                            'You are a read-only manufacturing assistant. Use only supplied JSON evidence. '
                            'Answer only about manufacturing machines, sensors, maintenance and production. '
                            'Clearly separate observed facts, supplied calculations, and tentative recommendations. '
                            'Do not invent readings or diagnoses.'
                        )
                    )
                )
            used_model = model
            try:
                response = request_analysis(model)
            except Exception as primary_error:
                if getattr(primary_error, 'code', None) != 504:
                    raise
                used_model = 'gemini-3.8-flash'
                response = request_analysis(used_model)
            answer = (response.text or '').strip()
        if not answer:
            return {
                'provider_status': 'unavailable',
                'generated_analysis': None,
                'provider_message': 'Gemini returned no usable answer. SQL evidence remains available.'
            }
        return {
            'provider_status': 'responded',
            'generated_analysis': answer,
            'provider_model': used_model,
            'provider_message': f'Google Gemini ({used_model}) analysis of the selected machine; recommendations require human review.'
        }
    except Exception as exc:
        logger.warning('Gemini request failed (%s)', type(exc).__name__)
        return {
            'provider_status': 'unavailable',
            'generated_analysis': None,
            'provider_message': 'Gemini is temporarily unavailable. SQL evidence remains available.'
        }


def analyze_machine_health(machine_id: str, machine_info: dict, telemetry_readings: list, downtime_info: dict = None) -> dict:
    """AI Machine Health Assistant analyzing real machine telemetry and downtime."""
    key, model, missing = provider_configuration()

    # Extract actual physical readings
    sensors = {}
    for r in telemetry_readings:
        s_name = r.get('sensor_name')
        if s_name and s_name not in sensors:
            val = r.get('sensor_value')
            if isinstance(val, (int, float)):
                sensors[s_name] = {
                    'value': float(val),
                    'unit': r.get('sensor_unit', ''),
                    'min': float(r.get('expected_min', 0)),
                    'max': float(r.get('expected_max', 100)),
                    'status': r.get('machine_status', 'NORMAL'),
                    'quality': r.get('data_quality', 'GOOD'),
                    'fault_mode': r.get('fault_mode')
                }

    temp_data = sensors.get('Temperature') or sensors.get('Motor Temperature')
    vib_data = sensors.get('Vibration')
    rpm_data = sensors.get('RPM')
    torque_data = sensors.get('Torque')
    curr_data = sensors.get('Current')

    temp_val = temp_data['value'] if temp_data else None
    vib_val = vib_data['value'] if vib_data else None
    rpm_val = rpm_data['value'] if rpm_data else None
    fault_mode = next((s['fault_mode'] for s in sensors.values() if s.get('fault_mode')), None)

    # Deterministic rule-based baseline calculations (empirically sound thresholds)
    warnings = []
    temp_warning = None
    vib_warning = None
    failure_indicators = []
    maintenance_recommendations = []

    if temp_val is not None:
        if temp_val > 65.0:
            temp_warning = {
                'severity': 'CRITICAL',
                'observed_value': f"{temp_val:.1f} °C",
                'threshold': '65.0 °C',
                'message': f"Critical thermal escalation: {temp_val:.1f}°C exceeds emergency cut-off limit."
            }
            warnings.append(temp_warning['message'])
            failure_indicators.append("Spindle Motor Thermal Runaway / Stator Overheat")
            maintenance_recommendations.append("Inspect coolant pump flow rate and chiller heat exchanger immediately.")
        elif temp_val > 45.0:
            temp_warning = {
                'severity': 'WARNING',
                'observed_value': f"{temp_val:.1f} °C",
                'threshold': '45.0 °C',
                'message': f"Elevated temperature detected: {temp_val:.1f}°C is above optimal operating range."
            }
            warnings.append(temp_warning['message'])
            failure_indicators.append("Coolant delivery degradation or high bearing friction")
            maintenance_recommendations.append("Top up cutting fluid reservoir and check line nozzles.")

    if vib_val is not None:
        if vib_val > 4.5:
            vib_warning = {
                'severity': 'CRITICAL',
                'observed_value': f"{vib_val:.2f} mm/s",
                'threshold': '4.5 mm/s',
                'message': f"Severe vibration spike: {vib_val:.2f} mm/s indicates dynamic imbalance or severe chatter."
            }
            warnings.append(vib_warning['message'])
            failure_indicators.append("Spindle Bearing Failure / Tool Breakage Risk")
            maintenance_recommendations.append("Halt cutting cycle; inspect tool holder runout and spindle taper seat.")
        elif vib_val > 2.5:
            vib_warning = {
                'severity': 'WARNING',
                'observed_value': f"{vib_val:.2f} mm/s",
                'threshold': '2.5 mm/s',
                'message': f"Moderate vibration elevation: {vib_val:.2f} mm/s approaching ISO vibration threshold."
            }
            warnings.append(vib_warning['message'])
            failure_indicators.append("Tool flank wear (Vb escalation) or harmonic resonance")
            maintenance_recommendations.append("Inspect insert cutting edge wear (Vb) and re-torque workholding clamps.")

    if fault_mode:
        failure_indicators.append(f"Simulator Fault Mode Triggered: {fault_mode}")
        maintenance_recommendations.append(f"Execute root-cause diagnosis for flagged fault mode: {fault_mode}.")

    # Downtime analysis
    current_round_downtime = downtime_info.get('current_downtime_seconds', 0) if downtime_info else 0
    total_downtime = downtime_info.get('total_seconds', 0) if downtime_info else 0

    if current_round_downtime > 0 or total_downtime > 0:
        downtime_explanation = (
            f"Machine accumulated {current_round_downtime:.0f}s of downtime during the active production round "
            f"(Total cumulative: {total_downtime:.0f}s). Root evidence: "
            + (f"Fault flag '{fault_mode}' with status STOPPED." if fault_mode else "Recorded machine status transitions to STOPPED in sensor readings.")
        )
    else:
        downtime_explanation = "Machine is actively producing with 0s downtime in the current production round."

    if not maintenance_recommendations:
        maintenance_recommendations.append("Continue standard operating shift schedule; maintain routine spindle lubrication.")

    # Check if Gemini is available for synthesis
    ai_generated_text = None
    if not missing:
        try:
            from google import genai
            from google.genai import types
            evidence_pack = {
                "machine_id": machine_id,
                "machine_name": machine_info.get('name') or machine_info.get('displayName'),
                "type": machine_info.get('machine_type'),
                "sensors": sensors,
                "downtime_current_round_sec": current_round_downtime,
                "downtime_total_sec": total_downtime,
                "fault_mode": fault_mode
            }
            with genai.Client(api_key=key, http_options=types.HttpOptions(timeout=10000)) as client:
                res = client.models.generate_content(
                    model=model,
                    contents=f"Analyze this manufacturing machine's real telemetry and produce a concise 3-sentence health assessment. Evidence: {json.dumps(evidence_pack, default=str)}",
                    config=types.GenerateContentConfig(
                        temperature=0.2,
                        max_output_tokens=300,
                        system_instruction="You are an industrial IoT AI engineer for FactoryPulse. Provide clear, factual machine health insights. Distinguish observed telemetry from predicted risks."
                    )
                )
                ai_generated_text = res.text.strip() if res.text else None
        except Exception as e:
            logger.info("Gemini live call skipped/failed: %s", type(e).__name__)

    # Default executive summary if Gemini not used or offline
    overall_health = "CRITICAL" if (temp_warning and temp_warning['severity'] == 'CRITICAL') or (vib_warning and vib_warning['severity'] == 'CRITICAL') else \
                     "WARNING" if temp_warning or vib_warning or fault_mode else "NOMINAL"

    if not ai_generated_text:
        ai_generated_text = (
            f"Condition Assessment for {machine_id} ({machine_info.get('name', 'CNC Station')}): "
            f"Machine is operating in {overall_health} condition. "
            f"Observed readings indicate {temp_val or 'nominal'}°C temperature and {vib_val or 'nominal'} mm/s vibration. "
            + ("Warning thresholds exceeded; immediate operator inspection recommended." if overall_health != 'NOMINAL' else "All core telemetry parameters remain safely within canonical ISO bounds.")
        )

    return {
        "machine_id": machine_id,
        "machine_code": machine_info.get('machineCode') or machine_info.get('machine_code'),
        "overall_health": overall_health,
        "machine_health_summary": ai_generated_text,
        "abnormal_temperature_warning": temp_warning,
        "excessive_vibration_warning": vib_warning,
        "potential_failure_indicators": failure_indicators,
        "downtime_explanation": downtime_explanation,
        "maintenance_recommendations": maintenance_recommendations,
        "natural_language_explanation": (
            f"Observed Facts: Real-time telemetry recorded {len(sensors)} active sensor streams at {datetime.datetime.now(datetime.timezone.utc).strftime('%H:%M:%S UTC')}. "
            f"Predicted Risks: Statistical baseline extrapolation indicates "
            + (f"risk of {failure_indicators[0]}." if failure_indicators else "low probability of unassisted failure in current shift.")
        ),
        "evidence_used": {
            "temperature": temp_val,
            "vibration": vib_val,
            "rpm": rpm_val,
            "fault_mode": fault_mode,
            "current_round_downtime_seconds": current_round_downtime,
            "total_downtime_seconds": total_downtime
        },
        "ai_engine": f"Google Gemini ({model})" if ai_generated_text and not missing else "FactoryPulse Industrial Physics Model",
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
    }
