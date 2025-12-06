# Resend Email Setup Guide

## Problem
If emails are not being received, it's likely because the Resend API key is not configured in your Convex environment.

## Solution

### Step 1: Get Your Resend API Key
1. Go to [Resend.com](https://resend.com) and sign up/login
2. Navigate to **API Keys** in your dashboard
3. Create a new API key (or use an existing one)
4. Copy the API key (it starts with `re_`)

### Step 2: Add API Key to Convex
1. Go to your [Convex Dashboard](https://dashboard.convex.dev)
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Click **Add Variable**
5. Name: `RESEND_API_KEY`
6. Value: Paste your Resend API key (e.g., `re_xxxxxxxxxxxxx`)
7. Click **Save**

### Step 3: Redeploy/Restart
- If using `npx convex dev`, restart it
- If deployed, the changes will take effect automatically

### Step 4: Test Email Sending
1. Try the password reset feature again
2. Check your email inbox (and spam folder)
3. Check the Convex dashboard logs for any errors

## Using Your Own Domain (Optional but Recommended)

For production, you should use your own domain instead of `onboarding@resend.dev`:

1. In Resend dashboard, go to **Domains**
2. Add your domain (e.g., `yourdomain.com`)
3. Add the DNS records Resend provides to your domain registrar
4. Wait for verification (usually takes a few minutes)
5. Update the `from` field in `convex/emails.ts`:
   ```typescript
   from: "Diabetes Risk Prediction <noreply@yourdomain.com>"
   ```

## Troubleshooting

### Emails not received?
1. **Check spam folder** - Emails from `onboarding@resend.dev` might go to spam
2. **Check Convex logs** - Look for error messages in the Convex dashboard
3. **Verify API key** - Make sure `RESEND_API_KEY` is set correctly in Convex
4. **Check Resend dashboard** - Go to Resend → Logs to see if emails were sent
5. **Test with a different email** - Try with Gmail, Outlook, etc.

### Common Errors:
- **"API key not found"** → API key not set in Convex environment variables
- **"Domain not verified"** → Using custom domain without verification
- **"Rate limit exceeded"** → Too many emails sent (free tier has limits)

## Free Tier Limits
Resend free tier includes:
- 3,000 emails/month
- 100 emails/day
- Test domain (`onboarding@resend.dev`) works for testing

For production, consider upgrading or using your own domain.










