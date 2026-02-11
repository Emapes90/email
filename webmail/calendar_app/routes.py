from datetime import datetime, timedelta
from flask import render_template, request, jsonify, flash, redirect, url_for
from flask_login import login_required, current_user
from calendar_app import calendar_bp
from models import db, CalendarEvent
import logging

logger = logging.getLogger(__name__)


@calendar_bp.route('/')
@login_required
def index():
    return render_template('calendar.html')


@calendar_bp.route('/api/events')
@login_required
def get_events():
    """Get events for calendar view"""
    start = request.args.get('start')
    end = request.args.get('end')

    query = CalendarEvent.query.filter_by(account_id=current_user.id)

    if start:
        try:
            start_dt = datetime.fromisoformat(start.replace('Z', '+00:00'))
            query = query.filter(CalendarEvent.end_time >= start_dt)
        except ValueError:
            pass

    if end:
        try:
            end_dt = datetime.fromisoformat(end.replace('Z', '+00:00'))
            query = query.filter(CalendarEvent.start_time <= end_dt)
        except ValueError:
            pass

    events = query.order_by(CalendarEvent.start_time).all()
    return jsonify([e.to_dict() for e in events])


@calendar_bp.route('/api/events', methods=['POST'])
@login_required
def create_event():
    """Create a new calendar event"""
    data = request.get_json()

    if not data or not data.get('title'):
        return jsonify({'error': 'Title is required'}), 400

    try:
        start_time = datetime.fromisoformat(data['start'].replace('Z', '+00:00'))
        end_time = datetime.fromisoformat(data['end'].replace('Z', '+00:00'))
    except (KeyError, ValueError) as e:
        return jsonify({'error': 'Invalid date format'}), 400

    event = CalendarEvent(
        account_id=current_user.id,
        title=data['title'],
        description=data.get('description', ''),
        location=data.get('location', ''),
        start_time=start_time,
        end_time=end_time,
        all_day=data.get('allDay', False),
        color=data.get('color', '#6366f1'),
        reminder_minutes=data.get('reminder_minutes', 15),
        recurrence=data.get('recurrence'),
    )

    db.session.add(event)
    db.session.commit()

    logger.info(f"EVENT_CREATED user={current_user.email} title={event.title}")
    return jsonify(event.to_dict()), 201


@calendar_bp.route('/api/events/<int:event_id>', methods=['PUT'])
@login_required
def update_event(event_id):
    """Update a calendar event"""
    event = CalendarEvent.query.filter_by(id=event_id, account_id=current_user.id).first()
    if not event:
        return jsonify({'error': 'Event not found'}), 404

    data = request.get_json()

    if data.get('title'):
        event.title = data['title']
    if data.get('description') is not None:
        event.description = data['description']
    if data.get('location') is not None:
        event.location = data['location']
    if data.get('start'):
        try:
            event.start_time = datetime.fromisoformat(data['start'].replace('Z', '+00:00'))
        except ValueError:
            pass
    if data.get('end'):
        try:
            event.end_time = datetime.fromisoformat(data['end'].replace('Z', '+00:00'))
        except ValueError:
            pass
    if data.get('allDay') is not None:
        event.all_day = data['allDay']
    if data.get('color'):
        event.color = data['color']
    if data.get('reminder_minutes') is not None:
        event.reminder_minutes = data['reminder_minutes']
    if data.get('recurrence') is not None:
        event.recurrence = data['recurrence']

    db.session.commit()
    return jsonify(event.to_dict())


@calendar_bp.route('/api/events/<int:event_id>', methods=['DELETE'])
@login_required
def delete_event(event_id):
    """Delete a calendar event"""
    event = CalendarEvent.query.filter_by(id=event_id, account_id=current_user.id).first()
    if not event:
        return jsonify({'error': 'Event not found'}), 404

    db.session.delete(event)
    db.session.commit()

    logger.info(f"EVENT_DELETED user={current_user.email} event_id={event_id}")
    return jsonify({'success': True})


@calendar_bp.route('/api/events/today')
@login_required
def today_events():
    """Get today's events"""
    today = datetime.utcnow().date()
    tomorrow = today + timedelta(days=1)

    events = CalendarEvent.query.filter(
        CalendarEvent.account_id == current_user.id,
        CalendarEvent.start_time >= datetime.combine(today, datetime.min.time()),
        CalendarEvent.start_time < datetime.combine(tomorrow, datetime.min.time())
    ).order_by(CalendarEvent.start_time).all()

    return jsonify([e.to_dict() for e in events])


@calendar_bp.route('/api/events/upcoming')
@login_required
def upcoming_events():
    """Get upcoming events (next 7 days)"""
    now = datetime.utcnow()
    week_later = now + timedelta(days=7)

    events = CalendarEvent.query.filter(
        CalendarEvent.account_id == current_user.id,
        CalendarEvent.start_time >= now,
        CalendarEvent.start_time <= week_later
    ).order_by(CalendarEvent.start_time).limit(20).all()

    return jsonify([e.to_dict() for e in events])
