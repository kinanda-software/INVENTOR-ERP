
from audit.models import AuditLog


def get_client_ip(request):
    """
    Return the client's IP address when a request is available.
    """
    if request is None:
        return None

    # Use REMOTE_ADDR by default.
    # Only trust forwarded headers when your proxy is configured
    # to set them safely.
    ip_address = request.META.get("REMOTE_ADDR")

    if not ip_address:
        return None

    import ipaddress

    try:
        return str(ipaddress.ip_address(ip_address))
    except ValueError:
        return None


def log_action(
    *,
    actor,
    action,
    module,
    obj,
    changes=None,
    request=None,
):
    """
    Create an audit record for a business action.

    Example:
        log_action(
            actor=request.user,
            action=AuditLog.Action.CREATE,
            module="inventory",
            obj=item,
            request=request,
        )
    """
    if obj is None:
        raise ValueError("An object is required for audit logging.")

    object_type = obj.__class__.__name__
    object_id = getattr(obj, "pk", None)

    if object_id is None:
        raise ValueError("The object must be saved before audit logging.")

    actor_id = getattr(actor, "pk", None)

    if actor_id is not None and not getattr(actor, "is_authenticated", False):
        actor = None

    return AuditLog.objects.create(
        actor=actor,
        action=action,
        module=module,
        object_type=object_type,
        object_id=str(object_id),
        object_repr=str(obj)[:255],
        changes=changes or {},
        ip_address=get_client_ip(request),
    )
