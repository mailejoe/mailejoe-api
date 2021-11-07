export enum MockType {
  Resolve = 'mockResolvedValue',
  ResolveOnce = 'mockResolvedValueOnce',
  Reject = 'mockRejectedValue',
  RejectOnce = 'mockRejectedValueOnce',
  Return = 'mockReturnValue',
  ReturnOnce = 'mockReturnValueOnce',
}

export function mockValue(fn: (...args: any[]) => any, type: MockType, ...values: any) {
  let returnedFn = (fn as jest.MockedFunction<typeof fn>)[type](values[0]);
  values.slice(1).forEach((value: any) => {
    returnedFn = returnedFn[type](value);
  });
}

export function mockRestore(fn: (...args: any[]) => any) {
  (fn as jest.MockedFunction<typeof fn>).mockRestore();
}