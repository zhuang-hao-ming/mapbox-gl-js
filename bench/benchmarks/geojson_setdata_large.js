'use strict';

const Benchmark = require('../lib/benchmark');
const createMap = require('../lib/create_map');

module.exports = class GeoJSONSetDataLarge extends Benchmark {
    setup() {
        return fetch('/bench/data/naturalearth-land.json')
            .then(response => response.json())
            .then(json => { this.data = json; })
            .then(() => createMap({
                width: 1024,
                height: 768,
                zoom: 5,
                center: [-77.032194, 38.912753],
                style: 'mapbox://styles/mapbox/light-v9'
            }))
            .then(map => {
                this.map = map;
                this.map.addSource('geojson', {
                    'type': 'geojson',
                    'data': {
                        'type': 'FeatureCollection',
                        'features': []
                    }
                });
                this.map.addLayer({
                    'id': 'geojson-polygon',
                    'source': 'geojson',
                    'type': 'fill',
                    'filter': ['==', '$type', 'Polygon']
                });
            });
    }

    bench() {
        return new Promise((resolve) => {
            const sourceCache = this.map.style.sourceCaches.geojson;

            sourceCache.on('data', function onData() {
                if (sourceCache.loaded()) {
                    sourceCache.off('data', onData);
                    resolve();
                }
            });

            sourceCache.getSource().setData(this.data);
        });
    }

    teardown() {
        this.map.remove();
    }
};
