pragma solidity >=0.6 <0.7.0;

import "../lib/AddressSet.sol";

/**
* @title MockAddressSetWrapper Contract
* @notice A mock wrapper for the AddressSet library
* @author gtlewis
*/
contract MockAddressSetWrapper {
    using AddressSet for AddressSet.Set;

    /**
    * @notice The address set (private)
    */
    AddressSet.Set private addressSet;

    /**
    * @notice Get the elements of the set (external view)
    * @return The elements of the set
    */
    function getElements() external view returns (address[] memory)
    {
        return addressSet.elements;
    }

    /**
    * @notice Add an element to the set (external)
    * @param value The element to add
    * @return False if the element is already in the set or is address 0x0
    */
    function add(address value) external returns (bool)
    {
        return addressSet.add(value);
    }

    /**
    * @notice Remove an element from the set (external)
    * @param value The element to remove
    * @return False if the element is not in the set
    */
    function remove(address value) external returns (bool)
    {
        return addressSet.remove(value);
    }

    /**
    * @notice Returns true if an element is in the set (external view)
    * @param value The element
    * @return True if the element is in the set 
    */
    function contains(address value) external view returns (bool)
    {
        return addressSet.contains(value);
    }
}
