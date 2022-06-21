export type Subscriber<T> = (value: T) => void;
export type Unsubscriber = () => void;
export type UnsubscriberWeak = Unsubscriber | { unsubscribe: Unsubscriber };
export type UnsubscriberStrong = Unsubscriber & { unsubscribe: Unsubscriber };
export type Updater<T> = (value: T) => T;
export type Invalidator = () => void;
export type StartStopNotifier<T> = (set: Subscriber<T>) => Unsubscriber | void;

/**
 * A minimal implementation of the Store Contract.
 * @see https://svelte.dev/docs#component-format-script-4-prefix-stores-with-$-to-access-their-values-store-contract
 */
export interface IReadable<T> {
    subscribe(this: void, run: Subscriber<T>): UnsubscriberWeak;
}

/**
 * A minimal writable implementation of the Store Contract.
 * @see https://svelte.dev/docs#component-format-script-4-prefix-stores-with-$-to-access-their-values-store-contract
 */
export interface IWritable<T> extends IReadable<T> {
    set(this: void, value: T): void;
}

export interface Readable<T> extends IReadable<T> {
    /**
     * Recieve a call every time the store changes its value. The callback is
     * called immediately (and synchronously) after subscribing, and recieves
     * the store's current value.
     * 
     * To ensure that the dependencies of a derived store are updated breadth-first
     * and it is not updated until all of its dependencies are updated, you can
     * optionally provide a second parameter – the _invalidate_ function.
     * It will be called before any of the subscribers recieves the new value.
     * This way, a derived store can mark its dependencies as dirty and only update
     * after the last dependency updates.
     * 
     * @param run the callback that recieves the store's new value
     * @param invalidate the callback that tells you this store is dirty and will be updating
     * 
     * @returns a function that cancels this subscribtion; also contains an `unsubscribe` parameter
     * for cross-compatibility with RxJS
     */
    subscribe(this: void, run: Subscriber<T>, invalidate?: Invalidator): UnsubscriberStrong;

    /**
     * Recieve a call every time the store changes its value. Exactly like `subscribe`
     * except the callback is **not** called immediately after subscribing, but only
     * after an actual change of value.
     * 
     * @param run the callback that recieves the store's new value
     * @param invalidate the callback that tells you this store is dirty and will be updating
     * 
     * @returns a function that cancels this subscribtion; also contains an `unsubscribe` parameter
     * for cross-compatibility with RxJS
     */
    listen(this: void, run: Subscriber<T>, invalidate?: Invalidator): UnsubscriberStrong;

    /**
     * Get the current value of this store but do not subscribe to changes.
     */
    get(this: void): T;
}

export interface Writable<T> extends IWritable<T> {
    /**
     * Set the value of this store and notify subscribers.
     * @returns the new value
     */
    set(this: void, value: T): T;

    /**
     * Update the store's current value using its current value, notify subscribers.
     * @returns the new value
     */
    update(this: void, updater: Updater<T>): T;
}


export function writable<T>(value: T, start?: StartStopNotifier<T>): Writable<T>;
export function writable<T>(value?: T, start?: StartStopNotifier<T | undefined>): Writable<T | undefined>;
export function writable<T>(value: T, start?: StartStopNotifier<T>): Writable<T> {
    
}

