import os
import sys
import shutil
import json
import time

sys.path.insert(0, os.path.abspath('sync-agent'))
from agent import CloudSyncAgent

def run_tests():
    # Clean up test directories
    test_dir_a = os.path.abspath('scratch/test_computer_a')
    test_dir_b = os.path.abspath('scratch/test_computer_b')
    os.makedirs(test_dir_a, exist_ok=True)
    os.makedirs(test_dir_b, exist_ok=True)

    # Config for Computer A
    config_a = {
        'server_url': 'http://localhost:8080',
        'username': 'admin',
        'password': 'admin123',
        'device_name': 'Bilgisayar-A',
        'sync_folders': [{'local_path': test_dir_a, 'remote_path': ''}],
        'sync_interval_seconds': 5,
        'ignored_patterns': ['*.tmp']
    }
    with open('scratch/config_a.json', 'w', encoding='utf-8') as f:
        json.dump(config_a, f)

    # Config for Computer B
    config_b = {
        'server_url': 'http://localhost:8080',
        'username': 'admin',
        'password': 'admin123',
        'device_name': 'Bilgisayar-B',
        'sync_folders': [{'local_path': test_dir_b, 'remote_path': ''}],
        'sync_interval_seconds': 5,
        'ignored_patterns': ['*.tmp']
    }
    with open('scratch/config_b.json', 'w', encoding='utf-8') as f:
        json.dump(config_b, f)

    agent_a = CloudSyncAgent('scratch/config_a.json')
    agent_b = CloudSyncAgent('scratch/config_b.json')

    if not agent_a.client.login():
        print("Agent A login failed")
        return False
    if not agent_b.client.login():
        print("Agent B login failed")
        return False

    print(">>> TEST 1: Bilgisayar A dosya olusturuyor ve sunucuya senkronize ediyor...")
    with open(os.path.join(test_dir_a, 'proje_raporu.txt'), 'w', encoding='utf-8') as f:
        f.write('Proje surum 1.0 - Bilgisayar A tarafindan hazirlandi.')
    agent_a.sync_once()

    print("\n>>> TEST 2: Bilgisayar B sunucudaki dosyalari cekiyor...")
    agent_b.sync_once()
    b_file = os.path.join(test_dir_b, 'proje_raporu.txt')
    if not os.path.exists(b_file):
        print("HATA: Dosya Bilgisayar B'ye inmedi!")
        return False
    with open(b_file, 'r', encoding='utf-8') as f:
        print("Bilgisayar B'deki icerik:", f.read())

    print("\n>>> TEST 3: Bilgisayar B dosyayi duzenliyor ve sunucuya gonderiyor...")
    with open(b_file, 'w', encoding='utf-8') as f:
        f.write('Proje surum 1.1 - Bilgisayar B tarafindan guncellendi.')
    agent_b.sync_once()

    print("\n>>> TEST 4: Bilgisayar A guncellemeyi sunucudan cekiyor...")
    agent_a.sync_once()
    with open(os.path.join(test_dir_a, 'proje_raporu.txt'), 'r', encoding='utf-8') as f:
        content_a = f.read()
        print("Bilgisayar A'daki yeni icerik:", content_a)
        if 'surum 1.1' not in content_a:
            print("HATA: Bilgisayar A güncellemeyi alamadı!")
            return False

    print("\n>>> TEST 5: Alt klasor ve coklu dosya senkronizasyonu...")
    sub_a = os.path.join(test_dir_a, 'kodlar')
    os.makedirs(sub_a, exist_ok=True)
    with open(os.path.join(sub_a, 'script.py'), 'w', encoding='utf-8') as f:
        f.write("print('Hello from CloudSync')")
    agent_a.sync_once()
    agent_b.sync_once()
    sub_b_file = os.path.join(test_dir_b, 'kodlar', 'script.py')
    if not os.path.exists(sub_b_file):
        print("HATA: Alt klasor ve dosya Bilgisayar B'ye inmedi!")
        return False
    print("Alt klasor ve dosya basariyla Bilgisayar B'ye esitlendi.")

    print("=== TUM COKLU BILGISAYAR SENKRONIZASYON TESTLERI BASARILI! ===")
    return True

if __name__ == '__main__':
    run_tests()
