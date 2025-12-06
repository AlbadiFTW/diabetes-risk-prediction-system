# SMS Integration Guide for Production

## Overview
Currently, SMS codes are logged to the console in development mode. To enable real SMS sending in production, you need to integrate with an SMS service provider.

## Recommended: Twilio Integration

### Step 1: Install Twilio SDK
```bash
npm install twilio
npm install --save-dev @types/twilio  # For TypeScript
```

### Step 2: Get Twilio Credentials
1. Sign up at https://www.twilio.com
2. Get your Account SID and Auth Token from the Twilio Console
3. Purchase a phone number (or use trial number for testing)

### Step 3: Add Environment Variables
Add to your `.env.local` file:
```
TWILIO_ACCOUNT_SID=your_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890  # Your Twilio phone number
```

### Step 4: Update the Code
In `convex/twoFactorAuthActions.ts`, find the `sendSMSCode` action and replace the TODO section with:

```typescript
import twilio from "twilio";

// ... in the handler function, after storing the code:

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

try {
  await client.messages.create({
    body: `Your Diabetes Risk Prediction System verification code is: ${code}. This code expires in 10 minutes.`,
    to: `+968${profile.phoneNumber}`, // Add country code for Oman (+968)
    from: process.env.TWILIO_PHONE_NUMBER,
  });
} catch (smsError: any) {
  console.error("Failed to send SMS:", smsError);
  return { 
    success: false, 
    error: "Failed to send SMS. Please try again later." 
  };
}
```

### Step 5: Remove Development Logging
Remove or comment out the console.log statements in the `sendSMSCode` action.

## Alternative: AWS SNS

### Step 1: Install AWS SDK
```bash
npm install @aws-sdk/client-sns
```

### Step 2: Configure AWS Credentials
Set up AWS credentials via environment variables or AWS credentials file.

### Step 3: Update Code
```typescript
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

const snsClient = new SNSClient({ region: "us-east-1" }); // Change region as needed

await snsClient.send(
  new PublishCommand({
    PhoneNumber: `+968${profile.phoneNumber}`,
    Message: `Your verification code is: ${code}. Expires in 10 minutes.`,
  })
);
```

## Other Options
- **Vonage (formerly Nexmo)**: https://developer.vonage.com/
- **MessageBird**: https://www.messagebird.com/
- **Plivo**: https://www.plivo.com/

## Testing
1. Use Twilio's trial account for testing (free credits available)
2. Test with your own phone number first
3. Verify codes are received and can be verified
4. Test error handling (invalid numbers, service failures)

## Cost Considerations
- Twilio: ~$0.0075 per SMS in most countries
- AWS SNS: ~$0.00645 per SMS
- Consider rate limiting to prevent abuse
- Monitor usage and set up billing alerts

## Security Notes
- Never commit API keys to version control
- Use environment variables for all credentials
- Implement rate limiting for SMS requests
- Log SMS sending attempts for audit purposes
- Consider SMS code expiration (currently 10 minutes)

## Production Checklist
- [ ] SMS service integrated and tested
- [ ] Environment variables configured
- [ ] Development console.log statements removed
- [ ] Error handling tested
- [ ] Rate limiting implemented
- [ ] Monitoring/alerts set up
- [ ] Cost tracking configured
- [ ] Phone number format validated (Oman: +968XXXXXXXX)








