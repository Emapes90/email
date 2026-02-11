import imaplib
import email
import smtplib
import os
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from email.header import decode_header
from email.utils import parseaddr, formatdate
from datetime import datetime
from flask import render_template, redirect, url_for, request, flash, jsonify, current_app
from flask_login import login_required, current_user
from mail import mail_bp
import bleach
import logging

logger = logging.getLogger(__name__)

FOLDERS_MAP = {
    'inbox': 'INBOX',
    'sent': 'Sent',
    'drafts': 'Drafts',
    'trash': 'Trash',
    'junk': 'Junk',
    'archive': 'Archive',
}

FOLDER_ICONS = {
    'inbox': 'fa-inbox',
    'sent': 'fa-paper-plane',
    'drafts': 'fa-file-alt',
    'trash': 'fa-trash-alt',
    'junk': 'fa-shield-alt',
    'archive': 'fa-archive',
}


def get_imap_connection():
    """Create authenticated IMAP connection for current user"""
    try:
        host = current_app.config['IMAP_HOST']
        port = current_app.config['IMAP_PORT']
        mail_conn = imaplib.IMAP4_SSL(host, port)
        mail_conn.login(current_user.email, current_user._imap_password)
        return mail_conn
    except Exception as e:
        logger.error(f"IMAP connection failed for {current_user.email}: {e}")
        return None


def decode_mime_header(header_value):
    """Decode MIME encoded header"""
    if not header_value:
        return ''
    decoded_parts = decode_header(header_value)
    result = ''
    for part, charset in decoded_parts:
        if isinstance(part, bytes):
            result += part.decode(charset or 'utf-8', errors='replace')
        else:
            result += str(part)
    return result


def parse_email_message(raw_email, uid):
    """Parse raw email into a structured dict"""
    msg = email.message_from_bytes(raw_email)

    from_name, from_addr = parseaddr(decode_mime_header(msg.get('From', '')))
    to_raw = decode_mime_header(msg.get('To', ''))
    subject = decode_mime_header(msg.get('Subject', '(No Subject)'))
    date_str = msg.get('Date', '')
    message_id = msg.get('Message-ID', '')

    # Parse date
    try:
        from email.utils import parsedate_to_datetime
        date_obj = parsedate_to_datetime(date_str)
    except Exception:
        date_obj = datetime.utcnow()

    # Parse body
    body_text = ''
    body_html = ''
    attachments = []

    if msg.is_multipart():
        for part in msg.walk():
            content_type = part.get_content_type()
            content_disp = str(part.get('Content-Disposition', ''))

            if 'attachment' in content_disp:
                filename = part.get_filename()
                if filename:
                    filename = decode_mime_header(filename)
                    attachments.append({
                        'filename': filename,
                        'size': len(part.get_payload(decode=True) or b''),
                        'content_type': content_type,
                    })
            elif content_type == 'text/plain':
                payload = part.get_payload(decode=True)
                if payload:
                    body_text = payload.decode(part.get_content_charset() or 'utf-8', errors='replace')
            elif content_type == 'text/html':
                payload = part.get_payload(decode=True)
                if payload:
                    body_html = payload.decode(part.get_content_charset() or 'utf-8', errors='replace')
    else:
        payload = msg.get_payload(decode=True)
        if payload:
            if msg.get_content_type() == 'text/html':
                body_html = payload.decode(msg.get_content_charset() or 'utf-8', errors='replace')
            else:
                body_text = payload.decode(msg.get_content_charset() or 'utf-8', errors='replace')

    # Sanitize HTML
    if body_html:
        body_html = bleach.clean(
            body_html,
            tags=['p', 'br', 'b', 'i', 'u', 'strong', 'em', 'a', 'ul', 'ol', 'li',
                  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code',
                  'table', 'thead', 'tbody', 'tr', 'th', 'td', 'div', 'span', 'img',
                  'hr', 'sub', 'sup'],
            attributes={'a': ['href', 'title'], 'img': ['src', 'alt', 'width', 'height'],
                        'td': ['colspan', 'rowspan'], 'th': ['colspan', 'rowspan'],
                        'div': ['style'], 'span': ['style']},
            strip=True
        )

    return {
        'uid': uid,
        'message_id': message_id,
        'from_name': from_name or from_addr.split('@')[0],
        'from_email': from_addr,
        'to': to_raw,
        'subject': subject,
        'date': date_obj,
        'date_str': date_obj.strftime('%b %d, %Y %I:%M %p'),
        'date_short': date_obj.strftime('%b %d'),
        'body_text': body_text,
        'body_html': body_html,
        'attachments': attachments,
        'has_attachments': len(attachments) > 0,
    }


