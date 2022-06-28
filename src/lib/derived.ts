import type {
	Invalidator,
	IReadable,
	Readable,
	Stopper,
	Subscriber,
	SubscriberInvalidatorPair,
	UnsubscriberStrong,
	Updater
} from './core';
import { writable } from './core';

type ReadableStores =
	| IReadable<any>
	| [IReadable<any>, ...Array<IReadable<any>>]
	| Array<IReadable<any>>;

type StoreValues<T> = T extends Readable<infer U>
	? U
	: { [K in keyof T]: T[K] extends Readable<infer U> ? U : never };

type PartialStoreValues<T> = T extends Readable<infer U>
	? U | undefined
	: { [K in keyof T]: T[K] extends Readable<infer U> ? U | undefined : never };

export interface DerivedOptions<S extends ReadableStores, T> {
	/** A store or a list of stores used to compute this derived store's value. */
	deps: S;

	/**
	 * Called every time the dependencies change value, given that this store has any
	 * subscribers and/or `keepAlive` is set to true.
	 *
	 * @param deps - values of the dependencies
	 * @param set - callback that allows you to set the value of this store, if you think
	 *              it needs updating; may be called after an arbitrary delay; if you don't
	 *              call `set` synchronously, subscribers will still be notified so that they
	 *              know this store is no longer dirty
	 * @param previousDeps - previous values of the dependencies
	 * @param previousValue - the previous value of this store
	 *
	 * @returns optionally return a _stopper_ that is run before the subsequent update,
	 *          or once all subscribers unsubscribe if that happens first
	 */
	update: (
		deps: StoreValues<S>,
		set: Updater<T>,
		previousDeps: PartialStoreValues<S>,
		previousValue: T | undefined
	) => Stopper | void;

	/**
	 * provide an initial value, so that `update` doesn't recieve
	 * `undefined` as the first `previousValue`
	 */
	initial?: T;

	/**
	 * By default
	 */
	skipDirtyDeps?: boolean;
	keepAlive?: boolean;
}

export type SimpleUpdateCallback<S, T, P> = (
	deps: StoreValues<S>,
	previousDeps: PartialStoreValues<S>,
	previousValue: P
) => T;

/**
 * Derived value store by synchronizing one or more readable stores and
 * applying an aggregation function over its input values.
 *
 * @param stores - input stores
 * @param fn - function callback that computes the new value
 */
export function derived<S extends ReadableStores, T>(
	stores: S,
	fn: SimpleUpdateCallback<S, T, T | undefined>
): Readable<T>;

/**
 * Derived value store by synchronizing one or more readable stores and
 * applying an aggregation function over its input values.
 *
 * @param stores - input stores
 * @param initialValue - provide an initial value, so that `fn` doesn't recieve
 *                       `undefined` as the first `previousValue`
 * @param fn - function callback that computes the new value
 */
export function derived<S extends ReadableStores, T>(
	stores: S,
	initialValue: T,
	fn: SimpleUpdateCallback<S, T, T>
): Readable<T>;

/**
 * Derived value store by synchronizing one or more readable stores and
 * applying an aggregation function over its input values.
 *
 * @param options - various settings and options for the derived store
 */
export function derived<S extends ReadableStores, T>(options: DerivedOptions<S, T>): Readable<T>;

export function derived<S extends ReadableStores, T>(
	a: S | DerivedOptions<S, T>,
	b?: T | SimpleUpdateCallback<S, T, T | undefined>,
	c?: SimpleUpdateCallback<S, T, T>
): Readable<T> {
	let options: DerivedOptions<S, T>;
	if ('deps' in a && 'update' in a && typeof a.update === 'function') {
		options = a;
	} else if (typeof c === 'function') {
		options = {
			deps: <S>a,
			initial: <T>b,
			update(stores, set, pDeps, pVal) {
				set(c(stores, pDeps, pVal!));
			}
		};
	} else {
		options = {
			deps: <S>a,
			update(stores, set, prev) {
				set((<any>b)(stores, prev));
			}
		};
	}

	const { update, initial } = options;
	const skipDirtyDeps = options.skipDirtyDeps ?? true;
	const deps: IReadable<any>[] = Array.isArray(options.deps) ? options.deps : [options.deps];

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

	function get(): T {
		return value;
	}

	function isDirty(): boolean {
		return dirty;
	}

	return { listen, subscribe, get, isDirty };
}
