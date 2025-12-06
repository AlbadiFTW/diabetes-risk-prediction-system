# Fix NetworkError with Railway ML API

## ✅ What Was Fixed

1. **CORS Configuration**: Updated `ml-model/cors_config.py` to read from `ML_API_ALLOWED_ORIGINS` environment variable instead of hardcoded domain.

## 🔧 Complete Setup Checklist

### 1. Railway (ML API) - ✅ Already Done
- [x] `FLASK_ENV=production`
- [x] `FLASK_DEBUG=false`
- [x] `ML_API_ALLOWED_ORIGINS=https://drisk.app,https://www.drisk.app`
- [x] `ML_API_KEY` set

**Next Step:** After updating `cors_config.py`, redeploy your Railway service to apply the CORS fix.

---

### 2. Vercel (Frontend) - ⚠️ NEEDS SETUP

Your frontend needs to know the Railway API URL. Set this environment variable in Vercel:

1. Go to your Vercel project dashboard
2. **Settings → Environment Variables**
3. Add new variable:
   - **Name**: `VITE_ML_API_URL`
   - **Value**: Your Railway service URL
     - Format: `https://your-service-name.up.railway.app`
     - Or your custom domain if you set one up
   - **Environments**: Select **Production** (and Preview if needed)

4. **After adding the variable, redeploy your Vercel site** so it picks up the new environment variable.

---

### 3. Get Your Railway Service URL

1. Go to your Railway dashboard
2. Click on your service (diabetes-risk-prediction-system)
3. In the **Settings** tab, find **Domains** or **Service URL**
4. Copy the Railway-provided URL (format: `https://xxxxx.up.railway.app`)
5. Use this URL for `VITE_ML_API_URL` in Vercel

**OR** if you set up a custom domain for your Railway service, use that instead.

---

## 🚀 Deployment Steps

### Step 1: Update Railway (CORS Fix)
```bash
# In your project directory
git add ml-model/cors_config.py
git commit -m "Fix CORS to use ML_API_ALLOWED_ORIGINS environment variable"
git push
```

Railway will automatically redeploy when you push. Or manually trigger a redeploy from Railway dashboard.

### Step 2: Set Vercel Environment Variable
- Add `VITE_ML_API_URL` in Vercel dashboard
- Value = Your Railway service URL
- Redeploy Vercel site

### Step 3: Test
- Try creating a new assessment
- Check browser console for any errors
- Check Railway logs if issues persist

---

## 🐛 Troubleshooting

### Still Getting NetworkError?

1. **Check Railway Service is Running:**
   - Go to Railway dashboard
   - Verify service shows "Online" (green)
   - Check logs for any errors

2. **Verify CORS Origins Match:**
   - Railway `ML_API_ALLOWED_ORIGINS` must include your Vercel domain
   - If your Vercel site is at `https://drisk-app.vercel.app`, add it:
     ```
     ML_API_ALLOWED_ORIGINS=https://drisk.app,https://www.drisk.app,https://drisk-app.vercel.app
     ```

3. **Check VITE_ML_API_URL:**
   - Open browser DevTools → Network tab
   - Try an assessment
   - See what URL it's trying to fetch
   - Should match your Railway URL

4. **SSL/HTTPS Issues:**
   - Make sure Railway URL uses `https://` (not `http://`)
   - Browsers block mixed content (HTTP API from HTTPS site)

5. **Check Railway Logs:**
   - Railway dashboard → Your service → Logs
   - Look for CORS errors or other issues

---

## ✅ Quick Checklist

- [ ] Updated `cors_config.py` to use environment variable
- [ ] Committed and pushed changes to trigger Railway redeploy
- [ ] Set `VITE_ML_API_URL` in Vercel environment variables
- [ ] Redeployed Vercel site
- [ ] Verified Railway service is online
- [ ] Tested assessment creation

---

**After completing these steps, the NetworkError should be resolved!** 🎉
