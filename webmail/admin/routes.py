import os
import subprocess
from functools import wraps
from datetime import datetime, timedelta
from flask import render_template, request, jsonify, flash, redirect, url_for, abort
from flask_login import login_required, current_user
from admin import admin_bp
from models import db, Domain, Account, Alias, Setting, LoginLog, CalendarEvent, Contact
import bcrypt
import logging

logger = logging.getLogger(__name__)


def admin_required(f):
    """Decorator to require admin access"""
    @wraps(f)
    @login_required
    def decorated_function(*args, **kwargs):
        if not current_user.is_admin:
            abort(403)
        return f(*args, **kwargs)
    return decorated_function


# ─── Dashboard ──────────────────────────────────────────────────────────────

@admin_bp.route('/')
@admin_required
def dashboard():
    stats = {
        'total_domains': Domain.query.count(),
        'active_domains': Domain.query.filter_by(is_active=True).count(),
        'total_accounts': Account.query.count(),
        'active_accounts': Account.query.filter_by(is_active=True).count(),
        'total_aliases': Alias.query.count(),
        'logins_today': LoginLog.query.filter(
            LoginLog.created_at >= datetime.utcnow().date()
        ).count(),
        'failed_logins_today': LoginLog.query.filter(
            LoginLog.created_at >= datetime.utcnow().date(),
            LoginLog.success == False
        ).count(),
    }

    # Recent logins
    recent_logins = LoginLog.query.order_by(
        LoginLog.created_at.desc()
    ).limit(20).all()

    # Get system info
    system_info = {}
    try:
        system_info['uptime'] = subprocess.check_output(
            ['uptime', '-p'], text=True
        ).strip()
    except Exception:
        system_info['uptime'] = 'N/A'

    try:
        disk = os.statvfs('/')
        total_gb = (disk.f_blocks * disk.f_frsize) / (1024 ** 3)
        free_gb = (disk.f_bfree * disk.f_frsize) / (1024 ** 3)
        system_info['disk_total'] = f"{total_gb:.1f} GB"
        system_info['disk_free'] = f"{free_gb:.1f} GB"
        system_info['disk_percent'] = round((1 - free_gb / total_gb) * 100, 1)
    except Exception:
        system_info['disk_total'] = 'N/A'
        system_info['disk_free'] = 'N/A'
        system_info['disk_percent'] = 0

    # Service status
    services = {}
    for svc in ['postfix', 'dovecot', 'opendkim', 'spamassassin', 'clamav-daemon', 'nginx', 'mariadb']:
        try:
            result = subprocess.run(
                ['systemctl', 'is-active', svc],
                capture_output=True, text=True, timeout=5
            )
            services[svc] = result.stdout.strip() == 'active'
        except Exception:
            services[svc] = None

    return render_template('dashboard.html',
                           stats=stats,
                           recent_logins=recent_logins,
                           system_info=system_info,
                           services=services)


# ─── Domain Management ──────────────────────────────────────────────────────

@admin_bp.route('/domains')
@admin_required
def domains():
    all_domains = Domain.query.order_by(Domain.domain).all()
    return render_template('domains.html', domains=all_domains)


@admin_bp.route('/api/domains', methods=['POST'])
@admin_required
def create_domain():
    data = request.get_json()
    domain_name = data.get('domain', '').strip().lower()

    if not domain_name:
        return jsonify({'error': 'Domain name is required'}), 400

    if Domain.query.filter_by(domain=domain_name).first():
        return jsonify({'error': 'Domain already exists'}), 409

    domain = Domain(
        domain=domain_name,
        description=data.get('description', ''),
        max_accounts=data.get('max_accounts', 100),
        max_aliases=data.get('max_aliases', 100),
        max_quota_mb=data.get('max_quota_mb', 10240),
    )
    db.session.add(domain)
    db.session.commit()

    logger.info(f"DOMAIN_CREATED domain={domain_name} by={current_user.email}")
    return jsonify(domain.to_dict()), 201


@admin_bp.route('/api/domains/<int:domain_id>', methods=['PUT'])
@admin_required
def update_domain(domain_id):
    domain = Domain.query.get_or_404(domain_id)
    data = request.get_json()

    if 'description' in data:
        domain.description = data['description']
    if 'max_accounts' in data:
        domain.max_accounts = data['max_accounts']
    if 'max_aliases' in data:
        domain.max_aliases = data['max_aliases']
    if 'max_quota_mb' in data:
        domain.max_quota_mb = data['max_quota_mb']
    if 'is_active' in data:
        domain.is_active = data['is_active']

    db.session.commit()
    return jsonify(domain.to_dict())


