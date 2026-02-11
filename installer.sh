#!/bin/bash
###############################################################################
#  ProMail - Professional Email Hosting Auto-Installer
#  Version: 2.0.0
#  Supports: Ubuntu 20.04/22.04/24.04, Debian 11/12
###############################################################################

set -euo pipefail

# ─── Colors ─────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'
BOLD='\033[1m'

# ─── Banner ─────────────────────────────────────────────────────────────────
show_banner() {
    clear
    echo -e "${CYAN}${BOLD}"
    echo "╔══════════════════════════════════════════════════════════════════╗"
    echo "║                                                                ║"
    echo "║     ██████╗ ██████╗  ██████╗ ███╗   ███╗ █████╗ ██╗██╗       ║"
    echo "║     ██╔══██╗██╔══██╗██╔═══██╗████╗ ████║██╔══██╗██║██║       ║"
    echo "║     ██████╔╝██████╔╝██║   ██║██╔████╔██║███████║██║██║       ║"
    echo "║     ██╔═══╝ ██╔══██╗██║   ██║██║╚██╔╝██║██╔══██║██║██║       ║"
    echo "║     ██║     ██║  ██║╚██████╔╝██║ ╚═╝ ██║██║  ██║██║███████╗  ║"
    echo "║     ╚═╝     ╚═╝  ╚═╝ ╚═════╝ ╚═╝     ╚═╝╚═╝  ╚═╝╚═╝╚══════╝  ║"
    echo "║                                                                ║"
    echo "║           Professional Email Hosting Platform                   ║"
    echo "║                  Auto-Installer v2.0                           ║"
    echo "║                                                                ║"
    echo "╚══════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# ─── Logging ────────────────────────────────────────────────────────────────
log_info()    { echo -e "${GREEN}[✓]${NC} $1"; }
log_warn()    { echo -e "${YELLOW}[⚠]${NC} $1"; }
log_error()   { echo -e "${RED}[✗]${NC} $1"; }
log_step()    { echo -e "\n${BLUE}${BOLD}━━━ $1 ━━━${NC}\n"; }
log_substep() { echo -e "  ${CYAN}→${NC} $1"; }

# ─── Root Check ─────────────────────────────────────────────────────────────
check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This installer must be run as root (use sudo)"
        exit 1
    fi
}

# ─── OS Check ───────────────────────────────────────────────────────────────
check_os() {
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        OS=$ID
        OS_VERSION=$VERSION_ID
    else
        log_error "Cannot detect OS. Only Ubuntu/Debian supported."
        exit 1
    fi

    if [[ "$OS" != "ubuntu" && "$OS" != "debian" ]]; then
        log_error "Unsupported OS: $OS. Only Ubuntu/Debian supported."
        exit 1
    fi
    log_info "Detected OS: $OS $OS_VERSION"
}

# ─── Variables ──────────────────────────────────────────────────────────────
INSTALL_DIR="/opt/promail"
WEBMAIL_DIR="$INSTALL_DIR/webmail"
FRONTEND_DIR="$INSTALL_DIR/frontend"
CONFIG_DIR="$INSTALL_DIR/config"
LOG_DIR="/var/log/promail"
VENV_DIR="$INSTALL_DIR/venv"

DB_NAME="promail"
DB_USER="promail"
DB_PASS=""
DOMAIN=""
HOSTNAME_FQDN=""
ADMIN_EMAIL=""
ADMIN_PASS=""
SSL_EMAIL=""
USE_LETSENCRYPT="y"

