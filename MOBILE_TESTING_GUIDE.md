# Mobile Testing Guide

## Testing Your Site on Samsung Phone

### Prerequisites
1. ✅ Your laptop and phone must be on the **same WiFi network**
2. ✅ Development server running on laptop
3. ✅ ML API running (if testing predictions)

### Step 1: Start Development Server

On your laptop, make sure the dev server is running:
```bash
npm run dev
```

The server should now be accessible from your network.

### Step 2: Find Your Laptop's IP Address

Your IP address is: **192.168.31.117** (from the network scan)

If this changes, you can find it again by running:
```bash
ipconfig
```
Look for "IPv4 Address" under "Wireless LAN adapter Wi-Fi"

### Step 3: Access from Your Samsung Phone

1. **Make sure your phone is on the same WiFi network** as your laptop
2. Open Chrome or Samsung Internet browser on your phone
3. Navigate to:
   ```
   http://192.168.31.117:5173
   ```
   (Replace with your actual IP if different)

### Step 4: Test the Application

Test these key features on mobile:
- [ ] Sign up / Sign in
- [ ] Profile creation
- [ ] Medical record form (check all inputs work)
- [ ] Dashboard navigation
- [ ] Charts and visualizations
- [ ] 2FA setup and verification
- [ ] SMS code reception (if testing SMS 2FA)
- [ ] Messaging system
- [ ] Profile page
- [ ] Data export

### Troubleshooting

#### Can't Connect from Phone

**Problem**: Phone can't reach the server

**Solutions**:
1. **Check WiFi**: Ensure both devices are on the same network
   - On phone: Settings → WiFi → Check network name matches laptop
   
2. **Check Firewall**: Windows Firewall might be blocking the connection
   - **Option A (Recommended)**: Allow Node.js through firewall
     - Press `Win + R`, type `wf.msc`, press Enter
     - Click "Inbound Rules" → "New Rule"
     - Select "Port" → Next
     - Select "TCP", enter port `5173` → Next
     - Select "Allow the connection" → Next
     - Check all profiles → Next
     - Name: "Vite Dev Server" → Finish
     - Repeat for port `5000` (ML API) if needed
   
   - **Option B (Quick Test)**: Temporarily disable firewall
     - Settings → Windows Security → Firewall & network protection
     - Turn off for Private network (temporarily for testing only!)
   
3. **Check IP Address**: IP might have changed, run `ipconfig` again
   - Look for "IPv4 Address" under "Wireless LAN adapter Wi-Fi"
   
4. **Test Connection**: From phone browser, try:
   - `http://192.168.31.117:5173` (frontend)
   - `http://192.168.31.117:5000/health` (ML API health check)
   
5. **Try Different Browser**: Try Chrome, Samsung Internet, or Firefox

#### ML API Not Working

**Problem**: Predictions fail on mobile

**Solution**: The ML API also needs to be accessible from your network
- Update `ml-model/app.py` to bind to `0.0.0.0` instead of `localhost`
- Access ML API at `http://192.168.31.117:5000`
- Update frontend ML API URL in your code if hardcoded

#### CORS Errors

**Problem**: Browser shows CORS errors

**Solution**: 
- Check `ml-model/cors_config.py` allows your phone's IP
- Or allow all origins for development: `CORS(app, resources={r"/*": {"origins": "*"}})`

### Alternative: Use ngrok (For Testing from Different Networks)

If you want to test from a different network (e.g., mobile data):

1. **Install ngrok**:
   ```bash
   npm install -g ngrok
   ```

2. **Start your dev server**:
   ```bash
   npm run dev
   ```

3. **In a new terminal, create tunnel**:
   ```bash
   ngrok http 5173
   ```

4. **Use the ngrok URL** on your phone (e.g., `https://abc123.ngrok.io`)

**Note**: Free ngrok URLs change each time. For production, use a proper domain.

### Mobile-Specific Testing Checklist

#### Touch Interactions
- [ ] All buttons are tappable (not too small)
- [ ] Forms are easy to fill on mobile
- [ ] Dropdowns work on touch
- [ ] Modals are properly sized
- [ ] Navigation is thumb-friendly

#### Responsive Design
- [ ] Text is readable without zooming
- [ ] Images scale properly
- [ ] Charts are viewable on small screens
- [ ] Tables scroll horizontally if needed
- [ ] No horizontal scrolling on pages

#### Performance
- [ ] Page loads quickly on mobile data
- [ ] Images are optimized
- [ ] Animations are smooth
- [ ] No lag when typing in forms

#### Samsung-Specific
- [ ] Works in Samsung Internet browser
- [ ] Works in Chrome on Samsung
- [ ] Keyboard doesn't cover inputs
- [ ] Back button works correctly

### Quick Test Commands

**Check if server is accessible**:
```bash
# From phone browser, try:
http://192.168.31.117:5173
```

**Check ML API**:
```bash
# From phone browser, try:
http://192.168.31.117:5000/health
```

**Find IP again**:
```bash
ipconfig | findstr "IPv4"
```

### Production Mobile Testing

For production, you'll deploy to a public URL, so mobile testing will be straightforward - just visit your production domain from your phone.

---

## Current Configuration

- **Your IP**: 192.168.31.117
- **Frontend Port**: 5173
- **ML API Port**: 5000 (if running)
- **Access URL**: http://192.168.31.117:5173
- **ML API URL**: http://192.168.31.117:5000 (automatically detected)

**Note**: 
- If your IP changes (e.g., after reconnecting to WiFi), you'll need to update the URL on your phone
- The ML API URL is automatically detected based on the URL you use to access the site
- If you access via `http://192.168.31.117:5173`, the ML API will automatically use `http://192.168.31.117:5000`

## Quick Start Steps

1. **On your laptop**, make sure both servers are running:
   ```bash
   # Terminal 1: Start frontend + backend
   npm run dev
   
   # Terminal 2: Start ML API (if testing predictions)
   cd ml-model
   python app.py
   ```

2. **On your Samsung phone**:
   - Connect to the same WiFi network
   - Open browser (Chrome or Samsung Internet)
   - Go to: `http://192.168.31.117:5173`
   - Start testing!

3. **If predictions don't work**, check:
   - ML API is running on your laptop
   - ML API is accessible at `http://192.168.31.117:5000/health` from phone
   - CORS is configured (already updated to allow network IPs)

