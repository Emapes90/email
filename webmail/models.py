from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
import bcrypt
import os
from cryptography.fernet import Fernet

db = SQLAlchemy()

# Encryption key for storing IMAP/SMTP passwords (reversible encryption)
_FERNET_KEY = os.environ.get('FERNET_KEY', Fernet.generate_key().decode())
_fernet = Fernet(_FERNET_KEY.encode() if isinstance(_FERNET_KEY, str) else _FERNET_KEY)


class Domain(db.Model):
    __tablename__ = 'domains'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), unique=True, nullable=False)
    description = db.Column(db.Text)
    max_accounts = db.Column(db.Integer, default=100)
    max_aliases = db.Column(db.Integer, default=100)
    max_quota_mb = db.Column(db.Integer, default=10240)
    active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    accounts = db.relationship('Account', backref='domain', lazy='dynamic')
    aliases = db.relationship('Alias', backref='domain', lazy='dynamic')

    @property
    def account_count(self):
        return self.accounts.filter_by(active=True).count()

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'max_accounts': self.max_accounts,
            'max_aliases': self.max_aliases,
            'max_quota_mb': self.max_quota_mb,
            'active': self.active,
            'account_count': self.account_count,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class Account(UserMixin, db.Model):
    __tablename__ = 'accounts'

    id = db.Column(db.Integer, primary_key=True)
    domain_id = db.Column(db.Integer, db.ForeignKey('domains.id'), nullable=False)
    email = db.Column(db.String(255), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    encrypted_password = db.Column(db.Text, nullable=True)  # Fernet-encrypted plain password for IMAP/SMTP
    name = db.Column(db.String(255), default='')
    quota = db.Column(db.Integer, default=1024)
    is_admin = db.Column(db.Boolean, default=False)
    active = db.Column(db.Boolean, default=True)
    last_login = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    calendar_events = db.relationship('CalendarEvent', backref='account', lazy='dynamic')
    contacts = db.relationship('Contact', backref='account', lazy='dynamic')

    def set_password(self, password):
        self.password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        # Also store encrypted version for IMAP/SMTP auth
        self.encrypted_password = _fernet.encrypt(password.encode('utf-8')).decode('utf-8')

    def check_password(self, password):
        try:
            return bcrypt.checkpw(password.encode('utf-8'), self.password_hash.encode('utf-8'))
        except (ValueError, AttributeError):
            return False

    def _decrypt_password(self):
        """Decrypt the stored password for IMAP/SMTP authentication."""
        if self.encrypted_password:
            try:
                return _fernet.decrypt(self.encrypted_password.encode('utf-8')).decode('utf-8')
            except Exception:
                return ''
        return ''

    @property
    def username(self):
        return self.email.split('@')[0] if self.email else ''

    @property
    def domain_name(self):
        return self.email.split('@')[1] if self.email and '@' in self.email else ''

    def to_dict(self):
        return {
            'id': self.id,
            'email': self.email,
            'name': self.name,
            'quota': self.quota,
            'is_admin': self.is_admin,
            'active': self.active,
            'last_login': self.last_login.isoformat() if self.last_login else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'domain': self.domain.name if self.domain else None,
        }


class Alias(db.Model):
    __tablename__ = 'aliases'

    id = db.Column(db.Integer, primary_key=True)
    domain_id = db.Column(db.Integer, db.ForeignKey('domains.id'), nullable=False)
    source = db.Column(db.String(255), nullable=False)
    destination = db.Column(db.Text, nullable=False)
    active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'source': self.source,
            'destination': self.destination,
            'active': self.active,
            'domain_name': self.domain.name if self.domain else None,
        }


class CalendarEvent(db.Model):
    __tablename__ = 'calendar_events'

    id = db.Column(db.Integer, primary_key=True)
    account_id = db.Column(db.Integer, db.ForeignKey('accounts.id'), nullable=False)
    title = db.Column(db.String(500), nullable=False)
    description = db.Column(db.Text, default='')
    location = db.Column(db.String(500), default='')
    start_date = db.Column(db.String(30), nullable=False)
    end_date = db.Column(db.String(30), default='')
    all_day = db.Column(db.Boolean, default=False)
    color = db.Column(db.String(20), default='#667eea')
    reminder_minutes = db.Column(db.Integer, default=15)
    recurrence = db.Column(db.String(50))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'location': self.location,
            'start_date': self.start_date,
            'end_date': self.end_date,
            'all_day': self.all_day,
            'color': self.color,
        }


class Contact(db.Model):
    __tablename__ = 'contacts'

    id = db.Column(db.Integer, primary_key=True)
    account_id = db.Column(db.Integer, db.ForeignKey('accounts.id'), nullable=False)
    first_name = db.Column(db.String(255), nullable=False)
    last_name = db.Column(db.String(255), default='')
    email = db.Column(db.String(255), default='')
    phone = db.Column(db.String(50), default='')
    company = db.Column(db.String(255), default='')
    job_title = db.Column(db.String(255), default='')
    address = db.Column(db.Text, default='')
    notes = db.Column(db.Text, default='')
    avatar_color = db.Column(db.String(20), default='#6366f1')
    favorite = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    groups = db.relationship('ContactGroup', secondary='contact_group_members', backref='contacts')

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip()

    @property
    def initials(self):
        f = self.first_name[0].upper() if self.first_name else ''
        l = self.last_name[0].upper() if self.last_name else ''
        return f"{f}{l}" or '?'

    def to_dict(self):
        return {
            'id': self.id,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'full_name': self.full_name,
            'email': self.email,
            'phone': self.phone,
            'company': self.company,
            'job_title': self.job_title,
            'address': self.address,
            'notes': self.notes,
            'avatar_color': self.avatar_color,
            'initials': self.initials,
            'favorite': self.favorite,
            'groups': [g.name for g in self.groups],
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class ContactGroup(db.Model):
    __tablename__ = 'contact_groups'

    id = db.Column(db.Integer, primary_key=True)
    account_id = db.Column(db.Integer, db.ForeignKey('accounts.id'), nullable=False)
    name = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'member_count': len(self.contacts),
        }


contact_group_members = db.Table(
    'contact_group_members',
    db.Column('contact_id', db.Integer, db.ForeignKey('contacts.id'), primary_key=True),
    db.Column('group_id', db.Integer, db.ForeignKey('contact_groups.id'), primary_key=True),
    extend_existing=True
)


class LoginLog(db.Model):
    __tablename__ = 'login_log'

    id = db.Column(db.Integer, primary_key=True)
    account_id = db.Column(db.Integer, db.ForeignKey('accounts.id'), nullable=True)
    email = db.Column(db.String(255))
    ip_address = db.Column(db.String(45))
    user_agent = db.Column(db.Text)
    success = db.Column(db.Boolean)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class Setting(db.Model):
    __tablename__ = 'settings'

    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.String(255), unique=True, nullable=False)
    value = db.Column(db.Text)
    description = db.Column(db.Text)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    @staticmethod
    def get(key_name, default=None):
        s = Setting.query.filter_by(key=key_name).first()
        return s.value if s else default

    @staticmethod
    def set(key_name, val, description=None):
        s = Setting.query.filter_by(key=key_name).first()
        if s:
            s.value = str(val)
            if description:
                s.description = description
        else:
            s = Setting(key=key_name, value=str(val), description=description)
            db.session.add(s)
        db.session.commit()
