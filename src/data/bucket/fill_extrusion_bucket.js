// @flow

const {SegmentVector, MAX_VERTEX_ARRAY_LENGTH} = require('../segment');
const VertexBuffer = require('../../gl/vertex_buffer');
const IndexBuffer = require('../../gl/index_buffer');
const {ProgramConfigurationSet} = require('../program_configuration');
const createVertexArrayType = require('../vertex_array_type');
const {TriangleIndexArray} = require('../index_array_type');
const loadGeometry = require('../load_geometry');
const EXTENT = require('../extent');
const earcut = require('earcut');
const classifyRings = require('../../util/classify_rings');
const assert = require('assert');
const EARCUT_MAX_RINGS = 500;

import type {Bucket, IndexedFeature, PopulateParameters, SerializedBucket} from '../bucket';
import type {ProgramInterface} from '../program_configuration';
import type StyleLayer from '../../style/style_layer';
import type {StructArray} from '../../util/struct_array';
import type Point from '@mapbox/point-geometry';

const fillExtrusionInterface = {
    layoutAttributes: [
        {name: 'a_pos',          components: 2, type: 'Int16'},
        {name: 'a_normal',       components: 3, type: 'Int16'},
        {name: 'a_edgedistance', components: 1, type: 'Int16'}
    ],
    indexArrayType: TriangleIndexArray,

    paintAttributes: [
        {property: 'fill-extrusion-base'},
        {property: 'fill-extrusion-height'},
        {property: 'fill-extrusion-color'}
    ]
};

const FACTOR = Math.pow(2, 13);

function addVertex(vertexArray, x, y, nx, ny, nz, t, e) {
    vertexArray.emplaceBack(
        // a_pos
        x,
        y,
        // a_normal
        Math.floor(nx * FACTOR) * 2 + t,
        ny * FACTOR * 2,
        nz * FACTOR * 2,

        // a_edgedistance
        Math.round(e)
    );
}

const LayoutVertexArrayType = createVertexArrayType(fillExtrusionInterface.layoutAttributes);

class FillExtrusionBucket implements Bucket {
    static programInterface: ProgramInterface;

    index: number;
    zoom: number;
    overscaling: number;
    layers: Array<StyleLayer>;

    layoutVertexArray: StructArray;
    layoutVertexBuffer: VertexBuffer;

    indexArray: StructArray;
    indexBuffer: IndexBuffer;

    programConfigurations: ProgramConfigurationSet;
    segments: SegmentVector;
    uploaded: boolean;

    constructor(options: any) {
        this.zoom = options.zoom;
        this.overscaling = options.overscaling;
        this.layers = options.layers;
        this.index = options.index;

        this.layoutVertexArray = new LayoutVertexArrayType(options.layoutVertexArray);
        this.indexArray = new TriangleIndexArray(options.indexArray);
        this.programConfigurations = new ProgramConfigurationSet(fillExtrusionInterface, options.layers, options.zoom, options.programConfigurations);
        this.segments = new SegmentVector(options.segments);
    }

    populate(features: Array<IndexedFeature>, options: PopulateParameters) {
        for (const {feature, index, sourceLayerIndex} of features) {
            if (this.layers[0].filter(feature)) {
                const geometry = loadGeometry(feature);
                this.addFeature(feature, geometry);
                options.featureIndex.insert(feature, geometry, index, sourceLayerIndex, this.index);
            }
        }
    }

    isEmpty() {
        return this.layoutVertexArray.length === 0;
    }

    serialize(transferables?: Array<Transferable>): SerializedBucket {
        return {
            zoom: this.zoom,
            layerIds: this.layers.map((l) => l.id),
            layoutVertexArray: this.layoutVertexArray.serialize(transferables),
            indexArray: this.indexArray.serialize(transferables),
            programConfigurations: this.programConfigurations.serialize(transferables),
            segments: this.segments.get(),
        };
    }

    upload(gl: WebGLRenderingContext) {
        this.layoutVertexBuffer = new VertexBuffer(gl, this.layoutVertexArray);
        this.indexBuffer = new IndexBuffer(gl, this.indexArray);
        this.programConfigurations.upload(gl);
    }

    destroy() {
        if (!this.layoutVertexBuffer) return;
        this.layoutVertexBuffer.destroy();
        this.indexBuffer.destroy();
        this.programConfigurations.destroy();
        this.segments.destroy();
    }

