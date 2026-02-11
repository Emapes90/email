"""
ProMail — REST API Blueprint
Production-grade JSON API for the Next.js frontend.
All endpoints prefixed with /api/
"""

import os, subprocess, shutil, imaplib, email as email_lib, smtplib
from datetime import datetime, date, timedelta
from functools import wraps

from flask import Blueprint, request, jsonify, g, current_app, make_response
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders

import jwt, bcrypt

api_bp = Blueprint('api', __name__, url_prefix='/api')

# ── Helpers ────────────────────────────────────────────────────────────────

SECRET_KEY = os.environ.get('SECRET_KEY', 'change-me-in-production')
TOKEN_EXPIRY_DAYS = 7
COOKIE_NAME = 'promail_token'


def create_token(account):
    payload = {
        'sub': account.id,
        'email': account.email,
        'name': account.name or account.email,
        'domain': account.domain.name if account.domain else '',
        'is_admin': account.is_admin,
        'exp': datetime.utcnow() + timedelta(days=TOKEN_EXPIRY_DAYS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm='HS256')


def decode_token(token):
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None


def get_current_user():
    """Return the decoded JWT payload or None."""
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        auth_header = request.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            token = auth_header[7:]
    return decode_token(token) if token else None


def auth_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({'error': 'Authentication required'}), 401
        g.user = user
        return f(*args, **kwargs)
    return wrapper


def admin_required(f):
    @wraps(f)
    @auth_required
    def wrapper(*args, **kwargs):
        if not g.user.get('is_admin'):
            return jsonify({'error': 'Admin access required'}), 403
        return f(*args, **kwargs)
    return wrapper


def get_imap(user_payload):
    """Open an IMAP connection for the current user."""
    from models import Account
    account = Account.query.get(user_payload['sub'])
    if not account:
        return None
    conn = imaplib.IMAP4_SSL(
        current_app.config.get('MAIL_SERVER', '127.0.0.1'),
        current_app.config.get('IMAP_PORT', 993),
    )
    conn.login(account.email, account._decrypt_password())
    return conn


def parse_email(raw_bytes, uid):
    """Parse raw email bytes into a dict."""
    msg = email_lib.message_from_bytes(raw_bytes)

    def decode_header(hdr):
        if not hdr:
            return ''
        parts = email_lib.header.decode_header(hdr)
        result = []
        for data, charset in parts:
            if isinstance(data, bytes):
                result.append(data.decode(charset or 'utf-8', errors='replace'))
            else:
                result.append(str(data))
        return ' '.join(result)

    from_header = decode_header(msg.get('From', ''))
    from_name = from_header
    from_email = from_header
    if '<' in from_header:
        from_name = from_header.split('<')[0].strip().strip('"')
        from_email = from_header.split('<')[1].rstrip('>')

    body_html = ''
    body_text = ''
    attachments = []

    if msg.is_multipart():
        for i, part in enumerate(msg.walk()):
            ct = part.get_content_type()
            cd = str(part.get('Content-Disposition', ''))
            if 'attachment' in cd:
                attachments.append({
                    'filename': part.get_filename() or f'attachment_{i}',
                    'content_type': ct,
                    'size': len(part.get_payload(decode=True) or b''),
                    'index': i,
                })
            elif ct == 'text/html':
                body_html = part.get_payload(decode=True).decode('utf-8', errors='replace')
            elif ct == 'text/plain' and not body_text:
                body_text = part.get_payload(decode=True).decode('utf-8', errors='replace')
    else:
        ct = msg.get_content_type()
        payload = msg.get_payload(decode=True)
        if payload:
            text = payload.decode('utf-8', errors='replace')
            if ct == 'text/html':
                body_html = text
            else:
                body_text = text

    date_str = msg.get('Date', '')
    try:
        parsed_date = email_lib.utils.parsedate_to_datetime(date_str).isoformat()
    except Exception:
        parsed_date = date_str

    return {
        'uid': uid,
        'subject': decode_header(msg.get('Subject', '(No subject)')),
        'from_name': from_name,
        'from_email': from_email,
        'to': decode_header(msg.get('To', '')),
        'cc': decode_header(msg.get('Cc', '')),
        'bcc': decode_header(msg.get('Bcc', '')),
        'reply_to': decode_header(msg.get('Reply-To', '')),
        'date': parsed_date,
        'body_html': body_html,
        'body_text': body_text,
        'preview': (body_text or body_html)[:200].replace('\n', ' ').replace('\r', ''),
        'attachments': attachments,
        'has_attachments': len(attachments) > 0,
        'starred': False,
        'read': False,
        'flags': [],
    }


# ══════════════════════════════════════════════════════════════════════════
#  AUTH
# ══════════════════════════════════════════════════════════════════════════

@api_bp.route('/auth/login', methods=['POST'])
def auth_login():
    from models import Account, LoginLog, db
    data = request.get_json(silent=True) or {}
    email_addr = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not email_addr or not password:
        return jsonify({'error': 'Email and password are required'}), 400

    account = Account.query.filter_by(email=email_addr).first()
    success_flag = False

    if account and account.active and account.check_password(password):
        success_flag = True
        token = create_token(account)
        user_data = {
            'id': account.id,
            'email': account.email,
            'name': account.name or account.email,
            'domain': account.domain.name if account.domain else '',
            'is_admin': account.is_admin,
            'quota': account.quota,
            'created_at': account.created_at.isoformat() if account.created_at else '',
        }
        resp = make_response(jsonify({'user': user_data, 'message': 'Login successful'}))
        resp.set_cookie(
            COOKIE_NAME, token,
            httponly=True, secure=request.is_secure,
            samesite='Lax', max_age=86400 * TOKEN_EXPIRY_DAYS,
            path='/',
        )
    else:
        resp = make_response(jsonify({'error': 'Invalid email or password'}), 401)

    # Log attempt
    try:
        log = LoginLog(
            email=email_addr,
            ip_address=request.remote_addr,
            user_agent=request.headers.get('User-Agent', '')[:500],
            success=success_flag,
        )
        db.session.add(log)
        db.session.commit()
    except Exception:
        db.session.rollback()

    return resp


@api_bp.route('/auth/logout', methods=['POST'])
def auth_logout():
    resp = make_response(jsonify({'message': 'Logged out'}))
    resp.delete_cookie(COOKIE_NAME, path='/')
    return resp


@api_bp.route('/auth/me', methods=['GET'])
@auth_required
def auth_me():
    from models import Account
    account = Account.query.get(g.user['sub'])
    if not account:
        return jsonify({'error': 'Account not found'}), 404
    return jsonify({
        'user': {
            'id': account.id,
            'email': account.email,
            'name': account.name or account.email,
            'domain': account.domain.name if account.domain else '',
            'is_admin': account.is_admin,
            'quota': account.quota,
            'created_at': account.created_at.isoformat() if account.created_at else '',
        }
    })


# ══════════════════════════════════════════════════════════════════════════
#  MAIL
# ══════════════════════════════════════════════════════════════════════════

@api_bp.route('/mail/folders', methods=['GET'])
@auth_required
def mail_folders():
    folders = [
        {'name': 'INBOX', 'display_name': 'Inbox', 'icon': 'inbox', 'count': 0, 'unread': 0},
        {'name': 'Sent', 'display_name': 'Sent', 'icon': 'send', 'count': 0, 'unread': 0},
        {'name': 'Drafts', 'display_name': 'Drafts', 'icon': 'file-text', 'count': 0, 'unread': 0},
        {'name': 'Trash', 'display_name': 'Trash', 'icon': 'trash-2', 'count': 0, 'unread': 0},
        {'name': 'Junk', 'display_name': 'Spam', 'icon': 'archive', 'count': 0, 'unread': 0},
    ]
    try:
        conn = get_imap(g.user)
        if conn:
            for f in folders:
                try:
                    status, data = conn.select(f['name'], readonly=True)
                    if status == 'OK':
                        f['count'] = int(data[0])
                        _, unseen = conn.search(None, 'UNSEEN')
                        f['unread'] = len(unseen[0].split()) if unseen[0] else 0
                except Exception:
                    pass
            conn.logout()
    except Exception:
        pass
    return jsonify({'folders': folders})


@api_bp.route('/mail/messages', methods=['GET'])
@auth_required
def mail_messages():
    folder = request.args.get('folder', 'INBOX')
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 50))

    try:
        conn = get_imap(g.user)
        if not conn:
            return jsonify({'error': 'Cannot connect to mailbox'}), 500

        conn.select(folder)
        _, data = conn.search(None, 'ALL')
        uids = data[0].split() if data[0] else []
        uids.reverse()  # newest first

        total = len(uids)
        start = (page - 1) * per_page
        page_uids = uids[start:start + per_page]

        messages = []
        if page_uids:
            uid_str = b','.join(page_uids)
            _, msg_data = conn.fetch(uid_str, '(RFC822 FLAGS)')
            i = 0
            while i < len(msg_data):
                if isinstance(msg_data[i], tuple):
                    uid_bytes = page_uids[len(messages)] if len(messages) < len(page_uids) else b'0'
                    uid = int(uid_bytes)
                    raw = msg_data[i][1]
                    parsed = parse_email(raw, uid)
                    # Parse flags
                    flag_line = msg_data[i][0].decode('utf-8', errors='replace')
                    parsed['read'] = '\\Seen' in flag_line
                    parsed['starred'] = '\\Flagged' in flag_line
                    messages.append(parsed)
                i += 1

        conn.logout()
        return jsonify({
            'messages': messages,
            'total': total,
            'page': page,
            'per_page': per_page,
            'folder': folder,
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api_bp.route('/mail/messages/<int:uid>', methods=['GET'])
@auth_required
def mail_message_detail(uid):
    folder = request.args.get('folder', 'INBOX')
    try:
        conn = get_imap(g.user)
        if not conn:
            return jsonify({'error': 'Cannot connect'}), 500
        conn.select(folder)
        _, data = conn.fetch(str(uid).encode(), '(RFC822 FLAGS)')
        if not data or not data[0]:
            conn.logout()
            return jsonify({'error': 'Message not found'}), 404
        raw = data[0][1]
        parsed = parse_email(raw, uid)
        flag_line = data[0][0].decode('utf-8', errors='replace')
        parsed['read'] = '\\Seen' in flag_line
        parsed['starred'] = '\\Flagged' in flag_line
        # Mark as read
        conn.store(str(uid).encode(), '+FLAGS', '\\Seen')
        conn.logout()
        return jsonify({'message': parsed})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api_bp.route('/mail/send', methods=['POST'])
@auth_required
def mail_send():
    from models import Account
    account = Account.query.get(g.user['sub'])
    if not account:
        return jsonify({'error': 'Account not found'}), 404

    # Support both JSON and FormData
    if request.content_type and 'multipart/form-data' in request.content_type:
        to = request.form.get('to', '')
        cc = request.form.get('cc', '')
        bcc = request.form.get('bcc', '')
        subject = request.form.get('subject', '')
        body = request.form.get('body', '')
        files = request.files.getlist('attachments')
    else:
        data = request.get_json(silent=True) or {}
        to = data.get('to', '')
        cc = data.get('cc', '')
        bcc = data.get('bcc', '')
        subject = data.get('subject', '')
        body = data.get('body', '')
        files = []

    if not to:
        return jsonify({'error': 'Recipient is required'}), 400

    try:
        msg = MIMEMultipart()
        msg['From'] = f'{account.name or account.email} <{account.email}>'
        msg['To'] = to
        msg['Subject'] = subject
        if cc:
            msg['Cc'] = cc
        msg['Date'] = email_lib.utils.formatdate(localtime=True)
        msg.attach(MIMEText(body, 'plain', 'utf-8'))

        for f in files:
            part = MIMEBase('application', 'octet-stream')
            part.set_payload(f.read())
            encoders.encode_base64(part)
            part.add_header('Content-Disposition', f'attachment; filename="{f.filename}"')
            msg.attach(part)

        smtp = smtplib.SMTP(
            current_app.config.get('MAIL_SERVER', '127.0.0.1'),
            current_app.config.get('SMTP_PORT', 587),
        )
        smtp.starttls()
        smtp.login(account.email, account._decrypt_password())

        all_recipients = [r.strip() for r in to.split(',')]
        if cc:
            all_recipients += [r.strip() for r in cc.split(',')]
        if bcc:
            all_recipients += [r.strip() for r in bcc.split(',')]

        smtp.sendmail(account.email, all_recipients, msg.as_string())
        smtp.quit()

        return jsonify({'message': 'Sent successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api_bp.route('/mail/messages/<int:uid>/star', methods=['POST'])
@auth_required
def mail_star(uid):
    data = request.get_json(silent=True) or {}
    folder = data.get('folder', 'INBOX')
    try:
        conn = get_imap(g.user)
        conn.select(folder)
        _, flag_data = conn.fetch(str(uid).encode(), '(FLAGS)')
        flags = flag_data[0].decode('utf-8', errors='replace') if flag_data[0] else ''
        if '\\Flagged' in flags:
            conn.store(str(uid).encode(), '-FLAGS', '\\Flagged')
        else:
            conn.store(str(uid).encode(), '+FLAGS', '\\Flagged')
        conn.logout()
        return jsonify({'message': 'OK'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api_bp.route('/mail/messages/<int:uid>/delete', methods=['POST'])
@auth_required
def mail_delete(uid):
    data = request.get_json(silent=True) or {}
    folder = data.get('folder', 'INBOX')
    try:
        conn = get_imap(g.user)
        conn.select(folder)
        conn.store(str(uid).encode(), '+FLAGS', '\\Deleted')
        conn.expunge()
        conn.logout()
        return jsonify({'message': 'Deleted'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api_bp.route('/mail/messages/<int:uid>/move', methods=['POST'])
@auth_required
def mail_move(uid):
    data = request.get_json(silent=True) or {}
    folder = data.get('folder', 'INBOX')
    target = data.get('target', 'Archive')
    try:
        conn = get_imap(g.user)
        conn.select(folder)
        conn.copy(str(uid).encode(), target)
        conn.store(str(uid).encode(), '+FLAGS', '\\Deleted')
        conn.expunge()
        conn.logout()
        return jsonify({'message': f'Moved to {target}'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ══════════════════════════════════════════════════════════════════════════
#  CALENDAR
# ══════════════════════════════════════════════════════════════════════════

@api_bp.route('/calendar/events', methods=['GET'])
@auth_required
def calendar_events():
    from models import CalendarEvent
    year = request.args.get('year', type=int, default=datetime.now().year)
    month = request.args.get('month', type=int, default=datetime.now().month)
    start = date(year, month, 1)
    if month == 12:
        end = date(year + 1, 1, 1)
    else:
        end = date(year, month + 1, 1)

    events = CalendarEvent.query.filter(
        CalendarEvent.account_id == g.user['sub'],
        CalendarEvent.start_date >= start.isoformat(),
        CalendarEvent.start_date < end.isoformat(),
    ).all()

    return jsonify({
        'events': [
            {
                'id': e.id, 'title': e.title, 'description': e.description or '',
                'start_date': e.start_date, 'end_date': e.end_date or '',
                'all_day': e.all_day, 'color': e.color or '#667eea',
                'location': e.location or '',
            }
            for e in events
        ]
    })


@api_bp.route('/calendar/events', methods=['POST'])
@auth_required
def calendar_create_event():
    from models import CalendarEvent, db
    data = request.get_json(silent=True) or {}
    event = CalendarEvent(
        account_id=g.user['sub'],
        title=data.get('title', ''),
        description=data.get('description', ''),
        start_date=data.get('start_date', ''),
        end_date=data.get('end_date', ''),
        all_day=data.get('all_day', False),
        color=data.get('color', '#667eea'),
        location=data.get('location', ''),
    )
    db.session.add(event)
    db.session.commit()
    return jsonify({'message': 'Created', 'id': event.id}), 201


@api_bp.route('/calendar/events/<int:eid>', methods=['PUT'])
@auth_required
def calendar_update_event(eid):
    from models import CalendarEvent, db
    event = CalendarEvent.query.filter_by(id=eid, account_id=g.user['sub']).first_or_404()
    data = request.get_json(silent=True) or {}
    for field in ('title', 'description', 'start_date', 'end_date', 'all_day', 'color', 'location'):
        if field in data:
            setattr(event, field, data[field])
    db.session.commit()
    return jsonify({'message': 'Updated'})


@api_bp.route('/calendar/events/<int:eid>', methods=['DELETE'])
@auth_required
def calendar_delete_event(eid):
    from models import CalendarEvent, db
    event = CalendarEvent.query.filter_by(id=eid, account_id=g.user['sub']).first_or_404()
    db.session.delete(event)
    db.session.commit()
    return jsonify({'message': 'Deleted'})


# ══════════════════════════════════════════════════════════════════════════
#  CONTACTS
# ══════════════════════════════════════════════════════════════════════════

@api_bp.route('/contacts', methods=['GET'])
@auth_required
def contacts_list():
    from models import Contact
    q = Contact.query.filter_by(account_id=g.user['sub'])
    search = request.args.get('search', '').strip()
    if search:
        q = q.filter(
            (Contact.first_name.ilike(f'%{search}%')) |
            (Contact.last_name.ilike(f'%{search}%')) |
            (Contact.email.ilike(f'%{search}%'))
        )
    contacts = q.order_by(Contact.first_name).all()
    return jsonify({
        'contacts': [
            {
                'id': c.id, 'first_name': c.first_name, 'last_name': c.last_name or '',
                'email': c.email, 'phone': c.phone or '', 'company': c.company or '',
                'job_title': c.job_title or '', 'address': c.address or '',
                'notes': c.notes or '', 'favorite': c.favorite,
                'avatar_color': c.avatar_color or '', 'groups': [],
                'created_at': c.created_at.isoformat() if c.created_at else '',
            }
            for c in contacts
        ]
    })


@api_bp.route('/contacts', methods=['POST'])
@auth_required
def contacts_create():
    from models import Contact, db
    data = request.get_json(silent=True) or {}
    contact = Contact(
        account_id=g.user['sub'],
        first_name=data.get('first_name', ''),
        last_name=data.get('last_name', ''),
        email=data.get('email', ''),
        phone=data.get('phone', ''),
        company=data.get('company', ''),
        job_title=data.get('job_title', ''),
        address=data.get('address', ''),
        notes=data.get('notes', ''),
        favorite=data.get('favorite', False),
    )
    db.session.add(contact)
    db.session.commit()
    return jsonify({'message': 'Created', 'id': contact.id}), 201


@api_bp.route('/contacts/<int:cid>', methods=['PUT'])
@auth_required
def contacts_update(cid):
    from models import Contact, db
    contact = Contact.query.filter_by(id=cid, account_id=g.user['sub']).first_or_404()
    data = request.get_json(silent=True) or {}
    for field in ('first_name', 'last_name', 'email', 'phone', 'company',
                  'job_title', 'address', 'notes', 'favorite'):
        if field in data:
            setattr(contact, field, data[field])
    db.session.commit()
    return jsonify({'message': 'Updated'})


@api_bp.route('/contacts/<int:cid>', methods=['DELETE'])
@auth_required
def contacts_delete(cid):
    from models import Contact, db
    contact = Contact.query.filter_by(id=cid, account_id=g.user['sub']).first_or_404()
    db.session.delete(contact)
    db.session.commit()
    return jsonify({'message': 'Deleted'})


@api_bp.route('/contacts/groups', methods=['GET'])
@auth_required
def contacts_groups():
    from models import ContactGroup
    groups = ContactGroup.query.filter_by(account_id=g.user['sub']).all()
    return jsonify({
        'groups': [{'id': g_.id, 'name': g_.name, 'count': 0} for g_ in groups]
    })


@api_bp.route('/contacts/groups', methods=['POST'])
@auth_required
def contacts_create_group():
    from models import ContactGroup, db
    data = request.get_json(silent=True) or {}
    group = ContactGroup(account_id=g.user['sub'], name=data.get('name', ''))
    db.session.add(group)
    db.session.commit()
    return jsonify({'message': 'Created', 'id': group.id}), 201


# ══════════════════════════════════════════════════════════════════════════
#  ADMIN
# ══════════════════════════════════════════════════════════════════════════

@api_bp.route('/admin/dashboard', methods=['GET'])
@admin_required
def admin_dashboard():
    from models import Domain, Account, Alias, LoginLog, db
    today_start = datetime.combine(date.today(), datetime.min.time())

    stats = {
        'active_domains': Domain.query.filter_by(active=True).count(),
        'active_accounts': Account.query.filter_by(active=True).count(),
        'total_aliases': Alias.query.count(),
        'logins_today': LoginLog.query.filter(LoginLog.created_at >= today_start).count(),
        'failed_logins_today': LoginLog.query.filter(
            LoginLog.created_at >= today_start, LoginLog.success == False
        ).count(),
        'disk_percent': 0,
        'disk_total': '0 GB',
        'disk_free': '0 GB',
        'uptime': 'Unknown',
    }

    # System info
    try:
        usage = shutil.disk_usage('/')
        stats['disk_percent'] = round(usage.used / usage.total * 100, 1)
        stats['disk_total'] = f'{usage.total // (1024**3)} GB'
        stats['disk_free'] = f'{usage.free // (1024**3)} GB'
    except Exception:
        pass

    try:
        result = subprocess.run(['uptime', '-p'], capture_output=True, text=True, timeout=5)
        stats['uptime'] = result.stdout.strip() if result.returncode == 0 else 'Unknown'
    except Exception:
        stats['uptime'] = 'Unknown'

    # Services
    service_names = [
        ('postfix', 'Postfix SMTP'),
        ('dovecot', 'Dovecot IMAP'),
        ('opendkim', 'OpenDKIM'),
        ('spamassassin', 'SpamAssassin'),
        ('clamav-daemon', 'ClamAV'),
        ('nginx', 'Nginx'),
        ('fail2ban', 'Fail2Ban'),
    ]
    services = []
    for name, display in service_names:
        running = False
        try:
            result = subprocess.run(
                ['systemctl', 'is-active', name],
                capture_output=True, text=True, timeout=5,
            )
            running = result.stdout.strip() == 'active'
        except Exception:
            pass
        services.append({'name': name, 'display_name': display, 'running': running})

    # Recent logins
    recent = LoginLog.query.order_by(LoginLog.created_at.desc()).limit(15).all()
    recent_data = [
        {
            'id': l.id, 'email': l.email, 'ip_address': l.ip_address,
            'success': l.success, 'user_agent': l.user_agent or '',
            'created_at': l.created_at.isoformat() if l.created_at else '',
        }
        for l in recent
    ]

    return jsonify({
        'stats': stats,
        'services': services,
        'recent_logins': recent_data,
    })


@api_bp.route('/admin/domains', methods=['GET'])
@admin_required
def admin_domains_list():
    from models import Domain
    domains = Domain.query.order_by(Domain.name).all()
    return jsonify({
        'domains': [
            {
                'id': d.id, 'name': d.name, 'active': d.active,
                'accounts_count': len(d.accounts) if hasattr(d, 'accounts') else 0,
                'aliases_count': len(d.aliases) if hasattr(d, 'aliases') else 0,
                'created_at': d.created_at.isoformat() if d.created_at else '',
            }
            for d in domains
        ]
    })


@api_bp.route('/admin/domains', methods=['POST'])
@admin_required
def admin_domains_create():
    from models import Domain, db
    data = request.get_json(silent=True) or {}
    name = data.get('name', '').strip().lower()
    if not name:
        return jsonify({'error': 'Domain name is required'}), 400
    if Domain.query.filter_by(name=name).first():
        return jsonify({'error': 'Domain already exists'}), 409
    domain = Domain(name=name, active=True)
    db.session.add(domain)
    db.session.commit()
    return jsonify({'message': 'Domain created', 'id': domain.id}), 201


@api_bp.route('/admin/domains/<int:did>', methods=['DELETE'])
@admin_required
def admin_domains_delete(did):
    from models import Domain, db
    domain = Domain.query.get_or_404(did)
    db.session.delete(domain)
    db.session.commit()
    return jsonify({'message': 'Domain deleted'})


@api_bp.route('/admin/accounts', methods=['GET'])
@admin_required
def admin_accounts_list():
    from models import Account, Domain
    q = Account.query
    domain_filter = request.args.get('domain', '').strip()
    if domain_filter:
        domain = Domain.query.filter_by(name=domain_filter).first()
        if domain:
            q = q.filter_by(domain_id=domain.id)
    accounts = q.order_by(Account.email).all()
    return jsonify({
        'accounts': [
            {
                'id': a.id, 'email': a.email, 'name': a.name or '',
                'domain_id': a.domain_id,
                'domain_name': a.domain.name if a.domain else '',
                'quota': a.quota, 'active': a.active, 'is_admin': a.is_admin,
                'created_at': a.created_at.isoformat() if a.created_at else '',
            }
            for a in accounts
        ]
    })


@api_bp.route('/admin/accounts', methods=['POST'])
@admin_required
def admin_accounts_create():
    from models import Account, Domain, db
    data = request.get_json(silent=True) or {}
    username = data.get('username', '').strip().lower()
    domain_id = data.get('domain_id', 0)
    password = data.get('password', '')
    name = data.get('name', '')

    if not username or not domain_id or not password:
        return jsonify({'error': 'Username, domain, and password are required'}), 400
    if len(password) < 8:
        return jsonify({'error': 'Password must be at least 8 characters'}), 400

    domain = Domain.query.get(domain_id)
    if not domain:
        return jsonify({'error': 'Domain not found'}), 404

    email_addr = f'{username}@{domain.name}'
    if Account.query.filter_by(email=email_addr).first():
        return jsonify({'error': 'Account already exists'}), 409

    account = Account(
        email=email_addr,
        name=name,
        domain_id=domain.id,
        quota=data.get('quota', 1024),
        is_admin=data.get('is_admin', False),
        active=True,
    )
    account.set_password(password)
    db.session.add(account)
    db.session.commit()

    # Create maildir
    maildir = f'/var/mail/vhosts/{domain.name}/{username}'
    try:
        os.makedirs(maildir, exist_ok=True)
        subprocess.run(['chown', '-R', 'vmail:vmail', maildir], check=False)
    except Exception:
        pass

    return jsonify({'message': 'Account created', 'id': account.id}), 201


@api_bp.route('/admin/accounts/<int:aid>', methods=['PUT'])
@admin_required
def admin_accounts_update(aid):
    from models import Account, db
    account = Account.query.get_or_404(aid)
    data = request.get_json(silent=True) or {}
    if 'active' in data:
        account.active = data['active']
    if 'name' in data:
        account.name = data['name']
    if 'quota' in data:
        account.quota = data['quota']
    if 'is_admin' in data:
        account.is_admin = data['is_admin']
    if 'password' in data and data['password']:
        account.set_password(data['password'])
    db.session.commit()
    return jsonify({'message': 'Account updated'})


@api_bp.route('/admin/accounts/<int:aid>', methods=['DELETE'])
@admin_required
def admin_accounts_delete(aid):
    from models import Account, db
    account = Account.query.get_or_404(aid)
    db.session.delete(account)
    db.session.commit()
    return jsonify({'message': 'Account deleted'})


@api_bp.route('/admin/aliases', methods=['GET'])
@admin_required
def admin_aliases_list():
    from models import Alias
    aliases = Alias.query.order_by(Alias.source).all()
    return jsonify({
        'aliases': [
            {
                'id': a.id, 'source': a.source, 'destination': a.destination,
                'domain_id': a.domain_id,
                'domain_name': a.domain.name if a.domain else '',
                'active': a.active,
                'created_at': a.created_at.isoformat() if a.created_at else '',
            }
            for a in aliases
        ]
    })


@api_bp.route('/admin/aliases', methods=['POST'])
@admin_required
def admin_aliases_create():
    from models import Alias, db
    data = request.get_json(silent=True) or {}
    source = data.get('source', '').strip().lower()
    destination = data.get('destination', '').strip().lower()
    domain_id = data.get('domain_id', 0)
    if not source or not destination:
        return jsonify({'error': 'Source and destination are required'}), 400
    alias = Alias(source=source, destination=destination, domain_id=domain_id, active=True)
    db.session.add(alias)
    db.session.commit()
    return jsonify({'message': 'Alias created', 'id': alias.id}), 201


@api_bp.route('/admin/aliases/<int:aid>', methods=['DELETE'])
@admin_required
def admin_aliases_delete(aid):
    from models import Alias, db
    alias = Alias.query.get_or_404(aid)
    db.session.delete(alias)
    db.session.commit()
    return jsonify({'message': 'Alias deleted'})


@api_bp.route('/admin/settings', methods=['GET'])
@admin_required
def admin_settings_get():
    from models import Setting
    settings = Setting.query.order_by(Setting.key).all()
    return jsonify({
        'settings': [
            {'key': s.key, 'value': s.value, 'description': s.description or ''}
            for s in settings
        ]
    })


@api_bp.route('/admin/settings', methods=['PUT'])
@admin_required
def admin_settings_update():
    from models import Setting, db
    data = request.get_json(silent=True) or {}
    settings_dict = data.get('settings', {})
    for key, value in settings_dict.items():
        setting = Setting.query.filter_by(key=key).first()
        if setting:
            setting.value = value
        else:
            db.session.add(Setting(key=key, value=value))
    db.session.commit()
    return jsonify({'message': 'Settings saved'})


@api_bp.route('/admin/services/<name>/<action>', methods=['POST'])
@admin_required
def admin_service_action(name, action):
    allowed_services = ['postfix', 'dovecot', 'opendkim', 'spamassassin', 'clamav-daemon', 'nginx', 'fail2ban']
    allowed_actions = ['start', 'stop', 'restart']
    if name not in allowed_services:
        return jsonify({'error': 'Invalid service'}), 400
    if action not in allowed_actions:
        return jsonify({'error': 'Invalid action'}), 400
    try:
        result = subprocess.run(
            ['systemctl', action, name],
            capture_output=True, text=True, timeout=30,
        )
        if result.returncode == 0:
            return jsonify({'message': f'{name} {action}ed successfully'})
        return jsonify({'error': result.stderr or 'Action failed'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api_bp.route('/admin/logs', methods=['GET'])
@admin_required
def admin_logs():
    from models import LoginLog
    page = int(request.args.get('page', 1))
    per_page = 50
    log_type = request.args.get('type', 'all')

    q = LoginLog.query
    if log_type == 'success':
        q = q.filter_by(success=True)
    elif log_type == 'failed':
        q = q.filter_by(success=False)

    total = q.count()
    total_pages = max(1, (total + per_page - 1) // per_page)
    logs = q.order_by(LoginLog.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()

    return jsonify({
        'items': [
            {
                'id': l.id, 'email': l.email, 'ip_address': l.ip_address,
                'success': l.success, 'user_agent': l.user_agent or '',
                'created_at': l.created_at.isoformat() if l.created_at else '',
            }
            for l in logs
        ],
        'total': total,
        'page': page,
        'per_page': per_page,
        'total_pages': total_pages,
    })


# ══════════════════════════════════════════════════════════════════════════
#  ATTACHMENT DOWNLOAD
# ══════════════════════════════════════════════════════════════════════════

@api_bp.route('/mail/messages/<int:uid>/attachments/<int:att_index>', methods=['GET'])
@auth_required
def download_attachment(uid, att_index):
    """Download a specific attachment from an email by its part index."""
    folder = request.args.get('folder', 'INBOX')
    conn = get_imap(g.user)
    if not conn:
        return jsonify({'error': 'Mail connection failed'}), 500

    try:
        conn.select(folder, readonly=True)
        _, data = conn.uid('FETCH', str(uid), '(RFC822)')
        if not data or not data[0]:
            return jsonify({'error': 'Message not found'}), 404

        raw = data[0][1]
        msg = email_lib.message_from_bytes(raw)

        # Walk through parts to find the attachment at the given index
        for i, part in enumerate(msg.walk()):
            if i == att_index:
                cd = str(part.get('Content-Disposition', ''))
                if 'attachment' not in cd:
                    return jsonify({'error': 'Part is not an attachment'}), 400

                payload = part.get_payload(decode=True)
                if not payload:
                    return jsonify({'error': 'Empty attachment'}), 404

                filename = part.get_filename() or f'attachment_{i}'
                content_type = part.get_content_type() or 'application/octet-stream'

                from flask import Response
                response = Response(payload, content_type=content_type)
                response.headers['Content-Disposition'] = f'attachment; filename="{filename}"'
                response.headers['Content-Length'] = len(payload)
                return response

        return jsonify({'error': 'Attachment not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        try:
            conn.logout()
        except Exception:
            pass
