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

    u(); // forgets the current value
    expect(h).toBeCalledTimes(2);

    c.subscribe(f);
    expect(h).toBeCalledTimes(3);
    expect(h).toHaveBeenLastCalledWith(2, undefined, 2);
});

test("multiple stores, simple update, without initial value", () => {
    const update = jest.fn(([v, w]: number[], p: number | undefined, d: number[]) => v + w);
    const sub = jest.fn<void, [number, number]>();
    const inv = jest.fn<void, []>();

    const a = writable(1);
    const b = writable(2);
    const c = derived([a, b], update);

    expect(update).not.toBeCalled();
    expect(sub).not.toBeCalled();
    expect(inv).not.toBeCalled();

    expect(c.get()).toBe(3);
    expect(update).toBeCalledTimes(1);
    expect(update).toHaveBeenLastCalledWith([1, 2], undefined, [1, 2]);
    // has no subs → won't remember last value

    const u = c.subscribe(sub, inv);
    expect(update).toBeCalledTimes(2);
    expect(update).toHaveBeenLastCalledWith([1, 2], undefined, [1, 2]);
    expect(sub).toBeCalledTimes(1);
    expect(sub).toHaveBeenCalledWith(3, 3);

    a.set(4);
    expect(update).toBeCalledTimes(3);
    expect(update).toHaveBeenLastCalledWith([4, 2], 3, [1 ,2]);

    u();
    expect(update).toBeCalledTimes(3);
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
    expect(f).toHaveBeenCalledWith(10, 10); // 0 + 10

    set(1);
    expect(f).toHaveBeenCalledTimes(2);
    expect(f).toHaveBeenCalledWith(11, 10); // 1 + 10

    set(10);
    expect(f).toHaveBeenCalledTimes(3);
    expect(f).toHaveBeenCalledWith(21, 11); // 10 + 11

    expect(b.get()).toBe(21);

    u(); //unsubscribe
    //the value of the derived store should reset now

    //changes ignored
    set(1);
    set(2);
    set(3);

    //only the last one matters
    set(-20);
    expect(f).toHaveBeenCalledTimes(3);
    expect(b.get()).toBe(-10); // a + initial = -20 + 10 = -10
    // immediately reset last value to initial (10)

    set(5);
    const c = derived([a, b], 100, ([$a, $b], $c) => $a + $b + $c);
    expect(c.get()).toBe(120); // 5 + (10+5) + 100

    c.subscribe(f);
    expect(c.get()).toBe(120);
    expect(f).toHaveBeenCalledTimes(4);
    expect(f).toHaveBeenCalledWith(120, 120);

    set(10);
    expect(b.get()).toBe(25); // 10 + 15
    expect(c.get()).toBe(155); // 10 + 25 + 120
});
