import axios from 'axios';

// 1. Change this to your Render URL after creating the service
// Example: https://fintech-api.onrender.com
const PRODUCTION_URL = 'https://YOUR_BACKEND_URL.onrender.com';

// 2. Development URL (Local)
const LOCAL_URL = 'http://192.168.2.19:8000';

// 3. Select automatically (or hardcode to PRODUCTION_URL for testing)
const baseURL = (__DEV__ && !PRODUCTION_URL.includes('YOUR_BACKEND_URL'))
    ? LOCAL_URL
    : PRODUCTION_URL;

const api = axios.create({
    baseURL: `${baseURL}/api`,
    timeout: 15000,
});

export default api;
