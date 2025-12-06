"""
CORS configuration for the Flask ML API
This file contains CORS settings to allow the React frontend to communicate with the Flask API
"""

from flask_cors import CORS
from functools import wraps
from flask import request, jsonify
import os

# Try to import flask-limiter (optional dependency)
try:
    from flask_limiter import Limiter  # type: ignore
    from flask_limiter.util import get_remote_address  # type: ignore
    HAS_FLASK_LIMITER = True
except ImportError:
    Limiter = None  # type: ignore
    get_remote_address = None  # type: ignore
    HAS_FLASK_LIMITER = False

# Global limiter instance (initialized in configure_cors)
limiter = None

def get_api_key():
    """Get the API key from environment variable"""
    return os.getenv('ML_API_KEY')

def require_api_key(f):
    """
    Decorator to require API key for protected endpoints.
    Checks for API key in X-API-Key header or Authorization: Bearer header.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        api_key = get_api_key()
        
        # Skip API key check if not configured (development mode)
        if not api_key:
            return f(*args, **kwargs)
        
        # Check X-API-Key header first
        provided_key = request.headers.get('X-API-Key')
        
        # Fallback to Authorization: Bearer header
        if not provided_key:
            auth_header = request.headers.get('Authorization', '')
            if auth_header.startswith('Bearer '):
                provided_key = auth_header[7:]  # Remove 'Bearer ' prefix
        
        if not provided_key:
            return jsonify({
                'error': 'API key required',
                'message': 'Please provide API key via X-API-Key header or Authorization: Bearer header'
            }), 401
        
        if provided_key != api_key:
            return jsonify({
                'error': 'Invalid API key',
                'message': 'The provided API key is not valid'
            }), 403
        
        return f(*args, **kwargs)
    return decorated_function

def configure_cors(app):
    """
    Configure CORS, Rate Limiting, and Security Headers for the Flask application
    """
    global limiter
    
    is_production = os.getenv("FLASK_ENV") == "production"
    
    # ==================== CORS Configuration ====================
    if is_production:
        # Production: Use allowed origins from environment variable
        allowed_origins_str = os.getenv('ML_API_ALLOWED_ORIGINS', '')
        if not allowed_origins_str:
            raise ValueError("ML_API_ALLOWED_ORIGINS environment variable must be set in production")
        
        # Split comma-separated origins and strip whitespace
        allowed_origins = [origin.strip() for origin in allowed_origins_str.split(',') if origin.strip()]
        if not allowed_origins:
            raise ValueError("ML_API_ALLOWED_ORIGINS must contain at least one origin")
        
        CORS(app, origins=allowed_origins,
             methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"], 
             allow_headers=["Content-Type", "Authorization", "X-Requested-With", "X-API-Key"],
             supports_credentials=True)
    else:
        # Development: Allow localhost and local network IPs
        CORS(app, origins=[
            "http://localhost:3000",  # React dev server
            "http://localhost:5173",  # Vite dev server
            "http://localhost:8080",  # Alternative dev server
            r"http://192\.168\.\d+\.\d+:\d+",  # Local network IPs
            r"http://10\.\d+\.\d+\.\d+:\d+",   # Private network IPs
            r"http://172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+:\d+",  # Private network IPs
        ], methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"], 
        allow_headers=["Content-Type", "Authorization", "X-Requested-With", "X-API-Key"],
        supports_credentials=True,
        regex=True)
    
    # ==================== Rate Limiting ====================
    global limiter
    if HAS_FLASK_LIMITER:
        try:
            limiter = Limiter(
                key_func=get_remote_address,
                app=app,
                default_limits=["1000 per hour"],  # Global default
                storage_uri="memory://",  # In-memory storage (use Redis for multi-instance)
                strategy="fixed-window",
                headers_enabled=True  # Include rate limit info in response headers
            )
        except Exception as e:
            print(f"Warning: Failed to initialize rate limiter: {e}")
            limiter = None
    else:
        print("Warning: flask-limiter not installed. Rate limiting disabled.")
        limiter = None
    
    # ==================== Security Headers ====================
    @app.after_request
    def add_security_headers(response):
        # Prevent MIME type sniffing
        response.headers['X-Content-Type-Options'] = 'nosniff'
        # Prevent clickjacking
        response.headers['X-Frame-Options'] = 'DENY'
        # XSS Protection
        response.headers['X-XSS-Protection'] = '1; mode=block'
        # Content Security Policy
        response.headers['Content-Security-Policy'] = "default-src 'self'"
        # HSTS (only in production with HTTPS)
        if is_production:
            response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
        return response
    
    return app

def get_limiter():
    """Get the limiter instance for use in route decorators"""
    return limiter

def rate_limit(limit_string):
    """Helper decorator to conditionally apply rate limiting"""
    def decorator(f):
        if limiter:
            return limiter.limit(limit_string)(f)
        return f
    return decorator
