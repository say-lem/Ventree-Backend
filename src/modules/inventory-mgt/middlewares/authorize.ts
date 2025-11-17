import { asyncHandler } from "../../../shared/utils/asyncHandler";
import { AuthorizationError, AuthenticationError } from "../../../shared/utils/AppError";

export const authorize = (...allowedRoles: string[]) =>
  asyncHandler(async (req, res, next) => {
    if (!req.user) {
      throw new AuthenticationError("Authentication required");
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new AuthorizationError(
        `Access denied. Only ${allowedRoles.join(" or ")} can perform this action`
      );
    }

    next();
  });
