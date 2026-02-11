from datetime import datetime
from flask import render_template, redirect, url_for, request, flash, session, current_app
from flask_login import login_user, logout_user, login_required, current_user
from auth import auth_bp
from models import db, Account, LoginLog
import logging

logger = logging.getLogger(__name__)


@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('mail.inbox'))

    if request.method == 'POST':
        email = request.form.get('email', '').strip().lower()
        password = request.form.get('password', '')
        remember = request.form.get('remember', False) == 'on'
        ip_addr = request.headers.get('X-Real-IP', request.remote_addr)
        user_agent = request.headers.get('User-Agent', '')

        # Rate limiting check
        lockout_key = f'login_attempts_{ip_addr}'
        attempts = session.get(lockout_key, 0)
        lockout_until = session.get(f'lockout_until_{ip_addr}')

        if lockout_until:
            lockout_time = datetime.fromisoformat(lockout_until)
            if datetime.utcnow() < lockout_time:
                remaining = int((lockout_time - datetime.utcnow()).total_seconds() / 60) + 1
                flash(f'Account locked. Try again in {remaining} minutes.', 'error')
                return render_template('login.html')
            else:
                session.pop(lockout_key, None)
                session.pop(f'lockout_until_{ip_addr}', None)
                attempts = 0

        if not email or not password:
            flash('Please enter your email and password.', 'error')
            return render_template('login.html')

        account = Account.query.filter_by(email=email, is_active=True).first()

        if account and account.check_password(password):
            login_user(account, remember=remember)
            account.last_login = datetime.utcnow()
            db.session.commit()

            # Log successful login
            log = LoginLog(
                account_id=account.id,
                email=email,
                ip_address=ip_addr,
                user_agent=user_agent,
                success=True
            )
            db.session.add(log)
            db.session.commit()

            # Clear attempts
            session.pop(lockout_key, None)
            session.pop(f'lockout_until_{ip_addr}', None)

            logger.info(f"LOGIN_SUCCESS email={email} ip={ip_addr}")

            next_page = request.args.get('next')
            if next_page:
                return redirect(next_page)
            return redirect(url_for('mail.inbox'))
        else:
            # Failed login
            attempts += 1
            session[lockout_key] = attempts

            log = LoginLog(
                account_id=account.id if account else None,
                email=email,
                ip_address=ip_addr,
                user_agent=user_agent,
                success=False
            )
            db.session.add(log)
            db.session.commit()

            max_attempts = current_app.config.get('MAX_LOGIN_ATTEMPTS', 5)
            if attempts >= max_attempts:
                lockout_seconds = current_app.config.get('LOCKOUT_DURATION', 900)
                lockout_time = datetime.utcnow().replace(
                    second=datetime.utcnow().second
                )
                from datetime import timedelta
                lockout_time = datetime.utcnow() + timedelta(seconds=lockout_seconds)
                session[f'lockout_until_{ip_addr}'] = lockout_time.isoformat()
                flash(f'Too many failed attempts. Account locked for {lockout_seconds // 60} minutes.', 'error')
                logger.warning(f"LOGIN_LOCKED email={email} ip={ip_addr}")
            else:
                remaining = max_attempts - attempts
                flash(f'Invalid credentials. {remaining} attempts remaining.', 'error')

            logger.warning(f"LOGIN_FAILED email={email} ip={ip_addr}")

    return render_template('login.html')


@auth_bp.route('/logout')
@login_required
def logout():
    logger.info(f"LOGOUT email={current_user.email}")
    logout_user()
    flash('You have been signed out.', 'info')
    return redirect(url_for('auth.login'))
