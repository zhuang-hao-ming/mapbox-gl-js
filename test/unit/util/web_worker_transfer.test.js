// @flow

'use strict';

const test = require('mapbox-gl-js-test').test;
const {register, serialize, deserialize} = require('../../../src/util/web_worker_transfer');

test('round trip', (t) => {
    class Foo {
        n: number;
        buffer: ArrayBuffer;
        _cached: ?number;

        constructor(n) {
            this.n = n;
            this.buffer = new ArrayBuffer(100);
            (this.buffer: any).transfer = true;
            this.squared();
        }

        squared() {
            if (this._cached) {
                return this._cached;
            }
            (Object.defineProperty: any)(this, '_cached', {
                writable: true,
                enumerable: false,
                value: this.n * this.n
            });
            return this._cached;
        }
    }

    register(Foo);

    const foo: Foo = new Foo(10);
    const transferables = [];
    const bar: Foo = (deserialize(serialize(foo, transferables)): any);
    t.assert(foo !== bar);
    t.assert(bar.constructor === Foo);
    t.assert(bar instanceof Foo);
    t.assert(bar.n === 10);
    t.assert(bar.buffer === foo.buffer);
    t.assert(transferables[0] === foo.buffer);
    t.assert(bar._cached === undefined);
    t.assert(bar.squared() === 100);
    t.end();
});
