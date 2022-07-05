import type { Subscriber } from 'svelte/store';
import { readable, writable } from './core';

test('basic functionality of writable', () => {
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
    a.update(v => ++v);
    expect(f).toBeCalledTimes(6);
    expect(f).toHaveBeenNthCalledWith(5, 3, 2, 'first sub');
    expect(f).toHaveBeenNthCalledWith(6, 3, 2, 'second sub');
    expect(a.get()).toBe(3);
});

test('listening on writable', () => {
    const a = writable('x');
    const f = jest.fn<void, [string]>();

    a.listen(f);
    expect(f).not.toHaveBeenCalled();

    a.set('foo');
    expect(f).toBeCalledTimes(1);
    expect(f).toHaveBeenLastCalledWith('foo', 'x');

    a.update(x => x + 'bar');
    expect(f).toBeCalledTimes(2);
    expect(f).toHaveBeenLastCalledWith('foobar', 'foo');
});

test('automatic invalidation of writable', () => {
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

    a.update(v => v**2);
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

test('manual invalidation of writable', () => {
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

test('lifetime of writable', () => {
    let set: Subscriber<number> | undefined;
    const stop = jest.fn<void, []>();
    const start = jest.fn((s: Subscriber<number>) => {
        a.get();
        set = s;
        return stop;
    });

    const a = writable(69, start);
    expect(start).not.toBeCalled();
    expect(stop).not.toBeCalled();

    const s1 = jest.fn<void, [number, number]>();
    const i1 = jest.fn<void, []>();
    const u1 = a.subscribe(s1, i1);
    expect(start).toBeCalledTimes(1);
    expect(start).toHaveBeenLastCalledWith(set);
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
    
    a.listen(s1, i1);
    expect(start).toBeCalledTimes(2);
    expect(start).toHaveBeenLastCalledWith(set);
    expect(i1).toBeCalledTimes(1);
    expect(s1).toBeCalledTimes(2);

    set!(21);
    expect(start).toBeCalledTimes(2);
    expect(i1).toBeCalledTimes(2);
    expect(i1).toHaveBeenLastCalledWith();
    expect(s1).toBeCalledTimes(3);
    expect(s1).toHaveBeenLastCalledWith(21, -1);
});

test('skipping subscribers of writable', () => {
    const a = writable<unknown>(42);
    const i = jest.fn<void, []>();
    const s = jest.fn<void, [unknown]>();

    a.listen(s, i);
    expect(i).not.toBeCalled();
    expect(s).not.toBeCalled();

    a.set(42);
    
});
