#!/usr/bin/env python3
"""
TrainLog Server Launcher GUI
Simple GUI for running and stopping the TrainLog development server
"""

import tkinter as tk
from tkinter import ttk, messagebox
import socket
import subprocess
import threading
import os
import sys
from pathlib import Path


class ServerLauncherGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("TrainLog Server Launcher")
        self.root.geometry("500x400")
        self.root.resizable(False, False)
        
        # Configure style
        style = ttk.Style()
        style.theme_use('clam')
        
        self.server_process = None
        self.is_running = False
        self.port = 8000
        
        # Get project root
        self.project_root = Path(__file__).parent
        
        self._create_widgets()
        self._update_status()
        
    def _create_widgets(self):
        """Create GUI widgets"""
        
        # Main frame
        main_frame = ttk.Frame(self.root, padding="20")
        main_frame.pack(fill=tk.BOTH, expand=True)
        
        # Title
        title_label = ttk.Label(
            main_frame,
            text="TrainLog Server",
            font=("Arial", 18, "bold")
        )
        title_label.pack(pady=(0, 20))
        
        # Status frame
        status_frame = ttk.LabelFrame(main_frame, text="Server Status", padding="10")
        status_frame.pack(fill=tk.X, pady=(0, 15))
        
        status_row = ttk.Frame(status_frame)
        status_row.pack(fill=tk.X, pady=5)
        
        ttk.Label(status_row, text="Status:").pack(side=tk.LEFT)
        self.status_label = ttk.Label(
            status_row,
            text="Stopped",
            foreground="red",
            font=("Arial", 12, "bold")
        )
        self.status_label.pack(side=tk.LEFT, padx=10)
        
        # Port frame
        port_row = ttk.Frame(status_frame)
        port_row.pack(fill=tk.X, pady=5)
        ttk.Label(port_row, text="Port:").pack(side=tk.LEFT)
        ttk.Label(port_row, text=f"{self.port}").pack(side=tk.LEFT, padx=10)
        
        # Project path frame
        path_row = ttk.Frame(status_frame)
        path_row.pack(fill=tk.X, pady=5)
        ttk.Label(path_row, text="Project:").pack(side=tk.LEFT)
        ttk.Label(path_row, text=str(self.project_root)).pack(side=tk.LEFT, padx=10)
        
        # Control buttons frame
        control_frame = ttk.Frame(main_frame)
        control_frame.pack(fill=tk.X, pady=(0, 15))
        
        self.start_button = ttk.Button(
            control_frame,
            text="▶ Start Server",
            command=self._start_server,
            width=20
        )
        self.start_button.pack(side=tk.LEFT, padx=5)
        
        self.stop_button = ttk.Button(
            control_frame,
            text="⏹ Stop Server",
            command=self._stop_server,
            width=20,
            state=tk.DISABLED
        )
        self.stop_button.pack(side=tk.LEFT, padx=5)
        
        # Address frame
        address_frame = ttk.LabelFrame(main_frame, text="Access Address", padding="10")
        address_frame.pack(fill=tk.BOTH, expand=True, pady=(0, 15))
        
        # IP address display
        ip_row = ttk.Frame(address_frame)
        ip_row.pack(fill=tk.X, pady=(0, 10))
        
        ttk.Label(ip_row, text="Local IP:").pack(side=tk.LEFT, padx=(0, 5))
        self.ip_var = tk.StringVar(value="detecting...")
        self.ip_label = ttk.Label(
            ip_row,
            textvariable=self.ip_var,
            font=("Courier", 11),
            foreground="blue"
        )
        self.ip_label.pack(side=tk.LEFT, padx=5)
        
        # Full address
        url_row = ttk.Frame(address_frame)
        url_row.pack(fill=tk.X, pady=(0, 10))
        
        ttk.Label(url_row, text="Full URL:").pack(side=tk.LEFT, pady=(10, 0))
        
        url_display_row = ttk.Frame(address_frame)
        url_display_row.pack(fill=tk.X, pady=(0, 10))
        
        self.url_var = tk.StringVar(value="http://IP:8000")
        url_entry = ttk.Entry(
            url_display_row,
            textvariable=self.url_var,
            font=("Courier", 10),
            state=tk.DISABLED,
            width=50
        )
        url_entry.pack(side=tk.LEFT, padx=(5, 5), fill=tk.X, expand=True)
        
        copy_button = ttk.Button(
            url_display_row,
            text="📋 Copy",
            command=self._copy_to_clipboard,
            width=8
        )
        copy_button.pack(side=tk.LEFT, padx=5)
        
        # Info text
        info_text = ttk.Label(
            address_frame,
            text="Open this address in your phone's browser\n(must be on the same WiFi network)",
            foreground="gray",
            font=("Arial", 9)
        )
        info_text.pack(pady=10)
        
        # Footer
        footer_frame = ttk.Frame(main_frame)
        footer_frame.pack(fill=tk.X)
        
        ttk.Button(
            footer_frame,
            text="Open in Browser",
            command=self._open_browser,
            width=20
        ).pack(side=tk.LEFT, padx=5)
        
        ttk.Button(
            footer_frame,
            text="Quit",
            command=self.root.quit,
            width=20
        ).pack(side=tk.LEFT, padx=5)
        
        # Get IP address in background
        threading.Thread(target=self._detect_ip, daemon=True).start()
    
    def _detect_ip(self):
        """Detect local IP address"""
        try:
            # Connect to a public DNS to determine local IP
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
        except Exception:
            try:
                # Fallback: use localhost
                ip = socket.gethostbyname(socket.gethostname())
            except Exception:
                ip = "127.0.0.1"
        
        self.ip_var.set(ip)
        self._update_url()
    
    def _update_url(self):
        """Update the full URL display"""
        ip = self.ip_var.get()
        if ip != "detecting...":
            url = f"http://{ip}:{self.port}"
            self.url_var.set(url)
    
    def _start_server(self):
        """Start the development server"""
        if self.is_running:
            messagebox.showwarning("Server", "Server is already running!")
            return
        
        try:
            # Start Python HTTP server
            self.server_process = subprocess.Popen(
                [sys.executable, "-m", "http.server", str(self.port)],
                cwd=str(self.project_root),
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            self.is_running = True
            self._update_status()
            messagebox.showinfo("Success", f"Server started on port {self.port}")
        except Exception as e:
            messagebox.showerror("Error", f"Failed to start server:\n{str(e)}")
    
    def _stop_server(self):
        """Stop the development server"""
        if not self.is_running or not self.server_process:
            messagebox.showwarning("Server", "Server is not running!")
            return
        
        try:
            self.server_process.terminate()
            self.server_process.wait(timeout=5)
            self.is_running = False
            self._update_status()
            messagebox.showinfo("Success", "Server stopped")
        except subprocess.TimeoutExpired:
            self.server_process.kill()
            self.is_running = False
            self._update_status()
            messagebox.showinfo("Success", "Server force-stopped")
        except Exception as e:
            messagebox.showerror("Error", f"Failed to stop server:\n{str(e)}")
    
    def _update_status(self):
        """Update status display and button states"""
        if self.is_running:
            self.status_label.config(text="Running ✓", foreground="green")
            self.start_button.config(state=tk.DISABLED)
            self.stop_button.config(state=tk.NORMAL)
        else:
            self.status_label.config(text="Stopped", foreground="red")
            self.start_button.config(state=tk.NORMAL)
            self.stop_button.config(state=tk.DISABLED)
    
    def _copy_to_clipboard(self):
        """Copy URL to clipboard"""
        url = self.url_var.get()
        if url and url != "http://IP:8000":
            self.root.clipboard_clear()
            self.root.clipboard_append(url)
            self.root.update()
            messagebox.showinfo("Copied", f"Address copied:\n{url}")
        else:
            messagebox.showwarning("Not Ready", "IP address is not detected yet")
    
    def _open_browser(self):
        """Open the server URL in the default browser"""
        url = self.url_var.get()
        if not self.is_running:
            messagebox.showwarning("Server", "Server is not running!")
            return
        
        if url and url != "http://IP:8000":
            import webbrowser
            webbrowser.open(url)
        else:
            messagebox.showwarning("Not Ready", "IP address is not detected yet")


def main():
    root = tk.Tk()
    app = ServerLauncherGUI(root)
    root.mainloop()


if __name__ == "__main__":
    main()
