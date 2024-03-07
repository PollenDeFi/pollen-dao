"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from) {
    for (var i = 0, il = from.length, j = to.length; i < il; i++, j++)
        to[j] = from[i];
    return to;
};
exports.__esModule = true;
var fs_1 = require("fs");
var path_1 = require("path");
var dree = require("dree");
/// Modified from https://github.com/maxme/abi2solidity
function getInOrOut(inputs, isFunction) {
    var out = '';
    for (var i = 0; i < inputs.length; i += 1) {
        if (inputs[i].type.match(/tuple/)) {
            out += inputs[i].internalType.match(/\.(\w+\[?\]?$)/)[1];
        }
        else {
            out += inputs[i].type;
        }
        if (isFunction && inputs[i].type.match(/string|\[\]|tuple/)) {
            out += ' calldata';
        }
        if (inputs[i].name) {
            out += " " + inputs[i].name;
        }
        if (i !== inputs.length - 1) {
            out += ', ';
        }
    }
    return out;
}
function getMethodInterface(method) {
    var out = [];
    if (method.type !== 'function' && method.type !== 'event') {
        return null;
    }
    out.push(method.type);
    // Name
    if (method.name) {
        out.push(method.name);
    }
    // Inputs
    out.push('(');
    out.push(getInOrOut(method.inputs, method.type === 'function'));
    out.push(')');
    // Mutability
    if (method.type === 'function') {
        out.push('external');
    }
    // State mutability
    if (method.stateMutability === 'pure') {
        out.push('pure');
    }
    else if (method.stateMutability === 'view') {
        out.push('view');
    }
    // Payable
    if (method.payable) {
        out.push('payable');
    }
    // Outputs
    if (method.outputs && method.outputs.length > 0) {
        out.push('returns');
        out.push('(');
        out.push(getInOrOut(method.outputs, method.type === 'function'));
        out.push(')');
    }
    return out.join(' ');
}
function ABI2Solidity(abi) {
    var HEADER = "\n/// SPDX-License-Identifier: UNLICENSED\n\npragma solidity ^0.8;\n\n/// @title IPollenDAO\n/// @notice Pollen DAO interface\n\nstruct AssetBalance {\n  address asset;\n  uint256 balance;\n}\n\nstruct Portfolio {\n  uint256[] assetAmounts;\n  uint8[] weights;\n  uint256 initialValue;\n  bool open;\n}\n\ninterface IPollenDAO {\n";
    var FOOTER = '}\n';
    var jsonABI = abi;
    var out = '';
    for (var _i = 0, jsonABI_1 = jsonABI; _i < jsonABI_1.length; _i++) {
        var method = jsonABI_1[_i];
        var methodString = getMethodInterface(method);
        if (methodString) {
            out += "  " + getMethodInterface(method) + ";\n";
        }
    }
    return HEADER + out + FOOTER;
}
function getContractABIs(paths) {
    var abis = [];
    var fileCallback = function (file) {
        if (!file.name.match(/^\w+\.json$/))
            return;
        var artifact = fs_1["default"].readFileSync(file.path, { encoding: 'utf8' });
        var abi = JSON.parse(artifact).abi;
        abis = __spreadArray(__spreadArray([], abis), abi);
    };
    for (var _i = 0, paths_1 = paths; _i < paths_1.length; _i++) {
        var _path = paths_1[_i];
        dree.scan(_path, { extensions: ['json'] }, fileCallback);
    }
    return abis;
}
function main(output) {
    var paths = [
        path_1["default"].resolve(__dirname, '..', 'artifacts', 'contracts', 'Mocks', 'mockModule'),
        path_1["default"].resolve(__dirname, '..', 'artifacts', 'contracts', 'Mocks', 'MockGetters.sol'),
        path_1["default"].resolve(__dirname, '..', 'artifacts', 'contracts', 'PollenDAO')
    ];
    var abis = getContractABIs(paths);
    var solidity = ABI2Solidity(abis);
    if (output === '') {
        // default to stdout
        console.log('------------ Solidity interface:');
        console.log(solidity);
    }
    else {
        fs_1["default"].writeFile(output, solidity, function (err2) {
            if (err2)
                console.error(err2);
        });
    }
}
main(path_1["default"].resolve(__dirname, '..', 'contracts', 'interface', 'IPollenDAO.sol'));
