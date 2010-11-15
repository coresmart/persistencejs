# jquery.persistence.js

`jquery.persistence.js` is a jquery plugin for `persistence.js` that
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
         

## jQuery mobile integration
jQuery mobile (jqm) ajax request re-routing to persitencejs for:  

* html text: caches ajax-loaded HTML pages in local DB
* images (in `img` tags of ajax-loaded HTML pages): grabs/encodes them via `canvas` and caches them as data-URL strings in local DB
* form submission

re-routed URL paths have the following format:
    
    optional/path/prefix  / entity-name / path/to/response-template-key

URL needs to match the following criteria for re-routing:  

* path prefix must be equal `persistence.jqmUrlPathPrefix` 
* entity with given entity-name must exist
  
Global settings (and it's default values):

    persistence.jqmUrlPathPrefix  = ""; 
    persistence.jqmPathField = "path";  // (Page entity path field name)
    persistence.jqmDataField`= "data";  // (Page entity data field name)

Ajax page loading example:

    URL: "docs_controller/path/docs/about/intro.html"
    persistence.jqmUrlPathPrefix = "docs_controller/path"
    => entity name: "Docs"
    => path: "about/intro.html"

Ajax form submission examples: 

    URL (GET): "form_controller/path/orderform/response.html?shipment=express"
    persistence.jqmUrlPathPrefix = "form_controller/path"
    => entity name: "Orderform"
    => entity fields: retrieved from URL
    => path: "response.html"

    URL (POST): "form_controller/path/orderform/response.html"
    persistence.jqmUrlPathPrefix = "form_controller/path"
    => entity name: "Orderform" 
    => entity fields: retrieved from POST data
    => path: "response.html"