@admin_bp.route('/api/domains/<int:domain_id>', methods=['DELETE'])
@admin_required
def delete_domain(domain_id):
    domain = Domain.query.get_or_404(domain_id)

    if domain.accounts.count() > 0:
        return jsonify({'error': 'Cannot delete domain with existing accounts'}), 400

    db.session.delete(domain)
    db.session.commit()

    logger.info(f"DOMAIN_DELETED domain={domain.domain} by={current_user.email}")
    return jsonify({'success': True})


# ─── Account Management ────────────────────────────────────────────────────

@admin_bp.route('/accounts')
@admin_required
def accounts():
    domain_filter = request.args.get('domain')
    query = Account.query

    if domain_filter:
        query = query.filter_by(domain_id=int(domain_filter))

    all_accounts = query.order_by(Account.email).all()
    all_domains = Domain.query.filter_by(is_active=True).all()
    return render_template('accounts.html',
                           accounts=all_accounts,
                           domains=all_domains,
                           selected_domain=domain_filter)


@admin_bp.route('/api/accounts', methods=['POST'])
@admin_required
def create_account():
    data = request.get_json()

    email_addr = data.get('email', '').strip().lower()
    password = data.get('password', '')
    domain_id = data.get('domain_id')

    if not email_addr or not password or not domain_id:
        return jsonify({'error': 'Email, password, and domain are required'}), 400

    if len(password) < 8:
        return jsonify({'error': 'Password must be at least 8 characters'}), 400

    domain = Domain.query.get(domain_id)
    if not domain:
        return jsonify({'error': 'Domain not found'}), 404

    # Auto-append domain if not present
    if '@' not in email_addr:
        email_addr = f"{email_addr}@{domain.domain}"

    if Account.query.filter_by(email=email_addr).first():
        return jsonify({'error': 'Account already exists'}), 409

    # Check account limit
    if domain.account_count >= domain.max_accounts:
        return jsonify({'error': 'Domain account limit reached'}), 400

    account = Account(
        domain_id=domain_id,
        email=email_addr,
        full_name=data.get('full_name', ''),
        quota_mb=data.get('quota_mb', int(Setting.get('default_quota', 1024))),
        is_admin=data.get('is_admin', False),
        is_active=True,
    )
    account.set_password(password)

    db.session.add(account)
    db.session.commit()

    # Create maildir
    try:
        mail_domain = email_addr.split('@')[1]
        mail_user = email_addr.split('@')[0]
        maildir = f"/var/vmail/{mail_domain}/{mail_user}/Maildir"
        os.makedirs(maildir, exist_ok=True)
        for d in ['cur', 'new', 'tmp']:
            os.makedirs(os.path.join(maildir, d), exist_ok=True)
        os.system(f"chown -R vmail:vmail /var/vmail/{mail_domain}/{mail_user}")
    except Exception as e:
        logger.warning(f"Could not create maildir: {e}")

    logger.info(f"ACCOUNT_CREATED email={email_addr} by={current_user.email}")
    return jsonify(account.to_dict()), 201


@admin_bp.route('/api/accounts/<int:account_id>', methods=['PUT'])
@admin_required
def update_account(account_id):
    account = Account.query.get_or_404(account_id)
    data = request.get_json()

    if 'full_name' in data:
        account.full_name = data['full_name']
    if 'quota_mb' in data:
        account.quota_mb = data['quota_mb']
    if 'is_admin' in data:
        account.is_admin = data['is_admin']
    if 'is_active' in data:
        account.is_active = data['is_active']
    if 'password' in data and data['password']:
        if len(data['password']) < 8:
            return jsonify({'error': 'Password must be at least 8 characters'}), 400
        account.set_password(data['password'])

    db.session.commit()
    return jsonify(account.to_dict())


@admin_bp.route('/api/accounts/<int:account_id>', methods=['DELETE'])
@admin_required
def delete_account(account_id):
    account = Account.query.get_or_404(account_id)

    if account.id == current_user.id:
        return jsonify({'error': 'Cannot delete your own account'}), 400

    email = account.email
    db.session.delete(account)
    db.session.commit()

    logger.info(f"ACCOUNT_DELETED email={email} by={current_user.email}")
    return jsonify({'success': True})


