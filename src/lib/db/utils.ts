/**
 * Removes all keys with 'undefined' values from an object.
 * Firestore does not support 'undefined' as a field value.
 */
export const clean = <T extends Record<string, any>>(obj: T): T => {
  const newObj: any = {};
  Object.keys(obj).forEach((key) => {
    const value = obj[key];
    if (value !== undefined) {
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        newObj[key] = clean(value);
      } else {
        newObj[key] = value;
      }
    }
  });
  return newObj as T;
};
