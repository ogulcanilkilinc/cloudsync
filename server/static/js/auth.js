document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const showRegisterLink = document.getElementById('show-register');
    const showLoginLink = document.getElementById('show-login');
    
    const loginError = document.getElementById('login-error');
    const registerError = document.getElementById('register-error');
    const registerSuccess = document.getElementById('register-success');

    // Check if already logged in
    const token = localStorage.getItem('access_token');
    if (token) {
        // Simple verification - if token exists, try redirecting to dashboard
        // App.js will handle actual validation and kick out if invalid
        window.location.href = '/dashboard';
    }

    if (showRegisterLink) {
        showRegisterLink.addEventListener('click', (e) => {
            e.preventDefault();
            loginForm.style.display = 'none';
            registerForm.style.display = 'block';
            loginError.style.display = 'none';
        });
    }

    if (showLoginLink) {
        showLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            registerForm.style.display = 'none';
            loginForm.style.display = 'block';
            registerError.style.display = 'none';
            registerSuccess.style.display = 'none';
        });
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = loginForm.username.value;
            const password = loginForm.password.value;
            
            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    localStorage.setItem('access_token', data.access_token);
                    window.location.href = '/dashboard';
                } else {
                    loginError.textContent = data.message || 'Giriş başarısız. Lütfen bilgilerinizi kontrol edin.';
                    loginError.style.display = 'block';
                }
            } catch (err) {
                loginError.textContent = 'Sunucuya bağlanılamadı.';
                loginError.style.display = 'block';
            }
        });
    }

    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = registerForm.username.value;
            const password = registerForm.password.value;
            const confirm = registerForm.confirm_password.value;
            
            registerError.style.display = 'none';
            registerSuccess.style.display = 'none';
            
            if (password !== confirm) {
                registerError.textContent = 'Şifreler eşleşmiyor.';
                registerError.style.display = 'block';
                return;
            }
            
            try {
                const response = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    registerSuccess.textContent = 'Kayıt başarılı! Şimdi giriş yapabilirsiniz.';
                    registerSuccess.style.display = 'block';
                    registerForm.reset();
                    setTimeout(() => {
                        showLoginLink.click();
                    }, 2000);
                } else {
                    registerError.textContent = data.message || 'Kayıt başarısız.';
                    registerError.style.display = 'block';
                }
            } catch (err) {
                registerError.textContent = 'Sunucuya bağlanılamadı.';
                registerError.style.display = 'block';
            }
        });
    }
});
