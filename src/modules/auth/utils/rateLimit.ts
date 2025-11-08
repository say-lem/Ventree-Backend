// Shared rate limit stores would change use Redis later
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const otpRequests = new Map<string, number>();

export const checkRateLimit = (
  key: string,
  store: Map<string, { count: number; resetAt: number }>,
  maxAttempts: number,
  lockoutDuration: number
) => {
  const now = Date.now();
  const record = store.get(key);
  if (!record || now > record.resetAt) {
    store.set(key, { count: 1, resetAt: now + lockoutDuration });
    return { allowed: true, remainingAttempts: maxAttempts - 1 };
  }
  if (record.count >= maxAttempts) return { allowed: false, resetAt: record.resetAt };
  record.count++;
  return { allowed: true, remainingAttempts: maxAttempts - record.count };
};

export const resetRateLimit = (key: string, store: Map<string, { count: number; resetAt: number }>) =>
  store.delete(key);

export const checkOTPCooldown = (phone: string) => {
  const now = Date.now();
  const last = otpRequests.get(phone);
  const cooldown = 60 * 1000;
  if (last && now - last < cooldown)
    return { allowed: false, waitTime: Math.ceil((cooldown - (now - last)) / 1000) };
  otpRequests.set(phone, now);
  return { allowed: true };
};

// Get shared login attempts store
export const getLoginAttemptsStore = () => loginAttempts;
