export type ResetTokenEntry = {
  shopId: string;
  phoneNumber: string;
  expiresAt: Date;
};

export type ResetTokenStore = Map<string, ResetTokenEntry>;

export type PasswordResetRequestInput = {
  shopName: string;
  phoneNumber: string;
  ip: string;
  requestId: string;
};

export type VerifyPasswordResetOtpInput = {
  shopName: string;
  phoneNumber: string;
  otp: string;
  ip: string;
  requestId: string;
};

export type ResetPasswordInput = {
  resetToken: string;
  newPassword: string;
  ip: string;
  requestId: string;
};

export type ChangePasswordInput = {
  shopId: string;
  role: "owner" | "staff";
  profileId: string;
  currentPassword: string;
  newPassword: string;
  ip: string;
  requestId: string;
};

export type DashboardPeriod = "today" | "week";

