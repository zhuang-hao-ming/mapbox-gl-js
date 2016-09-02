'use strict';

var jsdom = require('jsdom');
var util = require('./util');
var gl = require('gl');

var window = jsdom.jsdom().defaultView;

window.requestAnimationFrame = function(callback) { return setImmediate(callback, 0); };
window.cancelAnimationFrame = clearImmediate;

window.devicePixelRatio = 1;

window.HTMLCanvasElement.prototype.getContext = function(type, attributes) {
    if (!this.context) {
        var node = this;
        while (node.offsetWidth == null) {
            node = node.parentNode;
        }

        this.context = gl(
            node.offsetWidth * window.devicePixelRatio,
            node.offsetHeight * window.devicePixelRatio,
            util.extend({}, attributes, {preserveDrawingBuffer: true})
        );
    }
    return this.context;
};

module.exports = window;
