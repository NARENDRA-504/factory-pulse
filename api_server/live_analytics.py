"""Deterministic calculations from persisted, explicitly stopped machine states."""
from datetime import datetime, timedelta, timezone


def downtime_intervals(observations, since, until, stale_seconds=30):
    """Communication gaps are unknown time, never inferred physical downtime."""
    intervals, start, previous_time, previous_stopped = [], None, None, False
    for timestamp, stopped in sorted(observations):
        if timestamp.tzinfo is None:
            timestamp = timestamp.replace(tzinfo=timezone.utc)
        if timestamp > until:
            break
        if previous_time and (timestamp-previous_time).total_seconds() > stale_seconds:
            if start is not None:
                intervals.append((start, previous_time, False))
                start = None
        if stopped and start is None:
            start = timestamp
        elif not stopped and start is not None:
            intervals.append((start, timestamp, False))
            start = None
        previous_time, previous_stopped = timestamp, stopped
    if start is not None:
        ongoing = bool(previous_time and (until-previous_time).total_seconds() <= stale_seconds)
        intervals.append((start, until if ongoing else previous_time, ongoing))
    return [(max(a, since), min(b, until), ongoing) for a,b,ongoing in intervals
            if b > since and a < until and min(b,until) > max(a,since)]


def summarize_downtime(observations, since, until, round_minutes=30, stale_seconds=30):
    intervals = downtime_intervals(observations, since, until, stale_seconds)
    rounds = {}
    for start, end, ongoing in intervals:
        cursor = start
        while cursor < end:
            epoch = int(cursor.timestamp())
            bucket = datetime.fromtimestamp(epoch//(round_minutes*60)*(round_minutes*60), timezone.utc)
            bucket_end = bucket+timedelta(minutes=round_minutes)
            overlap_end = min(end,bucket_end)
            key = bucket.isoformat()
            row = rounds.setdefault(key, {'round_id':key,'start':key,'end':bucket_end.isoformat(),'downtime_seconds':0})
            row['downtime_seconds'] += (overlap_end-cursor).total_seconds()
            cursor = overlap_end
    return {
        'total_seconds':sum((b-a).total_seconds() for a,b,_ in intervals),
        'current_downtime_seconds':next(((b-a).total_seconds() for a,b,ongoing in reversed(intervals) if ongoing),0),
        'intervals':[{'start':a.isoformat(),'end':b.isoformat(),'seconds':(b-a).total_seconds(),'ongoing':o} for a,b,o in intervals],
        'rounds':list(rounds.values()),
        'round_definition':f'UTC-aligned {round_minutes}-minute analysis windows; these are not production cycles.',
        'basis':'Explicit STOPPED telemetry only. Communication gaps are excluded after the last confirmed stopped reading.',
    }
