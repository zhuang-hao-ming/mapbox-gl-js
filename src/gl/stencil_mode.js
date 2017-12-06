// @flow
import type { CompareFuncType, StencilOpConstant } from './types';

const ALWAYS = 0x0207;
const KEEP = 0x1E00;

class StencilMode {
    func: CompareFuncType;
    ref: number;
    mask: number;
    sfail: StencilOpConstant;
    dpfail: StencilOpConstant;
    pass: StencilOpConstant;
    test: boolean;

    constructor(func: CompareFuncType, ref: number, mask: number, sfail: StencilOpConstant,
        dpfail: StencilOpConstant, pass: StencilOpConstant, test: ?boolean) {
        this.func = func;
        this.ref = ref;
        this.mask = mask;
        this.sfail = sfail;
        this.dpfail = dpfail;
        this.pass = pass;
        this.test = (test !== null && typeof test !== 'undefined') ? test :
            !(func === ALWAYS && !mask);
    }

    static disabled() {
        return new StencilMode(ALWAYS, 0, 0, KEEP, KEEP, KEEP);
    }
}

module.exports = StencilMode;
