export const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(amount);
};

export const formatDateTime = (dateStr, timeStr) => {
    if (!dateStr) return { dayPart: '', timePart: '' };

    const date = new Date(dateStr + 'T12:00:00'); // Force midday to avoid timezone shifts
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const dayPart = `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;

    let timePart = '';
    const actualTime = timeStr || '12:00';
    let [hours, minutes] = actualTime.split(':').map(Number);
    const ampm = hours >= 12 ? 'p.m.' : 'a.m.';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const minutesStr = minutes < 10 ? '0' + minutes : minutes;
    timePart = `${hours}:${minutesStr} ${ampm}`;

    return { dayPart, timePart };
};

export const formatAuditDate = (date) => {
    if (!date) return '';

    let d;
    try {
        if (typeof date === 'string') {
            let s = date.trim();
            // Replace any space between date and time with T
            if (s.includes(' ') && !s.includes('T')) {
                s = s.replace(/\s+/, 'T');
            }
            // Ensure there's a timezone indicator if it looks like UTC
            if (!s.includes('Z') && !s.includes('+') && !s.includes('-')) {
                s += 'Z';
            }
            d = new Date(s);
        } else {
            d = new Date(date);
        }
    } catch (e) {
        d = new Date(date);
    }

    if (!d || isNaN(d.getTime())) return '';

    const now = new Date();
    const isToday = now.toDateString() === d.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = yesterday.toDateString() === d.toDateString();

    let prefix = '';
    if (isToday) prefix = 'Today';
    else if (isYesterday) prefix = 'Yesterday';
    else {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        prefix = `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
    }

    // Force local time formatting
    let hours = d.getHours();
    const minutes = d.getMinutes();
    const ampm = hours >= 12 ? 'p.m.' : 'a.m.';
    const displayHours = (hours % 12) || 12;
    const minutesStr = minutes < 10 ? '0' + minutes : minutes;

    return `${prefix}, ${displayHours}:${minutesStr} ${ampm}`;
};

export const cleanDeviceName = (name) => {
    if (!name) return '';
    const lowerName = name.toLowerCase();

    // Comprehensive list of technical/emulator strings
    const isEmulator = /sdk_gphone|vbox86p|emulator|google_sdk|generic_x86|unknown|vbox/i.test(lowerName);

    if (isEmulator) {
        return 'Android Emulator';
    }

    if (name.includes('iPhone') || name.includes('iPad')) {
        return name;
    }

    // Clean underscores and capitalize words
    return name.replace(/_/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase())
        .trim();
};
