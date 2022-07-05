import {
	writable,
	type Invalidator,
	type IReadable,
	type Readable,
	type Stopper,
	type Subscriber,
	type SubscriberInvalidatorPair,
	type UnsubscriberStrong,
	type UnsubscriberWeak,
	type Updater,
	type WritableOptions
} from './core';
import { shouldSomeUpdate } from './utils';

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
		previousDeps: PartialStoreValues<S>
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

	/**
	 * Similar to `skipSubscribersWhenEqual`, but this time it skips
	 * the call to the `update` function if the value of dependencies
	 * is reference-equal to the old value. Default value: `'never'`
	 */
	skipUpdateWhenEqual?: 'never' | 'primitive' | 'always';
}

export type SimpleUpdateCallback<S, T, P> = (
	deps: StoreValues<S>,
	previousValue: P,
	previousDeps: PartialStoreValues<S>
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
			update(stores, set, prev) {
				set((<any>b)(stores, prev));
			}
		};
	}

	const { update, initial, skipSubscribersWhenEqual } = options; // TODO keepAlive
	const skipDirtyDeps = options.skipDirtyDeps ?? true;
	const skipUpdateWhenEqual = options.skipUpdateWhenEqual ?? 'never';

    const single = !Array.isArray(options.deps);
	const deps: ReadonlyArray<
		IReadable<any> & { subscribe(run: Subscriber<any>, invalidate?: Invalidator): UnsubscriberWeak }
	> = Array.isArray(options.deps) ? options.deps : [options.deps];
	const depValues: any[] = [];
	let depPrevValues: any[] = deps.map((_) => undefined);
	const depDirty = deps.map((_) => true);
	const depUnsubscribers: UnsubscriberWeak[] = [];

	const { listen, subscribe, get, isDirty, set, invalidate } = writable<T>(
		initial!,
		() => {
			for (let i = 0; i < deps.length; i++) {
				depDirty[i] = true;
				depUnsubscribers[i] = deps[i].subscribe(
					(value) => {
						depValues[i] = value;
						depDirty[i] = false;

						if (skipDirtyDeps && depDirty.some((d) => d)) return;
                        if (!shouldSomeUpdate(depPrevValues, depValues, skipUpdateWhenEqual)) return;

						update(
                            single ? depValues[0] : depValues,
                            set,
                            get(),
                            single ? depPrevValues[0] : depPrevValues
                        );

                        depPrevValues = [...depValues];
					},
					() => {
						depDirty[i] = true;
						invalidate();
					}
				);
			}

			return () => {
				for (let i = 0; i < deps.length; i++) {
					const unsub = depUnsubscribers[i];
					if (typeof unsub === 'function') unsub();
					else unsub.unsubscribe();
				}
			};
		},
		{ skipSubscribersWhenEqual }
	);

	return { listen, subscribe, get, isDirty };
}
