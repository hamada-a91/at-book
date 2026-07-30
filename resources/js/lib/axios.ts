import axios from 'axios';

// Configure axios to include credentials and auth token
axios.defaults.withCredentials = true;

// Add token to all requests if available
axios.interceptors.request.use((config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Handle expired sessions globally, but keep login failures on the login form.
axios.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error.response?.status;
        const requestUrl = String(error.config?.url || '');
        const isLoginRequest = requestUrl.endsWith('/api/login') || requestUrl.endsWith('/login');
        const isAlreadyOnLoginPage = window.location.pathname === '/login';

        if (status === 401 && !isLoginRequest && !isAlreadyOnLoginPage) {
            localStorage.removeItem('auth_token');
            window.location.href = '/login';
        }

        return Promise.reject(error);
    }
);

export default axios;
