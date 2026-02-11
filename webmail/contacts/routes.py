import random
from flask import render_template, request, jsonify, flash, redirect, url_for
from flask_login import login_required, current_user
from contacts import contacts_bp
from models import db, Contact, ContactGroup
import logging

logger = logging.getLogger(__name__)

AVATAR_COLORS = [
    '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
    '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
]


@contacts_bp.route('/')
@login_required
def index():
    search = request.args.get('search', '')
    group_id = request.args.get('group')
    favorites = request.args.get('favorites', '') == '1'

    query = Contact.query.filter_by(account_id=current_user.id)

    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            db.or_(
                Contact.first_name.ilike(search_filter),
                Contact.last_name.ilike(search_filter),
                Contact.email.ilike(search_filter),
                Contact.company.ilike(search_filter),
            )
        )

    if favorites:
        query = query.filter_by(is_favorite=True)

    if group_id:
        query = query.filter(Contact.groups.any(ContactGroup.id == int(group_id)))

    contacts = query.order_by(Contact.first_name, Contact.last_name).all()
    groups = ContactGroup.query.filter_by(account_id=current_user.id).all()

    return render_template('contacts.html',
                           contacts=contacts,
                           groups=groups,
                           search=search,
                           current_group=group_id,
                           favorites=favorites)


@contacts_bp.route('/api/contacts', methods=['POST'])
@login_required
def create_contact():
    data = request.get_json()

    if not data or not data.get('first_name'):
        return jsonify({'error': 'First name is required'}), 400

    contact = Contact(
        account_id=current_user.id,
        first_name=data['first_name'],
        last_name=data.get('last_name', ''),
        email=data.get('email', ''),
        phone=data.get('phone', ''),
        company=data.get('company', ''),
        job_title=data.get('job_title', ''),
        address=data.get('address', ''),
        notes=data.get('notes', ''),
        avatar_color=random.choice(AVATAR_COLORS),
        is_favorite=data.get('is_favorite', False),
    )

    # Handle groups
    group_ids = data.get('groups', [])
    if group_ids:
        groups = ContactGroup.query.filter(
            ContactGroup.id.in_(group_ids),
            ContactGroup.account_id == current_user.id
        ).all()
        contact.groups = groups

    db.session.add(contact)
    db.session.commit()

    logger.info(f"CONTACT_CREATED user={current_user.email} contact={contact.full_name}")
    return jsonify(contact.to_dict()), 201


@contacts_bp.route('/api/contacts/<int:contact_id>', methods=['GET'])
@login_required
def get_contact(contact_id):
    contact = Contact.query.filter_by(id=contact_id, account_id=current_user.id).first()
    if not contact:
        return jsonify({'error': 'Contact not found'}), 404
    return jsonify(contact.to_dict())


@contacts_bp.route('/api/contacts/<int:contact_id>', methods=['PUT'])
@login_required
def update_contact(contact_id):
    contact = Contact.query.filter_by(id=contact_id, account_id=current_user.id).first()
    if not contact:
        return jsonify({'error': 'Contact not found'}), 404

    data = request.get_json()

    for field in ['first_name', 'last_name', 'email', 'phone', 'company',
                  'job_title', 'address', 'notes']:
        if field in data:
            setattr(contact, field, data[field])

    if 'is_favorite' in data:
        contact.is_favorite = data['is_favorite']

    if 'groups' in data:
        groups = ContactGroup.query.filter(
            ContactGroup.id.in_(data['groups']),
            ContactGroup.account_id == current_user.id
        ).all()
        contact.groups = groups

    db.session.commit()
    return jsonify(contact.to_dict())


@contacts_bp.route('/api/contacts/<int:contact_id>', methods=['DELETE'])
@login_required
def delete_contact(contact_id):
    contact = Contact.query.filter_by(id=contact_id, account_id=current_user.id).first()
    if not contact:
        return jsonify({'error': 'Contact not found'}), 404

    db.session.delete(contact)
    db.session.commit()

    logger.info(f"CONTACT_DELETED user={current_user.email} contact_id={contact_id}")
    return jsonify({'success': True})


@contacts_bp.route('/api/contacts/<int:contact_id>/favorite', methods=['POST'])
@login_required
def toggle_favorite(contact_id):
    contact = Contact.query.filter_by(id=contact_id, account_id=current_user.id).first()
    if not contact:
        return jsonify({'error': 'Contact not found'}), 404

    contact.is_favorite = not contact.is_favorite
    db.session.commit()
    return jsonify({'is_favorite': contact.is_favorite})


# ─── Contact Groups ────────────────────────────────────────────────────────

@contacts_bp.route('/api/groups', methods=['GET'])
@login_required
def list_groups():
    groups = ContactGroup.query.filter_by(account_id=current_user.id).all()
    return jsonify([g.to_dict() for g in groups])


@contacts_bp.route('/api/groups', methods=['POST'])
@login_required
def create_group():
    data = request.get_json()
    if not data or not data.get('name'):
        return jsonify({'error': 'Group name is required'}), 400

    group = ContactGroup(
        account_id=current_user.id,
        name=data['name']
    )
    db.session.add(group)
    db.session.commit()
    return jsonify(group.to_dict()), 201


@contacts_bp.route('/api/groups/<int:group_id>', methods=['DELETE'])
@login_required
def delete_group(group_id):
    group = ContactGroup.query.filter_by(id=group_id, account_id=current_user.id).first()
    if not group:
        return jsonify({'error': 'Group not found'}), 404

    db.session.delete(group)
    db.session.commit()
    return jsonify({'success': True})
