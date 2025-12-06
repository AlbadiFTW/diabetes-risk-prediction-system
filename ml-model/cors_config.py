"""
CORS configuration for the Flask ML API
This file contains CORS settings to allow the React frontend to communicate with the Flask API
"""

from flask_cors import CORS

def configure_cors(app):
    """
    Configure CORS for the Flask application
    """
    # For development: Allow all local network IPs (192.168.x.x, 10.x.x.x, etc.)
    # For production: Use specific origins
    import os
    is_production = os.getenv("FLASK_ENV") == "production"
    
    if is_production:
        # Production: Only allow specific domains
        CORS(app, origins=[
            "https://your-production-domain.com"  # Update with your production domain
        ], methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"], 
        allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
        supports_credentials=True)
    else:
        # Development: Allow localhost and local network IPs
        # This allows mobile testing on the same network
        CORS(app, origins=[
            "http://localhost:3000",  # React dev server
            "http://localhost:5173",  # Vite dev server
            "http://localhost:8080",  # Alternative dev server
            # Allow all local network IPs (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
            r"http://192\.168\.\d+\.\d+:\d+",  # Local network IPs
            r"http://10\.\d+\.\d+\.\d+:\d+",   # Private network IPs
            r"http://172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+:\d+",  # Private network IPs
        ], methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"], 
        allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
        supports_credentials=True,
        regex=True)  # Enable regex matching for origins
    
    return app
