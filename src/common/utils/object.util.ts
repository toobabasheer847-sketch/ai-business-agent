export const stripUndefined = <T extends Record<string, unknown>>(obj: T): Partial<T> =>
  Object.entries(obj).reduce((acc, [key, value]) => {
    if (value !== undefined) {
      (acc as Record<string, unknown>)[key] = value;
    }
    return acc;
  }, {} as Partial<T>);

export const omit = <T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[],
): Omit<T, K> => {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result;
};

export const pick = <T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[],
): Pick<T, K> =>
  keys.reduce((acc, key) => {
    if (key in obj) {
      acc[key] = obj[key];
    }
    return acc;
  }, {} as Pick<T, K>);

export const maskSecrets = (obj: Record<string, unknown>, keys: string[] = []): Record<string, unknown> =>
  Object.entries(obj).reduce((acc, [key, value]) => {
    acc[key] = keys.includes(key) ? '****' : value;
    return acc;
  }, {} as Record<string, unknown>);
