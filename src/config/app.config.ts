export default function appConfig() {
  return {
    PORT: process.env.PORT ?? '3000',
    NODE_ENV: process.env.NODE_ENV ?? 'development',
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? '7d',
  };
}
