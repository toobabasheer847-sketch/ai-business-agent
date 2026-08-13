function parseCorsOrigins(value: string | undefined): string[] {
  const fallback = ['http://localhost:5173'];

  if (!value?.trim()) {
    return fallback;
  }

  const origins = value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return origins.length > 0 ? origins : fallback;
}

export default function appConfig() {
  return {
    PORT: process.env.PORT ?? '3000',
    NODE_ENV: process.env.NODE_ENV ?? 'development',
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? '7d',
    CORS_ORIGINS: parseCorsOrigins(process.env.CORS_ORIGINS),
  };
}
