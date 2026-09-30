/** Original structure: no Array, Map, Set, push, splice, or array-backed storage. */
export class ListNode<T> {
  public previous: ListNode<T> | null = null;
  public next: ListNode<T> | null = null;
  constructor(
    public readonly id: string,
    public value: T,
  ) {}
}

export class DoublyLinkedList<T> implements Iterable<ListNode<T>> {
  public head: ListNode<T> | null = null;
  public tail: ListNode<T> | null = null;
  private count = 0;
  public current: ListNode<T> | null = null;
  get size(): number {
    return this.count;
  }
  getSize(): number {
    return this.count;
  }
  isEmpty(): boolean {
    return this.count === 0;
  }
  insertAt(index: number, value: T, id: string = crypto.randomUUID()): ListNode<T> {
    return this.insert(index, value, id);
  }
  removeAt(index: number): ListNode<T> | null {
    return this.remove(this.at(index).id);
  }
  next(): ListNode<T> | null {
    this.current = this.current ? this.current.next : this.head;
    return this.current;
  }
  previous(): ListNode<T> | null {
    this.current = this.current ? this.current.previous : this.tail;
    return this.current;
  }
  clear(): void {
    while (this.head) this.remove(this.head.id);
    this.current = null;
  }
  /** Export boundary only; never used as playlist storage or navigation. */
  toArray(): T[] {
    const result: T[] = [];
    for (const node of this) result.push(node.value);
    return result;
  }

  *[Symbol.iterator](): Generator<ListNode<T>> {
    let node = this.head;
    while (node) {
      yield node;
      node = node.next;
    }
  }

  find(id: string): ListNode<T> | null {
    for (const node of this) if (node.id === id) return node;
    return null;
  }

  at(index: number): ListNode<T> {
    if (!Number.isInteger(index) || index < 0 || index >= this.count)
      throw new RangeError('Position is outside the list.');
    let node: ListNode<T>;
    if (index < this.count / 2) {
      node = this.head!;
      for (let i = 0; i < index; i++) node = node.next!;
    } else {
      node = this.tail!;
      for (let i = this.count - 1; i > index; i--) node = node.previous!;
    }
    return node;
  }

  prepend(value: T, id: string = crypto.randomUUID()): ListNode<T> {
    return this.insert(0, value, id);
  }
  append(value: T, id: string = crypto.randomUUID()): ListNode<T> {
    return this.insert(this.count, value, id);
  }

  insert(index: number, value: T, id: string = crypto.randomUUID()): ListNode<T> {
    if (!Number.isInteger(index) || index < 0 || index > this.count)
      throw new RangeError('Invalid insertion position.');
    if (this.find(id)) throw new Error('Node IDs must be unique.');
    const node = new ListNode(id, value);
    const next = index === this.count ? null : this.at(index);
    const previous = next ? next.previous : this.tail;
    node.previous = previous;
    node.next = next;
    if (previous) previous.next = node;
    else this.head = node;
    if (next) next.previous = node;
    else this.tail = node;
    this.count++;
    return node;
  }

  remove(id: string): ListNode<T> | null {
    const node = this.find(id);
    if (!node) return null;
    if (this.current === node) this.current = node.next ?? node.previous;
    if (node.previous) node.previous.next = node.next;
    else this.head = node.next;
    if (node.next) node.next.previous = node.previous;
    else this.tail = node.previous;
    node.next = null;
    node.previous = null;
    this.count--;
    return node;
  }

  /** Move by relinking the same node; preserve its identity and cursor. */
  move(id: string, index: number): void {
    if (!Number.isInteger(index) || index < 0 || index >= this.count)
      throw new RangeError('Invalid target position.');
    const node = this.find(id);
    if (!node) throw new Error('Track not found.');
    const cursor = this.current;
    this.remove(id);
    const next = index === this.count ? null : this.at(index);
    const previous = next ? next.previous : this.tail;
    node.previous = previous;
    node.next = next;
    if (previous) previous.next = node;
    else this.head = node;
    if (next) next.previous = node;
    else this.tail = node;
    this.count++;
    this.current = cursor;
  }
}