# ─── Collect Configuration ──────────────────────────────────────────────────
collect_config() {
    log_step "Configuration Setup"

    echo -e "${BOLD}Enter your mail server details:${NC}\n"

    read -p "  Domain name (e.g., example.com): " DOMAIN
    while [[ -z "$DOMAIN" ]]; do
        echo -e "  ${RED}Domain cannot be empty${NC}"
        read -p "  Domain name (e.g., example.com): " DOMAIN
    done

    HOSTNAME_FQDN="mail.${DOMAIN}"
    read -p "  Mail hostname [${HOSTNAME_FQDN}]: " input
    HOSTNAME_FQDN="${input:-$HOSTNAME_FQDN}"

    read -p "  Admin email (e.g., admin@${DOMAIN}): " ADMIN_EMAIL
    ADMIN_EMAIL="${ADMIN_EMAIL:-admin@${DOMAIN}}"

    while true; do
        read -sp "  Admin password (min 8 chars): " ADMIN_PASS
        echo
        if [[ ${#ADMIN_PASS} -ge 8 ]]; then
            read -sp "  Confirm admin password: " ADMIN_PASS_CONFIRM
            echo
            if [[ "$ADMIN_PASS" == "$ADMIN_PASS_CONFIRM" ]]; then
                break
            else
                echo -e "  ${RED}Passwords do not match${NC}"
            fi
        else
            echo -e "  ${RED}Password must be at least 8 characters${NC}"
        fi
    done

    DB_PASS=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 24)

    read -p "  Use Let's Encrypt SSL? (y/n) [y]: " USE_LETSENCRYPT
    USE_LETSENCRYPT="${USE_LETSENCRYPT:-y}"

    if [[ "$USE_LETSENCRYPT" == "y" ]]; then
        read -p "  Email for SSL certificates [${ADMIN_EMAIL}]: " SSL_EMAIL
        SSL_EMAIL="${SSL_EMAIL:-$ADMIN_EMAIL}"
    fi

    echo ""
    echo -e "${BOLD}Configuration Summary:${NC}"
    echo -e "  Domain:       ${CYAN}${DOMAIN}${NC}"
    echo -e "  Hostname:     ${CYAN}${HOSTNAME_FQDN}${NC}"
    echo -e "  Admin Email:  ${CYAN}${ADMIN_EMAIL}${NC}"
    echo -e "  SSL:          ${CYAN}$([ "$USE_LETSENCRYPT" == "y" ] && echo "Let's Encrypt" || echo "Self-signed")${NC}"
    echo ""
    read -p "  Continue with installation? (y/n) [y]: " CONTINUE
    if [[ "${CONTINUE:-y}" != "y" ]]; then
        log_warn "Installation cancelled."
        exit 0
    fi
}

# ─── System Update ──────────────────────────────────────────────────────────
update_system() {
    log_step "Updating System Packages"
    export DEBIAN_FRONTEND=noninteractive

    apt-get update -qq
    apt-get upgrade -y -qq
    log_info "System packages updated"
}

# ─── Install Dependencies ──────────────────────────────────────────────────
install_dependencies() {
    log_step "Installing Dependencies"

    local packages=(
        # Mail server
        postfix postfix-mysql
        dovecot-core dovecot-imapd dovecot-pop3d dovecot-lmtpd dovecot-mysql dovecot-sieve dovecot-managesieved
        # Database
        mariadb-server mariadb-client
        # Spam & Virus Protection
        spamassassin spamd
        clamav clamav-daemon clamav-freshclam
        amavisd-new
        # DKIM
        opendkim opendkim-tools
        # SPF
        postfix-policyd-spf-python
        # SSL
        certbot
        # Python & Web
        python3 python3-pip python3-venv python3-dev
        # System utilities
        nginx
        ufw fail2ban
        git curl wget unzip
        libmariadb-dev
        # DNS utils
        dnsutils
    )

    for pkg in "${packages[@]}"; do
        log_substep "Installing $pkg..."
        apt-get install -y -qq "$pkg" 2>/dev/null || log_warn "Failed to install $pkg (may not be critical)"
    done

    log_info "All dependencies installed"
}

# ─── Setup Database ────────────────────────────────────────────────────────
setup_database() {
    log_step "Setting Up Database"

    systemctl start mariadb
    systemctl enable mariadb

    # Secure MariaDB
    mysql -e "DELETE FROM mysql.user WHERE User='';"
    mysql -e "DELETE FROM mysql.user WHERE User='root' AND Host NOT IN ('localhost', '127.0.0.1', '::1');"
    mysql -e "DROP DATABASE IF EXISTS test;"
    mysql -e "FLUSH PRIVILEGES;"

    # Create database and user
    mysql -e "CREATE DATABASE IF NOT EXISTS ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    mysql -e "CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';"
    mysql -e "GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost';"
    mysql -e "FLUSH PRIVILEGES;"

    log_info "Database '${DB_NAME}' created"

    # Create mail tables
    mysql "${DB_NAME}" <<EOF
-- Domains table
CREATE TABLE IF NOT EXISTS domains (
    id INT AUTO_INCREMENT PRIMARY KEY,
    domain VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    max_accounts INT DEFAULT 100,
    max_aliases INT DEFAULT 100,
    max_quota_mb INT DEFAULT 10240,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Email accounts table
CREATE TABLE IF NOT EXISTS accounts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    domain_id INT NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) DEFAULT '',
    quota_mb INT DEFAULT 1024,
    is_admin BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Aliases table
CREATE TABLE IF NOT EXISTS aliases (
    id INT AUTO_INCREMENT PRIMARY KEY,
    domain_id INT NOT NULL,
    source VARCHAR(255) NOT NULL,
    destination TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Calendar events
CREATE TABLE IF NOT EXISTS calendar_events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    account_id INT NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    location VARCHAR(500),
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    all_day BOOLEAN DEFAULT FALSE,
    color VARCHAR(7) DEFAULT '#6366f1',
    reminder_minutes INT DEFAULT 15,
    recurrence VARCHAR(50) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Contacts
CREATE TABLE IF NOT EXISTS contacts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    account_id INT NOT NULL,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) DEFAULT '',
    email VARCHAR(255) DEFAULT '',
    phone VARCHAR(50) DEFAULT '',
    company VARCHAR(255) DEFAULT '',
    job_title VARCHAR(255) DEFAULT '',
    address TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    avatar_color VARCHAR(7) DEFAULT '#6366f1',
    is_favorite BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Contact groups
CREATE TABLE IF NOT EXISTS contact_groups (
    id INT AUTO_INCREMENT PRIMARY KEY,
    account_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Contact group members
CREATE TABLE IF NOT EXISTS contact_group_members (
    contact_id INT NOT NULL,
    group_id INT NOT NULL,
    PRIMARY KEY (contact_id, group_id),
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
    FOREIGN KEY (group_id) REFERENCES contact_groups(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Login audit log
CREATE TABLE IF NOT EXISTS login_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    account_id INT,
    email VARCHAR(255),
    ip_address VARCHAR(45),
    user_agent TEXT,
    success BOOLEAN,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- System settings
CREATE TABLE IF NOT EXISTS settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    setting_key VARCHAR(255) NOT NULL UNIQUE,
    setting_value TEXT,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insert default settings
INSERT IGNORE INTO settings (setting_key, setting_value, description) VALUES
('max_attachment_size', '25', 'Maximum attachment size in MB'),
('default_quota', '1024', 'Default mailbox quota in MB'),
('allow_registration', 'false', 'Allow self-registration'),
('smtp_banner', 'ProMail ESMTP', 'SMTP banner message'),
('spam_threshold', '5.0', 'SpamAssassin threshold score'),
('virus_scanning', 'true', 'Enable virus scanning'),
('dkim_enabled', 'true', 'Enable DKIM signing'),
('spf_enabled', 'true', 'Enable SPF checking'),
('dmarc_enabled', 'true', 'Enable DMARC'),
('rate_limit_per_hour', '100', 'Max emails per hour per account'),
('system_name', 'ProMail', 'System display name'),
('system_version', '2.0.0', 'System version');
EOF

    log_info "Database tables created"

    # Insert domain and admin account
    ADMIN_PASS_HASH=$(python3 -c "
import hashlib, base64, os
salt = os.urandom(16)
h = hashlib.sha512(b'${ADMIN_PASS}' + salt).digest()
print('{SSHA512}' + base64.b64encode(h + salt).decode())
")

    mysql "${DB_NAME}" <<EOF
INSERT INTO domains (domain, description) VALUES ('${DOMAIN}', 'Primary domain')
ON DUPLICATE KEY UPDATE description='Primary domain';

INSERT INTO accounts (domain_id, email, password, full_name, is_admin, quota_mb)
SELECT d.id, '${ADMIN_EMAIL}', '${ADMIN_PASS_HASH}', 'Administrator', TRUE, 10240
FROM domains d WHERE d.domain='${DOMAIN}'
ON DUPLICATE KEY UPDATE password='${ADMIN_PASS_HASH}', is_admin=TRUE;
EOF

    log_info "Admin account created: ${ADMIN_EMAIL}"
}

# ─── Configure Postfix ──────────────────────────────────────────────────────
configure_postfix() {
    log_step "Configuring Postfix (SMTP Server)"

    # Backup originals
    cp /etc/postfix/main.cf /etc/postfix/main.cf.bak 2>/dev/null || true

    cat > /etc/postfix/main.cf <<EOF
# ProMail Postfix Configuration
# Generated by ProMail Installer

# Basic settings
smtpd_banner = \$myhostname ESMTP ProMail
biff = no
append_dot_mydomain = no
readme_directory = no
compatibility_level = 2

# TLS parameters
smtpd_tls_cert_file = /etc/ssl/certs/promail.pem
smtpd_tls_key_file = /etc/ssl/private/promail.key
smtpd_tls_security_level = may
smtpd_tls_auth_only = yes
smtpd_tls_loglevel = 1
smtpd_tls_received_header = yes
smtpd_tls_session_cache_timeout = 3600s
smtpd_tls_protocols = !SSLv2, !SSLv3, !TLSv1, !TLSv1.1
smtpd_tls_mandatory_protocols = !SSLv2, !SSLv3, !TLSv1, !TLSv1.1
smtpd_tls_mandatory_ciphers = high
smtpd_tls_eecdh_grade = strong
tls_preempt_cipherlist = yes

smtp_tls_security_level = may
smtp_tls_loglevel = 1
smtp_tls_session_cache_database = btree:\${data_directory}/smtp_scache
smtp_tls_protocols = !SSLv2, !SSLv3, !TLSv1, !TLSv1.1

# Network settings
myhostname = ${HOSTNAME_FQDN}
mydomain = ${DOMAIN}
myorigin = \$mydomain
mydestination = localhost
mynetworks = 127.0.0.0/8 [::ffff:127.0.0.0]/104 [::1]/128
inet_interfaces = all
inet_protocols = all

# Mailbox settings
virtual_transport = lmtp:unix:private/dovecot-lmtp
virtual_mailbox_domains = mysql:/etc/postfix/mysql-virtual-domains.cf
virtual_mailbox_maps = mysql:/etc/postfix/mysql-virtual-mailboxes.cf
virtual_alias_maps = mysql:/etc/postfix/mysql-virtual-aliases.cf

# SASL Authentication
smtpd_sasl_type = dovecot
smtpd_sasl_path = private/auth
smtpd_sasl_auth_enable = yes
smtpd_sasl_security_options = noanonymous
smtpd_sasl_local_domain = \$myhostname
broken_sasl_auth_clients = yes

# Restrictions
smtpd_helo_required = yes
smtpd_helo_restrictions =
    permit_mynetworks,
    reject_non_fqdn_helo_hostname,
    reject_invalid_helo_hostname,
    permit

smtpd_sender_restrictions =
    permit_mynetworks,
    reject_non_fqdn_sender,
    reject_unknown_sender_domain,
    permit

smtpd_recipient_restrictions =
    permit_sasl_authenticated,
    permit_mynetworks,
    reject_unauth_destination,
    reject_non_fqdn_recipient,
    reject_unknown_recipient_domain,
    reject_rbl_client zen.spamhaus.org,
    reject_rbl_client bl.spamcop.net,
    reject_rbl_client dnsbl.sorbs.net,
    permit

# Size limits
message_size_limit = 26214400
mailbox_size_limit = 0

# DKIM
milter_protocol = 6
milter_default_action = accept
smtpd_milters = unix:opendkim/opendkim.sock
non_smtpd_milters = unix:opendkim/opendkim.sock

# Content filter (Amavis)
content_filter = smtp-amavis:[127.0.0.1]:10024

# Rate limiting
smtpd_client_connection_rate_limit = 60
smtpd_client_message_rate_limit = 100
anvil_rate_time_unit = 60s

# Other
alias_maps = hash:/etc/aliases
alias_database = hash:/etc/aliases
EOF

    # MySQL lookup files for Postfix
    cat > /etc/postfix/mysql-virtual-domains.cf <<EOF
user = ${DB_USER}
password = ${DB_PASS}
hosts = 127.0.0.1
dbname = ${DB_NAME}
query = SELECT domain FROM domains WHERE domain='%s' AND is_active=1
EOF

    cat > /etc/postfix/mysql-virtual-mailboxes.cf <<EOF
user = ${DB_USER}
password = ${DB_PASS}
hosts = 127.0.0.1
dbname = ${DB_NAME}
query = SELECT CONCAT(SUBSTRING_INDEX(email,'@',-1),'/',SUBSTRING_INDEX(email,'@',1),'/') FROM accounts WHERE email='%s' AND is_active=1
EOF

    cat > /etc/postfix/mysql-virtual-aliases.cf <<EOF
user = ${DB_USER}
password = ${DB_PASS}
hosts = 127.0.0.1
dbname = ${DB_NAME}
query = SELECT destination FROM aliases WHERE source='%s' AND is_active=1
EOF

    chmod 640 /etc/postfix/mysql-*.cf
    chgrp postfix /etc/postfix/mysql-*.cf

    # Configure submission port
    cat > /etc/postfix/master.cf <<EOF
# ProMail Postfix Master Configuration
smtp      inet  n       -       y       -       -       smtpd
submission inet n       -       y       -       -       smtpd
  -o syslog_name=postfix/submission
  -o smtpd_tls_security_level=encrypt
  -o smtpd_sasl_auth_enable=yes
  -o smtpd_tls_auth_only=yes
  -o smtpd_reject_unlisted_recipient=no
  -o smtpd_recipient_restrictions=permit_sasl_authenticated,reject
  -o milter_macro_daemon_name=ORIGINATING
smtps     inet  n       -       y       -       -       smtpd
  -o syslog_name=postfix/smtps
  -o smtpd_tls_wrappermode=yes
  -o smtpd_sasl_auth_enable=yes
  -o smtpd_reject_unlisted_recipient=no
  -o smtpd_recipient_restrictions=permit_sasl_authenticated,reject
  -o milter_macro_daemon_name=ORIGINATING
pickup    unix  n       -       y       60      1       pickup
cleanup   unix  n       -       y       -       0       cleanup
qmgr      unix  n       -       n       300     1       qmgr
tlsmgr    unix  -       -       y       1000?   1       tlsmgr
rewrite   unix  -       -       y       -       -       trivial-rewrite
bounce    unix  -       -       y       -       0       bounce
defer     unix  -       -       y       -       0       bounce
trace     unix  -       -       y       -       0       bounce
verify    unix  -       -       y       -       1       verify
flush     unix  n       -       y       1000?   0       flush
proxymap  unix  -       -       n       -       -       proxymap
proxywrite unix -       -       n       -       1       proxymap
smtp      unix  -       -       y       -       -       smtp
relay     unix  -       -       y       -       -       smtp
showq     unix  n       -       y       -       -       showq
error     unix  -       -       y       -       -       error
retry     unix  -       -       y       -       -       error
discard   unix  -       -       y       -       -       discard
local     unix  -       n       n       -       -       local
virtual   unix  -       n       n       -       -       virtual
lmtp      unix  -       -       y       -       -       lmtp
anvil     unix  -       -       y       -       1       anvil
scache    unix  -       -       y       -       1       scache
postlog   unix-dgram n  -       n       -       1       postlogd
# Amavis content filter
smtp-amavis unix -      -       y       -       2       smtp
  -o smtp_data_done_timeout=1200
  -o smtp_send_xforward_command=yes
  -o disable_dns_lookups=yes
  -o max_use=20
127.0.0.1:10025 inet n  -       y       -       -       smtpd
  -o content_filter=
  -o local_recipient_maps=
  -o relay_recipient_maps=
  -o smtpd_restriction_classes=
  -o smtpd_delay_reject=no
  -o smtpd_client_restrictions=permit_mynetworks,reject
  -o smtpd_helo_restrictions=
  -o smtpd_sender_restrictions=
  -o smtpd_recipient_restrictions=permit_mynetworks,reject
  -o smtpd_data_restrictions=reject_unauth_pipelining
  -o smtpd_end_of_data_restrictions=
  -o mynetworks=127.0.0.0/8
  -o smtpd_error_sleep_time=0
  -o smtpd_soft_error_limit=1001
  -o smtpd_hard_error_limit=1000
  -o smtpd_client_connection_count_limit=0
  -o smtpd_client_connection_rate_limit=0
  -o receive_override_options=no_header_body_checks,no_unknown_recipient_checks
# SPF policy
policyd-spf unix -      n       n       -       0       spawn
  user=policyd-spf argv=/usr/bin/policyd-spf
EOF

    log_info "Postfix configured"
}

# ─── Configure Dovecot ──────────────────────────────────────────────────────
configure_dovecot() {
    log_step "Configuring Dovecot (IMAP/POP3 Server)"

    # Create vmail user
    groupadd -g 5000 vmail 2>/dev/null || true
    useradd -g vmail -u 5000 vmail -d /var/vmail -m 2>/dev/null || true
    mkdir -p /var/vmail
    chown -R vmail:vmail /var/vmail
    chmod 770 /var/vmail

    cat > /etc/dovecot/dovecot.conf <<EOF
# ProMail Dovecot Configuration
protocols = imap pop3 lmtp sieve
listen = *, ::
login_greeting = ProMail ready.

# Logging
log_path = /var/log/dovecot.log
info_log_path = /var/log/dovecot-info.log
debug_log_path = /var/log/dovecot-debug.log

# Mail location
mail_location = maildir:/var/vmail/%d/%n/Maildir
mail_privileged_group = vmail

# Authentication
auth_mechanisms = plain login
disable_plaintext_auth = yes

passdb {
    driver = sql
    args = /etc/dovecot/dovecot-sql.conf
}

userdb {
    driver = sql
    args = /etc/dovecot/dovecot-sql.conf
}

# SSL
ssl = required
ssl_cert = </etc/ssl/certs/promail.pem
ssl_key = </etc/ssl/private/promail.key
ssl_min_protocol = TLSv1.2
ssl_cipher_list = EECDH+AESGCM:EDH+AESGCM
ssl_prefer_server_ciphers = yes

# Services
service imap-login {
    inet_listener imap {
        port = 143
    }
    inet_listener imaps {
        port = 993
        ssl = yes
    }
}

service pop3-login {
    inet_listener pop3 {
        port = 110
    }
    inet_listener pop3s {
        port = 995
        ssl = yes
    }
}

service lmtp {
    unix_listener /var/spool/postfix/private/dovecot-lmtp {
        mode = 0600
        user = postfix
        group = postfix
    }
}

service auth {
    unix_listener /var/spool/postfix/private/auth {
        mode = 0666
        user = postfix
        group = postfix
    }
    unix_listener auth-userdb {
        mode = 0600
        user = vmail
        group = vmail
    }
    user = dovecot
}

service auth-worker {
    user = vmail
}

# Sieve
plugin {
    sieve = /var/vmail/%d/%n/.dovecot.sieve
    sieve_dir = /var/vmail/%d/%n/sieve
    sieve_before = /var/vmail/sieve-before.d/
    sieve_after = /var/vmail/sieve-after.d/
}

protocol lmtp {
    mail_plugins = \$mail_plugins sieve
}

protocol imap {
    mail_plugins = \$mail_plugins
    mail_max_userip_connections = 20
}

# Namespace
namespace inbox {
    inbox = yes
    separator = /

    mailbox Drafts {
        special_use = \Drafts
        auto = subscribe
    }
    mailbox Sent {
        special_use = \Sent
        auto = subscribe
    }
    mailbox "Sent Messages" {
        special_use = \Sent
    }
    mailbox Trash {
        special_use = \Trash
        auto = subscribe
    }
    mailbox Junk {
        special_use = \Junk
        auto = subscribe
    }
    mailbox Archive {
        special_use = \Archive
        auto = subscribe
    }
}
EOF

    cat > /etc/dovecot/dovecot-sql.conf <<EOF
driver = mysql
connect = host=127.0.0.1 dbname=${DB_NAME} user=${DB_USER} password=${DB_PASS}
default_pass_scheme = SSHA512

password_query = SELECT email as user, password FROM accounts WHERE email='%u' AND is_active=1
user_query = SELECT CONCAT('maildir:/var/vmail/', SUBSTRING_INDEX(email,'@',-1), '/', SUBSTRING_INDEX(email,'@',1), '/Maildir') as mail, 5000 as uid, 5000 as gid, CONCAT('*:bytes=', quota_mb * 1048576) as quota_rule FROM accounts WHERE email='%u' AND is_active=1
iterate_query = SELECT email as user FROM accounts WHERE is_active=1
EOF

    chmod 640 /etc/dovecot/dovecot-sql.conf
    chown root:dovecot /etc/dovecot/dovecot-sql.conf

    # Create sieve directories
    mkdir -p /var/vmail/sieve-before.d /var/vmail/sieve-after.d
    chown -R vmail:vmail /var/vmail/sieve-before.d /var/vmail/sieve-after.d

    # Spam filter sieve
    cat > /var/vmail/sieve-before.d/spam.sieve <<'EOF'
require ["fileinto", "reject", "vacation"];
if header :contains "X-Spam-Flag" "YES" {
    fileinto "Junk";
    stop;
}
EOF
    sievec /var/vmail/sieve-before.d/spam.sieve 2>/dev/null || true

    log_info "Dovecot configured"
}

# ─── Configure OpenDKIM ─────────────────────────────────────────────────────
configure_opendkim() {
    log_step "Configuring OpenDKIM"

    mkdir -p /etc/opendkim/keys/${DOMAIN}

    cat > /etc/opendkim.conf <<EOF
AutoRestart             Yes
AutoRestartRate         10/1h
Umask                   002
Syslog                  yes
SyslogSuccess           yes
LogWhy                  yes
Canonicalization        relaxed/simple
ExternalIgnoreList      refile:/etc/opendkim/TrustedHosts
InternalHosts           refile:/etc/opendkim/TrustedHosts
KeyTable                refile:/etc/opendkim/KeyTable
SigningTable             refile:/etc/opendkim/SigningTable
Mode                    sv
PidFile                 /var/run/opendkim/opendkim.pid
SignatureAlgorithm      rsa-sha256
UserID                  opendkim:opendkim
Socket                  local:/var/spool/postfix/opendkim/opendkim.sock
EOF

    cat > /etc/opendkim/TrustedHosts <<EOF
127.0.0.1
localhost
${DOMAIN}
*.${DOMAIN}
EOF

    # Generate DKIM key
    opendkim-genkey -s mail -d ${DOMAIN} -D /etc/opendkim/keys/${DOMAIN}/ -b 2048

    cat > /etc/opendkim/KeyTable <<EOF
mail._domainkey.${DOMAIN} ${DOMAIN}:mail:/etc/opendkim/keys/${DOMAIN}/mail.private
EOF

    cat > /etc/opendkim/SigningTable <<EOF
*@${DOMAIN} mail._domainkey.${DOMAIN}
EOF

    chown -R opendkim:opendkim /etc/opendkim
    chmod 700 /etc/opendkim/keys/

    # Create socket directory
    mkdir -p /var/spool/postfix/opendkim
    chown opendkim:postfix /var/spool/postfix/opendkim
    chmod 750 /var/spool/postfix/opendkim
    usermod -aG opendkim postfix

    log_info "OpenDKIM configured"

    # Display DKIM record
    echo ""
    log_warn "Add the following DNS TXT record for DKIM:"
    cat /etc/opendkim/keys/${DOMAIN}/mail.txt
    echo ""
}

# ─── Configure SpamAssassin ─────────────────────────────────────────────────
configure_spamassassin() {
    log_step "Configuring SpamAssassin"

    cat > /etc/spamassassin/local.cf <<EOF
# ProMail SpamAssassin Configuration
rewrite_header Subject [SPAM]
required_score 5.0
use_bayes 1
bayes_auto_learn 1
bayes_auto_expire 1

skip_rbl_checks 0
use_razor2 0
use_pyzor 0

# Network tests
dns_available yes
clear_trusted_networks
trusted_networks 127.0.0.0/8

# Score adjustments
score URIBL_BLOCKED 0
score RCVD_IN_SORBS_DUL 0
score RCVD_IN_DNSWL_BLOCKED 0

# Whitelist/Blacklist
# whitelist_from user@example.com
# blacklist_from spammer@example.com
EOF

    systemctl enable spamd
    systemctl start spamd
    sa-update 2>/dev/null || true

    log_info "SpamAssassin configured"
}

# ─── Configure ClamAV ───────────────────────────────────────────────────────
configure_clamav() {
    log_step "Configuring ClamAV Antivirus"

    systemctl stop clamav-freshclam 2>/dev/null || true
    freshclam 2>/dev/null || log_warn "ClamAV database update failed (will retry later)"
    systemctl enable clamav-freshclam
    systemctl start clamav-freshclam
    systemctl enable clamav-daemon
    systemctl start clamav-daemon 2>/dev/null || true

    log_info "ClamAV configured"
}

# ─── SSL Certificates ──────────────────────────────────────────────────────
setup_ssl() {
    log_step "Setting Up SSL Certificates"

    if [[ "$USE_LETSENCRYPT" == "y" ]]; then
        certbot certonly --standalone --non-interactive --agree-tos \
            -m "$SSL_EMAIL" \
            -d "$HOSTNAME_FQDN" \
            -d "webmail.${DOMAIN}" 2>/dev/null && {
            ln -sf /etc/letsencrypt/live/${HOSTNAME_FQDN}/fullchain.pem /etc/ssl/certs/promail.pem
            ln -sf /etc/letsencrypt/live/${HOSTNAME_FQDN}/privkey.pem /etc/ssl/private/promail.key
            log_info "Let's Encrypt SSL certificates installed"

            # Auto-renewal cron
            (crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet --post-hook 'systemctl reload postfix dovecot nginx'") | crontab -
        } || {
            log_warn "Let's Encrypt failed, generating self-signed certificate"
            generate_self_signed_ssl
        }
    else
        generate_self_signed_ssl
    fi
}

generate_self_signed_ssl() {
    openssl req -new -x509 -days 3650 -nodes \
        -out /etc/ssl/certs/promail.pem \
        -keyout /etc/ssl/private/promail.key \
        -subj "/C=US/ST=State/L=City/O=ProMail/CN=${HOSTNAME_FQDN}"
    chmod 600 /etc/ssl/private/promail.key
    log_info "Self-signed SSL certificate generated"
}

# ─── Configure Fail2Ban ─────────────────────────────────────────────────────
configure_fail2ban() {
    log_step "Configuring Fail2Ban (Brute Force Protection)"

    cat > /etc/fail2ban/jail.local <<EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5
ignoreip = 127.0.0.1/8

[postfix]
enabled = true
port = smtp,465,submission
filter = postfix
logpath = /var/log/mail.log

[dovecot]
enabled = true
port = imap,imaps,pop3,pop3s
filter = dovecot
logpath = /var/log/dovecot.log

[postfix-sasl]
enabled = true
port = smtp,465,submission
filter = postfix[mode=auth]
logpath = /var/log/mail.log

[promail-webmail]
enabled = true
port = http,https
filter = promail-webmail
logpath = /var/log/promail/webmail.log
maxretry = 5
bantime = 3600
EOF

    cat > /etc/fail2ban/filter.d/promail-webmail.conf <<EOF
[Definition]
failregex = ^.*LOGIN_FAILED.*ip=<HOST>.*$
ignoreregex =
EOF

    systemctl enable fail2ban
    systemctl restart fail2ban

    log_info "Fail2Ban configured"
}

# ─── Configure Firewall ────────────────────────────────────────────────────
configure_firewall() {
    log_step "Configuring UFW Firewall"

    ufw default deny incoming
    ufw default allow outgoing
    ufw allow 22/tcp    # SSH
    ufw allow 25/tcp    # SMTP
    ufw allow 80/tcp    # HTTP
    ufw allow 443/tcp   # HTTPS
    ufw allow 143/tcp   # IMAP
    ufw allow 993/tcp   # IMAPS
    ufw allow 110/tcp   # POP3
    ufw allow 995/tcp   # POP3S
    ufw allow 587/tcp   # Submission
    ufw allow 465/tcp   # SMTPS
    ufw allow 4190/tcp  # ManageSieve

    echo "y" | ufw enable

    log_info "Firewall configured"
}

# ─── Setup Webmail Application ──────────────────────────────────────────────
setup_webmail() {
    log_step "Setting Up ProMail Backend (Flask API)"

    mkdir -p "$INSTALL_DIR" "$WEBMAIL_DIR" "$FRONTEND_DIR" "$LOG_DIR" "$CONFIG_DIR"

    # Copy source files
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

    if [[ -d "$SCRIPT_DIR/webmail" ]]; then
        cp -r "$SCRIPT_DIR/webmail/"* "$WEBMAIL_DIR/"
    else
        log_error "Backend source not found at $SCRIPT_DIR/webmail"
        exit 1
    fi

    # Create Python virtual environment
    python3 -m venv "$VENV_DIR"
    source "$VENV_DIR/bin/activate"

    pip install --upgrade pip
    pip install -r "$WEBMAIL_DIR/requirements.txt"

    deactivate

    # Create production config
    SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))")
    JWT_SECRET=$(python3 -c "import secrets; print(secrets.token_hex(32))")

    cat > "$CONFIG_DIR/production.env" <<EOF
# ProMail Production Configuration
FLASK_ENV=production
SECRET_KEY=${SECRET_KEY}
JWT_SECRET_KEY=${JWT_SECRET}

# Database
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASS=${DB_PASS}

# Mail Server
MAIL_SERVER=${HOSTNAME_FQDN}
MAIL_DOMAIN=${DOMAIN}
IMAP_HOST=127.0.0.1
IMAP_PORT=993
SMTP_HOST=127.0.0.1
SMTP_PORT=587

# Security
SESSION_TIMEOUT=3600
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_DURATION=900
CSRF_ENABLED=true

# Limits
MAX_ATTACHMENT_SIZE=26214400
MAX_RECIPIENTS=50
EOF

    chmod 600 "$CONFIG_DIR/production.env"
    chown -R www-data:www-data "$WEBMAIL_DIR"
    chown -R www-data:www-data "$LOG_DIR"

    log_info "Flask backend deployed"
}

# ─── Build Next.js Frontend ─────────────────────────────────────────────────
setup_frontend() {
    log_step "Building Next.js Frontend (Production)"

    # Install Node.js 20 LTS if not present
    if ! command -v node &>/dev/null || [[ $(node -v | cut -d. -f1 | tr -d v) -lt 18 ]]; then
        log_substep "Installing Node.js 20 LTS..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y nodejs
    fi
    log_info "Node.js $(node -v) / npm $(npm -v)"

    # Copy frontend source
    if [[ -d "$SCRIPT_DIR/frontend" ]]; then
        cp -r "$SCRIPT_DIR/frontend/"* "$FRONTEND_DIR/"
    else
        log_error "Frontend source not found at $SCRIPT_DIR/frontend"
        exit 1
    fi

    # Create frontend .env for production build
    cat > "$FRONTEND_DIR/.env.local" <<EOF
BACKEND_URL=http://127.0.0.1:8000
NEXT_PUBLIC_APP_NAME=ProMail
NEXT_PUBLIC_APP_VERSION=2.0.0
EOF

    cd "$FRONTEND_DIR"

    # Install dependencies and build
    log_substep "Installing npm dependencies..."
    npm ci --production=false 2>/dev/null || npm install

    log_substep "Building production bundle (standalone)..."
    npm run build

    # Copy standalone output + static assets
    mkdir -p "$FRONTEND_DIR/.next/standalone/public"
    cp -r "$FRONTEND_DIR/public/"* "$FRONTEND_DIR/.next/standalone/public/" 2>/dev/null || true
    cp -r "$FRONTEND_DIR/.next/static" "$FRONTEND_DIR/.next/standalone/.next/static"

    chown -R www-data:www-data "$FRONTEND_DIR"

    cd "$SCRIPT_DIR"
    log_info "Next.js frontend built successfully"
}

# ─── Configure Nginx ────────────────────────────────────────────────────────
configure_nginx() {
    log_step "Configuring Nginx Web Server"

    cat > /etc/nginx/sites-available/promail <<EOF
# ProMail Webmail - Nginx Configuration

# Rate limiting
limit_req_zone \$binary_remote_addr zone=login:10m rate=5r/m;
limit_req_zone \$binary_remote_addr zone=api:10m rate=30r/m;

# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name webmail.${DOMAIN} ${HOSTNAME_FQDN};
    return 301 https://\$host\$request_uri;
}

# Main HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name webmail.${DOMAIN} ${HOSTNAME_FQDN};

    # SSL
    ssl_certificate /etc/ssl/certs/promail.pem;
    ssl_certificate_key /etc/ssl/private/promail.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers EECDH+AESGCM:EDH+AESGCM;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    ssl_stapling on;
    ssl_stapling_verify on;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:;" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Logging
    access_log /var/log/nginx/promail-access.log;
    error_log /var/log/nginx/promail-error.log;

    # Max upload size
    client_max_body_size 25M;

    # Next.js static assets (immutable hashed filenames)
    location /_next/static/ {
        proxy_pass http://127.0.0.1:3000;
        expires 365d;
        add_header Cache-Control "public, immutable";
    }

    # API endpoints → Flask backend (port 8000)
    location /api/ {
        limit_req zone=api burst=10 nodelay;
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
    }

    # Login rate limiting (API login endpoint)
    location /api/auth/login {
        limit_req zone=login burst=3 nodelay;
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Everything else → Next.js frontend (port 3000)
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF

    ln -sf /etc/nginx/sites-available/promail /etc/nginx/sites-enabled/promail
    rm -f /etc/nginx/sites-enabled/default

    nginx -t && systemctl enable nginx && systemctl restart nginx
    log_info "Nginx configured"
}

# ─── Create Systemd Service ────────────────────────────────────────────────
create_systemd_service() {
    log_step "Creating Systemd Services"

    # Flask API backend service (port 8000)
    cat > /etc/systemd/system/promail-api.service <<EOF
[Unit]
Description=ProMail Flask API Backend
After=network.target mariadb.service

[Service]
Type=exec
User=www-data
Group=www-data
WorkingDirectory=${WEBMAIL_DIR}
EnvironmentFile=${CONFIG_DIR}/production.env
ExecStart=${VENV_DIR}/bin/gunicorn --workers 4 --bind 127.0.0.1:8000 --timeout 120 --access-logfile /var/log/promail/api-access.log --error-logfile /var/log/promail/api-error.log app:app
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

    # Next.js frontend service (port 3000)
    cat > /etc/systemd/system/promail-frontend.service <<EOF
[Unit]
Description=ProMail Next.js Frontend
After=network.target promail-api.service

[Service]
Type=exec
User=www-data
Group=www-data
WorkingDirectory=${FRONTEND_DIR}/.next/standalone
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=HOSTNAME=127.0.0.1
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

    # Legacy alias — "promail" target manages both
    cat > /etc/systemd/system/promail.service <<EOF
[Unit]
Description=ProMail Email Platform (API + Frontend)
After=network.target
Requires=promail-api.service promail-frontend.service

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/bin/true

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable promail-api promail-frontend promail
    systemctl start promail-api
    systemctl start promail-frontend

    log_info "ProMail services created and started (API :8000, Frontend :3000)"
}

# ─── Start All Services ────────────────────────────────────────────────────
start_services() {
    log_step "Starting All Services"

    local services=(postfix dovecot opendkim spamd clamav-daemon clamav-freshclam)
    for svc in "${services[@]}"; do
        systemctl enable "$svc" 2>/dev/null || true
        systemctl restart "$svc" 2>/dev/null && log_info "$svc started" || log_warn "$svc failed to start"
    done
}

# ─── Save Installation Info ────────────────────────────────────────────────
save_install_info() {
    cat > "$CONFIG_DIR/install-info.txt" <<EOF
╔══════════════════════════════════════════════════════════════╗
║                ProMail Installation Details                  ║
╚══════════════════════════════════════════════════════════════╝

Installation Date: $(date)
Domain: ${DOMAIN}
Mail Hostname: ${HOSTNAME_FQDN}
Admin Email: ${ADMIN_EMAIL}

── Database ──────────────────────────────────────────────────
Database: ${DB_NAME}
DB User: ${DB_USER}
DB Password: ${DB_PASS}

── Webmail ───────────────────────────────────────────────────
URL: https://webmail.${DOMAIN}
Admin Panel: https://webmail.${DOMAIN}/admin
Frontend Dir: ${FRONTEND_DIR}

── Ports ─────────────────────────────────────────────────────
SMTP:       25
Submission: 587
SMTPS:      465
IMAP:       143
IMAPS:      993
POP3:       110
POP3S:      995
HTTP:       80
HTTPS:      443

── DNS Records Required ──────────────────────────────────────
MX:    ${DOMAIN}    →  ${HOSTNAME_FQDN}  (Priority: 10)
A:     ${HOSTNAME_FQDN}  →  <YOUR_SERVER_IP>
A:     webmail.${DOMAIN}  →  <YOUR_SERVER_IP>
TXT:   ${DOMAIN}    →  "v=spf1 mx a ip4:<YOUR_SERVER_IP> -all"
TXT:   _dmarc.${DOMAIN}  →  "v=DMARC1; p=quarantine; rua=mailto:dmarc@${DOMAIN}"
DKIM:  (see /etc/opendkim/keys/${DOMAIN}/mail.txt)

── File Locations ────────────────────────────────────────────
Install Directory:  ${INSTALL_DIR}
Webmail Directory:  ${WEBMAIL_DIR}
Config Directory:   ${CONFIG_DIR}
Log Directory:      ${LOG_DIR}
Mail Storage:       /var/vmail/

══════════════════════════════════════════════════════════════
EOF

    chmod 600 "$CONFIG_DIR/install-info.txt"
}

# ─── Final Summary ──────────────────────────────────────────────────────────
show_summary() {
    echo ""
    echo -e "${GREEN}${BOLD}"
    echo "╔══════════════════════════════════════════════════════════════════╗"
    echo "║                                                                ║"
    echo "║              ✓ ProMail Installation Complete!                   ║"
    echo "║                                                                ║"
    echo "╚══════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo -e "  ${BOLD}Webmail URL:${NC}    ${CYAN}https://webmail.${DOMAIN}${NC}"
    echo -e "  ${BOLD}Admin Panel:${NC}    ${CYAN}https://webmail.${DOMAIN}/admin${NC}"
    echo -e "  ${BOLD}Admin Login:${NC}    ${CYAN}${ADMIN_EMAIL}${NC}"
    echo ""
    echo -e "  ${YELLOW}Important:${NC} Configure DNS records as shown in:"
    echo -e "  ${CYAN}${CONFIG_DIR}/install-info.txt${NC}"
    echo ""
    echo -e "  ${YELLOW}DKIM Public Key:${NC}"
    cat /etc/opendkim/keys/${DOMAIN}/mail.txt 2>/dev/null || echo "  (not available)"
    echo ""
    echo -e "  ${BOLD}Service Management:${NC}"
    echo -e "    systemctl status promail          ${CYAN}# Overall status${NC}"
    echo -e "    systemctl restart promail-api      ${CYAN}# Restart Flask API${NC}"
    echo -e "    systemctl restart promail-frontend ${CYAN}# Restart Next.js${NC}"
    echo -e "    systemctl status postfix           ${CYAN}# SMTP status${NC}"
    echo -e "    systemctl status dovecot           ${CYAN}# IMAP status${NC}"
    echo ""
}

# ─── Main ───────────────────────────────────────────────────────────────────
main() {
    show_banner
    check_root
    check_os
    collect_config
    update_system
    install_dependencies
    setup_database
    setup_ssl
    configure_postfix
    configure_dovecot
    configure_opendkim
    configure_spamassassin
    configure_clamav
    configure_fail2ban
    configure_firewall
    setup_webmail
    setup_frontend
    configure_nginx
    create_systemd_service
    start_services
    save_install_info
    show_summary
}

main "$@"
