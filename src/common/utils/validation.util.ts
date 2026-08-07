export const isE164 = (value: string): boolean => /^\+?[1-9]\d{1,14}$/.test(value);

export const isUuid = (value: string): boolean =>
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value);

export const isEmail = (value: string): boolean =>
  /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);

export const isDomain = (value: string): boolean =>
  /^(?!-)[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/.test(value);
