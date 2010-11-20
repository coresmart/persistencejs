# persistence.jquery.js

`persistence.jquery.js` is a jquery plugin for `persistence.js` that
allows the usage of jquery notation for crossbrowser-access of
persistencejs entities.
 
Example
-------

Simple example:

    var User = persistence.define('User', {
      firstname: "TEXT",
      lastname: "TEXT"
    });

    var user = new User({firstname: "Joe", lastname: "Doo"});

    // setter   
    $(user).data('firstname', "Mike") 

    // getter
    console.log($(user).data('firstname')); // => Mike

You can find more examples in `test/test.persistence-jquery.js`.