window.App = {
    state: {
        currentPath: '',
        selectedFiles: new Set(),
        user: null
    },

    init: async function() {
        const token = localStorage.getItem('access_token');
        if (!token) {
            this.logout();
            return;
        }

        try {
            const user = await this.apiCall('GET', '/api/auth/me');
            this.state.user = user;
            const userEl = document.getElementById('username-display');
            if (userEl) userEl.textContent = user.username || 'Kullanıcı';
            
            // Initialize other components
            if (window.FileManager && typeof window.FileManager.init === 'function') {
                window.FileManager.init();
            }
            if (window.Editor && typeof window.Editor.init === 'function') {
                window.Editor.init();
            }
            
            // Setup global events
            const logoutBtn = document.getElementById('logout-btn');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', () => this.logout());
            }
            
        } catch (err) {
            console.error('Auth verification failed:', err);
            this.logout();
        }
    },

    apiCall: async function(method, url, body = null, isFormData = false) {
        const token = localStorage.getItem('access_token');
        const headers = {};
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        if (!isFormData && body) {
            headers['Content-Type'] = 'application/json';
        }

        const options = {
            method,
            headers
        };

        if (body) {
            options.body = isFormData ? body : JSON.stringify(body);
        }

        const response = await fetch(url, options);

        if (response.status === 401) {
            this.logout();
            throw new Error('Oturum süresi doldu. Lütfen tekrar giriş yapın.');
        }

        if (!response.ok) {
            let errorMsg = 'İşlem başarısız oldu';
            try {
                const errData = await response.json();
                errorMsg = errData.detail || errData.message || errorMsg;
            } catch(e) {}
            throw new Error(errorMsg);
        }

        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            return response.json();
        }
        return response;
    },

    logout: function() {
        localStorage.removeItem('access_token');
        window.location.href = '/';
    },

    showToast: function(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('fadeOut');
            setTimeout(() => {
                if (toast.parentNode === container) {
                    container.removeChild(toast);
                }
            }, 300);
        }, 3000);
    },

    formatFileSize: function(bytes) {
        if (bytes === 0 || bytes === undefined || bytes === null) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    formatDate: function(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleString('tr-TR');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    if (document.body.classList.contains('dashboard-body')) {
        window.App.init();
    }
});
