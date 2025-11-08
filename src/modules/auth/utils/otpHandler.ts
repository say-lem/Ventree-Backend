// Generate 6-digit OTP for better security (1,000,000 possible values)
export const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

export const sendOTP = async (phoneNumber: string, otp: string) => {
  // Integrate the a with twilio API after Quest pays for it
  console.log(`Sending OTP ${otp} to ${phoneNumber}`);
};
