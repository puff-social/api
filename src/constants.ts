export const ProductModelMap = [
  '0',
  '21', // Why another one
  '4294967295', // wtf is this puffco
  '1',
  '22', // Again why another, what happened here?
  '2',
  '4',
] as const;

export const UserFlags = {
  tester: 1 << 0,
  supporter: 1 << 1,
  admin: 1 << 2,
};