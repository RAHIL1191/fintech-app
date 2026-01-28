const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DATA_FILE = path.join(__dirname, '../../data/notifications.json');

// Ensure data directory exists
const dataDir = path.dirname(DATA_FILE);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Helper to load notifications
const loadNotifications = () => {
    if (!fs.existsSync(DATA_FILE)) return [];
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        console.error('Error reading notifications:', e);
        return [];
    }
};

// Helper to save
const saveNotifications = (data) => {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
};

// GET all notifications
router.get('/', (req, res) => {
    const notifications = loadNotifications();
    // Sort by date desc
    notifications.sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json(notifications);
});

// POST new notification
router.post('/', (req, res) => {
    const { title, body, data, type } = req.body;
    if (!title || !body) return res.status(400).json({ error: 'Missing title or body' });

    const notifications = loadNotifications();
    const newNotif = {
        id: uuidv4(),
        title,
        body,
        data: data || {},
        type: type || 'info', // 'info', 'warning', 'danger'
        date: new Date().toISOString(),
        read: false
    };

    notifications.push(newNotif);
    saveNotifications(notifications);
    res.json(newNotif);
});

// PATCH mark as read
router.patch('/:id/read', (req, res) => {
    const { id } = req.params;
    const notifications = loadNotifications();
    const notification = notifications.find(n => n.id === id);

    if (!notification) return res.status(404).json({ error: 'Notification not found' });

    notification.read = true;
    saveNotifications(notifications);
    res.json(notification);
});

// DELETE notification
router.delete('/:id', (req, res) => {
    const { id } = req.params;
    let notifications = loadNotifications();
    notifications = notifications.filter(n => n.id !== id);
    saveNotifications(notifications);
    res.json({ success: true });
});

// POST Mark all as read
router.post('/mark-all-read', (req, res) => {
    const notifications = loadNotifications();
    notifications.forEach(n => n.read = true);
    saveNotifications(notifications);
    res.json({ success: true });
});

module.exports = router;
