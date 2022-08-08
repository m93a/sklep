import {
	writable,
	get as getStoreValue,
	type Invalidator,
	type IReadable,
	type Readable,
	type Stopper,
	type UnsubscriberWeak,
	type Updater,
	type WritableOptions,
	type SubscriberWeak
} from './core';

type ReadableStores =
	| IReadable<any>
	| [IReadable<any>, ...Array<IReadable<any>>]
	| Array<IReadable<any>>;

type StoreValues<T> = T extends IReadable<infer U>
	? U
	: { [K in keyof T]: T[K] extends IReadable<infer U> ? U : never };

export interface DerivedOptions<S extends ReadableStores, T> extends WritableOptions {
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
		previousValue: T | undefined,
		previousDeps: StoreValues<S>
	) => Stopper | void;

	/**
	 * Provide an initial value, so that `update` doesn't recieve
	 * `undefined` as the first `previousValue`
	 */
	initial?: T;

	/**
	 * By default
	 */
	skipDirtyDeps?: boolean;

	// TODO keepAlive
}

export type SimpleUpdateCallback<S, T, P> = (
	deps: StoreValues<S>,
	previousValue: P,
	previousDeps: StoreValues<S>
) => T;

/**
 * Store which listens to the change of other stores' values and
 * computes its own value based on these.
 *
 * @param stores - input stores
 * @param fn - function callback that computes the new value
 */
export function derived<S extends ReadableStores, T>(
	stores: S,
	fn: SimpleUpdateCallback<S, T, T | undefined>
): Readable<T>;

/**
 * Store which listens to the change of other stores' values and
 * computes its own value based on these.
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
 * Store which listens to the change of other stores' values and
 * computes its own value based on these.
 *
 * @param options - various settings and options for the derived store
 */
export function derived<S extends ReadableStores, T>(options: DerivedOptions<S, T>): Readable<T>;

export function derived<S extends ReadableStores, T>(
	a: S | DerivedOptions<S, T>,
	b?: T | SimpleUpdateCallback<S, T, T | undefined>,
	c?: SimpleUpdateCallback<S, T, T>
): Readable<T> {
	// parse options from the three possible overloads
	// and collect them into one options object
	let options: DerivedOptions<S, T>;
	if ('deps' in a && 'update' in a && typeof a.update === 'function') {
		options = a;
	} else if (typeof c === 'function') {
		options = {
			deps: <S>a,
			initial: <T>b,
			update(stores, set, pVal, pDeps) {
				set(c(stores, pVal!, pDeps));
			}
		};
	} else {
		options = {
			deps: <S>a,
			update(stores, set, pVal, pDeps) {
				set((<any>b)(stores, pVal, pDeps));
			}
		};
	}

	// array of dependencies
	const single = !Array.isArray(options.deps);
	const deps: ReadonlyArray<
		IReadable<any> & { subscribe(run: SubscriberWeak<any>, invalidate?: Invalidator): UnsubscriberWeak }
	> = Array.isArray(options.deps) ? options.deps : [options.deps];

	// extract other important options
	const { update, initial, skipSubscribersWhenEqual } = options;
	const skipDirtyDeps = options.skipDirtyDeps ?? true;

	// various bookkeeping and caching
	let depValues: any[] = [];
	let depPrevValues: any[] = deps.map((_) => undefined);
	let depUnsubscribers: UnsubscriberWeak[] = [];
	const depDirty = deps.map((_) => true);

	let stopPreviousUpdate: Stopper | void;
	let hasAnySubscribers = false;

	// the internal writable store
	// that manages subscribers to this store,
	// remembers the last value, etc.
	const {
		listen,
		subscribe,
		get: getRawValue,
		isDirty,
		set,
		invalidate,
	} = writable<T>(
		// initial value might be undefined,
		// but will most likely be immediately set
		// to a value of type T by the `update` callback
		initial!,

		// initialization function, executed when the first
		// subscriber subscribes. note that this also applies
		// to the case when all previous subscribers have
		// unsubscribed
		() => {
			let starting = true;
			for (let i = 0; i < deps.length; i++) {
				depDirty[i] = true;
				depUnsubscribers[i] = deps[i].subscribe(
					// an internal subscriber for the i-th dependency
					(value) => {
						// remember the current dep's value,
						// initialize previous value to the current one
						// (the rationale being that it hasn't changed recently)
						// and mark this dep as not dirty
						depValues[i] = value;
						if (starting) depPrevValues[i] = value;
						depDirty[i] = false;

						// skip updating this store's value if some deps are still dirty
						if (skipDirtyDeps && depDirty.some((d) => d)) return;

						// call the previous update's stopper, if there's any
						// and call the update, remembering its current stopper
						stopPreviousUpdate?.();
						stopPreviousUpdate = update(
							single ? depValues[0] : depValues,
							set,
							getRawValue(),
							single ? depPrevValues[0] : depPrevValues
						);

						depPrevValues = [...depValues];
					},

					// if a dependency invalidates, remember it's invalid
					// also invalidate self
					() => {
						depDirty[i] = true;
						invalidate();
					}
				);
			}

			// the store is now fully initialized
			hasAnySubscribers = true;
			starting = false;

			// the stopper for this store,
			// called when all its subscribers unsubscribe
			return () => {
				// unsubscribe all internal subscribers
				// of this store's dependencies
				for (let i = 0; i < deps.length; i++) {
					const unsub = depUnsubscribers[i];
					if (typeof unsub === 'function') unsub();
					else unsub.unsubscribe();
				}

				// call and forget the update's stopper
				stopPreviousUpdate?.();
				stopPreviousUpdate = undefined;
				hasAnySubscribers = false;

				// wipe everything to prevent memory leaks
				depValues = [];
				depPrevValues = [];
				depUnsubscribers = [];

				// reset the value to the initial value
				// don't mind the undefined, as it will only ever
				// be passed as previousValue, never as value
				set(initial!);
			};
		},
		{ skipSubscribersWhenEqual }
	);

	function get(): T {
		// if there are no subscribers, the values are probably outdated
		// fetch new dep values and compute new derived value
		let value!: T;
		if (!hasAnySubscribers) {
			depValues = deps.map(getStoreValue);
			update(
				single ? depValues[0] : depValues,
				v => (value = v),
				getRawValue(),
				single ? depValues[0] : depValues
			)?.();
		} else {
			value = getRawValue();
		}

		return value;
	}

	function pipe(...fns: Array<(item: any) => any>) {
		return fns.reduce((previousValue, f) => f(previousValue), result);
	}

	const result: Readable<T> = { listen, subscribe, get, isDirty, pipe };
	return result
}
