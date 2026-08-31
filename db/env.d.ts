declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    FILES: R2Bucket;
    TELEGRAM_CONTACT_URL?: string;
  }
}
