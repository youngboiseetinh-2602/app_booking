import { registerDecorator, type ValidationOptions } from 'class-validator';

/** Reject missing values and blank strings; other types are checked in the next stage. */
export function IsNotBlank(options?: ValidationOptions): PropertyDecorator {
  return (target: object, propertyKey: string | symbol): void => {
    registerDecorator({
      name: 'isNotBlank',
      target: target.constructor,
      propertyName: String(propertyKey),
      options,
      validator: {
        validate(value: unknown): boolean {
          return (
            value !== undefined &&
            value !== null &&
            (typeof value !== 'string' || value.trim().length > 0)
          );
        },
      },
    });
  };
}
