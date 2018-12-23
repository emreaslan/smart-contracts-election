pragma solidity ^0.4.20;

contract Members {

    mapping(address => bool) public members;

    event signUpEvent ();

    function signUp() public {
        require(!members[msg.sender]);
        members[msg.sender] = true;
        signUpEvent();
    }
}
