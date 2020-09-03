// SPDX-License-Identifier: UNLICENSED

pragma solidity >=0.6 <0.7.0;

/**
* @title AddressSet Library
* @notice Library for representing a set of addresses
* @author gtlewis
*/
library AddressSet {
    /**
    * @notice Type for representing a set of addresses
    * @member elements The elements of the set, contains address 0x0 for deleted elements
    * @member indexes A mapping of the address to the index in the set (to avoid loops)
    */
    struct Set {
        address[] elements;
        mapping(address => Index) indexes;
    }

    /**
    * @notice Type for representing an index in the set
    * @member index The index in the set
    * @member exists False if the element has been deleted
    */
    struct Index {
        uint256 index;
        bool exists;
    }

    /**
    * @notice Add an element to the set (internal)
    * @param self The set
    * @param value The element to add
    * @return False if the element is already in the set or is address 0x0
    */
    function add(Set storage self, address value) internal returns (bool)
    {
        if (self.indexes[value].exists || value == address(0)) {
            return false;
        }

        self.elements.push(value);
        self.indexes[value].index = self.elements.length - 1;
        self.indexes[value].exists = true;
        return true;
    }

    /**
    * @notice Remove an element from the set (internal)
    * @param self The set
    * @param value The element to remove
    * @return False if the element is not in the set
    */
    function remove(Set storage self, address value) internal returns (bool)
    {
        if (!self.indexes[value].exists) {
            return false;
        }

        delete(self.elements[self.indexes[value].index]);
        self.indexes[value].exists = false;
        return true;
    }

    /**
    * @notice Returns true if an element is in the set (internal view)
    * @param self The set
    * @param value The element
    * @return True if the element is in the set 
    */
    function contains(Set storage self, address value) internal view returns (bool)
    {
        return self.indexes[value].exists;
    }
}
