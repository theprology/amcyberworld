declare namespace NodeJS {
  interface ProcessEnv {
    DB_HOST?: string;
    DB_PORT?: string;
    DB_NAME?: string;
    DB_USER?: string;
    DB_PASSWORD?: string;
    AGENT_ACCESS_CODE?: string;
    TELEGRAM_CONTACT_URL?: string;
    UPLOAD_DIR?: string;
  }
}
