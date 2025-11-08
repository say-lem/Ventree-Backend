import jwt from "jsonwebtoken";
import { InternalServerError } from "../../../shared/utils/AppError";

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "7d";

if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
  throw new InternalServerError(
    "JWT_SECRET and JWT_REFRESH_SECRET environment variables must be set"
  );
}

export const generateTokens = (payload: object) => {
  if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
    throw new InternalServerError("JWT secrets are not configured");
  }
  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
  const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
  return { accessToken, refreshToken };
};
