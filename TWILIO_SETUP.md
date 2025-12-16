# Twilio SMS Setup Guide

## ✅ Installation Complete
The Twilio SDK has been installed and integrated into the codebase.

## Step 1: Add Twilio Credentials to Convex Dashboard

1. Go to your [Convex Dashboard](https://dashboard.convex.dev)
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Add the following three environment variables:

### Variable 1: TWILIO_ACCOUNT_SID
- **Name**: `TWILIO_ACCOUNT_SID`
- **Value**: `AC3108b1bb48595320b841a06f0e0bdcdc`
- Click **Save**

### Variable 2: TWILIO_AUTH_TOKEN
- **Name**: `TWILIO_AUTH_TOKEN`
- **Value**: `c0d1d8a5d9bbe804dba9a2935ee99f54`
- Click **Save**

### Variable 3: TWILIO_PHONE_NUMBER
- **Name**: `TWILIO_PHONE_NUMBER`
- **Value**: `+12524866123`
- Click **Save**

## Step 2: Restart Convex Dev Server

If you're running `npx convex dev`, restart it to load the new environment variables:
1. Stop the current dev server (Ctrl+C)
2. Run `npx convex dev` again

## Step 3: Test SMS Sending

1. Enable SMS 2FA in your profile settings
2. Try to sign in - you should receive an SMS code
3. Check your phone for the verification code
4. Enter the code to complete verification

## How It Works

- **Phone Number Format**: The system automatically adds the Oman country code (+968) if not present
- **Message Format**: "Your Diabetes Risk Prediction System verification code is: [CODE]. This code expires in 10 minutes."
- **Fallback**: If Twilio fails, the code will be logged to the console (development mode)

## Troubleshooting

### SMS Not Received?

1. **Check Twilio Console**
   - Go to [Twilio Console](https://console.twilio.com)
   - Check **Monitor** → **Logs** → **Messaging** to see if SMS was sent
   - Look for any error messages

2. **Verify Phone Number Format**
   - Phone numbers should be 8 digits for Oman (e.g., `12345678`)
   - The system automatically adds `+968` prefix
   - Make sure the phone number in your profile is correct

3. **Check Environment Variables**
   - Verify all three variables are set in Convex dashboard
   - Make sure there are no extra spaces in the values
   - Restart `convex dev` after adding variables

4. **Twilio Account Status**
   - Check if your Twilio account is active
   - Verify you have credits/balance in your Twilio account
   - Trial accounts have restrictions on which numbers can receive SMS

5. **Check Console Logs**
   - Look at Convex dashboard logs for any errors
   - Check browser console for error messages

### Common Errors

- **"Failed to send SMS via Twilio"** → Check Twilio credentials and account status
- **"Invalid phone number"** → Verify phone number format in user profile
- **"Unauthorized"** → Check TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN
- **"The number is unverified"** (Trial account) → Verify the number in Twilio console or upgrade account

### Trial Account Limitations

If you're using a Twilio trial account:
- You can only send SMS to **verified phone numbers**
- Go to [Twilio Console](https://console.twilio.com) → **Phone Numbers** → **Manage** → **Verified Caller IDs**
- Add and verify your phone number there
- After verification, you can receive SMS codes

### Production Considerations

1. **Upgrade Twilio Account**: Trial accounts have limitations
2. **Phone Number Verification**: Set up number verification for production
3. **Rate Limiting**: Consider implementing rate limits to prevent abuse
4. **Cost Monitoring**: Monitor SMS usage and set up billing alerts
5. **Error Handling**: The system falls back to console logging if SMS fails

## Cost Information

- Twilio SMS pricing: ~$0.0075 per SMS in most countries
- Monitor usage in Twilio dashboard
- Set up billing alerts to avoid unexpected charges

## Security Notes

⚠️ **Important**: The credentials above are now in this file. For production:
- Never commit `.env.local` or this file to version control
- Use Convex environment variables (which are secure)
- Rotate credentials if they're ever exposed
- Consider using Twilio API keys instead of Auth Token for better security

## Next Steps

1. ✅ Twilio SDK installed
2. ✅ Code updated to use Twilio
3. ⏳ Add environment variables to Convex dashboard (do this now!)
4. ⏳ Test SMS sending
5. ⏳ Verify phone numbers work correctly









