import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DoublyLinkedList } from '../src/core/list.js';
function check<T>(list: DoublyLinkedList<T>): void {
  let previous = null;
  let count = 0;
  for (const node of list) {
    assert.equal(node.previous, previous);
    previous = node;
    count++;
  }
  assert.equal(previous, list.tail);
  assert.equal(count, list.getSize());
  assert.equal(list.head?.previous ?? null, null);
  assert.equal(list.tail?.next ?? null, null);
  let next = null;
  let node = list.tail;
  let reverseCount = 0;
  while (node) {
    assert.equal(node.next, next);
    next = node;
    node = node.previous;
    reverseCount++;
  }
  assert.equal(reverseCount, count);
}
test('empty list and invalid positions', () => {
  const list = new DoublyLinkedList<string>();
  assert.ok(list.isEmpty());
  assert.equal(list.next(), null);
  assert.equal(list.previous(), null);
  assert.equal(list.remove('missing'), null);
  assert.deepEqual(list.toArray(), []);
  assert.throws(() => list.insertAt(-1, 'x'), RangeError);
  assert.throws(() => list.insertAt(1, 'x'), RangeError);
  assert.throws(() => list.removeAt(0), RangeError);
  assert.throws(() => list.at(0.5), RangeError);
  check(list);
});
test('append, prepend and insert beginning, middle, end', () => {
  const list = new DoublyLinkedList<string>();
  list.append('B');
  list.prepend('A');
  list.append('D');
  list.insertAt(2, 'C');
  list.insertAt(0, '0');
  list.insertAt(5, 'E');
  assert.deepEqual(list.toArray(), ['0', 'A', 'B', 'C', 'D', 'E']);
  check(list);
  assert.equal(list.at(3).value, 'C');
  assert.equal(list.find(list.tail!.id), list.tail);
  assert.throws(() => list.append('duplicate', list.head!.id));
});
test('next and previous follow node identity', () => {
  const list = new DoublyLinkedList<string>();
  list.append('A');
  const b = list.append('B');
  list.append('C');
  list.current = b;
  assert.equal(list.next(), b.next);
  assert.equal(list.previous(), b);
  assert.equal(list.previous(), list.head);
  assert.equal(list.previous(), null);
  check(list);
});
test('remove current, first, last, middle and only node', () => {
  const list = new DoublyLinkedList<string>();
  list.append('A');
  const b = list.append('B');
  const c = list.append('C');
  list.append('D');
  list.current = b;
  assert.equal(list.remove(b.id), b);
  assert.equal(list.current, c);
  check(list);
  list.removeAt(0);
  check(list);
  list.removeAt(1);
  check(list);
  list.remove(c.id);
  assert.equal(list.current, null);
  assert.ok(list.isEmpty());
  check(list);
});
test('move preserves node and current identities, clear detaches all nodes', () => {
  const list = new DoublyLinkedList<string>();
  const a = list.append('A');
  list.append('B');
  list.append('C');
  list.current = a;
  list.move(a.id, 2);
  assert.equal(list.tail, a);
  assert.equal(list.current, a);
  check(list);
  list.move(a.id, 0);
  assert.equal(list.head, a);
  check(list);
  list.clear();
  check(list);
  assert.equal(a.next, null);
  assert.equal(a.previous, null);
  assert.equal(list.current, null);
});
