-- Hash refresh tokens: rename token → tokenHash, old tokens become invalid
-- (all existing raw tokens are invalidated for security)

DROP INDEX IF EXISTS "RefreshToken_token_idx";

ALTER TABLE "RefreshToken" RENAME COLUMN "token" TO "tokenHash";

ALTER TABLE "RefreshToken" RENAME CONSTRAINT "RefreshToken_token_key" TO "RefreshToken_tokenHash_key";

CREATE INDEX "RefreshToken_tokenHash_idx" ON "RefreshToken"("tokenHash");
