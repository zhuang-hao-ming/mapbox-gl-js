attribute vec2 a_pos;

uniform mat4 u_matrix;

#pragma mapbox: define highp vec4 color
#pragma mapbox: define lowp float opacity

// The fill vertex shaper is very simple: take a vertex's position attribute
// (relative to a tile), multiply it by the transformation matrix (relative
// to the screen) and put it down. (Don't worry about the #pragmas here.)
void main() {
    #pragma mapbox: initialize highp vec4 color
    #pragma mapbox: initialize lowp float opacity

    gl_Position = u_matrix * vec4(a_pos, 0, 1);
    // Now go to fill.fragment.glsl.
}
