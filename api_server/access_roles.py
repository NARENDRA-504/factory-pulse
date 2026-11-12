"""Explicit Super Admin inheritance and protection of privileged accounts."""
from fastapi import HTTPException

ADMIN_ROLES = {'Admin', 'Super Admin'}

def role_allowed(role, allowed):
    return role == 'Super Admin' or role in allowed

def protect_privileged_account(actor, before_role=None, requested_role=None):
    if actor.get('role') != 'Super Admin' and 'Super Admin' in (before_role, requested_role):
        raise HTTPException(403, 'Only a Super Admin can create, change or deactivate a Super Admin account.')

