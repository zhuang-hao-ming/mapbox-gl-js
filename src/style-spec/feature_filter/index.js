// @flow

const {createExpression} = require('../expression');

const isEvalSupported = require('../util/eval_support');

import type {GlobalProperties} from '../expression';
export type FeatureFilter = (globalProperties: GlobalProperties, feature: VectorTileFeature) => boolean;

module.exports = createFilter;
module.exports.isExpressionFilter = isExpressionFilter;

function isExpressionFilter(filter) {
    if (!Array.isArray(filter) || filter.length === 0) {
        return false;
    }
    switch (filter[0]) {
    case 'has':
        return filter.length >= 2 && filter[1] !== '$id' && filter[1] !== '$type';

    case 'in':
    case '!in':
    case '!has':
    case 'none':
        return false;

    case '==':
    case '!=':
    case '>':
    case '>=':
    case '<':
    case '<=':
        return filter.length === 3 && (Array.isArray(filter[1]) || Array.isArray(filter[2]));

    case 'any':
    case 'all':
        for (const f of filter.slice(1)) {
            if (!isExpressionFilter(f) && typeof f !== 'boolean') {
                return false;
            }
        }
        return true;

    default:
        return true;
    }
}

const types = ['Unknown', 'Point', 'LineString', 'Polygon'];

const filterSpec = {
    'type': 'boolean',
    'default': false,
    'function': true,
    'property-function': true,
    'zoom-function': true
};

/**
 * Given a filter expressed as nested arrays, return a new function
 * that evaluates whether a given feature (with a .properties or .tags property)
 * passes its test.
 *
 * @private
 * @param {Array} filter mapbox gl filter
 * @returns {Function} filter-evaluating function
 */
function createFilter(filter: any): FeatureFilter {
    if (!filter) {
        return () => true;
    }

    const isExpression = isExpressionFilter(filter);
    if (!isExpression && isEvalSupported) {
        return (new Function('g', 'f', `var p = (f && f.properties || {}); return ${compile(filter)}`): any);
    } else if (!isExpression) {
        filter = convertFilter(filter);
    }

    const compiled = createExpression(filter, filterSpec);
    if (compiled.result === 'error') {
        throw new Error(compiled.value.map(err => `${err.key}: ${err.message}`).join(', '));
    } else {
        return compiled.value.evaluate;
    }
}

function compile(filter) {
    if (!filter) return 'true';
    const op = filter[0];
    if (filter.length <= 1) return op === 'any' ? 'false' : 'true';
    const str =
        op === '==' ? compileComparisonOp(filter[1], filter[2], '===', false) :
        op === '!=' ? compileComparisonOp(filter[1], filter[2], '!==', false) :
        op === '<' ||
        op === '>' ||
        op === '<=' ||
        op === '>=' ? compileComparisonOp(filter[1], filter[2], op, true) :
        op === 'any' ? compileLogicalOp(filter.slice(1), '||') :
        op === 'all' ? compileLogicalOp(filter.slice(1), '&&') :
        op === 'none' ? compileNegation(compileLogicalOp(filter.slice(1), '||')) :
        op === 'in' ? compileInOp(filter[1], filter.slice(2)) :
        op === '!in' ? compileNegation(compileInOp(filter[1], filter.slice(2))) :
        op === 'has' ? compileHasOp(filter[1]) :
        op === '!has' ? compileNegation(compileHasOp(filter[1])) :
        'true';
    return `(${str})`;
}

function compilePropertyReference(property) {
    const ref =
        property === '$type' ? 'f.type' :
        property === '$id' ? 'f.id' : `p[${JSON.stringify(property)}]`;
    return ref;
}

function compileComparisonOp(property, value, op, checkType) {
    const left = compilePropertyReference(property);
    const right = property === '$type' ? types.indexOf(value) : JSON.stringify(value);
    return (checkType ? `typeof ${left}=== typeof ${right}&&` : '') + left + op + right;
}

function compileLogicalOp(expressions, op) {
    return expressions.map(compile).join(op);
}

function compileInOp(property, values) {
    if (property === '$type') values = values.map((value) => {
        return types.indexOf(value);
    });
    const left = JSON.stringify(values.sort(compare));
    const right = compilePropertyReference(property);

    if (values.length <= 200 || values.some(v => typeof v !== typeof values[0])) return `${left}.indexOf(${right}) !== -1`;

    return `${'function(v, a, i, j) {' +
        'while (i <= j) { var m = (i + j) >> 1;' +
        '    if (a[m] === v) return true; if (a[m] > v) j = m - 1; else i = m + 1;' +
        '}' +
    'return false; }('}${right}, ${left},0,${values.length - 1})`;
}

function compileHasOp(property) {
    return property === '$id' ? '"id" in f' : `${JSON.stringify(property)} in p`;
}

function compileNegation(expression) {
    return `!(${expression})`;
}

// Comparison function to sort numbers and strings
function compare(a, b) {
    return a < b ? -1 : a > b ? 1 : 0;
}

function convertFilter(filter: ?Array<any>): mixed {
    if (!filter) return true;
    const op = filter[0];
    if (filter.length <= 1) return (op !== 'any');
    const converted =
        op === '==' ? convertComparisonOp(filter[1], filter[2], '==') :
        op === '!=' ? convertNegation(convertComparisonOp(filter[1], filter[2], '==')) :
        op === '<' ||
        op === '>' ||
        op === '<=' ||
        op === '>=' ? convertComparisonOp(filter[1], filter[2], op) :
        op === 'any' ? convertDisjunctionOp(filter.slice(1)) :
        op === 'all' ? ['all'].concat(filter.slice(1).map(convertFilter)) :
        op === 'none' ? ['all'].concat(filter.slice(1).map(convertFilter).map(convertNegation)) :
        op === 'in' ? convertInOp(filter[1], filter.slice(2)) :
        op === '!in' ? convertNegation(convertInOp(filter[1], filter.slice(2))) :
        op === 'has' ? convertHasOp(filter[1]) :
        op === '!has' ? convertNegation(convertHasOp(filter[1])) :
        true;
    return converted;
}

function convertComparisonOp(property: string, value: any, op: string) {
    switch (property) {
    case '$type':
        return [`filter-type-${op}`, value];
    case '$id':
        return [`filter-id-${op}`, value];
    default:
        return [`filter-${op}`, property, value];
    }
}

function convertDisjunctionOp(filters: Array<Array<any>>) {
    return ['any'].concat(filters.map(convertFilter));
}

function convertInOp(property: string, values: Array<any>) {
    if (values.length === 0) { return false; }
    switch (property) {
    case '$type':
        return [`filter-type-in`, ['literal', values]];
    case '$id':
        return [`filter-id-in`, ['literal', values]];
    default:
        if (values.length > 200 && !values.some(v => typeof v !== typeof values[0])) {
            return ['filter-in-large', property, ['literal', values.sort(compare)]];
        } else {
            return ['filter-in-small', property, ['literal', values]];
        }
    }
}

function convertHasOp(property: string) {
    switch (property) {
    case '$type':
        return true;
    case '$id':
        return [`filter-has-id`];
    default:
        return [`filter-has`, property];
    }
}

function convertNegation(filter: mixed) {
    return ['!', filter];
}

