# API Key Authentication Setup Complete ✅

## What Was Implemented

### 1. ✅ Frontend Updates (`src/utils/mlApiClient.ts`)
- Added API key support to all API requests
- Reads API key from `VITE_ML_API_KEY` environment variable
- Automatically includes `X-API-Key` header in all requests

### 2. ✅ Backend Security (`ml-model/cors_config.py`)
- Added `require_api_key` decorator for endpoint protection
- Added rate limiting with `flask-limiter`
- Added security headers (X-Content-Type-Options, X-Frame-Options, etc.)
- CORS configured to allow `X-API-Key` header

### 3. ✅ API Endpoints Protected (`ml-model/app.py`)
- `/predict` - Rate limited: 20 requests/minute, requires API key
- `/batch_predict` - Rate limited: 5 requests/minute, requires API key  
- `/model/info` - Requires API key
- `/health` - Public (no API key required)

## 🔧 Setup Instructions

### Railway (ML API) Environment Variables

Already set:
- ✅ `ML_API_KEY` - Your API key (e.g., `7PfV1mnHzTbbM6cPaThVvq9SEEjNaXBnM`)
- ✅ `ML_API_ALLOWED_ORIGINS` - Your domains
- ✅ `FLASK_ENV=production`
- ✅ `FLASK_DEBUG=false`

**No changes needed!** ✅

---

### Vercel (Frontend) Environment Variables

**You need to add:**

1. Go to **Vercel Dashboard → Your Project → Settings → Environment Variables**

2. Add **TWO** variables:

   **Variable 1:**
   - **Name**: `VITE_ML_API_URL`
   - **Value**: Your Railway service URL (e.g., `https://diabetes-risk-prediction-system.up.railway.app`)
   - **Environments**: Production, Preview, Development

   **Variable 2:**
   - **Name**: `VITE_ML_API_KEY`
   - **Value**: Same value as Railway's `ML_API_KEY` (e.g., `7PfV1mnHzTbbM6cPaThVvq9SEEjNaXBnM`)
   - **Environments**: Production, Preview, Development

3. **After adding variables, redeploy your Vercel site** so it picks up the new environment variables.

---

## 🚀 Deployment Steps

### Step 1: Install Dependencies (Railway)
Railway should auto-install, but if needed:
```bash
pip install flask-limiter
```

### Step 2: Deploy Code Changes
```bash
git add .
git commit -m "Add API key authentication and rate limiting"
git push
```

Railway will auto-deploy. Check Railway logs to ensure flask-limiter is installed.

### Step 3: Set Vercel Environment Variables
- Add `VITE_ML_API_URL` (Railway service URL)
- Add `VITE_ML_API_KEY` (same as Railway `ML_API_KEY`)
- Redeploy Vercel site

### Step 4: Test
1. Try creating a new assessment
2. Should work without NetworkError
3. Check browser DevTools → Network tab to verify API key header is sent

---

## 🔐 Security Features

### Rate Limiting
- **Global**: 1000 requests/hour
- **/predict**: 20 requests/minute per IP
- **/batch_predict**: 5 requests/minute per IP
- **/health**: No rate limit (public endpoint)

### API Key Authentication
- Required for `/predict`, `/batch_predict`, `/model/info`
- Not required for `/health` (public health check)
- Supports `X-API-Key` header or `Authorization: Bearer <key>`
- Skipped in development if `ML_API_KEY` not set

### Security Headers
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security` (production only)
- `Content-Security-Policy`

---

## 🐛 Troubleshooting

### Error: "API key required"
**Cause**: Frontend not sending API key  
**Fix**: 
- Check `VITE_ML_API_KEY` is set in Vercel
- Redeploy Vercel site after adding the variable
- Check browser console for errors

### Error: "Invalid API key"
**Cause**: API key mismatch  
**Fix**: 
- Verify `VITE_ML_API_KEY` in Vercel matches `ML_API_KEY` in Railway
- Both should be exactly the same value

### Error: "Rate limit exceeded"
**Cause**: Too many requests  
**Fix**: 
- Wait for rate limit window to reset
- `/predict`: 20/minute
- `/batch_predict`: 5/minute

### Error: ModuleNotFoundError: flask_limiter
**Cause**: flask-limiter not installed  
**Fix**: 
- Check Railway logs
- Add `flask-limiter>=3.5.0` to `requirements.txt` (already done)
- Redeploy Railway service

---

## ✅ Verification Checklist

- [ ] `VITE_ML_API_URL` set in Vercel
- [ ] `VITE_ML_API_KEY` set in Vercel (matches Railway `ML_API_KEY`)
- [ ] Code changes pushed to GitHub
- [ ] Railway service redeployed
- [ ] Vercel site redeployed
- [ ] Test assessment creation works
- [ ] Check browser DevTools → Network → Headers to verify `X-API-Key` is sent

---

**After completing these steps, your API will be secure with authentication and rate limiting!** 🎉
