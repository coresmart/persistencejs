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
    
    entity-name / path1/path2/../pathN

URL needs to match the following criteria for re-routing:  

* entity with given entity-name must exist
  
Global settings (and it's default values):

    persistence.jqmPathField = "path";    // Entity path-field name
    persistence.jqmDataField`= "data";    // Entity data-field name
    persistence.jqmTypeField`= "type";    // Entity MIME content-type-field name
    persistence.jqmImageEntityName = "";  // Overwrites default from embedding HTML-page URL

Ajax page loading example:

    URL: "docs/about/intro.html"
    => entity name: "Docs"
    => path: "about/intro.html"

Ajax form submission examples: 

    URL (GET): "orderform/response.html?shipment=express"
    => entity name: "Orderform"
    => entity fields: retrieved from URL
    => path: "response.html"
    => type: "application/x-www-form-urlencoded"

    URL (POST): "orderform/response.html"
    => entity name: "Orderform" 
    => entity fields: retrieved from POST data
    => path: "response.html"
    => type: "application/x-www-form-urlencoded"