import { writable } from "./core";
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
