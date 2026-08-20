import requests
import os
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

class SyncClient:
    def __init__(self, server_url, username, password):
        self.server_url = server_url.rstrip('/')
        self.username = username
        self.password = password
        self.token = None
        
        self.session = requests.Session()
        retries = Retry(total=3, backoff_factor=0.5, status_forcelist=[502, 503, 504])
        self.session.mount('http://', HTTPAdapter(max_retries=retries))
        self.session.mount('https://', HTTPAdapter(max_retries=retries))

    def login(self) -> bool:
        try:
            response = self.session.post(
                f"{self.server_url}/api/auth/login", 
                json={"username": self.username, "password": self.password},
                timeout=10
            )
            if response.status_code == 200:
                data = response.json()
                self.token = data.get("access_token")
                return True
            return False
        except requests.RequestException as e:
            print(f"[Hata] Giriş yapılamadı: {e}")
            return False

    def _headers(self):
        return {"Authorization": f"Bearer {self.token}"} if self.token else {}

    def _request(self, method, endpoint, **kwargs):
        url = f"{self.server_url}{endpoint}"
        if 'timeout' not in kwargs:
            kwargs['timeout'] = 30
            
        try:
            response = self.session.request(method, url, headers=self._headers(), **kwargs)
            if response.status_code == 401:
                if self.login():
                    response = self.session.request(method, url, headers=self._headers(), **kwargs)
            return response
        except requests.RequestException as e:
            print(f"[Bağlantı Hatası] {endpoint}: {e}")
            return None

    def get_manifest(self):
        resp = self._request('GET', '/api/sync/manifest')
        if resp and resp.status_code == 200:
            data = resp.json()
            return data if isinstance(data, list) else data.get('files', [])
        return []

    def check_sync(self, local_manifest):
        resp = self._request('POST', '/api/sync/check', json={"client_manifest": local_manifest})
        if resp and resp.status_code == 200:
            return resp.json()
        return {"to_upload": [], "to_download": [], "conflicts": [], "to_delete_server": [], "to_delete_client": []}

    def push_file(self, local_path, relative_path, device_name="agent"):
        try:
            if not os.path.exists(local_path):
                return False
            with open(local_path, 'rb') as f:
                files = {'file': (os.path.basename(local_path), f)}
                data = {'path': relative_path, 'device_name': device_name}
                resp = self._request('POST', '/api/sync/push', files=files, data=data)
                return resp is not None and resp.status_code == 200
        except Exception as e:
            print(f"[Hata] Dosya yüklenemedi ({relative_path}): {e}")
            return False

    def download_file(self, relative_path, local_path):
        try:
            resp = self._request('GET', '/api/files/download', params={'path': relative_path}, stream=True)
            if resp and resp.status_code == 200:
                os.makedirs(os.path.dirname(os.path.abspath(local_path)), exist_ok=True)
                with open(local_path, 'wb') as f:
                    for chunk in resp.iter_content(chunk_size=65536):
                        if chunk:
                            f.write(chunk)
                return True
            return False
        except Exception as e:
            print(f"[Hata] Dosya indirilemedi ({relative_path}): {e}")
            return False

    def delete_remote(self, relative_path):
        resp = self._request('DELETE', '/api/files/delete', params={'path': relative_path})
        return resp is not None and resp.status_code == 200

    def resolve_conflict(self, local_path, relative_path, device_name):
        try:
            if not os.path.exists(local_path):
                return False
            with open(local_path, 'rb') as f:
                files = {'file': (os.path.basename(local_path), f)}
                data = {'path': relative_path, 'device_name': device_name}
                resp = self._request('POST', '/api/sync/resolve-conflict', files=files, data=data)
                return resp is not None and resp.status_code == 200
        except Exception as e:
            print(f"[Hata] Çakışma çözülemedi ({relative_path}): {e}")
            return False
