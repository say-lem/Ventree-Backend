// Generate 6-digit OTP for better security (1,000,000 possible values)
export const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

export const sendOTP = async (phoneNumber: string, otp: string) => {
  try {
    console.log(`Sending OTP ${otp} to ${phoneNumber}`);

    const accountSid = process.env.TWILLOACCOUNTSID;
    const authToken = process.env.TWILLOAUTHTOKEN;
    const client = require('twilio')(accountSid, authToken);

    const message = await client.messages.create({
      body: `Your ventree verification code is: ${otp}`,
      from: process.env.VENTREE_PHONE_NUMBER,
      to: phoneNumber,
    });

    return {
      ok: true,
      sid: message.sid,
      status: message.status,   // queued, sent, delivered (sometimes)
      body: message.body,
    };

  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : error,
    };
  }

};
