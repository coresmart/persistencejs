# persistence.jquery.mobile.js

`persistence.jquery.mobile.js` is a plugin for `persistence.js` and jQuery mobile that
allows ajax request re-routing to persitencejs for:

* html text: caches ajax-loaded HTML pages in local DB
* images (in `img` tags of ajax-loaded HTML pages): grabs/encodes them via `canvas` and caches them as data-URL strings in local DB
* form submission (only POST requests)

For ajax-loaded HTML pages and images, the content-providing entities get 
their name from user-overwritable default values. For form submissions, the entity 
is matched according to the following URL pattern:
    
    entity-name / path1/path2/../pathN

Ajax re-routing to persitencejs only takes place if the required entities exist.
  
Global settings (and it's default values):

    persistence.jquery.mobile.pageEntityName = "Page";    // Html page entity name
    persistence.jquery.mobile.imageEntityName = "Image";  // Image entity name
    persistence.jquery.mobile.pathField = "path";         // Entity path-field name
    persistence.jquery.mobile.dataField = "data";         // Entity data-field name
    

Optional Regular Expression to exclude URLs from re-routing to persistencejs:

    persistence.jquery.mobile.urlExcludeRx
    
Example: `persistence.jquery.mobile.urlExcludeRx = /^\/admin\//;` 
(all URL paths starting with "/admin/" are excluded)


Ajax page loading example:

    URL: "about/intro.html"
    => entity name: "Page"
    => entity path field: "about/intro.html" 
    => entity data field: (the HTML content of the page)
    Images:
    => entity name: "Image"
    => entity path field: (src attribute value of the related IMG tag) 
    => entity data field: (the imgae data as Base64 encoded dataURL)

Ajax form submission examples: 

    URL (POST): "order/response.html"
    => entity name: "Order"
    => entity fields (other than path): retrieved from POST data