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
    * @member indexes A mapping of the address to the index in the set, counted from 1 (rather than 0)
    */
    struct Set {
        // TODO: optimize storage structure
        address[] elements;
        mapping(address => uint256) indexes;
    }

    /**
    * @notice Add an element to the set (internal)
    * @param self The set
    * @param value The element to add
    * @return False if the element is already in the set or is address 0x0
    */
    function add(Set storage self, address value) internal returns (bool)
    {
        if (self.indexes[value] != 0 || value == address(0)) {
            return false;
        }

        self.elements.push(value);
        self.indexes[value] = self.elements.length;
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
        if (self.indexes[value] == 0) {
            return false;
        }

        delete(self.elements[self.indexes[value] - 1]);
        self.indexes[value] = 0;
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
        return self.indexes[value] != 0;
    }
}
