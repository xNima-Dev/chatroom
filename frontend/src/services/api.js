import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

const api = axios.create({
  baseURL: `${baseURL}/api`,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Attach JWT token from localStorage to every outgoing request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('chatroom_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle unauthenticated 401s
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Clear expired credentials
      localStorage.removeItem('chatroom_token');
      localStorage.removeItem('chatroom_user');
      if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me')
};

export const roomAPI = {
  getRooms: () => api.get('/rooms'),
  createRoom: (data) => api.post('/rooms', data),
  joinRoom: (roomId) => api.post(`/rooms/${roomId}/join`),
  getMessages: (roomId, limit = 30, before = null) => {
    const params = { limit };
    if (before) params.before = before;
    return api.get(`/rooms/${roomId}/messages`, { params });
  }
};

export default api;
