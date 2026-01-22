import axios from 'axios';

// 1. Change this to your Render URL after creating the service
// Example: https://fintech-api.onrender.com
const PRODUCTION_URL = 'https://fintech-backend-psg5.onrender.com';

// 2. Development URL (Local)
const LOCAL_URL = 'http://10.0.2.2:8000';

// 3. Select automatically (or hardcode to PRODUCTION_URL for testing)
// 3. Select automatically
// Currently forcing PRODUCTION_URL to allow "Wireless" usage on iPhone/Android without local terminal
// const baseURL = PRODUCTION_URL;
const baseURL = (__DEV__ && !PRODUCTION_URL.includes('YOUR_BACKEND_URL')) ? LOCAL_URL : PRODUCTION_URL;

const api = axios.create({
    baseURL: `${baseURL}/api`,
    timeout: 60000,
});

export default api;
