window.Editor = {
    currentPath: null,
    isDirty: false,

    init: function() {
        this.bindEvents();
    },

    bindEvents: function() {
        const modal = document.getElementById('editor-modal');
        const textarea = document.getElementById('editor-textarea');
        const saveBtn = document.getElementById('editor-save-btn');
        const closeBtn = document.getElementById('editor-close-btn');

        if (saveBtn) saveBtn.addEventListener('click', () => this.saveFile());
        
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                if (this.isDirty) {
                    if (confirm("Kaydedilmemiş değişiklikleriniz var. Çıkmak istediğinize emin misiniz?")) {
                        this.closeEditor();
                    }
                } else {
                    this.closeEditor();
                }
            });
        }

        if (textarea) {
            textarea.addEventListener('input', () => {
                this.isDirty = true;
                const statusEl = document.getElementById('editor-status');
                if (statusEl) statusEl.textContent = 'Değiştirildi (Kaydedilmedi)';
                this.updateLineNumbers();
            });

            textarea.addEventListener('scroll', () => {
                const lineNumbers = document.getElementById('editor-line-numbers');
                if (lineNumbers) lineNumbers.scrollTop = textarea.scrollTop;
            });

            textarea.addEventListener('keydown', (e) => {
                // Handle Tab
                if (e.key === 'Tab') {
                    e.preventDefault();
                    const start = textarea.selectionStart;
                    const end = textarea.selectionEnd;
                    textarea.value = textarea.value.substring(0, start) + "    " + textarea.value.substring(end);
                    textarea.selectionStart = textarea.selectionEnd = start + 4;
                }
                
                // Handle Ctrl+S
                if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                    e.preventDefault();
                    this.saveFile();
                }
            });
        }
    },

    openEditor: async function(path) {
        this.currentPath = path;
        this.isDirty = false;
        
        const modal = document.getElementById('editor-modal');
        const textarea = document.getElementById('editor-textarea');
        const pathDisplay = document.getElementById('editor-path');
        const statusDisplay = document.getElementById('editor-status');
        
        if (pathDisplay) pathDisplay.textContent = path;
        if (statusDisplay) statusDisplay.textContent = 'Yükleniyor...';
        if (textarea) textarea.value = '';
        if (modal) modal.style.display = 'flex';
        
        try {
            const token = localStorage.getItem('access_token');
            const response = await fetch(`/api/files/download?path=${encodeURIComponent(path)}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!response.ok) throw new Error('Dosya okunamadı');
            
            const text = await response.text();
            if (textarea) {
                textarea.value = text;
                const ext = path.split('.').pop().toLowerCase();
                textarea.className = 'code-editor lang-' + ext;
            }
            if (statusDisplay) statusDisplay.textContent = '';
            this.updateLineNumbers();
            
        } catch (err) {
            if (statusDisplay) statusDisplay.textContent = 'Hata: ' + err.message;
            if (window.App && typeof window.App.showToast === 'function') {
                window.App.showToast(err.message, 'error');
            }
        }
    },

    saveFile: async function() {
        if (!this.currentPath) return;
        
        const textarea = document.getElementById('editor-textarea');
        const statusDisplay = document.getElementById('editor-status');
        const content = textarea ? textarea.value : '';
        
        if (statusDisplay) statusDisplay.textContent = 'Kaydediliyor...';
        
        try {
            await window.App.apiCall('PUT', '/api/files/edit', {
                path: this.currentPath,
                content: content
            });
            
            this.isDirty = false;
            if (statusDisplay) statusDisplay.textContent = 'Kaydedildi';
            if (window.App) window.App.showToast('Dosya başarıyla kaydedildi', 'success');
            
            setTimeout(() => {
                if (!this.isDirty && statusDisplay && statusDisplay.textContent === 'Kaydedildi') {
                    statusDisplay.textContent = '';
                }
            }, 3000);
            
        } catch (err) {
            if (statusDisplay) statusDisplay.textContent = 'Kaydetme hatası';
            if (window.App) window.App.showToast('Dosya kaydedilemedi: ' + err.message, 'error');
        }
    },

    closeEditor: function() {
        const modal = document.getElementById('editor-modal');
        if (modal) modal.style.display = 'none';
        this.currentPath = null;
        this.isDirty = false;
    },
    
    updateLineNumbers: function() {
        const textarea = document.getElementById('editor-textarea');
        const lineNumbers = document.getElementById('editor-line-numbers');
        if (!textarea || !lineNumbers) return;
        
        const lines = textarea.value.split('\n').length;
        let numbersHtml = '';
        for (let i = 1; i <= lines; i++) {
            numbersHtml += i + '<br>';
        }
        lineNumbers.innerHTML = numbersHtml;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('editor-modal') && window.Editor) {
        window.Editor.init();
    }
});
