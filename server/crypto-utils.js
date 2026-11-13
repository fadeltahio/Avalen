// Low-level crypto helpers shared by the account and session routes. No database
// or HTTP knowledge here, so these can be tested and reasoned about on their own.
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export const hash = (value) => createHash("sha256").update(value).digest("hex");

export const token = () => randomBytes(32).toString("base64url");

export const passwordHash = (password) => {
  const salt = token();
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
};

export const checkPassword = (password, stored) => {
  const [salt, value] = stored.split(":");
  return timingSafeEqual(
    scryptSync(password, salt, 64),
    Buffer.from(value, "hex"),
  );
};
