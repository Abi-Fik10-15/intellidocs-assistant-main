export const logger = {
  warn(message: string, err?: unknown) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(message, err);
    }
  },
};
