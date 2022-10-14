import {
	get,
	readable,
	writable,
	isIReadable,
	isReadable,
	isIWritable,
	isWritable,
	type Invalidator,
	type IReadable,
	type Setter,
	type WritableOptions
} from './core';

describe('writable', () => {
	test('basic functionality', () => {
		const a = writable(1);

		// get
		const v = a.get();
		expect(v).toBe(1);
		const w1: number = v; // type ⊂ number
		const w2: typeof v = 10 as number; // type ⊃ number

		// subscribe
		const f = jest.fn<void, [v: number, p: number, label: string]>();
		const sub1 = (v: number, p: number) => f(v, p, 'first sub');
		const sub2 = (v: number, p: number) => f(v, p, 'second sub');

		a.subscribe(sub1);
		expect(f).toBeCalledTimes(1);
		expect(f).toHaveBeenLastCalledWith(1, 1, 'first sub');

		a.subscribe(sub2);
		expect(f).toBeCalledTimes(2);
		expect(f).toHaveBeenLastCalledWith(1, 1, 'second sub');

		// set
		a.set(2);
		expect(f).toBeCalledTimes(4);
		expect(f).toHaveBeenNthCalledWith(3, 2, 1, 'first sub');
		expect(f).toHaveBeenNthCalledWith(4, 2, 1, 'second sub');
		expect(a.get()).toBe(2);

		// update
		a.update((v) => ++v);
		expect(f).toBeCalledTimes(6);
		expect(f).toHaveBeenNthCalledWith(5, 3, 2, 'first sub');
		expect(f).toHaveBeenNthCalledWith(6, 3, 2, 'second sub');
		expect(a.get()).toBe(3);
	});

	test('listening', () => {
		const a = writable('x');
		const f = jest.fn<void, [string]>();

		a.listen(f);
		expect(f).not.toHaveBeenCalled();

		a.set('foo');
		expect(f).toBeCalledTimes(1);
		expect(f).toHaveBeenLastCalledWith('foo', 'x');

		a.update((x) => x + 'bar');
		expect(f).toBeCalledTimes(2);
		expect(f).toHaveBeenLastCalledWith('foobar', 'foo');
	});

	test('automatic invalidation', () => {
		const a = writable(5);
		const f = jest.fn<void, [v?: number, p?: number]>();
		let invValue: number | undefined;
		let subValue: number | undefined;

		a.subscribe(
			(v, p) => {
				expect(a.isDirty()).toBe(false);
				subValue = a.get();
				f(v, p);
			},
			() => {
				expect(a.isDirty()).toBe(true);
				invValue = a.get();
				f();
			}
		);

		expect(f).toBeCalledTimes(1);
		expect(f).toHaveBeenLastCalledWith(5, 5);
		expect(subValue).toBe(5);

		a.update((v) => v ** 2);
		expect(f).toBeCalledTimes(3);
		expect(f).toHaveBeenNthCalledWith(2);
		expect(f).toHaveBeenNthCalledWith(3, 25, 5);
		expect(invValue).toBe(5);
		expect(subValue).toBe(25);

		const g = jest.fn<void, [v?: number, p?: number]>();
		a.listen(
			(v, p) => {
				expect(a.isDirty()).toBe(false);
				g(v, p);
			},
			() => {
				expect(a.isDirty()).toBe(true);
				g();
			}
		);
		expect(g).not.toBeCalled();

		a.set(42);
		expect(f).toBeCalledTimes(5);
		expect(f).toHaveBeenNthCalledWith(4);
		expect(f).toHaveBeenNthCalledWith(5, 42, 25);
		expect(g).toBeCalledTimes(2);
		expect(g).toHaveBeenNthCalledWith(1);
		expect(g).toHaveBeenNthCalledWith(2, 42, 25);
		expect(invValue).toBe(25);
		expect(subValue).toBe(42);
	});

	test('manual invalidation', () => {
		const s = jest.fn<void, [number]>();
		const i = jest.fn<void, []>();
		const a = writable(1);

		a.listen(s, i);
		expect(s).not.toBeCalled();
		expect(i).not.toBeCalled();

		a.invalidate();
		expect(i).toBeCalledTimes(1);
		expect(s).toBeCalledTimes(0);
		expect(a.isDirty()).toBe(true);

		a.invalidate();
		expect(i).toBeCalledTimes(1);
		expect(s).toBeCalledTimes(0);
		expect(a.isDirty()).toBe(true);

		a.set(2);
		expect(i).toBeCalledTimes(1);
		expect(s).toBeCalledTimes(1);
		expect(a.isDirty()).toBe(false);

		a.invalidate();
		expect(i).toBeCalledTimes(2);
		expect(s).toBeCalledTimes(1);
		expect(a.isDirty()).toBe(true);

		a.set(2);
		expect(i).toBeCalledTimes(2);
		expect(s).toBeCalledTimes(2);
		expect(a.isDirty()).toBe(false);

		a.set(2);
		expect(i).toBeCalledTimes(2);
		expect(s).toBeCalledTimes(2);
		expect(a.isDirty()).toBe(false);
	});

	test('lifetime', () => {
		let set: Setter<number> | undefined;
		let invalidate: Invalidator | undefined;
		const stop = jest.fn<void, []>();
		const start = jest.fn((s: Setter<number>, i: Invalidator) => {
			a.get();
			set = s;
			invalidate = i;
			return stop;
		});

		const a = writable(69, start);
		expect(start).not.toBeCalled();
		expect(stop).not.toBeCalled();

		const s1 = jest.fn<void, [number, number]>();
		const i1 = jest.fn<void, []>();
		const u1 = a.subscribe(s1, i1);
		expect(start).toBeCalledTimes(1);
		expect(start).toHaveBeenLastCalledWith(set, invalidate);
		expect(set).not.toBeUndefined();
		expect(stop).not.toBeCalled();
		expect(s1).toBeCalledTimes(1);
		expect(s1).toHaveBeenLastCalledWith(69, 69);
		expect(i1).not.toBeCalled();

		const s2 = jest.fn<void, [number, number]>();
		const u2 = a.listen(s2);
		expect(stop).not.toBeCalled();
		expect(s2).not.toBeCalled();

		set!(420);
		expect(stop).not.toBeCalled();
		expect(i1).toBeCalledTimes(1);
		expect(i1).toHaveBeenLastCalledWith();
		expect(s1).toBeCalledTimes(2);
		expect(s1).toHaveBeenLastCalledWith(420, 69);
		expect(s2).toBeCalledTimes(1);
		expect(s2).toHaveBeenLastCalledWith(420, 69);

		u1();
		expect(stop).not.toBeCalled();
		expect(i1).toBeCalledTimes(1);
		expect(s1).toBeCalledTimes(2);
		expect(s2).toBeCalledTimes(1);

		set!(-1);
		expect(stop).not.toBeCalled();
		expect(i1).toBeCalledTimes(1);
		expect(s1).toBeCalledTimes(2);
		expect(s2).toBeCalledTimes(2);
		expect(s2).toHaveBeenLastCalledWith(-1, 420);

		u2();
		expect(start).toBeCalledTimes(1);
		expect(stop).toBeCalledTimes(1);
		expect(stop).toHaveBeenLastCalledWith();
		expect(i1).toBeCalledTimes(1);
		expect(s1).toBeCalledTimes(2);
		expect(s2).toBeCalledTimes(2);

		u1();
		u2();
		expect(start).toBeCalledTimes(1);
		expect(stop).toBeCalledTimes(1);
		expect(i1).toBeCalledTimes(1);
		expect(s1).toBeCalledTimes(2);
		expect(s2).toBeCalledTimes(2);

		a.listen(s1, i1);
		expect(start).toBeCalledTimes(2);
		expect(start).toHaveBeenLastCalledWith(set, invalidate);
		expect(i1).toBeCalledTimes(1);
		expect(s1).toBeCalledTimes(2);

		set!(21);
		expect(start).toBeCalledTimes(2);
		expect(i1).toBeCalledTimes(2);
		expect(i1).toHaveBeenLastCalledWith();
		expect(s1).toBeCalledTimes(3);
		expect(s1).toHaveBeenLastCalledWith(21, -1);
	});

	test('initial value set in starter', () => {
		const a = writable<number | undefined>(undefined, (set) => {
			set(42);
		});
		const f = jest.fn<void, [number | undefined, number | undefined]>();
		a.subscribe(f);
		expect(f).toBeCalledTimes(1);
		expect(f).toHaveBeenCalledWith(42, 42);
	});

	test('skipping subscribers', () => {
		doTest();
		doTest('never');
		doTest('primitive');
		doTest('always');

		function doTest(skip?: WritableOptions['skipSubscribersWhenEqual']) {
			const always = skip === 'always';
			const never = skip === 'never';

			const a = writable<unknown>(42, () => void 0, {
				skipSubscribersWhenEqual: skip
			});
			const i = jest.fn<void, []>();
			const s = jest.fn<void, [unknown]>();

			a.listen(s, i);
			expect(i).toBeCalledTimes(0);
			expect(s).toBeCalledTimes(0);

			a.set(42);
			expect(i).toBeCalledTimes(never ? 1 : 0);
			expect(s).toBeCalledTimes(never ? 1 : 0);

			const o = {};
			a.set(o);
			expect(i).toBeCalledTimes(never ? 2 : 1);
			expect(s).toBeCalledTimes(never ? 2 : 1);

			a.set(o);
			expect(i).toBeCalledTimes(never ? 3 : always ? 1 : 2);
			expect(s).toBeCalledTimes(never ? 3 : always ? 1 : 2);
		}
	});
});

