"""Read-only evidence checks and role-specific response plans; never equipment control."""
import datetime as dt
import math

SENSORS = {
    'Temperature': ('°C', 'temperature'), 'Motor Temperature': ('°C', 'temperature'),
    'Coolant Temperature': ('°C', 'coolant'), 'Coolant Flow': ('L/min', 'coolant'),
    'Vibration': ('mm/s', 'vibration'), 'RPM': ('RPM', 'rpm'),
    'Pressure': ('bar', 'pressure'), 'Current': ('A', 'electrical'),
    'Voltage': ('V', 'electrical'), 'Torque': ('Nm', 'load'),
}


def assess(facts, machine_id, now):
    checked = []; latest = {}
    if now.tzinfo is None: now = now.replace(tzinfo=dt.timezone.utc)
    for fact in facts:
        if fact.get('machine_id') != machine_id or fact.get('sensor_name') not in SENSORS:
            continue
        name = fact['sensor_name']; issues = []; stamp = None; age = None
        try:
            raw = fact['timestamp']
            stamp = raw if isinstance(raw, dt.datetime) else dt.datetime.fromisoformat(str(raw).replace('Z', '+00:00'))
            if stamp.tzinfo is None: stamp = stamp.replace(tzinfo=dt.timezone.utc)
            age = round((now - stamp).total_seconds(), 1)
            if age < -5: issues.append('future_timestamp')
            elif age < 0 or age > 30: issues.append('stale_or_unverified_time')
        except (KeyError, ValueError, TypeError): issues.append('unverified_timestamp')
        if fact.get('data_quality') != 'GOOD': issues.append('unreliable_quality')
        if fact.get('sensor_unit') != SENSORS[name][0]: issues.append('unit_mismatch')
        value = fact.get('sensor_value')
        if not finite(value): issues.append('missing_or_invalid_value')
        low, high = fact.get('expected_min'), fact.get('expected_max')
        bounds = finite(low) and finite(high) and low < high
        row = {k: fact.get(k) for k in ('reading_id', 'sensor_name', 'sensor_value', 'sensor_unit', 'timestamp', 'machine_status')}
        row['sensor_value'] = value if finite(value) else None
        if not isinstance(row['timestamp'], (str, dt.datetime)):
            row['timestamp'] = None
        row.update(age_seconds=age, issues=issues, usable=not issues, category=SENSORS[name][1],
                   bounds_available=bounds, configured_range=f'{low}–{high} {SENSORS[name][0]}' if bounds else 'Not supplied',
                   comparison='unavailable' if issues or not bounds else 'below_configured_range' if value < low else 'above_configured_range' if value > high else 'within_configured_range')
        # Never use an older good sample to hide the newest bad-quality sample.
        order = stamp or dt.datetime.min.replace(tzinfo=dt.timezone.utc)
        if name not in latest or order >= latest[name][0]: latest[name] = (order, row)
    checked = [pair[1] for _, pair in sorted(latest.items())]
    valid = [r for r in checked if r['usable']]
    excursions = [r for r in valid if r['comparison'] in {'below_configured_range', 'above_configured_range'}]
    categories = sorted({r['category'] for r in excursions})
    return {'checks': checked, 'fresh_valid': len(valid), 'unreliable': len(checked) - len(valid),
            'excursions': excursions, 'suggested_topics': categories,
            'notice': 'Configured ranges are comparison evidence, not approved operating limits or proof of a failed component.'}


def finite(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def response_plan(role, assessment, level):
    role = 'Admin' if role == 'Super Admin' else role
    count = len(assessment['excursions'])
    summary = ('No verified current physical readings. Verify the data path before interpreting machine condition.'
               if not assessment['fresh_valid'] else
               f'{count} current sensor comparison(s) outside configured ranges. Confirm the event with the responsible team.'
               if count else 'Current validated readings do not show a configured-range excursion. Review any reported alarm separately.')
    owner = {'Operator': 'Your assigned supervisor and responsible maintenance team',
             'Supervisor': 'Assigned operator and authorized maintenance technician',
             'Maintenance': 'Assigned supervisor and maintenance lead',
             'Manager': 'Responsible supervisor and maintenance lead',
             'Admin': 'Data/platform owner for routing issues; supervisor for equipment response'}.get(role, 'Responsible supervisor')
    immediate = ('Follow the equipment/site-approved safe response and notify the responsible supervisor. Keep clear; this app supplies no isolation or stop-button sequence.'
                 if level == 'Critical' else
                 'Record the concern and ask the responsible team to review it. Continue operation only if the approved site procedure permits it.'
                 if level == 'Suspect' else 'Confirm the selected machine, controller alarm and evidence timestamp before deciding the next action.')
    if role in {'Manager', 'Admin'}:
        immediate = 'Confirm the response owner and the evidence; coordinate within your role. Account access does not authorize equipment operation.'
    return {'summary': summary, 'owner': owner, 'immediate_action': immediate,
            'capture': ['Machine ID, sensor name and exact unit', 'Reading ID, timestamp and controller alarm text',
                        'Operating mode, recent relevant change and observed symptoms', 'Assigned owner, inspection findings and follow-up verification'],
            'release_gate': 'A normal reading or closed ticket does not authorize restart. Follow the approved equipment verification and release process.',
            'avoid': 'Do not bypass guards, adjust limits to clear an alert, perform unauthorized repair or reset protective trips repeatedly.',
            'automatic_actions': False}
