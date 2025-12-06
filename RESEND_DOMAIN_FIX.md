# Resend Domain Configuration Fix

## ✅ What Was Fixed

All email functions now use the `RESEND_FROM_EMAIL` environment variable instead of the hardcoded `onboarding@resend.dev` address.

## 🔧 Setup Checklist

### 1. Verify Domain in Resend Dashboard

1. Go to [resend.com/domains](https://resend.com/domains)
2. Make sure your domain is **verified** (should show a green checkmark)
3. If not verified:
   - Click "Verify Domain"
   - Add the DNS records shown to your domain registrar (Cloudflare, etc.)
   - Wait for verification (can take a few minutes)

### 2. Set Environment Variable in Convex

**In Convex Dashboard → Production Environment:**

1. Go to **Settings → Environment Variables**
2. Add/Update: `RESEND_FROM_EMAIL`
3. **Value Format**: `"Diabetes Risk Prediction <noreply@yourdomain.com>"` 
   - Replace `yourdomain.com` with your actual verified domain
   - Example: `"Diabetes Risk Prediction <noreply@example.com>"`

### 3. Important Notes

- ✅ The email **MUST** use your verified domain (e.g., `@yourdomain.com`)
- ✅ Cannot use `@resend.dev` or Gmail addresses in production
- ✅ You can use any subdomain (noreply, mail, notifications, etc.) as long as it's on your verified domain

### 4. Test After Setup

After setting the environment variable:
1. **Deploy** your Convex changes (if any)
2. Try sending a verification email again
3. Check Convex logs for any errors

## 🐛 Troubleshooting

### Error: "You can only send testing emails..."

**Cause**: 
- Domain not verified in Resend, OR
- `RESEND_FROM_EMAIL` not set, OR  
- `RESEND_FROM_EMAIL` doesn't use your verified domain

**Fix**:
1. Check domain verification status in Resend dashboard
2. Verify `RESEND_FROM_EMAIL` is set in Convex Dashboard
3. Ensure the email uses your verified domain (e.g., `noreply@yourdomain.com`)

### Environment Variable Format

✅ **Correct**: `"Diabetes Risk Prediction <noreply@yourdomain.com>"`
✅ **Also Correct**: `"noreply@yourdomain.com"`
❌ **Wrong**: `"onboarding@resend.dev"`
❌ **Wrong**: `"projectekko1962@gmail.com"`

## 📋 Quick Setup Steps

```bash
# 1. Verify domain at resend.com/domains
# 2. In Convex Dashboard → Environment Variables:
RESEND_FROM_EMAIL = "Diabetes Risk Prediction <noreply@yourdomain.com>"
# 3. Deploy/restart your Convex functions
# 4. Test email sending
```

---

**After completing these steps, your emails should work!** 🎉