# ─── Alias Management ──────────────────────────────────────────────────────

@admin_bp.route('/aliases')
@admin_required
def aliases():
    all_aliases = Alias.query.order_by(Alias.source).all()
    all_domains = Domain.query.filter_by(is_active=True).all()
    return render_template('aliases.html', aliases=all_aliases, domains=all_domains)


@admin_bp.route('/api/aliases', methods=['POST'])
@admin_required
def create_alias():
    data = request.get_json()

    source = data.get('source', '').strip().lower()
    destination = data.get('destination', '').strip().lower()
    domain_id = data.get('domain_id')

    if not source or not destination or not domain_id:
        return jsonify({'error': 'Source, destination, and domain are required'}), 400

    alias = Alias(
        domain_id=domain_id,
        source=source,
        destination=destination,
    )
    db.session.add(alias)
    db.session.commit()

    logger.info(f"ALIAS_CREATED {source} -> {destination} by={current_user.email}")
    return jsonify(alias.to_dict()), 201


@admin_bp.route('/api/aliases/<int:alias_id>', methods=['DELETE'])
@admin_required
def delete_alias(alias_id):
    alias = Alias.query.get_or_404(alias_id)
    db.session.delete(alias)
    db.session.commit()
    return jsonify({'success': True})


# ─── Settings ──────────────────────────────────────────────────────────────

@admin_bp.route('/settings')
@admin_required
def settings():
    all_settings = Setting.query.order_by(Setting.setting_key).all()
    return render_template('settings.html', settings=all_settings)


@admin_bp.route('/api/settings', methods=['POST'])
@admin_required
def update_settings():
    data = request.get_json()

    for key, value in data.items():
        Setting.set(key, value)

    logger.info(f"SETTINGS_UPDATED by={current_user.email} keys={list(data.keys())}")
    return jsonify({'success': True})


# ─── Service Control ───────────────────────────────────────────────────────

@admin_bp.route('/api/service/<action>/<service>', methods=['POST'])
@admin_required
def service_control(action, service):
    allowed_services = ['postfix', 'dovecot', 'opendkim', 'spamassassin',
                        'clamav-daemon', 'nginx', 'promail']
    allowed_actions = ['start', 'stop', 'restart']

    if service not in allowed_services or action not in allowed_actions:
        return jsonify({'error': 'Invalid service or action'}), 400

    try:
        result = subprocess.run(
            ['systemctl', action, service],
            capture_output=True, text=True, timeout=30
        )
        success = result.returncode == 0
        logger.info(f"SERVICE_{action.upper()} {service} success={success} by={current_user.email}")
        return jsonify({'success': success, 'message': result.stderr or 'OK'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


# ─── Logs ──────────────────────────────────────────────────────────────────

@admin_bp.route('/logs')
@admin_required
def logs():
    log_type = request.args.get('type', 'login')
    page = int(request.args.get('page', 1))
    per_page = 50

    if log_type == 'login':
        query = LoginLog.query.order_by(LoginLog.created_at.desc())
        total = query.count()
        entries = query.offset((page - 1) * per_page).limit(per_page).all()
    else:
        entries = []
        total = 0

    total_pages = max(1, (total + per_page - 1) // per_page)

    return render_template('logs.html',
                           entries=entries,
                           log_type=log_type,
                           page=page,
                           total_pages=total_pages)


# ─── System Stats API ──────────────────────────────────────────────────────

@admin_bp.route('/api/stats')
@admin_required
def api_stats():
    # Mail queue
    try:
        queue = subprocess.check_output(
            ['postqueue', '-p'], text=True, timeout=5
        )
        queue_count = queue.count('\n') - 1 if queue.strip() != 'Mail queue is empty' else 0
    except Exception:
        queue_count = 0

    stats = {
        'accounts': Account.query.filter_by(is_active=True).count(),
        'domains': Domain.query.filter_by(is_active=True).count(),
        'aliases': Alias.query.filter_by(is_active=True).count(),
        'queue': queue_count,
        'logins_today': LoginLog.query.filter(
            LoginLog.created_at >= datetime.utcnow().date()
        ).count(),
    }
    return jsonify(stats)
