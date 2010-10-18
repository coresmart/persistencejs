/**
 * Copyright (c) 2010 Roberto Saccon <rsaccon@gmail.com>
 * 
 * Permission is hereby granted, free of charge, to any person
 * obtaining a copy of this software and associated documentation
 * files (the "Software"), to deal in the Software without
 * restriction, including without limitation the rights to use,
 * copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following
 * conditions:
 * 
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 * OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
 * OTHER DEALINGS IN THE SOFTWARE.
 */


if(!window.jQuery) {
  throw "jQuery should be loaded before persistence.jquery.js"
}

if(!window.persistence) {
  throw "persistence.js should be loaded before persistence.jquery.js"
}

/**
 * crossbrowser implementation for entity-property 
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
 * crossbrowser implementation for entity-property setter
 */
persistence.set = function(scope, fieldName, value) { 
    if (persistence.isImmutable(fieldName)) throw "immutable field: "+fieldName;
    scope[fieldName](value);
    return scope;
};               

/**
 * crossbrowser implementation for entity-property getter 
 */
persistence.get = function(arg1, arg2) {
    var val = (arguments.length == 1) ? arg1 : arg1[arg2];
    return (typeof val === "function") ? val() : val;
};  
  

/**
 * jquery ajax
 */
if (persistence.sync) {
    persistence.sync.getJSON = function(url, callback) { 
        $.getJSON(url, null, callback); 
    };
    persistence.sync.postJSON = function(url, data, callback) {
        $.ajax({
            url: url,
            type: 'POST',
            data: data, 
            dataType: 'json', 
            success: function(response) {
                callback(JSON.parse(response));
            }
        });
    };
}  

/**
 * and finally the actual jquery plugin
 */
(function($){
    var originalDataMethod = jQuery.fn.data;

    $.fn.data = function(name, data) {      
        if (this[0] && this[0]._session && (this[0]._session === window.persistence)) {  
            if (data) {
                this[0][name](data);
                return this;
            } else {
                return this[0][name]();
            }
        } else {       
            originalDataMethod.apply(this, arguments);
        }
    };
})(jQuery);     
