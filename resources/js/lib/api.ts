// API helper with auto-token injection
const apiFetch = async (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('auth_token');

    const headers: HeadersInit = {
        'Accept': 'application/json',
        ...options.headers,
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    // Add Content-Type for JSON bodies
    if (options.body && typeof options.body === 'string') {
        headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include', // Include cookies for session auth
    });

    // Handle 401 errors by redirecting to login
    if (response.status === 401) {
        localStorage.removeItem('auth_token');
        window.location.href = '/login';
        throw new Error('Unauthorized');
    }

    return response;
};

export default apiFetch;
