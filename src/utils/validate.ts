import { __ } from 'i18n';
import * as validations from 'validator';

const extensions = {
  isRequired: (v: any): boolean => {
    return v !== null && v !== undefined;
  },
  isString: (v: any): boolean => {
    return typeof v === 'string' || v instanceof String;
  },
};

type anyObj = { type: string, [x: string]: any };
type validatePayload = {
  field: string;
  val: any;
  locale: string;
  validations: Array<string|anyObj>;
};

export function validate(input: validatePayload[]): string | null {
  for (const i of input) {
    for (const validation of i.validations) {
      if (extensions.isString(validation)) {
        const validationName = String(validation);
        const fn = validations[validationName] || extensions[validationName];
        if (!fn(i.val)) {
          return __({ phrase: `validation.${validationName}`, locale: i.locale }, i.field);
        }
      } else {
        const { type, msg, pattern, ...params } = (validation as anyObj);
        const fn = validations[type] || extensions[type];
        if (pattern ? !fn(i.val, RegExp(pattern)) : !fn(i.val, params)) {
          return __({ phrase: `validation.${msg || type}`, locale: i.locale }, i.field, ...Object.values(params));
        }
      }
    }
  }

  return null;
}