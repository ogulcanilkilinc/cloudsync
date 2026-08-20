import json
import os
import time
import hashlib
import argparse
from datetime import datetime
from sync_client import SyncClient
from watcher import FolderWatcher

class CloudSyncAgent:
    def __init__(self, config_path='config_agent.json'):
        self.config_path = config_path
        self.config = self.load_config()
        self.client = SyncClient(self.config['server_url'], self.config['username'], self.config['password'])
        self.watcher = None
        self.sync_active = False
        self.state_file = os.path.join(os.path.dirname(os.path.abspath(config_path)), '.sync_state.json')
        self.last_sync_state = self.load_state()

    def load_config(self):
        if not os.path.exists(self.config_path):
            print(f"[Hata] Yapılandırma dosyası bulunamadı: {self.config_path}")
            exit(1)
        with open(self.config_path, 'r', encoding='utf-8') as f:
            return json.load(f)

    def load_state(self):
        if os.path.exists(self.state_file):
            try:
                with open(self.state_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception:
                return {}
        return {}

    def save_state(self):
        try:
            with open(self.state_file, 'w', encoding='utf-8') as f:
                json.dump(self.last_sync_state, f, indent=2)
        except Exception as e:
            print(f"[Uyarı] Durum kaydedilemedi: {e}")

    def compute_hash(self, file_path):
        sha256_hash = hashlib.sha256()
        try:
            with open(file_path, "rb") as f:
                for byte_block in iter(lambda: f.read(65536), b""):
                    sha256_hash.update(byte_block)
            return sha256_hash.hexdigest()
        except Exception:
            return None

    def build_local_manifest(self, sync_folder):
        manifest = []
        local_path = os.path.abspath(sync_folder['local_path'])
        remote_prefix = sync_folder.get('remote_path', '').strip('/')
        
        if not os.path.exists(local_path):
            os.makedirs(local_path, exist_ok=True)
            
        for root, dirs, files in os.walk(local_path):
            for f in files:
                full_path = os.path.join(root, f)
                rel_path = os.path.relpath(full_path, local_path).replace("\\", "/")
                
                # Check ignored patterns
                ignored = False
                for pat in self.config.get('ignored_patterns', []):
                    if pat.strip('*') in f:
                        ignored = True
                        break
                if ignored:
                    continue
                
                remote_path = f"{remote_prefix}/{rel_path}".lstrip('/') if remote_prefix else rel_path
                file_hash = self.compute_hash(full_path)
                
                if file_hash:
                    stat = os.stat(full_path)
                    manifest.append({
                        "path": remote_path,
                        "hash": file_hash,
                        "size": stat.st_size,
                        "updated_at": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                        "local_path": full_path
                    })
        return manifest

    def get_all_local_manifests(self):
        full_manifest = []
        for folder in self.config.get('sync_folders', []):
            full_manifest.extend(self.build_local_manifest(folder))
        return full_manifest

    def resolve_local_path(self, remote_path):
        remote_clean = remote_path.lstrip('/')
        for folder in self.config.get('sync_folders', []):
            prefix = folder.get('remote_path', '').strip('/')
            if prefix and remote_clean.startswith(prefix):
                rel = remote_clean[len(prefix):].lstrip('/')
                return os.path.join(os.path.abspath(folder['local_path']), rel)
            elif not prefix:
                return os.path.join(os.path.abspath(folder['local_path']), remote_clean)
        
        if self.config.get('sync_folders'):
            return os.path.join(os.path.abspath(self.config['sync_folders'][0]['local_path']), remote_clean)
        return remote_clean

    def sync_once(self):
        if self.sync_active:
            return
        self.sync_active = True
        device_name = self.config.get('device_name', 'client')
        
        try:
            local_items = self.get_all_local_manifests()
            local_dict = {item['path']: item for item in local_items}
            
            server_items = self.client.get_manifest()
            server_dict = {item['path']: item for item in server_items}
            
            all_paths = set(local_dict.keys()).union(server_dict.keys()).union(self.last_sync_state.keys())
            
            changes_count = 0
            
            for path in sorted(all_paths):
                local_file = local_dict.get(path)
                server_file = server_dict.get(path)
                last_hash = self.last_sync_state.get(path)
                
                local_hash = local_file['hash'] if local_file else None
                server_hash = server_file['hash'] if server_file else None
                l_path = self.resolve_local_path(path)
                
                # Case 1: File exists everywhere with same hash
                if local_hash and server_hash and local_hash == server_hash:
                    self.last_sync_state[path] = local_hash
                    continue
                
                # Case 2: New file on local only (not on server, not in last sync)
                if local_file and not server_file and not last_hash:
                    print(f"[Yukleniyor] {path}")
                    if self.client.push_file(l_path, path, device_name):
                        self.last_sync_state[path] = local_hash
                        changes_count += 1
                    continue
                
                # Case 3: New file on server only (not on local, not in last sync)
                if server_file and not local_file and not last_hash:
                    print(f"[Indiriliyor] {path}")
                    if self.client.download_file(path, l_path):
                        self.last_sync_state[path] = server_hash
                        changes_count += 1
                    continue
                
                # Case 4: File existed before, now deleted locally
                if not local_file and server_file and last_hash:
                    if server_hash == last_hash:
                        # Server file didn't change -> propagate local deletion to server
                        print(f"[Sunucudan Siliniyor] {path}")
                        if self.client.delete_remote(path):
                            del self.last_sync_state[path]
                            changes_count += 1
                    else:
                        # Server file was updated elsewhere -> re-download
                        print(f"[Yeniden Indiriliyor] {path}")
                        if self.client.download_file(path, l_path):
                            self.last_sync_state[path] = server_hash
                            changes_count += 1
                    continue
                
                # Case 5: File existed before, now deleted on server
                if local_file and not server_file and last_hash:
                    if local_hash == last_hash:
                        # Local file didn't change -> delete locally
                        print(f"[Yerelden Siliniyor] {path}")
                        if os.path.exists(l_path):
                            try:
                                os.remove(l_path)
                            except Exception:
                                pass
                        del self.last_sync_state[path]
                        changes_count += 1
                    else:
                        # Local file was modified -> upload as new
                        print(f"[Yukleniyor] {path}")
                        if self.client.push_file(l_path, path, device_name):
                            self.last_sync_state[path] = local_hash
                            changes_count += 1
                    continue
                
                # Case 6: Both local and server exist, but hashes differ
                if local_file and server_file and local_hash != server_hash:
                    if local_hash == last_hash:
                        # Only server changed -> download update
                        print(f"[Guncelleniyor] {path}")
                        if self.client.download_file(path, l_path):
                            self.last_sync_state[path] = server_hash
                            changes_count += 1
                    elif server_hash == last_hash:
                        # Only local changed -> push update
                        print(f"[Guncelleniyor] {path}")
                        if self.client.push_file(l_path, path, device_name):
                            self.last_sync_state[path] = local_hash
                            changes_count += 1
                    else:
                        # Conflict! Both changed independently -> preserve both
                        print(f"[Cakisma Algilandi] {path}")
                        self.client.resolve_conflict(l_path, path, device_name)
                        # Download current server version to local
                        self.client.download_file(path, l_path)
                        self.last_sync_state[path] = server_hash
                        changes_count += 1
                        
            self.save_state()
            if changes_count > 0:
                print(f"[Tamamlandi] Senkronizasyon tamamlandi: {changes_count} islem yapildi.")
        except Exception as e:
            print(f"[Hata] Eşitleme sırasında hata oluştu: {e}")
        finally:
            self.sync_active = False

    def on_file_change(self, event_type, src_path, dest_path=None):
        self.sync_once()

    def run(self):
        print("=" * 60)
        print("  CloudSync İstemcisi Başlatılıyor...")
        print(f"  Sunucu: {self.config['server_url']}")
        print(f"  Kullanıcı: {self.config['username']}")
        print(f"  Cihaz Adı: {self.config.get('device_name', 'client')}")
        print("=" * 60)
        
        if not self.client.login():
            print("[Hata] Sunucuya baglanilamadi veya kullanici adi/sifre hatali!")
            return

        print("[OK] Sunucuya basariyla giris yapildi.")
        
        # Initial sync
        print("[Senkronizasyon] Ilk esitleme yapiliyor...")
        self.sync_once()

        folders_to_watch = [os.path.abspath(f['local_path']) for f in self.config.get('sync_folders', [])]
        for folder in folders_to_watch:
            os.makedirs(folder, exist_ok=True)
            print(f"[Izleme] Klasor: {folder}")
            
        self.watcher = FolderWatcher(
            folders_to_watch, 
            self.on_file_change, 
            self.config.get('ignored_patterns', [])
        )
        self.watcher.start()
        print("[Aktif] Gercek zamanli dosya izleyici aktif.")

        interval = self.config.get('sync_interval_seconds', 30)
        print(f"[Zamanlayici] Otomatik kontrol araligi: {interval} saniye\n(Durdurmak icin Ctrl+C)")
        
        try:
            while True:
                time.sleep(interval)
                self.sync_once()
        except KeyboardInterrupt:
            print("\n[Kapatiliyor] Istemci durduruluyor...")
            self.watcher.stop()
            print("[Bitti] Istemci kapatildi.")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="CloudSync Agent")
    parser.add_argument('--config', type=str, default='config_agent.json', help='Yapılandırma dosyası yolu')
    args = parser.parse_args()
    
    agent = CloudSyncAgent(args.config)
    agent.run()
