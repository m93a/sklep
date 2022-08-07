import { writable, type IReadable, type IWritable } from "./core";
import { derived } from "./derived";

test("single store, simple update, without initial value", () => {
    const a = writable(1);
    const b = derived(a, x => 2 * x);
    const f = jest.fn<void, [number, number]>();
    const g = jest.fn<void, []>();

    b.subscribe(f, g);
    expect(g).not.toBeCalled();
    expect(f).toBeCalledTimes(1);
    expect(f).toHaveBeenLastCalledWith(2, 2);

    a.invalidate();
    expect(g).toBeCalledTimes(1);
    expect(g).toHaveBeenCalledWith();
    expect(f).toBeCalledTimes(1);

    a.set(2);
    expect(g).toBeCalledTimes(1);
    expect(f).toBeCalledTimes(2);
    expect(f).toHaveBeenLastCalledWith(4, 2);

    a.set(3);
    expect(g).toBeCalledTimes(2);
    expect(g).toHaveBeenLastCalledWith();
    expect(f).toBeCalledTimes(3);
    expect(f).toHaveBeenLastCalledWith(6, 4);

    const h = jest.fn((v: number, p: number | undefined, d: number) => v / 2);
    const c = derived(b, h);
    expect(h).not.toBeCalled();

    const u = c.subscribe(f);
    expect(h).toBeCalledTimes(1);
    expect(h).toHaveBeenCalledWith(6, undefined, 6);

    a.set(1);
    expect(h).toBeCalledTimes(2);
    expect(h).toHaveBeenLastCalledWith(2, 3, 6);

    u();
    expect(h).toBeCalledTimes(2);

    c.subscribe(f);
    expect(h).toBeCalledTimes(3);
    expect(h).toHaveBeenLastCalledWith(2, 1, 2);
});

test("multiple stores, simple update, without initial value", () => {
    const f = jest.fn(([v, w]: number[], p: number | undefined, d: number[]) => v + w);
    const g = jest.fn<void, [number, number]>();
    const h = jest.fn<void, []>();

    const a = writable(1);
    const b = writable(2);
    const c = derived([a, b], f);

    expect(f).not.toBeCalled();
    expect(g).not.toBeCalled();
    expect(h).not.toBeCalled();

    expect(c.get()).toBe(3);
    expect(f).toBeCalledTimes(1);
    expect(f).toHaveBeenCalledWith([1, 2], undefined, [1, 2]);

    const u = c.subscribe(g, h);
    expect(f).toBeCalledTimes(2);
    expect(f).toHaveBeenCalledWith([1, 2], 3, [1, 2]);
    expect(g).toBeCalledTimes(1);
    expect(g).toHaveBeenCalledWith(3, 3);

    a.set(4);
    expect(f).toBeCalledTimes(3);
    expect(f).toHaveBeenLastCalledWith([4, 2], 3, [1 ,2]);

    u();
    expect(f).toBeCalledTimes(3);
});

test("simple update, with initial value", () => {
    const { subscribe, set } = writable(0);
    const a: IReadable<number> = {
        subscribe(r, i?: any) {
            return { unsubscribe: subscribe(r, i) };
        }
    };
    const b = derived(a, 10, ($a, $b) => $b + $a);

    expect(b.get()).toBe(10);

    const f = jest.fn<void, [number, number]>();
    const u = b.subscribe(f);
    expect(f).toHaveBeenCalledTimes(1);
    expect(f).toHaveBeenCalledWith(10, 10);

    set(1);
    expect(f).toHaveBeenCalledTimes(2);
    expect(f).toHaveBeenCalledWith(11, 10);

    set(10);
    expect(f).toHaveBeenCalledTimes(3);
    expect(f).toHaveBeenCalledWith(21, 11);

    expect(b.get()).toBe(21);

    u(); //unsubscribe

    //changes ignored
    set(1);
    set(2);
    set(3);

    //only the last one matters
    set(-20);
    expect(f).toHaveBeenCalledTimes(3);
    expect(b.get()).toBe(1);
    set(0);

    const c = derived([a, b], 100, ([$a, $b], $c) => $a + $b + $c);
    expect(c.get()).toBe(101);

    c.subscribe(f);
    expect(c.get()).toBe(102);
    expect(f).toHaveBeenCalledTimes(4);
    expect(f).toHaveBeenCalledWith(102, 102);

    set(1);
    expect(b.get()).toBe(2);
    expect(c.get()).toBe(105);
});
