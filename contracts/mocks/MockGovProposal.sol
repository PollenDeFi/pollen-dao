/// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8;

import "../interface/IPollenDAO.sol";

/// @title MovGovProposal
/// @notice This mock serves as a mock proposal for governance process

contract MockGovProposal {
    address public pollenDAOAddr;
    address public module;
    bytes4[] public selectors;

    constructor(
        address _pollenDAO,
        address _module,
        bytes4[] memory _selectors
    ) {
        pollenDAOAddr = _pollenDAO;
        module = _module;
        selectors = _selectors;
    }

    function execute() external {
        IPollenDAO DAO = IPollenDAO(pollenDAOAddr);
        DAO.addModule(module, selectors);
    }
}
