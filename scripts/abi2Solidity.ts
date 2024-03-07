import fs from 'fs';
import path from 'path';

import * as dree from 'dree';

/// Modified from https://github.com/maxme/abi2solidity

/**
 * Formats the list of arguments of a function or an event
 * @param inputs list of arguments
 * @param isFunction true if it is a function
 * @param isReturns true if it is the returning arguments
 * @returns arguments formatted
 */
function formatArguments(inputs: any, isFunction: boolean, isReturns: boolean): string {
  let out = '';
  for (let i = 0; i < inputs.length; i += 1) {
    if (inputs[i].type.match(/tuple/)) {
      out += inputs[i].internalType.match(/\.(\w+\[?\]?$)/)[1];
    } else {
      out += inputs[i].type;
    }
    if (isFunction && inputs[i].type.match(/string|bytes$|\[\]|tuple/)) {
      out += isReturns ? ' memory' : ' calldata';
    }
    if (inputs[i].name) {
      out += ` ${inputs[i].name}`;
    }
    if (i !== inputs.length - 1) {
      out += ', ';
    }
  }
  return out;
}

/**
 * Formats a function or an event into solidity code
 * @param method function or event in ABI format
 * @returns function or event formatted
 */
function getMethodInterface(method: any): string | null {
  const out = [];

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
  out.push(formatArguments(method.inputs, method.type === 'function', false));
  out.push(')');
  // Mutability
  if (method.type === 'function') {
    out.push('external');
  }
  // State mutability
  if (method.stateMutability === 'pure') {
    out.push('pure');
  } else if (method.stateMutability === 'view') {
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
    out.push(formatArguments(method.outputs, method.type === 'function', true));
    out.push(')');
  }
  return out.join(' ');
}

/**
 * Converts ABI json to solidity code with custom header
 * @param header header of the contract
 * @param abi abi to be converted
 * @returns solidity code
 */
function ABI2Solidity(header: string, abi: any): string {
  const jsonABI = abi;
  let out = '';

  for (const method of jsonABI) {
    const methodString = getMethodInterface(method);
    if (methodString) {
      out += `  ${getMethodInterface(method)};\n`;
    }
  }

  return header + out + '}\n';
}

/**
 * Read and get all functions and events from the ABIs
 * Combines all functions and events into a single ABI
 * @param paths list of folders or files to be added
 * @returns concatenated array of functions and events
 */
function getContractABIs(paths: any): any[] {
  let abis: any[] = [];
  const fileCallback = (file: any) => {
    if (!file.name.match(/^\w+\.json$/)) return;

    const artifact = fs.readFileSync(file.path, { encoding: 'utf8' });
    const abi = JSON.parse(artifact).abi;

    abis = [...abis, ...abi];
  };

  for (const _path of paths) {
    dree.scan(
      _path,
      { extensions: ['json'] },
      fileCallback
    );
  }

  return abis;
}

/**
 * Write interface file
 * @param header header of the interface
 * @param paths list of folders or files to be added
 * @param output path to the output file
 */
function writeInterface(header: string, paths: string[], output: string): void {
  const abis = getContractABIs(paths);
  const solidity = ABI2Solidity(header, abis);
  if (output === '') {
    // default to stdout
    console.log('------------ Solidity interface:');
    console.log(solidity);
  } else {
    fs.writeFile(output, solidity, (err2) => {
      if (err2) console.error(err2);
    });
  }
}

function pollenDaoInterface(): void {
  const pathsIPollenDAO = [
    path.resolve(__dirname, '..', 'artifacts', 'contracts', 'Mocks', 'mockModule'),
    path.resolve(__dirname, '..', 'artifacts', 'contracts', 'Mocks', 'MockGetters.sol'),
    path.resolve(__dirname, '..', 'artifacts', 'contracts', 'Mocks', 'MockGovGetters.sol'),
    path.resolve(__dirname, '..', 'artifacts', 'contracts', 'Mocks', 'MockMinterGetters.sol'),
    path.resolve(__dirname, '..', 'artifacts', 'contracts', 'PollenDAO')
  ];
  const HEADER_POLLEN_DAO =
`/// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8;

/// @title IPollenDAO
/// @notice Pollen DAO interface

struct Portfolio {
  uint256[] assetAmounts;
  uint8[] weights;
  uint256 initialValue;
  bool open;
}

struct IssuanceInfo {
  uint256 maxTime; 
  uint256 offsetX;
  uint256 offsetY; 
  uint256 rate; 
}

interface IPollenDAO {
`;

  writeInterface(
    HEADER_POLLEN_DAO,
    pathsIPollenDAO,
    path.resolve(__dirname, '..', 'contracts', 'interface', 'IPollenDAO.sol')
  );
}

function leaguesInterface(): void {
  const pathsIPollenDAO = [
    path.resolve(__dirname, '..', 'artifacts', 'contracts', 'Leagues')
  ];
  const HEADER_POLLEN_DAO =
      `/// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8;

/// @title ILeagues
/// @notice Leagues interface


interface ILeagues {
`;

  writeInterface(
    HEADER_POLLEN_DAO,
    pathsIPollenDAO,
    path.resolve(__dirname, '..', 'contracts', 'interface', 'ILeagues.sol')
  );
}

pollenDaoInterface();
leaguesInterface();