    // addFeature is run on each individual geometry feature contained in a fill-extrusion layer
    addFeature(feature: VectorTileFeature, geometry: Array<Array<Point>>) {
        // As we do in fill_bucket, we need to iterate over potential multipolygons;
        // for most cases this will only be a single polygon.
        for (const polygon of classifyRings(geometry, EARCUT_MAX_RINGS)) {
            let numVertices = 0;
            for (const ring of polygon) {
                numVertices += ring.length;
            }

            let segment = this.segments.prepareSegment(4, this.layoutVertexArray, this.indexArray);

            // As we do in fill_bucket, we need to iterate here in case we
            // have interior holes. In the case of a simple polygon, this
            // is an array of length 1.
            for (const ring of polygon) {
                if (ring.length === 0) {
                    continue;
                }

                let edgeDistance = 0;

                // Now we iterate over the individual vertices within a ring to
                // add the "walls."
                for (let p = 0; p < ring.length; p++) {
                    const p1 = ring[p];

                    if (p >= 1) {
                        const p2 = ring[p - 1];

                        // isBoundaryEdge does a coarse check to ensure this
                        // edge isn't one artificially created where a polygon
                        // feature crosses a tile boundary; if that's the case,
                        // we don't need to add that wall as it would be occluded
                        // by the extruded feature on the adjoining tile.
                        if (!isBoundaryEdge(p1, p2)) {
                            if (segment.vertexLength + 4 > MAX_VERTEX_ARRAY_LENGTH) {
                                segment = this.segments.prepareSegment(4, this.layoutVertexArray, this.indexArray);
                            }

                            // Here we calculate the normal vector (the unit
                            // vector pointing perpendicularly from the edge);
                            // this is saved as an attribute on these vertices
                            // and is used for lighting.
                            const perp = p1.sub(p2)._perp()._unit();

                            // Here we add the bottom and top vertices of the
                            // near end of this wall.
                            addVertex(this.layoutVertexArray, p1.x, p1.y, perp.x, perp.y, 0, 0, edgeDistance);
                            addVertex(this.layoutVertexArray, p1.x, p1.y, perp.x, perp.y, 0, 1, edgeDistance);

                            // We track distance along the edge of an extrusion
                            // in order to tile patterns well along walls, in
                            // the case of patterned extrusions.
                            edgeDistance += p2.dist(p1);

                            // Now we add the bottom and top vertices of the next
                            // end of this wall.
                            addVertex(this.layoutVertexArray, p2.x, p2.y, perp.x, perp.y, 0, 0, edgeDistance);
                            addVertex(this.layoutVertexArray, p2.x, p2.y, perp.x, perp.y, 0, 1, edgeDistance);

                            const bottomRight = segment.vertexLength;

                            // Add two triangles to the index array that will
                            // make up the rectangular wall.
                            this.indexArray.emplaceBack(bottomRight, bottomRight + 1, bottomRight + 2);
                            this.indexArray.emplaceBack(bottomRight + 1, bottomRight + 2, bottomRight + 3);

                            segment.vertexLength += 4;
                            segment.primitiveLength += 2;
                        }
                    }
                }
            }

            if (segment.vertexLength + numVertices > MAX_VERTEX_ARRAY_LENGTH) {
                segment = this.segments.prepareSegment(numVertices, this.layoutVertexArray, this.indexArray);
            }

            const flattened = [];
            const holeIndices = [];
            const triangleIndex = segment.vertexLength;

            // Now we'll iterate over the ring again to add the vertices that
            // make up the rooftop. (We can't share vertices with the walls
            // because these will have different normal vectors in order
            // to light these surfaces differently.)
            for (const ring of polygon) {
                if (ring.length === 0) {
                    continue;
                }

                if (ring !== polygon[0]) {
                    holeIndices.push(flattened.length / 2);
                }

                for (let i = 0; i < ring.length; i++) {
                    const p = ring[i];

                    // Add this roof vertex.
                    addVertex(this.layoutVertexArray, p.x, p.y, 0, 0, 1, 1, 0);

                    flattened.push(p.x);
                    flattened.push(p.y);
                }
            }

            // Like in fill_bucket, we use an algorithm called earcut to
            // calculate the triangles that will make up the roof polygon.
            const indices = earcut(flattened, holeIndices);
            assert(indices.length % 3 === 0);

            // Now add these triangle indices to the index array:
            for (let j = 0; j < indices.length; j += 3) {
                this.indexArray.emplaceBack(
                    triangleIndex + indices[j],
                    triangleIndex + indices[j + 1],
                    triangleIndex + indices[j + 2]);
            }

            segment.primitiveLength += indices.length / 3;
            segment.vertexLength += numVertices;
        }

        this.programConfigurations.populatePaintArrays(this.layoutVertexArray.length, feature);
    }
}

FillExtrusionBucket.programInterface = fillExtrusionInterface;

module.exports = FillExtrusionBucket;

function isBoundaryEdge(p1, p2) {
    return (p1.x === p2.x && (p1.x < 0 || p1.x > EXTENT)) ||
        (p1.y === p2.y && (p1.y < 0 || p1.y > EXTENT));
}
