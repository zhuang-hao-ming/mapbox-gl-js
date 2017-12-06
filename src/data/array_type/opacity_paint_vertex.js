// This file is generated. Edit build/generate-struct-arrays.js, then run `node build/generate-struct-arrays.js`.
// @flow
/* eslint-disable camelcase */
const StructArrayLayout_4_1f = require('./struct_array_layout_4_1f');
const {register} = require('../../util/web_worker_transfer');

class OpacityPaintVertexStructArray extends StructArrayLayout_4_1f {
}

OpacityPaintVertexStructArray.prototype.members = [{"name":"a_opacity", "type":"Float32", "components":1, "offset":0, "size":4, "view":"float32"}];

register('OpacityPaintVertexStructArray', OpacityPaintVertexStructArray);

module.exports = OpacityPaintVertexStructArray;
