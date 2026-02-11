/* ═══════════════════════════════════════════════════════════════════════════
   ProMail — Core JavaScript
   Professional Email Hosting Webmail
   ═══════════════════════════════════════════════════════════════════════════ */

'use strict';

const ProMail = {
    // ─── Configuration ──────────────────────────────────────────────────
    config: {
        toastDuration: 4000,
        refreshInterval: 60000,
        csrfToken: null,
    },

    // ─── Initialize ─────────────────────────────────────────────────────
    init() {
        this.config.csrfToken = document.querySelector('meta[name="csrf-token"]') ? .content;
        this.initSidebar();
        this.initToasts();
        this.initModals();
        this.initSearch();
        this.initTooltips();
        this.initKeyboardShortcuts();

        // Auto-refresh folder counts
        if (document.querySelector('.sidebar')) {
            this.refreshFolderCounts();
            setInterval(() => this.refreshFolderCounts(), this.config.refreshInterval);
        }
    },

    // ─── API Calls ──────────────────────────────────────────────────────
    async api(url, options = {}) {
        const defaults = {
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': this.config.csrfToken,
            },
            credentials: 'same-origin',
        };

        const config = {...defaults, ...options };
        if (options.headers) {
            config.headers = {...defaults.headers, ...options.headers };
        }

        try {
            const response = await fetch(url, config);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || `HTTP ${response.status}`);
            }

            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },

    // ─── Sidebar ────────────────────────────────────────────────────────
    initSidebar() {
        const toggle = document.getElementById('sidebarToggle');
        const sidebar = document.querySelector('.sidebar');

        if (toggle && sidebar) {
            toggle.addEventListener('click', () => {
                sidebar.classList.toggle('open');
            });

            // Close sidebar on click outside (mobile)
            document.addEventListener('click', (e) => {
                if (window.innerWidth <= 768 &&
                    sidebar.classList.contains('open') &&
                    !sidebar.contains(e.target) &&
                    e.target !== toggle) {
                    sidebar.classList.remove('open');
                }
            });
        }
    },

    // ─── Toast Notifications ────────────────────────────────────────────
    initToasts() {
        // Create toast container if not exists
        if (!document.querySelector('.toast-container')) {
            const container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        // Convert flash messages to toasts
        document.querySelectorAll('.alert[data-auto-dismiss]').forEach(alert => {
            setTimeout(() => {
                alert.style.opacity = '0';
                setTimeout(() => alert.remove(), 300);
            }, this.config.toastDuration);
        });
    },

    showToast(message, type = 'info') {
        const container = document.querySelector('.toast-container');
        if (!container) return;

        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle',
        };

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <i class="fas ${icons[type] || icons.info}" style="color: var(--btn-${type === 'error' ? 'danger' : type === 'success' ? 'success' : 'warning'})"></i>
            <span style="flex:1;color:var(--text-primary);font-size:0.875rem">${message}</span>
            <button onclick="this.parentElement.remove()" class="btn-ghost btn-icon" style="margin-left:auto">
                <i class="fas fa-times" style="font-size:0.75rem"></i>
            </button>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, this.config.toastDuration);
    },

    // ─── Modal System ───────────────────────────────────────────────────
    initModals() {
        // Close on overlay click
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay')) {
                this.closeModal(e.target.id);
            }
        });

        // Close on Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const activeModal = document.querySelector('.modal-overlay.active');
                if (activeModal) {
                    this.closeModal(activeModal.id);
                }
            }
        });
    },

    openModal(id) {
        const modal = document.getElementById(id);
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    },

    closeModal(id) {
        const modal = document.getElementById(id);
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    },

    // ─── Search ─────────────────────────────────────────────────────────
    initSearch() {
        const searchInput = document.querySelector('.top-bar-search input');
        if (searchInput) {
            let timeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(timeout);
                timeout = setTimeout(() => {
                    const query = e.target.value.trim();
                    if (query.length >= 2) {
                        window.location.href = `?search=${encodeURIComponent(query)}`;
                    } else if (query.length === 0) {
                        window.location.href = window.location.pathname;
                    }
                }, 500);
            });
        }
    },

    // ─── Tooltips ───────────────────────────────────────────────────────
    initTooltips() {
        document.querySelectorAll('[data-tooltip]').forEach(el => {
            el.style.position = 'relative';
            el.addEventListener('mouseenter', () => {
                const tip = document.createElement('div');
                tip.className = 'tooltip-popup';
                tip.textContent = el.dataset.tooltip;
                tip.style.cssText = `
                    position:absolute;bottom:calc(100% + 8px);left:50%;transform:translateX(-50%);
                    background:var(--bg-elevated);color:var(--text-primary);padding:4px 10px;
                    border-radius:6px;font-size:0.75rem;white-space:nowrap;z-index:500;
                    box-shadow:var(--shadow-md);border:1px solid var(--border-primary);
                `;
                el.appendChild(tip);
            });
            el.addEventListener('mouseleave', () => {
                el.querySelector('.tooltip-popup') ? .remove();
            });
        });
    },

    // ─── Keyboard Shortcuts ─────────────────────────────────────────────
    initKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Skip if typing in input
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

            switch (e.key) {
                case 'c':
                    if (!e.ctrlKey && !e.metaKey) {
                        e.preventDefault();
                        window.location.href = '/mail/compose';
                    }
                    break;
                case '/':
                    e.preventDefault();
                    document.querySelector('.top-bar-search input') ? .focus();
                    break;
                case 'g':
                    if (this._lastKey === 'g') {
                        // gg = go to top
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                    break;
                case '?':
                    this.showToast('Shortcuts: C=Compose, /=Search, R=Refresh', 'info');
                    break;
                case 'r':
                    if (!e.ctrlKey && !e.metaKey) {
                        e.preventDefault();
                        this.refreshFolderCounts();
                        this.showToast('Refreshed', 'success');
                    }
                    break;
            }
            this._lastKey = e.key;
        });
    },

    // ─── Folder Counts ──────────────────────────────────────────────────
    async refreshFolderCounts() {
        try {
            const counts = await this.api('/mail/api/folder-counts');
            Object.keys(counts).forEach(folder => {
                const badge = document.querySelector(`.nav-item[data-folder="${folder}"] .badge`);
                if (badge) {
                    if (counts[folder] > 0) {
                        badge.textContent = counts[folder];
                        badge.style.display = '';
                    } else {
                        badge.style.display = 'none';
                    }
                }
            });
        } catch (e) {
            // Silently fail
        }
    },

    // ─── Email Actions ──────────────────────────────────────────────────
    async toggleStar(uid, folder) {
        try {
            await this.api(`/mail/star/${uid}`, {
                method: 'POST',
                body: JSON.stringify({ folder }),
            });

            const star = document.querySelector(`.email-star[data-uid="${uid}"]`);
            if (star) {
                star.classList.toggle('starred');
                star.innerHTML = star.classList.contains('starred') ?
                    '<i class="fas fa-star"></i>' :
                    '<i class="far fa-star"></i>';
            }
        } catch (error) {
            this.showToast('Failed to update star', 'error');
        }
    },

    deleteEmail(uid, folder) {
        if (!confirm('Move this email to trash?')) return;

        const form = document.createElement('form');
        form.method = 'POST';
        form.action = `/mail/delete/${uid}`;

        const csrfInput = document.createElement('input');
        csrfInput.type = 'hidden';
        csrfInput.name = 'csrf_token';
        csrfInput.value = this.config.csrfToken;
        form.appendChild(csrfInput);

        const folderInput = document.createElement('input');
        folderInput.type = 'hidden';
        folderInput.name = 'folder';
        folderInput.value = folder;
        form.appendChild(folderInput);

        document.body.appendChild(form);
        form.submit();
    },

    // ─── Calendar Functions ─────────────────────────────────────────────
    calendar: {
        currentDate: new Date(),
        events: [],

        async init() {
            await this.loadEvents();
            this.render();
        },

        async loadEvents() {
            const start = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), 1);
            const end = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 0);

            try {
                this.events = await ProMail.api(
                    `/calendar/api/events?start=${start.toISOString()}&end=${end.toISOString()}`
                );
            } catch (e) {
                this.events = [];
            }
        },

        render() {
            const grid = document.getElementById('calendarGrid');
            if (!grid) return;

            const year = this.currentDate.getFullYear();
            const month = this.currentDate.getMonth();

            // Update header
            const header = document.getElementById('calendarMonth');
            if (header) {
                header.textContent = this.currentDate.toLocaleDateString('en-US', {
                    month: 'long',
                    year: 'numeric'
                });
            }

            const firstDay = new Date(year, month, 1).getDay();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const daysInPrevMonth = new Date(year, month, 0).getDate();
            const today = new Date();

            let html = '';

            // Day headers
            ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(day => {
                html += `<div class="calendar-day-header">${day}</div>`;
            });

            // Previous month days
            for (let i = firstDay - 1; i >= 0; i--) {
                const day = daysInPrevMonth - i;
                html += `<div class="calendar-day other-month"><div class="calendar-day-number">${day}</div></div>`;
            }

            // Current month days
            for (let day = 1; day <= daysInMonth; day++) {
                const date = new Date(year, month, day);
                const isToday = date.toDateString() === today.toDateString();
                const dayEvents = this.events.filter(e => {
                    const eDate = new Date(e.start);
                    return eDate.getDate() === day && eDate.getMonth() === month;
                });

                html += `<div class="calendar-day ${isToday ? 'today' : ''}" onclick="ProMail.calendar.openDay(${year},${month},${day})">`;
                html += `<div class="calendar-day-number">${day}</div>`;
                dayEvents.slice(0, 3).forEach(evt => {
                    html += `<div class="calendar-event" style="background:${evt.color}" onclick="event.stopPropagation();ProMail.calendar.editEvent(${evt.id})">${evt.title}</div>`;
                });
                if (dayEvents.length > 3) {
                    html += `<div style="font-size:0.6875rem;color:var(--text-muted)">+${dayEvents.length - 3} more</div>`;
                }
                html += `</div>`;
            }

            // Fill remaining cells
            const totalCells = firstDay + daysInMonth;
            const remaining = 7 - (totalCells % 7);
            if (remaining < 7) {
                for (let i = 1; i <= remaining; i++) {
                    html += `<div class="calendar-day other-month"><div class="calendar-day-number">${i}</div></div>`;
                }
            }

            grid.innerHTML = html;
        },

        prevMonth() {
            this.currentDate.setMonth(this.currentDate.getMonth() - 1);
            this.loadEvents().then(() => this.render());
        },

        nextMonth() {
            this.currentDate.setMonth(this.currentDate.getMonth() + 1);
            this.loadEvents().then(() => this.render());
        },

        goToday() {
            this.currentDate = new Date();
            this.loadEvents().then(() => this.render());
        },

        openDay(year, month, day) {
            // Pre-fill date in create event modal
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const startInput = document.getElementById('eventStart');
            const endInput = document.getElementById('eventEnd');
            if (startInput) startInput.value = `${dateStr}T09:00`;
            if (endInput) endInput.value = `${dateStr}T10:00`;

            document.getElementById('eventId').value = '';
            document.getElementById('eventTitle').value = '';
            document.getElementById('eventDescription').value = '';
            document.getElementById('eventLocation').value = '';

            ProMail.openModal('eventModal');
        },

        async saveEvent() {
            const eventId = document.getElementById('eventId') ? .value;
            const data = {
                title: document.getElementById('eventTitle').value,
                description: document.getElementById('eventDescription') ? .value || '',
                location: document.getElementById('eventLocation') ? .value || '',
                start: document.getElementById('eventStart').value,
                end: document.getElementById('eventEnd').value,
                color: document.getElementById('eventColor') ? .value || '#6366f1',
                allDay: document.getElementById('eventAllDay') ? .checked || false,
            };

            if (!data.title || !data.start || !data.end) {
                ProMail.showToast('Please fill required fields', 'warning');
                return;
            }

            try {
                if (eventId) {
                    await ProMail.api(`/calendar/api/events/${eventId}`, {
                        method: 'PUT',
                        body: JSON.stringify(data),
                    });
                    ProMail.showToast('Event updated', 'success');
                } else {
                    await ProMail.api('/calendar/api/events', {
                        method: 'POST',
                        body: JSON.stringify(data),
                    });
                    ProMail.showToast('Event created', 'success');
                }

                ProMail.closeModal('eventModal');
                await this.loadEvents();
                this.render();
            } catch (error) {
                ProMail.showToast(error.message, 'error');
            }
        },

        async editEvent(id) {
            try {
                const events = this.events.filter(e => e.id === id);
                if (events.length === 0) return;

                const event = events[0];
                document.getElementById('eventId').value = event.id;
                document.getElementById('eventTitle').value = event.title;
                document.getElementById('eventDescription').value = event.description || '';
                document.getElementById('eventLocation').value = event.location || '';
                document.getElementById('eventStart').value = event.start ? .slice(0, 16) || '';
                document.getElementById('eventEnd').value = event.end ? .slice(0, 16) || '';
                if (document.getElementById('eventColor')) {
                    document.getElementById('eventColor').value = event.color || '#6366f1';
                }

                ProMail.openModal('eventModal');
            } catch (e) {
                ProMail.showToast('Failed to load event', 'error');
            }
        },

        async deleteEvent() {
            const eventId = document.getElementById('eventId') ? .value;
            if (!eventId) return;

            if (!confirm('Delete this event?')) return;

            try {
                await ProMail.api(`/calendar/api/events/${eventId}`, { method: 'DELETE' });
                ProMail.showToast('Event deleted', 'success');
                ProMail.closeModal('eventModal');
                await this.loadEvents();
                this.render();
            } catch (error) {
                ProMail.showToast(error.message, 'error');
            }
        },
    },

    // ─── Contact Functions ──────────────────────────────────────────────
    contacts: {
        async save() {
            const contactId = document.getElementById('contactId') ? .value;
            const data = {
                first_name: document.getElementById('contactFirstName').value,
                last_name: document.getElementById('contactLastName') ? .value || '',
                email: document.getElementById('contactEmail') ? .value || '',
                phone: document.getElementById('contactPhone') ? .value || '',
                company: document.getElementById('contactCompany') ? .value || '',
                job_title: document.getElementById('contactJobTitle') ? .value || '',
                address: document.getElementById('contactAddress') ? .value || '',
                notes: document.getElementById('contactNotes') ? .value || '',
            };

            if (!data.first_name) {
                ProMail.showToast('First name is required', 'warning');
                return;
            }

            try {
                if (contactId) {
                    await ProMail.api(`/contacts/api/contacts/${contactId}`, {
                        method: 'PUT',
                        body: JSON.stringify(data),
                    });
                    ProMail.showToast('Contact updated', 'success');
                } else {
                    await ProMail.api('/contacts/api/contacts', {
                        method: 'POST',
                        body: JSON.stringify(data),
                    });
                    ProMail.showToast('Contact created', 'success');
                }

                ProMail.closeModal('contactModal');
                setTimeout(() => window.location.reload(), 500);
            } catch (error) {
                ProMail.showToast(error.message, 'error');
            }
        },

        async edit(id) {
            try {
                const contact = await ProMail.api(`/contacts/api/contacts/${id}`);
                document.getElementById('contactId').value = contact.id;
                document.getElementById('contactFirstName').value = contact.first_name;
                document.getElementById('contactLastName').value = contact.last_name || '';
                document.getElementById('contactEmail').value = contact.email || '';
                document.getElementById('contactPhone').value = contact.phone || '';
                document.getElementById('contactCompany').value = contact.company || '';
                document.getElementById('contactJobTitle').value = contact.job_title || '';
                document.getElementById('contactAddress').value = contact.address || '';
                document.getElementById('contactNotes').value = contact.notes || '';
                ProMail.openModal('contactModal');
            } catch (e) {
                ProMail.showToast('Failed to load contact', 'error');
            }
        },

        async remove(id) {
            if (!confirm('Delete this contact?')) return;
            try {
                await ProMail.api(`/contacts/api/contacts/${id}`, { method: 'DELETE' });
                ProMail.showToast('Contact deleted', 'success');
                setTimeout(() => window.location.reload(), 500);
            } catch (error) {
                ProMail.showToast(error.message, 'error');
            }
        },

        async toggleFavorite(id) {
            try {
                const result = await ProMail.api(`/contacts/api/contacts/${id}/favorite`, { method: 'POST' });
                const icon = document.querySelector(`.contact-favorite[data-id="${id}"] i`);
                if (icon) {
                    icon.className = result.is_favorite ? 'fas fa-star' : 'far fa-star';
                    icon.parentElement.classList.toggle('active', result.is_favorite);
                }
            } catch (e) {
                ProMail.showToast('Failed to update favorite', 'error');
            }
        },
    },

    // ─── Admin Functions ────────────────────────────────────────────────
    admin: {
        async createDomain() {
            const data = {
                domain: document.getElementById('domainName').value,
                description: document.getElementById('domainDesc') ? .value || '',
                max_accounts: parseInt(document.getElementById('domainMaxAccounts') ? .value || 100),
            };

            if (!data.domain) {
                ProMail.showToast('Domain name is required', 'warning');
                return;
            }

            try {
                await ProMail.api('/admin/api/domains', {
                    method: 'POST',
                    body: JSON.stringify(data),
                });
                ProMail.showToast('Domain created', 'success');
                ProMail.closeModal('domainModal');
                setTimeout(() => window.location.reload(), 500);
            } catch (error) {
                ProMail.showToast(error.message, 'error');
            }
        },

        async deleteDomain(id) {
            if (!confirm('Delete this domain? This cannot be undone.')) return;
            try {
                await ProMail.api(`/admin/api/domains/${id}`, { method: 'DELETE' });
                ProMail.showToast('Domain deleted', 'success');
                setTimeout(() => window.location.reload(), 500);
            } catch (error) {
                ProMail.showToast(error.message, 'error');
            }
        },

        async createAccount() {
            const data = {
                email: document.getElementById('accountEmail').value,
                password: document.getElementById('accountPassword').value,
                full_name: document.getElementById('accountName') ? .value || '',
                domain_id: parseInt(document.getElementById('accountDomain').value),
                quota_mb: parseInt(document.getElementById('accountQuota') ? .value || 1024),
                is_admin: document.getElementById('accountAdmin') ? .checked || false,
            };

            if (!data.email || !data.password) {
                ProMail.showToast('Email and password are required', 'warning');
                return;
            }

            try {
                await ProMail.api('/admin/api/accounts', {
                    method: 'POST',
                    body: JSON.stringify(data),
                });
                ProMail.showToast('Account created', 'success');
                ProMail.closeModal('accountModal');
                setTimeout(() => window.location.reload(), 500);
            } catch (error) {
                ProMail.showToast(error.message, 'error');
            }
        },

        async deleteAccount(id) {
            if (!confirm('Delete this account? All emails will be lost.')) return;
            try {
                await ProMail.api(`/admin/api/accounts/${id}`, { method: 'DELETE' });
                ProMail.showToast('Account deleted', 'success');
                setTimeout(() => window.location.reload(), 500);
            } catch (error) {
                ProMail.showToast(error.message, 'error');
            }
        },

        async toggleAccountStatus(id, active) {
            try {
                await ProMail.api(`/admin/api/accounts/${id}`, {
                    method: 'PUT',
                    body: JSON.stringify({ is_active: active }),
                });
                ProMail.showToast(`Account ${active ? 'activated' : 'deactivated'}`, 'success');
                setTimeout(() => window.location.reload(), 500);
            } catch (error) {
                ProMail.showToast(error.message, 'error');
            }
        },

        async serviceAction(action, service) {
            try {
                const result = await ProMail.api(`/admin/api/service/${action}/${service}`, {
                    method: 'POST',
                });
                ProMail.showToast(`${service}: ${action} ${result.success ? 'successful' : 'failed'}`,
                    result.success ? 'success' : 'error');
                setTimeout(() => window.location.reload(), 1000);
            } catch (error) {
                ProMail.showToast(error.message, 'error');
            }
        },

        async saveSettings() {
            const inputs = document.querySelectorAll('.setting-input');
            const data = {};
            inputs.forEach(input => {
                data[input.dataset.key] = input.type === 'checkbox' ? input.checked.toString() : input.value;
            });

            try {
                await ProMail.api('/admin/api/settings', {
                    method: 'POST',
                    body: JSON.stringify(data),
                });
                ProMail.showToast('Settings saved', 'success');
            } catch (error) {
                ProMail.showToast(error.message, 'error');
            }
        },

        async createAlias() {
            const data = {
                source: document.getElementById('aliasSource').value,
                destination: document.getElementById('aliasDest').value,
                domain_id: parseInt(document.getElementById('aliasDomain').value),
            };

            if (!data.source || !data.destination) {
                ProMail.showToast('Source and destination are required', 'warning');
                return;
            }

            try {
                await ProMail.api('/admin/api/aliases', {
                    method: 'POST',
                    body: JSON.stringify(data),
                });
                ProMail.showToast('Alias created', 'success');
                ProMail.closeModal('aliasModal');
                setTimeout(() => window.location.reload(), 500);
            } catch (error) {
                ProMail.showToast(error.message, 'error');
            }
        },

        async deleteAlias(id) {
            if (!confirm('Delete this alias?')) return;
            try {
                await ProMail.api(`/admin/api/aliases/${id}`, { method: 'DELETE' });
                ProMail.showToast('Alias deleted', 'success');
                setTimeout(() => window.location.reload(), 500);
            } catch (error) {
                ProMail.showToast(error.message, 'error');
            }
        },
    },
};

// Initialize when DOM ready
document.addEventListener('DOMContentLoaded', () => ProMail.init());