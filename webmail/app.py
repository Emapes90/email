import os
import logging
from datetime import datetime
from flask import Flask, redirect, url_for, request
from flask_login import LoginManager, current_user
from flask_wtf.csrf import CSRFProtect
from flask_session import Session
from config import config
from models import db, Account

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('/var/log/promail/webmail.log', mode='a')
        if os.path.isdir('/var/log/promail') else logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Extensions
login_manager = LoginManager()
csrf = CSRFProtect()
sess = Session()


def create_app(config_name=None):
    """Application factory"""
    if config_name is None:
        config_name = os.environ.get('FLASK_ENV', 'production')

    app = Flask(__name__)
    app.config.from_object(config.get(config_name, config['default']))

    # Initialize extensions
    db.init_app(app)
    login_manager.init_app(app)
    csrf.init_app(app)
    sess.init_app(app)

    # Login manager config
    login_manager.login_view = 'auth.login'
    login_manager.login_message = 'Please sign in to access your mailbox.'
    login_manager.login_message_category = 'info'
    login_manager.session_protection = 'strong'

    @login_manager.user_loader
    def load_user(user_id):
        return Account.query.get(int(user_id))

    # Register blueprints — template-based (legacy)
    from auth.routes import auth_bp
    from mail.routes import mail_bp
    from calendar_app.routes import calendar_bp
    from contacts.routes import contacts_bp
    from admin.routes import admin_bp

    app.register_blueprint(auth_bp, url_prefix='/auth')
    app.register_blueprint(mail_bp, url_prefix='/mail')
    app.register_blueprint(calendar_bp, url_prefix='/calendar')
    app.register_blueprint(contacts_bp, url_prefix='/contacts')
    app.register_blueprint(admin_bp, url_prefix='/admin')

    # Register REST API blueprint (for Next.js frontend)
    from api import api_bp
    csrf.exempt(api_bp)          # API uses JWT cookies, not CSRF tokens
    app.register_blueprint(api_bp)

    # Root redirect
    @app.route('/')
    def index():
        if current_user.is_authenticated:
            return redirect(url_for('mail.inbox'))
        return redirect(url_for('auth.login'))

    # Context processor for templates
    @app.context_processor
    def inject_globals():
        return {
            'app_name': app.config.get('APP_NAME', 'ProMail'),
            'app_version': app.config.get('APP_VERSION', '2.0.0'),
            'current_year': datetime.utcnow().year,
        }

    # Security headers
    @app.after_request
    def security_headers(response):
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'SAMEORIGIN'
        response.headers['X-XSS-Protection'] = '1; mode=block'
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        return response

    # Error handlers
    @app.errorhandler(404)
    def not_found(e):
        return redirect(url_for('auth.login'))

    @app.errorhandler(500)
    def server_error(e):
        logger.error(f"Server error: {e}")
        return '<h1>500 - Internal Server Error</h1>', 500

    # Create tables if needed
    with app.app_context():
        db.create_all()

    return app


# Create application instance
app = create_app()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000, debug=True)
