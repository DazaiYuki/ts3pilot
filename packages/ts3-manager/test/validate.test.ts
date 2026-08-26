import assert from 'node:assert/strict';
import test from 'node:test';
import { ValidationError, expectBoolean, expectEnum, expectNumber, expectString, expectStringArray } from '../src/domain/validate.ts';

test('expectString validates type and length', () => {
  assert.equal(expectString('abc', 'x'), 'abc');
  assert.throws(() => expectString(42, 'x'), ValidationError);
  assert.throws(() => expectString('ab', 'x', { min: 3 }), ValidationError);
});

test('expectNumber validates integer bounds', () => {
  assert.equal(expectNumber(3, 'x', { integer: true, min: 1 }), 3);
  assert.throws(() => expectNumber(3.5, 'x', { integer: true }), ValidationError);
  assert.throws(() => expectNumber(0, 'x', { min: 1 }), ValidationError);
});

test('expectBoolean and expectEnum validate', () => {
  assert.equal(expectBoolean(true, 'x'), true);
  assert.throws(() => expectBoolean('yes', 'x'), ValidationError);
  assert.equal(expectEnum('b', 'x', ['a', 'b'] as const), 'b');
  assert.throws(() => expectEnum('c', 'x', ['a', 'b'] as const), ValidationError);
});

test('expectStringArray validates arrays', () => {
  assert.deepEqual(expectStringArray(['a', 'b'], 'x'), ['a', 'b']);
  assert.throws(() => expectStringArray(['a', 1], 'x'), ValidationError);
  assert.throws(() => expectStringArray('a', 'x'), ValidationError);
});
