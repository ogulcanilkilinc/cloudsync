import os
import threading
import fnmatch
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

class DebouncedEventHandler(FileSystemEventHandler):
    def __init__(self, callback, debounce_seconds=2.0, ignore_patterns=None):
        self.callback = callback
        self.debounce_seconds = debounce_seconds
        self.ignore_patterns = ignore_patterns or []
        self.timers = {}
        self.lock = threading.Lock()

    def _is_ignored(self, path):
        basename = os.path.basename(path)
        for pattern in self.ignore_patterns:
            if fnmatch.fnmatch(basename, pattern) or fnmatch.fnmatch(path, pattern):
                return True
        return False

    def _handle_event(self, event_type, src_path, dest_path=None):
        if self._is_ignored(src_path) or (dest_path and self._is_ignored(dest_path)):
            return
        
        with self.lock:
            if src_path in self.timers:
                self.timers[src_path].cancel()
            
            def trigger():
                with self.lock:
                    if src_path in self.timers:
                        del self.timers[src_path]
                self.callback(event_type, src_path, dest_path)

            timer = threading.Timer(self.debounce_seconds, trigger)
            self.timers[src_path] = timer
            timer.start()

    def on_created(self, event):
        if not event.is_directory:
            self._handle_event('created', event.src_path)

    def on_modified(self, event):
        if not event.is_directory:
            self._handle_event('modified', event.src_path)

    def on_deleted(self, event):
        if not event.is_directory:
            self._handle_event('deleted', event.src_path)

    def on_moved(self, event):
        if not event.is_directory:
            self._handle_event('moved', event.src_path, event.dest_path)

class FolderWatcher:
    def __init__(self, paths_to_watch: list[str], callback, ignore_patterns=None):
        self.paths_to_watch = paths_to_watch
        self.callback = callback
        self.ignore_patterns = ignore_patterns or ["*.tmp", "*.swp", "~*", "*.part", "__pycache__", ".git", ".DS_Store", "Thumbs.db"]
        self.observer = Observer()
        self.handler = DebouncedEventHandler(self.callback, 2.0, self.ignore_patterns)

    def start(self):
        for path in self.paths_to_watch:
            if os.path.exists(path):
                self.observer.schedule(self.handler, path, recursive=True)
        self.observer.start()

    def stop(self):
        self.observer.stop()
        self.observer.join()
