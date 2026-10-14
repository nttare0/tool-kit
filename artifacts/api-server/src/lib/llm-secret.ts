import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

const VERSION = "v1";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function encryptionKey() {
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    throw new Error("LLM key encryption requires SESSION_SECRET to be configured.");
  }

  return Buffer.from(hkdfSync(
    "sha256",
    Buffer.from(sessionSecret, "utf8"),
    Buffer.from("toolstack-llm-provider-keys", "utf8"),
    Buffer.from("aes-256-gcm-v1", "utf8"),
    32,
  ));
}

export function encryptLlmApiKey(apiKey: string) {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(apiKey, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString("base64url"),
    authTag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptLlmApiKey(encryptedValue: string) {
  try {
    const [version, encodedIv, encodedAuthTag, encodedCiphertext, extra] = encryptedValue.split(".");
    if (version !== VERSION || !encodedIv || !encodedAuthTag || !encodedCiphertext || extra) {
      throw new Error("Invalid encrypted value.");
    }

    const iv = Buffer.from(encodedIv, "base64url");
    const authTag = Buffer.from(encodedAuthTag, "base64url");
    if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
      throw new Error("Invalid encrypted value.");
    }

    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([
      decipher.update(Buffer.from(encodedCiphertext, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error("This provider key cannot be decrypted. Enter the API key again to reconnect it.");
  }
}
