'use strict';

const Benchmark = require('../lib/benchmark');
const createStyle = require('../lib/create_style');
const accessToken = require('../lib/access_token');

module.exports = class StyleLoad extends Benchmark {
    setup() {
        return fetch(`https://api.mapbox.com/styles/v1/mapbox/streets-v9?access_token=${accessToken}`)
            .then(response => response.json())
            .then(json => this.json = json);
    }

    bench() {
        return createStyle(this.json);
    }
};
