@echo off
echo ========================================
echo Mobile Testing Connection Helper
echo ========================================
echo.
echo This script helps you test mobile access to your dev server.
echo.
echo Your current IP address:
ipconfig | findstr "IPv4"
echo.
echo ========================================
echo Testing Steps:
echo ========================================
echo.
echo 1. Make sure your dev server is running:
echo    npm run dev
echo.
echo 2. On your Samsung phone:
echo    - Connect to the SAME WiFi network
echo    - Open browser
echo    - Go to: http://YOUR_IP:5173
echo    (Replace YOUR_IP with the IPv4 address above)
echo.
echo 3. If you can't connect:
echo    - Check Windows Firewall (see MOBILE_TESTING_GUIDE.md)
echo    - Verify both devices on same WiFi
echo    - Try the IP address shown above
echo.
echo ========================================
echo Press any key to exit...
pause >nul







