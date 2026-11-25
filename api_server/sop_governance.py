"""Read-only SOP metadata review. A catalog flag alone is not approval."""
import datetime as dt

def approval_review(document,now):
    status=document.get('status');issues=[];effective=None;due=None
    if status!='approved':issues.append('Site approval pending' if status=='training' else 'Document is not approved')
    if not isinstance(document.get('approved_by'),str) or not document['approved_by'].strip():issues.append('Approver not recorded')
    if not isinstance(document.get('manual_reference'),str) or not document['manual_reference'].strip():issues.append('Equipment manual reference missing')
    mapping=document.get('machine_ids')
    if not isinstance(mapping,list) or not mapping or not all(isinstance(x,str) and x.strip() for x in mapping):issues.append('Explicit machine mapping missing')
    for key in ('effective_date','review_due'):
        try:
            value=dt.date.fromisoformat(document.get(key) or '')
            if key=='effective_date':effective=value
            else:due=value
        except (ValueError,TypeError):issues.append(key.replace('_',' ').capitalize()+' missing or invalid')
    if effective and due and effective>due:issues.append('Review date is before the effective date')
    if effective and effective>now.date():issues.append('Not yet effective')
    if due and due<now.date():issues.append('Review overdue')
    roles=document.get('roles')
    if not isinstance(roles,dict) or not any(isinstance(steps,list) and steps and all(isinstance(s,str) and 0<len(s)<=700 for s in steps) for steps in roles.values()):issues.append('Usable role instructions missing')
    return {'usable_approved':not issues,'issues':issues,'review_overdue':bool(due and due<now.date()),
        'review_due_soon':bool(due and 0<=(due-now.date()).days<=30)}
