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
         

jQuery mobile integration
=========================
jQuery mobile (jqm) ajax request re-routing to persitencejs for:
* html page loading (caches the page in local DB)
* form submission

re-routed URL paths have the following format:
  `optional/path/prefix  / entity-name / path/to/response-template-key`

URL needs to match the following criteria for re-routing:
* path prefix must be equal `persistence.jqmUrlPathPrefix` 
* entity with given entity-name must exist
  
Global settings (and it's default values):
------------------------------------------
`persistence.jqmUrlPathPrefix  = ""` 
`persistence.jqmTemplateKeyField = "path"` Page entity template-key field name
`persistence.jqmDataField`= "data"  Page entity template data field name

*IMPORTANT:* Images need to be embedded into HTML response via data URL's) 

Ajax page loading example:

    URL: "docs_controller/path/docs/about/intro.html"
    persistence.jqmUrlPathPrefix = "docs_controller/path"
    => entity name: "Docs"
    => templateKey: "about/intro.html"

Ajax form submission examples: 

    URL (GET): "form_controller/path/orderform/response.html?shipment=express"
    persistence.jqmUrlPathPrefix = "form_controller/path"
    => entity name: "Orderform"
    => entity fields: retrieved from URL
    => templateKey: "response.html"

    URL (POST): "form_controller/path/orderform/response.html"
    persistence.jqmUrlPathPrefix = "form_controller/path"
    => entity name: "Orderform" 
    => entity fields: retrieved from POST data
    => templateKey: "response.html"