describe('readable', () => {
	test('basic functionality', () => {
		// constant readable
		const a = readable(420);
		const f = jest.fn<void, [number]>();
		expect(a.get()).toBe(420);
		expect(a).not.toHaveProperty('set');
		expect(a).not.toHaveProperty('update');
		expect(a).not.toHaveProperty('invalidate');

		const u = a.subscribe(f);
		expect(typeof u).toBe('function');
		expect(f).toBeCalledTimes(1);
		expect(f).toHaveBeenLastCalledWith(420, 420);

		// mutating readable
		let set: Setter<number> | undefined;
		let invalidate: Invalidator | undefined;
		const stop = jest.fn<void, []>();
		const start = jest.fn((s: Setter<number>, i: Invalidator) => {
			set = s;
			invalidate = i;
			return stop;
		});

		const b = readable(69, start);
		expect(start).not.toBeCalled();
		expect(stop).not.toBeCalled();

		const g = jest.fn<void, [number]>();
		const i = jest.fn<void, []>();
		const v = b.subscribe(g, i);
		expect(start).toBeCalledWith(set, invalidate);
		expect(stop).not.toBeCalled();
		expect(g).toBeCalledWith(69, 69);
		expect(i).not.toBeCalled();

		invalidate!();
		expect(i).toBeCalledWith();
		expect(g).toBeCalledTimes(1);

		set!(-1 / 12);
		expect(i).toBeCalledTimes(1);
		expect(g).toHaveBeenLastCalledWith(-1 / 12, 69);

		v();
		expect(stop).toBeCalledWith();
	});

	test('readonly writable', () => {
		const a = writable(123);
		const b = readable(a);
		const f = jest.fn();
		const g = jest.fn();

		b.subscribe(f, g);
		expect(f).toBeCalledTimes(1);
		expect(g).not.toBeCalled();

		a.invalidate();
		expect(f).toBeCalledTimes(1);
		expect(g).toBeCalledTimes(1);

		a.set(456);
		expect(f).toBeCalledTimes(2);
		expect(f).toHaveBeenLastCalledWith(456, 123);
		expect(g).toBeCalledTimes(1);

		a.set(789);
		expect(f).toBeCalledTimes(3);
		expect(f).toHaveBeenLastCalledWith(789, 456);
		expect(g).toBeCalledTimes(2);
	});
});

describe('get', () => {
	test('basic functionality', () => {
		const a = writable(1);
		const b: IReadable<number> = { subscribe: a.subscribe };
		const c: IReadable<number> = {
			subscribe(r) {
				return { unsubscribe: a.subscribe(r) };
			}
		};

		expect(a.get()).toBe(1);
		expect(get(a)).toBe(1);
		expect(get(b)).toBe(1);
		expect(get(c)).toBe(1);

		a.set(2);
		expect(a.get()).toBe(2);
		expect(get(a)).toBe(2);
		expect(get(b)).toBe(2);
		expect(get(c)).toBe(2);
	});

	test('throws if callback not called', () => {
		const a: IReadable<number> = {
			subscribe() {
				return () => void 0;
			}
		};

		expect(() => get(a)).toThrowError(TypeError);
	});
});
