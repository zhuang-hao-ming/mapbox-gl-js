// @flow

'use strict';

class Benchmark {
    constructor() {
        this._async = this._async.bind(this);
    }

    /**
     * The `setup` method is intended to be overridden by subclasses. It will be called once, prior to
     * running any benchmark iterations, and may set state on `this` which the benchmark later accesses.
     * If the setup involves an asynchronous step, `setup` may return a promise.
     */
    setup(): Promise<void> | void {}

    /**
     * The `bench` method is intended to be overridden by subclasses. It should contain the code to be
     * benchmarked. It may access state on `this` set by the `setup` function (but should not modify this
     * state). It will be called multiple times, the total number to be determined by the harness. If
     * the benchmark involves an asynchronous step, `bench` may return a promise.
     */
    bench(): Promise<void> | void {}

    /**
     * The `teardown` method is intended to be overridden by subclasses. It will be called once, after
     * running all benchmark iterations, and may perform any necessary cleanup. If cleaning up involves
     * an asynchronous step, `teardown` may return a promise.
     */
    teardown(): Promise<void> | void {}

    _async: () => Promise<Array<number>>;
    _elapsed: number;
    _samples: Array<number>;
    _start: number;

    /**
     * Run the benchmark by executing `setup` once, sampling the execution time of `bench` some number of
     * times, and then executing `teardown`. Yields an array of execution times.
     */
    run(): Promise<Array<number>> {
        return Promise.resolve(this.setup()).then(() => this._begin());
    }

    _begin(): Promise<Array<number>> {
        this._samples = [];
        this._elapsed = 0;
        this._start = performance.now();

        const bench = this.bench();
        if (bench instanceof Promise) {
            return bench.then(this._async);
        } else {
            return this._sync();
        }
    }

    _sync(): Promise<Array<number>> {
        // Avoid Promise overhead for sync benchmarks.
        while (true) {
            const sample = performance.now() - this._start;
            this._samples.push(sample);
            this._elapsed += sample;
            if (this._elapsed >= 1000) {
                return this._end();
            }
            this._start = performance.now();
            this.bench();
        }

        // Unreachable, but placate flow.
        return this._end();
    }

    _async(): Promise<Array<number>> {
        const sample = performance.now() - this._start;
        this._samples.push(sample);
        this._elapsed += sample;
        if (this._elapsed >= 1000) {
            return this._end();
        }
        this._start = performance.now();
        return ((this.bench(): any): Promise<void>).then(this._async);
    }

    _end(): Promise<Array<number>> {
        return Promise.resolve(this.teardown()).then(() => this._samples);
    }
}

module.exports = Benchmark;
