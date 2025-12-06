"""
Main entry point for Railway deployment
This file imports the Flask app so Railway/gunicorn can find it
"""
from app import app

# Export the app for gunicorn
application = app

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
