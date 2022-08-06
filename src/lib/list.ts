import { Readable } from "./core";

export type ListObserverAtomicEntry<T> = {
    type: "set";
    index: number;
    value: T;
} | {
    type: "insert";
    index: number;
    value: T;
} | {
    type: "move";
    previousIndex: number;
    index: number;
} | {
    type: "delete";
    index: number;
};

export type ListObserverBatchEntry<T> = {
    type: "batch";
    name: "swap";
    indices: [number, number];
    toAtomics(this: ListObserverEntry<T>): ListObserverAtomicEntry<T>[];
} | {
    type: "batch";
    name: "copyWithin";
    startIndex: number;
    endIndex: number;
    targetIndex: number;
    toAtomics(this: ListObserverEntry<T>): ListObserverAtomicEntry<T>[];
} | {
    type: "batch";
    name: "splice";
    index: number;
    deleteCount: number;
    insertedValues: T[];
    toAtomics(this: ListObserverEntry<T>): ListObserverAtomicEntry<T>[];
};

export type ListObserverEntry<T> = ListObserverAtomicEntry<T> | ListObserverBatchEntry<T>;

export interface ReadableList<T> extends Readable<readonly T[]>, ArrayLike<T> {
    /**
     * A derived store which holds the 
     */
    size: Readable<number>

    /**
     * Returns the readable store which tracks the value
     * at a given index.
     * 
     * If the item moves away and a new one is at the specified index,
     * the store will report the new item's value – ie. the store does
     * not track items, it always watches the same index. If the index
     * is out of bounds (either `>= length`, or `< -length`), undefined
     * is passed as the value.
     */
    at(index: number): Readable<T | undefined>;

    /**
     * Returns the readable store which tracks the entry which is
     * currently at the given index.
     * 
     * If the value at the current index is set, the value of the
     * entry is updated. If the item at the current index moves
     * to another index, the index of the entry is updated and the
     * value stays the same. If the item is deleted, the entry
     * becomes `[-1, undefined]`.
     * 
     * TODO: Maybe change to { index: number, value: T }
     */
    entryAt(index: number): Readable<[number, T] | [-1, undefined]>;

    /**
     * Recieve a call every time the list is modified
     */
    observe(): void;

    /**
     * Returns a derived list which is sorted. The resulting list only updates
     * if necessary, for example moving items of the original list won't have
     * any effect on the sorted list.
     */
    sorted(compareFn?: ((a: number, b: number) => number)): ReadableList<T>;

    reversed(): ReadableList<T>;
    slice(start: number, end?: number): ReadableList<T>;
}

export interface WritableList<T> extends ReadableList<T> {
    [index: number]: T;
    length: number;

    set(index: number, value: T): this;
    insert(index: number, value: T): this;
    delete(index: number): boolean;

    push(value: T): number;
    pop(): T | undefined;
    unshift(value: T): number;
    shift(): T | undefined;

    move(currentIndex: number, newIndex: number): this;
    swap(index1: number, index2: number): this;
    sort(compareFn?: ((a: number, b: number) => number)): this;
    reverse(): this;
    
    copyWithin(targetIndex: number, startIndex: number, endIndex?: number): this;
    splice(startIndex: number, deleteCount?: number, ...items: T[]): T[];
}
