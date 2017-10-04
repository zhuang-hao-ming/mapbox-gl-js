#pragma mapbox: define highp vec4 color
#pragma mapbox: define lowp float opacity

void main() {
    // These #pragmas are an abstraction in this codebase that means: depending
    // on the layer style, it might be set as a uniform (same across all features
    // in a layer) or as an attribute (individually set for all different
    // features), but the important thing is that when the shader is compiled,
    // color and opacity will be correctly set.
    #pragma mapbox: initialize highp vec4 color
    #pragma mapbox: initialize lowp float opacity

    // gl_FragColor is set for each individual pixel (fragment) between the
    // three corners (vertices) of this feature. For fills, it's simply the
    // color multiplied by the opacity.
    gl_FragColor = color * opacity;

#ifdef OVERDRAW_INSPECTOR
    // Don't mind this -- just a debugging view.
    gl_FragColor = vec4(1.0);
#endif
}
