// @flow

const assert = require('assert');
const registry: {[string]: Class<any>} = {};

function register(klass: Class<any>) {
    assert(klass.name);
    assert(!registry[klass.name]);
    registry[klass.name] = klass;
}

register(Object);

export type Serialized =
    | null
    | void
    | boolean
    | number
    | string
    | Boolean
    | Number
    | String
    | Date
    | RegExp
    | ArrayBuffer
    | $ArrayBufferView
    | Array<Serialized>
    | {| name: string, properties: {+[string]: Serialized} |};

function serialize(input: mixed, transferables?: Array<Transferable>): Serialized {
    if (input === null ||
        input === undefined ||
        typeof input === 'boolean' ||
        typeof input === 'number' ||
        typeof input === 'string' ||
        input instanceof Boolean ||
        input instanceof Number ||
        input instanceof String ||
        input instanceof Date ||
        input instanceof RegExp) {
        return input;
    }

    if (input instanceof ArrayBuffer) {
        if (transferables && input.transfer) {
            transferables.push(input);
        }
        return input;
    }

    if (ArrayBuffer.isView(input)) {
        const view: $ArrayBufferView = (input: any);
        if (transferables && view.transfer) {
            transferables.push(view.buffer);
        }
        return view;
    }

    if (Array.isArray(input)) {
        return input.map((i) => serialize(i, transferables));
    }

    if (typeof input === 'object') {
        const name = input.constructor.name;
        if (!name) {
            throw new Error(`can't serialize object of anonymous class`);
        }

        if (!registry[name]) {
            throw new Error(`can't serialize unregistered class ${name}`);
        }

        const properties: {[string]: Serialized} = {};

        for (const key of Object.keys(input)) {
            properties[key] = serialize(input[key], transferables);
        }

        return {name, properties};
    }

    throw new Error(`can't serialize object of type ${typeof input}`);
}

function deserialize(input: Serialized): mixed {
    if (input === null ||
        input === undefined ||
        typeof input === 'boolean' ||
        typeof input === 'number' ||
        typeof input === 'string' ||
        input instanceof Boolean ||
        input instanceof Number ||
        input instanceof String ||
        input instanceof Date ||
        input instanceof RegExp ||
        input instanceof ArrayBuffer ||
        ArrayBuffer.isView(input)) {
        return input;
    }

    if (Array.isArray(input)) {
        return input.map((i) => deserialize(i));
    }

    if (typeof input === 'object') {
        const {name, properties} = input;
        if (!name) {
            throw new Error(`can't deserialize object of anonymous class`);
        }

        const klass = registry[name];
        if (!klass) {
            throw new Error(`can't deserialize unregistered class ${name}`);
        }

        const result = Object.create(klass.prototype);

        for (const key of Object.keys(properties)) {
            result[key] = deserialize(properties[key]);
        }

        return result;
    }

    throw new Error(`can't deserialize object of type ${typeof input}`);
}

module.exports = {
    register,
    serialize,
    deserialize
};
