# How to Deploy Convex Functions

## Quick Answer: Two Options

### Option 1: Manual Deploy (Recommended - Fastest) ⚡

Just run this command in your terminal:

```bash
npx convex deploy
```

This will:
- Deploy all your `convex/` directory changes
- Push to your production Convex deployment (`brainy-flamingo-145`)
- Only takes 30-60 seconds

**After running this command, your code changes are live!**

---

### Option 2: Push to GitHub (If You Have Auto-Deploy Setup)

1. **Commit your changes:**
   ```bash
   git add .
   git commit -m "Fix Resend email to use domain from environment variable"
   ```

2. **Push to GitHub:**
   ```bash
   git push
   ```

3. **Check if Convex auto-deploys:**
   - Go to [Convex Dashboard](https://dashboard.convex.dev)
   - Check if you have GitHub integration enabled
   - If enabled, it will auto-deploy on push
   - If not enabled, you'll need to use Option 1

---

## ⚠️ Important: Environment Variables Are Separate!

**Code deployment** (Options 1 or 2) only deploys your code.

**Environment variables** are set separately in the Convex Dashboard:

1. Go to [Convex Dashboard](https://dashboard.convex.dev/d/brainy-flamingo-145)
2. Settings → Environment Variables
3. **Select your Production environment** (not Development!)
4. Add/Update: `RESEND_FROM_EMAIL = "Diabetes Risk Prediction <noreply@yourdomain.com>"`

**Environment variables don't require a code deploy** - they take effect immediately after saving in the dashboard.

---

## 📋 Complete Deployment Checklist

### Step 1: Set Environment Variable (Do this FIRST)
- [ ] Go to Convex Dashboard → Production
- [ ] Settings → Environment Variables  
- [ ] Add `RESEND_FROM_EMAIL = "Diabetes Risk Prediction <noreply@yourdomain.com>"`
- [ ] Replace `yourdomain.com` with your verified Resend domain

### Step 2: Deploy Code Changes
- [ ] Run `npx convex deploy` OR push to GitHub (if auto-deploy enabled)

### Step 3: Verify
- [ ] Try sending a verification email from your app
- [ ] Check that it works without the 403 error

---

## 🎯 Recommended Approach

**For this fix, do this:**

1. **First:** Set `RESEND_FROM_EMAIL` in Convex Dashboard (takes effect immediately)
2. **Then:** Run `npx convex deploy` (deploys the code fix)

**Total time: ~2 minutes** ⏱️

---

## 🔍 Check Your Deployment Status

After deploying, you can check the status at:
- [Convex Dashboard → Deployments](https://dashboard.convex.dev/d/brainy-flamingo-145/deployments)

You'll see your latest deployment with a timestamp.

---

## 💡 Pro Tip

You can also use:
```bash
npx convex dev --once
```

This runs one-time deployment (same as `npx convex deploy`) and then exits. Useful if you're used to running `convex dev` in development.
