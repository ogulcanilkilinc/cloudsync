window.FileManager = {
    viewMode: 'list', // 'list' or 'grid'
    contextMenuTarget: null,
    currentItems: [],
    currentSort: { column: 'name', asc: true },
    searchQuery: '',

    init: function() {
        this.bindEvents();
        this.loadDirectory('');
        this.setupDragAndDrop();
    },

    bindEvents: function() {
        const safeOn = (id, event, handler) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener(event, handler);
        };

        // Navigation
        safeOn('breadcrumb', 'click', (e) => {
            const item = e.target.closest('.breadcrumb-item');
            if (item) {
                const path = item.getAttribute('data-path') || '';
                this.loadDirectory(path);
            }
        });

        // Search filter
        safeOn('file-search-input', 'input', (e) => {
            this.searchQuery = (e.target.value || '').trim().toLowerCase();
            this.renderFileList(this.currentItems);
        });

        // File upload button
        safeOn('btn-upload', 'click', () => {
            const input = document.getElementById('file-upload-input');
            if (input) input.click();
        });
        
        safeOn('file-upload-input', 'change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                this.uploadFiles(e.target.files, App.state.currentPath);
                e.target.value = '';
            }
        });

        // Folder upload button (HTML5 webkitdirectory)
        safeOn('btn-upload-folder', 'click', () => {
            const input = document.getElementById('folder-upload-input');
            if (input) input.click();
        });

        safeOn('folder-upload-input', 'change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                this.uploadFolderFiles(e.target.files, App.state.currentPath);
                e.target.value = '';
            }
        });

        safeOn('btn-new-folder', 'click', () => {
            this.showPrompt('Yeni Klasör Adı:', '', (name) => this.createFolder(name));
        });
        
        safeOn('btn-download-selected', 'click', () => this.downloadSelected());
        safeOn('btn-delete-selected', 'click', () => this.deleteSelected());

        // View toggle
        const btnList = document.getElementById('btn-view-list');
        const btnGrid = document.getElementById('btn-view-grid');
        const fileListContainer = document.getElementById('file-list-container');
        
        if (btnList && btnGrid && fileListContainer) {
            btnList.addEventListener('click', () => {
                this.viewMode = 'list';
                btnList.classList.add('active');
                btnGrid.classList.remove('active');
                fileListContainer.classList.remove('grid-view');
            });
            
            btnGrid.addEventListener('click', () => {
                this.viewMode = 'grid';
                btnGrid.classList.add('active');
                btnList.classList.remove('active');
                fileListContainer.classList.add('grid-view');
            });
        }

        // Sorting
        document.querySelectorAll('.file-table th.sortable').forEach(th => {
            th.addEventListener('click', () => {
                const column = th.getAttribute('data-sort');
                if (this.currentSort.column === column) {
                    this.currentSort.asc = !this.currentSort.asc;
                } else {
                    this.currentSort.column = column;
                    this.currentSort.asc = true;
                }
                this.renderFileList(this.currentItems);
            });
        });

        // Select All
        const selectAll = document.getElementById('select-all');
        if (selectAll) {
            selectAll.addEventListener('change', (e) => {
                const checkboxes = document.querySelectorAll('.file-checkbox');
                checkboxes.forEach(cb => {
                    cb.checked = e.target.checked;
                    this.toggleSelection(cb.getAttribute('data-path'), cb.checked);
                    const row = cb.closest('.file-row');
                    if (row) {
                        if (e.target.checked) row.classList.add('selected');
                        else row.classList.remove('selected');
                    }
                });
                this.updateSelectionUI();
            });
        }

        // Context Menu outside click
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#context-menu')) {
                const menu = document.getElementById('context-menu');
                if (menu) menu.style.display = 'none';
            }
        });

        const fileListBody = document.getElementById('file-list-body');
        if (fileListBody) {
            fileListBody.addEventListener('contextmenu', (e) => {
                const row = e.target.closest('.file-row');
                if (row) {
                    e.preventDefault();
                    this.showContextMenu(e, row.getAttribute('data-path'), row.getAttribute('data-type'), row.getAttribute('data-mime'));
                }
            });
        }

        // Context menu actions
        safeOn('cm-open', 'click', () => {
            if (this.contextMenuTarget) {
                if (this.contextMenuTarget.isDir) {
                    this.loadDirectory(this.contextMenuTarget.path);
                } else {
                    this.previewFile(this.contextMenuTarget.path, this.contextMenuTarget.mime);
                }
            }
        });
        safeOn('cm-preview', 'click', () => {
            if (this.contextMenuTarget && !this.contextMenuTarget.isDir) {
                this.previewFile(this.contextMenuTarget.path, this.contextMenuTarget.mime);
            }
        });
        safeOn('cm-edit', 'click', () => {
            if (this.contextMenuTarget && !this.contextMenuTarget.isDir) {
                if (window.Editor && typeof window.Editor.openEditor === 'function') {
                    window.Editor.openEditor(this.contextMenuTarget.path);
                }
            }
        });
        safeOn('cm-download', 'click', () => {
            if (this.contextMenuTarget) {
                if (this.contextMenuTarget.isDir) {
                    this.downloadFolder(this.contextMenuTarget.path);
                } else {
                    this.downloadFile(this.contextMenuTarget.path);
                }
            }
        });
        safeOn('cm-download-folder', 'click', () => {
            if (this.contextMenuTarget && this.contextMenuTarget.isDir) {
                this.downloadFolder(this.contextMenuTarget.path);
            }
        });
        safeOn('cm-rename', 'click', () => {
            if (this.contextMenuTarget) {
                const pathParts = this.contextMenuTarget.path.split('/');
                const oldName = pathParts[pathParts.length - 1];
                this.showPrompt('Yeniden Adlandır:', oldName, (newName) => {
                    this.renameItem(this.contextMenuTarget.path, newName);
                });
            }
        });
        safeOn('cm-move', 'click', () => {
             if (this.contextMenuTarget) {
                 this.showPrompt('Yeni Yol (örn: hedef_klasor/yeni_ad):', this.contextMenuTarget.path, (newPath) => {
                     this.moveItem(this.contextMenuTarget.path, newPath);
                 });
             }
        });
        safeOn('cm-delete', 'click', () => {
            if (this.contextMenuTarget) {
                this.showConfirm('Silme İşlemi', `"${this.contextMenuTarget.path}" silinecek. Emin misiniz?`, () => {
                    this.deleteItem(this.contextMenuTarget.path);
                });
            }
        });

        // Modals
        safeOn('prompt-cancel', 'click', () => {
            const modal = document.getElementById('prompt-modal');
            if (modal) modal.style.display = 'none';
        });
        safeOn('confirm-cancel', 'click', () => {
            const modal = document.getElementById('confirm-modal');
            if (modal) modal.style.display = 'none';
        });
        safeOn('preview-close-btn', 'click', () => {
            const modal = document.getElementById('preview-modal');
            if (modal) modal.style.display = 'none';
            const content = document.getElementById('preview-content');
            if (content) content.innerHTML = '';
        });
        
        // Sync log toggle
        safeOn('toggle-sync-log', 'click', () => {
            const panel = document.getElementById('sync-log-panel');
            if (panel) panel.classList.remove('collapsed');
            this.loadSyncLog();
        });
        safeOn('close-sync-log', 'click', () => {
            const panel = document.getElementById('sync-log-panel');
            if (panel) panel.classList.add('collapsed');
        });
    },

    setupDragAndDrop: function() {
        const dropOverlay = document.getElementById('drop-overlay');
        if (!dropOverlay) return;
        
        let dragCounter = 0;

        window.addEventListener('dragenter', (e) => {
            e.preventDefault();
            dragCounter++;
            dropOverlay.style.display = 'flex';
        });

        window.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dragCounter--;
            if (dragCounter <= 0) {
                dragCounter = 0;
                dropOverlay.style.display = 'none';
            }
        });

        window.addEventListener('dragover', (e) => {
            e.preventDefault();
        });

        window.addEventListener('drop', async (e) => {
            e.preventDefault();
            dragCounter = 0;
            dropOverlay.style.display = 'none';
            
            if (e.dataTransfer && e.dataTransfer.items) {
                const items = e.dataTransfer.items;
                const filesToUpload = [];
                
                const readEntry = async (entry, currentSubPath = '') => {
                    if (entry.isFile) {
                        return new Promise((resolve) => {
                            entry.file((file) => {
                                filesToUpload.push({
                                    file: file,
                                    targetSubPath: currentSubPath
                                });
                                resolve();
                            });
                        });
                    } else if (entry.isDirectory) {
                        const dirReader = entry.createReader();
                        const dirSubPath = currentSubPath ? `${currentSubPath}/${entry.name}` : entry.name;
                        
                        return new Promise((resolve) => {
                            const readEntries = () => {
                                dirReader.readEntries(async (entries) => {
                                    if (entries.length === 0) {
                                        resolve();
                                    } else {
                                        for (const child of entries) {
                                            await readEntry(child, dirSubPath);
                                        }
                                        readEntries();
                                    }
                                });
                            };
                            readEntries();
                        });
                    }
                };

                for (let i = 0; i < items.length; i++) {
                    const item = items[i];
                    if (item.webkitGetAsEntry) {
                        const entry = item.webkitGetAsEntry();
                        if (entry) await readEntry(entry, '');
                    }
                }

                if (filesToUpload.length > 0) {
                    this.uploadStructuredFiles(filesToUpload, App.state.currentPath);
                    return;
                }
            }
            
            if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                this.uploadFiles(e.dataTransfer.files, App.state.currentPath);
            }
        });
    },

    loadDirectory: async function(path) {
        try {
            const data = await App.apiCall('GET', `/api/files/list?path=${encodeURIComponent(path)}`);
            App.state.currentPath = path;
            App.state.selectedFiles.clear();
            
            const selectAll = document.getElementById('select-all');
            if (selectAll) selectAll.checked = false;
            
            this.updateSelectionUI();
            this.renderBreadcrumb(path);
            
            const items = Array.isArray(data) ? data : (data.items || []);
            this.currentItems = items;
            this.renderFileList(items);
            this.updateFolderTree();
        } catch (err) {
            App.showToast('Klasör yüklenirken hata oluştu: ' + err.message, 'error');
        }
    },

    renderBreadcrumb: function(path) {
        const container = document.getElementById('breadcrumb');
        if (!container) return;
        container.innerHTML = '';
        
        const root = document.createElement('span');
        root.className = 'breadcrumb-item';
        root.textContent = '🏠 Ana Dizin';
        root.setAttribute('data-path', '');
        container.appendChild(root);
        
        if (!path) return;
        
        const parts = path.split('/').filter(p => p);
        let currentPath = '';
        
        parts.forEach((part) => {
            const sep = document.createElement('span');
            sep.className = 'breadcrumb-separator';
            sep.textContent = '/';
            container.appendChild(sep);
            
            currentPath += (currentPath ? '/' : '') + part;
            
            const item = document.createElement('span');
            item.className = 'breadcrumb-item';
            item.textContent = part;
            item.setAttribute('data-path', currentPath);
            container.appendChild(item);
        });
    },

    getFileIcon: function(isDir, mimeType) {
        if (isDir) return '📁';
        if (!mimeType) return '📄';
        if (mimeType.startsWith('image/')) return '🖼️';
        if (mimeType.startsWith('text/')) return '📄';
        if (mimeType.startsWith('video/')) return '🎬';
        if (mimeType.startsWith('audio/')) return '🎵';
        if (mimeType.includes('pdf')) return '📝';
        if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('rar') || mimeType.includes('compressed')) return '📦';
        if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return '📊';
        return '📎';
    },

    renderFileList: function(items) {
        const tbody = document.getElementById('file-list-body');
        if (!tbody) return;
        tbody.innerHTML = '';
        
        let filtered = items;
        if (this.searchQuery) {
            filtered = items.filter(i => i.name.toLowerCase().includes(this.searchQuery));
        }

        const sorted = [...filtered].sort((a, b) => {
            if (a.is_directory && !b.is_directory) return -1;
            if (!a.is_directory && b.is_directory) return 1;
            
            let valA = a[this.currentSort.column];
            let valB = b[this.currentSort.column];
            
            if (this.currentSort.column === 'name') {
                valA = a.name.toLowerCase();
                valB = b.name.toLowerCase();
            }
            
            if (valA < valB) return this.currentSort.asc ? -1 : 1;
            if (valA > valB) return this.currentSort.asc ? 1 : -1;
            return 0;
        });
        
        if (sorted.length === 0) {
            const msg = this.searchQuery ? `"${this.searchQuery}" ile eşleşen dosya bulunamadı.` : 'Bu klasör boş. Dosya veya klasör yüklemek için yukarıdaki butonları kullanabilirsiniz.';
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">${msg}</td></tr>`;
            return;
        }

        sorted.forEach(item => {
            const tr = document.createElement('tr');
            tr.className = 'file-row';
            tr.setAttribute('data-path', item.path);
            tr.setAttribute('data-type', item.is_directory ? 'dir' : 'file');
            tr.setAttribute('data-mime', item.mime_type || '');
            
            const isSelected = App.state.selectedFiles.has(item.path);
            if (isSelected) tr.classList.add('selected');
            
            const icon = this.getFileIcon(item.is_directory, item.mime_type);
            
            tr.innerHTML = `
                <td class="col-checkbox" onclick="event.stopPropagation()">
                    <input type="checkbox" class="file-checkbox" data-path="${item.path}" ${isSelected ? 'checked' : ''}>
                </td>
                <td class="col-icon"><span class="file-icon">${icon}</span></td>
                <td class="col-name">
                    <div class="item-name-cell" style="cursor: pointer; font-weight: ${item.is_directory ? '600' : 'normal'};">
                        ${item.name}
                    </div>
                </td>
                <td class="col-size">${item.is_directory ? '--' : App.formatFileSize(item.size)}</td>
                <td class="col-type">${item.is_directory ? 'Klasör' : (item.mime_type || 'Dosya')}</td>
                <td class="col-date">${App.formatDate(item.modified_at)}</td>
            `;
            
            // Double click to open/preview
            tr.addEventListener('dblclick', () => {
                if (item.is_directory) {
                    this.loadDirectory(item.path);
                } else {
                    this.previewFile(item.path, item.mime_type);
                }
            });
            
            // Checkbox click
            const cb = tr.querySelector('.file-checkbox');
            if (cb) {
                cb.addEventListener('change', (e) => {
                    this.toggleSelection(item.path, e.target.checked);
                    if (e.target.checked) tr.classList.add('selected');
                    else tr.classList.remove('selected');
                    this.updateSelectionUI();
                });
            }
            
            tbody.appendChild(tr);
        });
    },

    updateFolderTree: async function() {
        const treeContainer = document.getElementById('folder-tree');
        if (!treeContainer) return;
        
        try {
            const manifest = await App.apiCall('GET', '/api/sync/manifest');
            const folders = new Set();
            folders.add(''); // Root
            let totalBytes = 0;
            let fileCount = 0;
            
            if (Array.isArray(manifest)) {
                manifest.forEach(item => {
                    fileCount++;
                    totalBytes += item.size || 0;
                    const parts = item.path.split('/');
                    parts.pop(); // Remove file name
                    let accumulated = '';
                    parts.forEach(p => {
                        accumulated = accumulated ? `${accumulated}/${p}` : p;
                        folders.add(accumulated);
                    });
                });
            }
            
            // Update storage stats
            const statsEl = document.getElementById('storage-used-text');
            if (statsEl) {
                statsEl.innerHTML = `<strong>${fileCount}</strong> dosya (${App.formatFileSize(totalBytes)})`;
            }

            const folderList = Array.from(folders).sort();
            treeContainer.innerHTML = '';
            
            folderList.forEach(f => {
                const item = document.createElement('div');
                item.className = 'tree-item' + (f === App.state.currentPath ? ' active' : '');
                const depth = f ? f.split('/').length : 0;
                item.style.paddingLeft = `${depth * 14 + 10}px`;
                const label = f ? f.split('/').pop() : '🏠 Ana Dizin';
                item.innerHTML = `<span>📁 ${label}</span>`;
                item.addEventListener('click', () => this.loadDirectory(f));
                treeContainer.appendChild(item);
            });
        } catch (e) {
            console.error("Folder tree update failed", e);
        }
    },

    toggleSelection: function(path, isSelected) {
        if (isSelected) {
            App.state.selectedFiles.add(path);
        } else {
            App.state.selectedFiles.delete(path);
        }
    },

    updateSelectionUI: function() {
        const count = App.state.selectedFiles.size;
        const actionsEl = document.getElementById('selection-actions');
        if (actionsEl) {
            actionsEl.style.display = count > 0 ? 'flex' : 'none';
        }
    },

    showContextMenu: function(e, path, type, mime) {
        const menu = document.getElementById('context-menu');
        if (!menu) return;
        this.contextMenuTarget = { path, isDir: type === 'dir', mime };
        
        const isDir = type === 'dir';
        const cmPreview = document.getElementById('cm-preview');
        const cmEdit = document.getElementById('cm-edit');
        const cmDownload = document.getElementById('cm-download');
        const cmDownloadFolder = document.getElementById('cm-download-folder');
        
        if (cmPreview) cmPreview.style.display = isDir ? 'none' : 'block';
        if (cmEdit) cmEdit.style.display = (isDir || (mime && !mime.startsWith('text/') && !mime.includes('json') && !mime.includes('javascript') && !mime.includes('xml'))) ? 'none' : 'block';
        if (cmDownload) {
            cmDownload.textContent = isDir ? 'Klasörü ZIP Olarak İndir' : 'İndir';
            cmDownload.style.display = 'block';
        }
        if (cmDownloadFolder) cmDownloadFolder.style.display = isDir ? 'block' : 'none';
        
        menu.style.display = 'block';
        
        let left = e.pageX;
        let top = e.pageY;
        
        const menuWidth = 180;
        const menuHeight = 220;
        if (left + menuWidth > window.innerWidth) left = window.innerWidth - menuWidth - 10;
        if (top + menuHeight > window.innerHeight) top = window.innerHeight - menuHeight - 10;
        
        menu.style.left = `${left}px`;
        menu.style.top = `${top}px`;
    },

    showPrompt: function(title, defaultValue, callback) {
        const modal = document.getElementById('prompt-modal');
        const input = document.getElementById('prompt-input');
        const titleEl = document.getElementById('prompt-title');
        const confirmBtn = document.getElementById('prompt-confirm');
        
        if (!modal || !input || !titleEl || !confirmBtn) return;
        
        titleEl.textContent = title;
        input.value = defaultValue || '';
        modal.style.display = 'flex';
        input.focus();
        
        const newConfirmBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
        
        newConfirmBtn.addEventListener('click', () => {
            const val = input.value.trim();
            if (val) {
                modal.style.display = 'none';
                callback(val);
            }
        });
        
        input.onkeydown = (e) => {
            if (e.key === 'Enter') {
                newConfirmBtn.click();
            }
        };
    },

    showConfirm: function(title, message, callback) {
        const modal = document.getElementById('confirm-modal');
        const titleEl = document.getElementById('confirm-title');
        const messageEl = document.getElementById('confirm-message');
        const confirmBtn = document.getElementById('confirm-confirm');
        
        if (!modal || !titleEl || !messageEl || !confirmBtn) return;
        
        titleEl.textContent = title;
        messageEl.textContent = message;
        modal.style.display = 'flex';
        
        const newConfirmBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
        
        newConfirmBtn.addEventListener('click', () => {
            modal.style.display = 'none';
            callback();
        });
    },

    // API Actions
    createFolder: async function(name) {
        const path = App.state.currentPath ? `${App.state.currentPath}/${name}` : name;
        try {
            await App.apiCall('POST', '/api/files/mkdir', { path });
            App.showToast('Klasör oluşturuldu', 'success');
            this.loadDirectory(App.state.currentPath);
        } catch (err) {
            App.showToast('Hata: ' + err.message, 'error');
        }
    },

    deleteItem: async function(path) {
        try {
            await App.apiCall('DELETE', `/api/files/delete?path=${encodeURIComponent(path)}`);
            App.showToast('Silindi', 'success');
            this.loadDirectory(App.state.currentPath);
        } catch (err) {
            App.showToast('Hata: ' + err.message, 'error');
        }
    },

    deleteSelected: async function() {
        if (App.state.selectedFiles.size === 0) return;
        
        this.showConfirm('Toplu Silme', `${App.state.selectedFiles.size} öğeyi silmek istediğinize emin misiniz?`, async () => {
            let successCount = 0;
            for (const path of App.state.selectedFiles) {
                try {
                    await App.apiCall('DELETE', `/api/files/delete?path=${encodeURIComponent(path)}`);
                    successCount++;
                } catch (e) {
                    console.error("Failed to delete", path, e);
                }
            }
            App.showToast(`${successCount} öğe silindi`, 'success');
            this.loadDirectory(App.state.currentPath);
        });
    },

    renameItem: async function(path, newName) {
        try {
            await App.apiCall('POST', '/api/files/rename', { path, new_name: newName });
            App.showToast('Yeniden adlandırıldı', 'success');
            this.loadDirectory(App.state.currentPath);
        } catch (err) {
            App.showToast('Hata: ' + err.message, 'error');
        }
    },

    moveItem: async function(oldPath, newPath) {
         try {
            await App.apiCall('POST', '/api/files/move', { old_path: oldPath, new_path: newPath });
            App.showToast('Taşındı', 'success');
            this.loadDirectory(App.state.currentPath);
        } catch (err) {
            App.showToast('Hata: ' + err.message, 'error');
        }
    },

    uploadFiles: function(files, targetPath) {
        const list = Array.from(files).map(f => ({ file: f, targetSubPath: '' }));
        this.uploadStructuredFiles(list, targetPath);
    },

    uploadFolderFiles: function(files, targetPath) {
        const list = Array.from(files).map(f => {
            const rel = f.webkitRelativePath || '';
            const parts = rel.split('/');
            parts.pop(); // remove filename
            return {
                file: f,
                targetSubPath: parts.join('/')
            };
        });
        this.uploadStructuredFiles(list, targetPath);
    },

    uploadStructuredFiles: function(items, basePath) {
        const progressContainer = document.getElementById('upload-progress-container');
        const progressBar = document.getElementById('upload-progress-bar');
        const percentText = document.getElementById('upload-percent');
        const statusText = document.getElementById('upload-status-text');
        
        if (progressContainer && progressBar && percentText) {
            progressContainer.style.display = 'block';
            progressBar.style.width = '0%';
            percentText.textContent = '0%';
        }

        let completed = 0;
        const total = items.length;

        items.forEach((item) => {
            const file = item.file;
            const fullTargetPath = item.targetSubPath 
                ? (basePath ? `${basePath}/${item.targetSubPath}` : item.targetSubPath)
                : basePath;

            const formData = new FormData();
            formData.append('file', file);
            formData.append('path', fullTargetPath);

            const token = localStorage.getItem('access_token');
            const xhr = new XMLHttpRequest();
            
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable && progressBar && percentText) {
                    const currentPercent = Math.round(((completed + (e.loaded / e.total)) / total) * 100);
                    progressBar.style.width = currentPercent + '%';
                    percentText.textContent = currentPercent + '%';
                    if (statusText) statusText.textContent = `Yükleniyor: ${completed + 1}/${total} dosya`;
                }
            });

            xhr.addEventListener('load', () => {
                completed++;
                if (completed === total) {
                    if (progressContainer) progressContainer.style.display = 'none';
                    App.showToast(`${total} dosya/klasör başarıyla yüklendi`, 'success');
                    this.loadDirectory(App.state.currentPath);
                }
            });

            xhr.addEventListener('error', () => {
                completed++;
                App.showToast(`${file.name} yüklenirken hata oluştu`, 'error');
                if (completed === total && progressContainer) progressContainer.style.display = 'none';
            });

            xhr.open('POST', '/api/files/upload', true);
            if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            xhr.send(formData);
        });
    },

    downloadFile: function(path) {
        const token = localStorage.getItem('access_token');
        const downloadUrl = `/api/files/download?path=${encodeURIComponent(path)}&token=${encodeURIComponent(token || '')}`;
        const a = document.createElement('a');
        a.href = downloadUrl;
        const filename = path.split('/').pop();
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            if (a.parentNode) document.body.removeChild(a);
        }, 2000);
    },

    downloadFolder: function(path) {
        App.showToast('Klasör ZIP olarak hazırlanıyor...', 'info');
        const token = localStorage.getItem('access_token');
        const downloadUrl = `/api/files/download-folder?path=${encodeURIComponent(path || '')}&token=${encodeURIComponent(token || '')}`;
        const a = document.createElement('a');
        a.href = downloadUrl;
        const folderName = path ? path.split('/').pop() : 'tum_klasorler';
        a.download = `${folderName}.zip`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            if (a.parentNode) document.body.removeChild(a);
        }, 2000);
    },

    downloadSelected: function() {
        const paths = Array.from(App.state.selectedFiles);
        if (paths.length === 0) return;
        
        App.showToast('Seçilenler ZIP olarak hazırlanıyor...', 'info');
        const token = localStorage.getItem('access_token');
        
        fetch('/api/files/download-zip', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ paths })
        })
        .then(res => {
            if (!res.ok) throw new Error('ZIP indirme başarısız');
            return res.blob();
        })
        .then(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'cloudsync_secilenler.zip';
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                window.URL.revokeObjectURL(url);
                if (a.parentNode) document.body.removeChild(a);
            }, 30000);
        })
        .catch(err => {
            App.showToast(err.message, 'error');
        });
    },

    previewFile: async function(path, mimeType) {
        const modal = document.getElementById('preview-modal');
        const content = document.getElementById('preview-content');
        const title = document.getElementById('preview-title');
        const editBtn = document.getElementById('preview-edit-btn');
        const downloadBtn = document.getElementById('preview-download-btn');
        
        if (!modal || !content || !title || !downloadBtn) return;
        
        const filename = path.split('/').pop();
        title.textContent = filename;
        content.innerHTML = '<div style="text-align:center; padding: 2rem;">Yükleniyor...</div>';
        modal.style.display = 'flex';
        
        downloadBtn.onclick = () => this.downloadFile(path);
        
        const isText = (mimeType && (mimeType.startsWith('text/') || mimeType.includes('json') || mimeType.includes('javascript') || mimeType.includes('xml') || mimeType.includes('markdown') || mimeType.includes('csv'))) || filename.match(/\.(txt|md|py|js|html|css|json|csv|log|yaml|yml|ini|env|sh|bat|sql)$/i);
        const isPDF = (mimeType && mimeType.includes('pdf')) || filename.toLowerCase().endsWith('.pdf');
        const isAudio = (mimeType && mimeType.startsWith('audio/')) || filename.match(/\.(mp3|wav|ogg|m4a|aac)$/i);
        const isVideo = (mimeType && mimeType.startsWith('video/')) || filename.match(/\.(mp4|webm|mkv|mov|avi)$/i);
        const token = localStorage.getItem('access_token') || '';
        const mediaUrl = `/api/files/download?path=${encodeURIComponent(path)}&token=${encodeURIComponent(token)}`;
        
        if (isText) {
            if (editBtn) {
                editBtn.style.display = 'block';
                editBtn.onclick = () => {
                    modal.style.display = 'none';
                    if (window.Editor && typeof window.Editor.openEditor === 'function') {
                        window.Editor.openEditor(path);
                    }
                };
            }
            
            try {
                const response = await fetch(mediaUrl);
                if (!response.ok) throw new Error('Dosya okunamadı');
                const text = await response.text();
                content.innerHTML = `<pre style="white-space: pre-wrap; word-break: break-all; max-height: 60vh; overflow: auto; background: var(--bg-primary); padding: 1rem; border-radius: 6px; font-family: monospace; font-size: 0.9rem;">${this.escapeHtml(text)}</pre>`;
            } catch (err) {
                content.innerHTML = `<div class="error-message">${err.message}</div>`;
            }
        } else if (isPDF) {
            if (editBtn) editBtn.style.display = 'none';
            content.innerHTML = `<iframe src="${mediaUrl}" style="width: 100%; height: 65vh; border: none; border-radius: 6px;"></iframe>`;
        } else if (isAudio) {
            if (editBtn) editBtn.style.display = 'none';
            content.innerHTML = `<div style="text-align:center; padding: 2rem;"><audio controls autoplay src="${mediaUrl}" style="width: 85%;"></audio></div>`;
        } else if (isVideo) {
            if (editBtn) editBtn.style.display = 'none';
            content.innerHTML = `<div style="text-align:center;"><video controls autoplay src="${mediaUrl}" style="max-width: 100%; max-height: 60vh; border-radius: 6px;"></video></div>`;
        } else if (mimeType && mimeType.startsWith('image/')) {
            if (editBtn) editBtn.style.display = 'none';
            content.innerHTML = `<div style="text-align: center;"><img src="${mediaUrl}" alt="${filename}" style="max-width: 100%; max-height: 60vh; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.5);"></div>`;
        } else {
            if (editBtn) editBtn.style.display = 'none';
            content.innerHTML = `
                <div style="text-align:center; padding: 2rem;">
                    <div style="font-size: 4rem; margin-bottom: 1rem;">${this.getFileIcon(false, mimeType)}</div>
                    <p>Bu dosya türü için doğrudan önizleme kullanılamıyor.</p>
                    <button class="btn btn-primary" style="margin-top: 1rem;" onclick="FileManager.downloadFile('${path}')">⬇️ Dosyayı İndir</button>
                </div>
            `;
        }
    },
    
    escapeHtml: function(unsafe) {
        return (unsafe || '')
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
    },

    loadSyncLog: async function() {
        const content = document.getElementById('sync-log-content');
        if (!content) return;
        content.innerHTML = '<div style="padding: 1rem; color: var(--text-muted);">Yükleniyor...</div>';
        try {
            const logs = await App.apiCall('GET', '/api/sync/log?limit=50');
            if (Array.isArray(logs) && logs.length > 0) {
                content.innerHTML = logs.map(log => {
                    return `<div class="log-entry" style="padding: 0.5rem 0.8rem; border-bottom: 1px solid var(--border-color); font-size: 0.85rem;">
                        <span style="color: var(--text-muted);">[${App.formatDate(log.timestamp)}]</span> 
                        <strong style="color: var(--accent);">${log.device_name || 'Web'}</strong>: 
                        <span style="background: var(--bg-card); padding: 2px 6px; border-radius: 4px;">${log.action}</span> 
                        <span style="color: var(--primary); font-family: monospace;">${log.file_path}</span>
                    </div>`;
                }).join('');
            } else {
                content.innerHTML = '<div style="padding: 1rem; color: var(--text-muted);">Henüz senkronizasyon kaydı bulunmuyor.</div>';
            }
        } catch (err) {
            content.innerHTML = `<div class="error-message" style="padding: 1rem;">Günlükler yüklenemedi: ${err.message}</div>`;
        }
    }
};