def get_folder_counts():
    """Get unread counts for all folders"""
    counts = {}
    try:
        conn = get_imap_connection()
        if not conn:
            return {f: 0 for f in FOLDERS_MAP}

        for key, folder in FOLDERS_MAP.items():
            try:
                conn.select(folder, readonly=True)
                _, data = conn.search(None, 'UNSEEN')
                counts[key] = len(data[0].split()) if data[0] else 0
            except Exception:
                counts[key] = 0

        conn.logout()
    except Exception as e:
        logger.error(f"Error getting folder counts: {e}")
        counts = {f: 0 for f in FOLDERS_MAP}

    return counts


@mail_bp.route('/')
@mail_bp.route('/inbox')
@login_required
def inbox():
    folder = request.args.get('folder', 'inbox')
    page = int(request.args.get('page', 1))
    per_page = 25
    search = request.args.get('search', '')

    messages = []
    total = 0

    try:
        conn = get_imap_connection()
        if conn:
            imap_folder = FOLDERS_MAP.get(folder, 'INBOX')
            conn.select(imap_folder, readonly=True)

            if search:
                _, data = conn.search(None, f'(OR SUBJECT "{search}" FROM "{search}")')
            else:
                _, data = conn.search(None, 'ALL')

            msg_ids = data[0].split() if data[0] else []
            msg_ids.reverse()  # Newest first
            total = len(msg_ids)

            # Paginate
            start = (page - 1) * per_page
            end = start + per_page
            page_ids = msg_ids[start:end]

            for msg_id in page_ids:
                try:
                    _, msg_data = conn.fetch(msg_id, '(UID RFC822 FLAGS)')
                    if msg_data and msg_data[0]:
                        raw_email = msg_data[0][1]
                        # Extract UID
                        uid = msg_id.decode()
                        flags = msg_data[0][0].decode() if msg_data[0][0] else ''
                        parsed = parse_email_message(raw_email, uid)
                        parsed['is_read'] = '\\Seen' in flags
                        parsed['is_flagged'] = '\\Flagged' in flags
                        messages.append(parsed)
                except Exception as e:
                    logger.error(f"Error parsing message {msg_id}: {e}")

            conn.logout()
    except Exception as e:
        logger.error(f"Error fetching messages: {e}")
        flash('Could not connect to mail server.', 'error')

    total_pages = max(1, (total + per_page - 1) // per_page)
    folder_counts = {}  # Will be fetched via JS API

    return render_template('inbox.html',
                           messages=messages,
                           folder=folder,
                           folders=FOLDERS_MAP,
                           folder_icons=FOLDER_ICONS,
                           page=page,
                           total_pages=total_pages,
                           total=total,
                           search=search,
                           folder_counts=folder_counts)


@mail_bp.route('/read/<uid>')
@login_required
def read_message(uid):
    folder = request.args.get('folder', 'inbox')
    message = None

    try:
        conn = get_imap_connection()
        if conn:
            imap_folder = FOLDERS_MAP.get(folder, 'INBOX')
            conn.select(imap_folder)

            _, msg_data = conn.fetch(uid.encode(), '(RFC822)')
            if msg_data and msg_data[0]:
                raw_email = msg_data[0][1]
                message = parse_email_message(raw_email, uid)
                # Mark as read
                conn.store(uid.encode(), '+FLAGS', '\\Seen')

            conn.logout()
    except Exception as e:
        logger.error(f"Error reading message {uid}: {e}")
        flash('Could not load message.', 'error')

    if not message:
        flash('Message not found.', 'error')
        return redirect(url_for('mail.inbox', folder=folder))

    return render_template('read.html', message=message, folder=folder,
                           folders=FOLDERS_MAP, folder_icons=FOLDER_ICONS)


@mail_bp.route('/compose', methods=['GET', 'POST'])
@login_required
def compose():
    if request.method == 'POST':
        to_addrs = request.form.get('to', '').strip()
        cc_addrs = request.form.get('cc', '').strip()
        bcc_addrs = request.form.get('bcc', '').strip()
        subject = request.form.get('subject', '').strip()
        body = request.form.get('body', '')
        is_html = request.form.get('is_html', 'true') == 'true'

        if not to_addrs:
            flash('Please specify at least one recipient.', 'error')
            return render_template('compose.html', folders=FOLDERS_MAP,
                                   folder_icons=FOLDER_ICONS)

        try:
            msg = MIMEMultipart('mixed')
            msg['From'] = f"{current_user.full_name} <{current_user.email}>"
            msg['To'] = to_addrs
            if cc_addrs:
                msg['Cc'] = cc_addrs
            msg['Subject'] = subject
            msg['Date'] = formatdate(localtime=True)

            # Body
            if is_html:
                body_part = MIMEText(body, 'html', 'utf-8')
            else:
                body_part = MIMEText(body, 'plain', 'utf-8')
            msg.attach(body_part)

            # Attachments
            files = request.files.getlist('attachments')
            for f in files:
                if f and f.filename:
                    attachment = MIMEBase('application', 'octet-stream')
                    attachment.set_payload(f.read())
                    encoders.encode_base64(attachment)
                    attachment.add_header('Content-Disposition', 'attachment',
                                         filename=f.filename)
                    msg.attach(attachment)

            # Send via SMTP
            all_recipients = []
            for addr_field in [to_addrs, cc_addrs, bcc_addrs]:
                if addr_field:
                    all_recipients.extend([a.strip() for a in addr_field.split(',')])

            smtp_host = current_app.config['SMTP_HOST']
            smtp_port = current_app.config['SMTP_PORT']

            with smtplib.SMTP(smtp_host, smtp_port) as smtp:
                smtp.starttls()
                smtp.login(current_user.email, current_user._imap_password)
                smtp.sendmail(current_user.email, all_recipients, msg.as_string())

            flash('Email sent successfully!', 'success')
            logger.info(f"EMAIL_SENT from={current_user.email} to={to_addrs}")
            return redirect(url_for('mail.inbox'))

        except Exception as e:
            logger.error(f"Error sending email: {e}")
            flash(f'Failed to send email: {str(e)}', 'error')

    # Pre-fill for reply/forward
    reply_to = request.args.get('reply_to', '')
    forward_uid = request.args.get('forward', '')
    reply_subject = request.args.get('subject', '')
    reply_body = request.args.get('body', '')

    return render_template('compose.html',
                           folders=FOLDERS_MAP,
                           folder_icons=FOLDER_ICONS,
                           reply_to=reply_to,
                           reply_subject=reply_subject,
                           reply_body=reply_body)


@mail_bp.route('/delete/<uid>', methods=['POST'])
@login_required
def delete_message(uid):
    folder = request.form.get('folder', 'inbox')
    try:
        conn = get_imap_connection()
        if conn:
            imap_folder = FOLDERS_MAP.get(folder, 'INBOX')
            conn.select(imap_folder)

            if folder == 'trash':
                conn.store(uid.encode(), '+FLAGS', '\\Deleted')
                conn.expunge()
            else:
                conn.copy(uid.encode(), 'Trash')
                conn.store(uid.encode(), '+FLAGS', '\\Deleted')
                conn.expunge()

            conn.logout()
            flash('Message moved to trash.', 'success')
    except Exception as e:
        logger.error(f"Error deleting message: {e}")
        flash('Failed to delete message.', 'error')

    return redirect(url_for('mail.inbox', folder=folder))


@mail_bp.route('/move/<uid>', methods=['POST'])
@login_required
def move_message(uid):
    folder = request.form.get('folder', 'inbox')
    target = request.form.get('target', 'archive')
    try:
        conn = get_imap_connection()
        if conn:
            imap_folder = FOLDERS_MAP.get(folder, 'INBOX')
            target_folder = FOLDERS_MAP.get(target, 'Archive')
            conn.select(imap_folder)
            conn.copy(uid.encode(), target_folder)
            conn.store(uid.encode(), '+FLAGS', '\\Deleted')
            conn.expunge()
            conn.logout()
            flash(f'Message moved to {target}.', 'success')
    except Exception as e:
        logger.error(f"Error moving message: {e}")
        flash('Failed to move message.', 'error')

    return redirect(url_for('mail.inbox', folder=folder))


@mail_bp.route('/api/folder-counts')
@login_required
def api_folder_counts():
    counts = get_folder_counts()
    return jsonify(counts)


@mail_bp.route('/star/<uid>', methods=['POST'])
@login_required
def toggle_star(uid):
    folder = request.form.get('folder', 'inbox')
    try:
        conn = get_imap_connection()
        if conn:
            imap_folder = FOLDERS_MAP.get(folder, 'INBOX')
            conn.select(imap_folder)
            _, data = conn.fetch(uid.encode(), '(FLAGS)')
            if data and data[0]:
                flags = data[0].decode()
                if '\\Flagged' in flags:
                    conn.store(uid.encode(), '-FLAGS', '\\Flagged')
                else:
                    conn.store(uid.encode(), '+FLAGS', '\\Flagged')
            conn.logout()
    except Exception as e:
        logger.error(f"Error toggling star: {e}")

    return jsonify({'success': True})
