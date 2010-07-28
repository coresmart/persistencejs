// Original file at: http://github.com/rsaccon/uki/tree/master/src/uki-persistence/persistence.js


/**
 * persistencejs integration (http://www.persistencejs.org)
 * 
 **/ 
 
// Example
// =======
// // persistence engine
// include('path/to/persistence.js'); 
// include('path/to/persistence.sync.js'); // optional
// include('path/to/persistence.search.js'); // optional
// include('path/to/persistence.migrations.js'); // optional
// include('path/to/uki-data/uki-persistence.js');
//                  
// persistence.connect('myDbName', 'database', 5 * 1024 * 1024, '1.0'); 
//                          
// var User = uki.persistence.define('User', {
//   firstname: "TEXT",
//   lastname: "TEXT"
// });
// 
// var aUser = new User({firstname: "Joe", lastname: "Doo"});
// 
// aUser.firstname("Mike") ;
// 
// console.log(aUser.firstname()); // => Mike 
// 
// persistence.add(aUser);
// 
// persistence.flush();


/**
 * uki implementation for entity-property 
 */
persistence.defineProp = function(scope, field, setterCallback, getterCallback) {
    scope[field] = function(value) {
        if (value === undefined) { 
            return getterCallback();
        } else {
            setterCallback(value); 
            return scope;
        }
    };
};      

/**
 * uki implementation for entity-property setter  
 */
persistence.set = function(scope, field, value) { 
    scope[field](value);
    return scope; 
}; 

/**
 * uki implementation for entity-property getter  
 */
persistence.get = function(arg1, arg2) {
    var val = (arguments.length == 1) ? arg1 : arg1[arg2];
    return (typeof val === "function") ? val() : val;
    //return val();
};
 
/**
 * uki ajax implementation
 */
if (persistence.sync) {
    uki.extend(persistence.sync, {
        getJSON: function(url, callback) { 
            uki.getJSON(url, null, callback); 
        },   
        postJSON: function(url, data, callback) {
            uki.ajax({
                url: url,
                type: 'POST',
                data: data, 
                dataType: 'json', 
                success: function(response) {
                    callback(JSON.parse(response));
                }
            });
        }
    });
}