import bcrypt from "bcryptjs";

export const hashOTP = async (otp: string) => await bcrypt.hash(otp, 10);
export const verifyOTP = async (otp: string, hash: string) => await bcrypt.compare(otp, hash);
