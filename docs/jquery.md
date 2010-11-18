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
* form submission (only POST requests)

For ajax-loaded HTML pages and images, the content-providing entities get 
their name from user-overwritable default values. For form submissions, the entity 
is matched according to the following URL pattern:
    
    entity-name / path1/path2/../pathN

Ajax re-routing to persitencejs only takes place if the required entities exist.
  
Global settings (and it's default values):

    persistence.jqmPageEntityName = "Page";    // Html page entity name
    persistence.jqmImageEntityName = "Image";  // Image entity name
    persistence.jqmPathField = "path";         // Entity path-field name
    persistence.jqmDataField`= "data";         // Entity data-field name

Ajax page loading example:

    URL: "about/intro.html"
    => entity name: "Page"
    => entity **path** field: "about/intro.html" 
    => entity **data** field: (the HTML content of the page)
    Images:
    => entity name: "Image"
    => entity **path** field: (src attribute value of the related IMG tag) 
    => entity **data** field: (the imgae data as Base64 encoded dataURL)

Ajax form submission examples: 

    URL (POST): "order/response.html"
    => entity name: "Order" 
    => entity fields: retrieved from POST data
    => path: "response.html"