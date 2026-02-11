import os
from datetime import timedelta
from dotenv import load_dotenv

basedir = os.path.abspath(os.path.dirname(__file__))
load_dotenv(os.path.join(basedir, '..', 'config', 'production.env'))


class Config:
    """Base configuration"""
    SECRET_KEY = os.environ.get('SECRET_KEY', os.urandom(32).hex())
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', os.urandom(32).hex())

    # Database
    DB_HOST = os.environ.get('DB_HOST', '127.0.0.1')
    DB_PORT = int(os.environ.get('DB_PORT', 3306))
    DB_NAME = os.environ.get('DB_NAME', 'promail')
    DB_USER = os.environ.get('DB_USER', 'promail')
    DB_PASS = os.environ.get('DB_PASS', '')
    SQLALCHEMY_DATABASE_URI = (
        f"mysql+pymysql://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
        f"?charset=utf8mb4"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_POOL_SIZE = 10
    SQLALCHEMY_POOL_RECYCLE = 3600

    # Mail Server
    MAIL_SERVER = os.environ.get('MAIL_SERVER', 'localhost')
    MAIL_DOMAIN = os.environ.get('MAIL_DOMAIN', 'localhost')
    IMAP_HOST = os.environ.get('IMAP_HOST', '127.0.0.1')
    IMAP_PORT = int(os.environ.get('IMAP_PORT', 993))
    SMTP_HOST = os.environ.get('SMTP_HOST', '127.0.0.1')
    SMTP_PORT = int(os.environ.get('SMTP_PORT', 587))

    # Session
    SESSION_TYPE = 'filesystem'
    SESSION_FILE_DIR = os.path.join(basedir, 'sessions')
    PERMANENT_SESSION_LIFETIME = timedelta(hours=1)
    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'

    # Security
    WTF_CSRF_ENABLED = True
    MAX_LOGIN_ATTEMPTS = int(os.environ.get('MAX_LOGIN_ATTEMPTS', 5))
    LOCKOUT_DURATION = int(os.environ.get('LOCKOUT_DURATION', 900))
    MAX_CONTENT_LENGTH = int(os.environ.get('MAX_ATTACHMENT_SIZE', 26214400))

    # Upload
    UPLOAD_FOLDER = os.path.join(basedir, 'uploads')
    ALLOWED_EXTENSIONS = {
        'txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'doc', 'docx',
        'xls', 'xlsx', 'ppt', 'pptx', 'zip', 'rar', '7z', 'csv'
    }

    # Limits
    MAX_RECIPIENTS = int(os.environ.get('MAX_RECIPIENTS', 50))
    RATE_LIMIT_PER_HOUR = int(os.environ.get('RATE_LIMIT_PER_HOUR', 100))

    # App
    APP_NAME = 'ProMail'
    APP_VERSION = '2.0.0'


class DevelopmentConfig(Config):
    DEBUG = True
    SESSION_COOKIE_SECURE = False


class ProductionConfig(Config):
    DEBUG = False


config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': ProductionConfig
}
