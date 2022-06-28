export type Subscriber<T> = (value: T) => void;
export type UnsubscriberWeak = (() => void) | { unsubscribe(): void };
export type UnsubscriberStrong = { (): boolean, unsubscribe(): boolean };
export type Updater<T> = (value: T) => T;
export type Invalidator = () => void;
export type Stopper = () => void;
export type StartStopNotifier<T> = (set: Subscriber<T>) => Stopper | void;

export interface SubscriberInvalidatorPair<T> {
    run: Subscriber<T>;
    invalidate?: Invalidator;
}

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

    /**
     * If true, the store is in the middle of being updated – ie. after being set or invalidated
     * but before changing its value and notifying any of its subscribers.
     */
    isDirty(this: void): boolean;
}

export interface Writable<T> extends Readable<T>, Omit<IWritable<T>, 'subscribe'> {
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
    const subscribers: SubscriberInvalidatorPair<T>[] = [];
    let stop: Stopper | void;
    let dirty = false;

    function listen(run: Subscriber<T>, invalidate?: Invalidator): UnsubscriberStrong {
        // first subscriber?
        if (subscribers.length === 0) {
            stop = start?.(set);
        }

        const obj = { run, invalidate };
        subscribers.push(obj);

        function unsubscribe(): boolean {
            const index = subscribers.indexOf(obj);
            if (index === -1) return false;
            subscribers.splice(index, 1);

            // last subscriber?
            if (subscribers.length === 0) stop?.();

            return true;
        }

        return Object.assign(unsubscribe, { unsubscribe });
    }

    function subscribe(run: Subscriber<T>, invalidate?: Invalidator): UnsubscriberStrong {
        run(value);
        return listen(run, invalidate);
    }

    function set(val: T): T {
        dirty = true;
        for (const { invalidate } of subscribers) {
            invalidate?.();
        }
        value = val;
        dirty = false;
        for (const { run } of subscribers) {
            run(value);
        }
        return value;
    }

    function update(updater: Updater<T>): T {
        return set(updater(value));
    }

    function get(): T {
        return value;
    }

    function isDirty(): boolean {
        return dirty;
    }

    return { listen, subscribe, get, set, update, isDirty };
}


export function readable<T>(value: T, start?: StartStopNotifier<T>): Readable<T>;
export function readable<T>(value?: T, start?: StartStopNotifier<T | undefined>): Readable<T | undefined>;
export function readable<T>(value: T, start?: StartStopNotifier<T>): Readable<T> {
    const { listen, subscribe, get, isDirty } = writable(value, start);
    return { listen, subscribe, get, isDirty };
}

/**
 * Get the value of a store – either by retrieving it directly, if the store
 * supports this, or by subscribing and immediately unsubscribing again.
 */
export function get<T>(store: IReadable<T>): T {
    const s: IReadable<T> & Partial<Pick<Readable<T>, 'get'>> = store;
    if (typeof s.get === 'function' && s.get.length === 0) {
        return s.get();
    }

    let value: T;
    let called = false;
    const unsub = store.subscribe(v => {
        value = v;
        called = true;
    });
    
    if (typeof unsub === 'function') unsub();
    else unsub.unsubscribe();

    if (!called) throw new TypeError(
        "Subscribed function not called synchronously at subscription time."
    );

    return value!;
}
