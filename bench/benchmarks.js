// @flow

'use strict';

require('../src').accessToken = require('./lib/access_token');

window.mapboxglVersions = window.mapboxglVersions || [];
window.mapboxglBenchmarks = window.mapboxglBenchmarks || {};

const version = process.env.BENCHMARK_VERSION;
window.mapboxglVersions.push('master');
window.mapboxglVersions.push(version);

function register(Benchmark) {
    const benchmarkArgs = Benchmark.getArguments();
    for (const arg of benchmarkArgs) {
        const label = arg.label ? `${Benchmark.name}/${arg.label}` : Benchmark.name;
        console.log('registering ', label, arg)
        window.mapboxglBenchmarks[label] = window.mapboxglBenchmarks[label] || {};
        window.mapboxglBenchmarks[label].master = [Benchmark, arg];
        window.mapboxglBenchmarks[label][version] = [Benchmark, arg];
    }
}

register(require('./benchmarks/layout'));
register(require('./benchmarks/layout_dds'));
register(require('./benchmarks/paint'));
register(require('./benchmarks/map_load'));
register(require('./benchmarks/style_load'));
register(require('./benchmarks/query_point'));
register(require('./benchmarks/query_box'));
register(require('./benchmarks/geojson_setdata_large'));
register(require('./benchmarks/geojson_setdata_small'));
register(require('./benchmarks/filter_create'));
register(require('./benchmarks/filter_evaluate'));

// Ensure the global worker pool is never drained. Browsers have resource limits
// on the max number of workers that can be created per page.
require('../src/util/global_worker_pool')().acquire(-1);
