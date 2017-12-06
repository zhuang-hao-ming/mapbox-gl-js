// This file is generated. Edit build/generate-struct-arrays.js, then run `node build/generate-struct-arrays.js`.
// @flow
/* eslint-disable camelcase */
const StructArrayLayout_1_1ul2ui = require('./struct_array_layout_1_1ul2ui');
const {register} = require('../../util/web_worker_transfer');

class FeatureIndexStructArray extends StructArrayLayout_1_1ul2ui {
}

FeatureIndexStructArray.prototype.members = [{"name":"featureIndex", "type":"Uint32", "components":1, "offset":0, "size":4, "view":"uint32"}, {"name":"sourceLayerIndex", "type":"Uint16", "components":1, "offset":4, "size":2, "view":"uint16"}, {"name":"bucketIndex", "type":"Uint16", "components":1, "offset":6, "size":2, "view":"uint16"}];

register('FeatureIndexStructArray', FeatureIndexStructArray);

module.exports = FeatureIndexStructArray;
