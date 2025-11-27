import { JwtPayload } from "jsonwebtoken";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        shopId: string;
        role: "owner" | "staff";
        profileId: string;
        staffName?: string;
      } & JwtPayload; 
    }
  }
}

export {};
