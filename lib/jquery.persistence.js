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


if (!window.jQuery) {
  throw new Error("jQuery should be loaded before persistence.jquery.js");
}

if (!window.persistence) {
  throw new Error("persistence.js should be loaded before persistence.jquery.js");
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
    if (persistence.isImmutable(fieldName)) throw new Error("immutable field: "+fieldName);
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


(function($){
    var originalDataMethod = $.fn.data;

    $.fn.data = function(name, data) {
        if (this[0] && this[0]._session && (this[0]._session === window.persistence)) {
            if (data) {
                this[0][name](data);
                return this;
            } else {
                return this[0][name]();
            }
        } else {
            return originalDataMethod.apply(this, arguments);
        }
    };

    if ($.mobile && window.openDatabase) {
        persistence.jqmUrlPathPrefix = "";
        persistence.jqmTemplateKeyField = "path"; 
        persistence.jqmDataField = "data";
        
        var originalAjaxMethod = $.ajax;

        function anylizeRequest(settings) {
            var arr = settings.url.split('?');
            var parts, name, url = arr[0];
            if (persistence.jqmUrlPathPrefix.length == 0) {
                parts = url.split("/");
            } else if ((persistence.jqmUrlPathPrefix.length > 0)
              && (persistence.jqmUrlPathPrefix.length < url.length)
              && (url.match("^" + persistence.jqmUrlPathPrefix) == persistence.jqmUrlPathPrefix)) {
                parts = url.substring(persistence.jqmUrlPathPrefix.length).split("/");
            } else {
                return null ;
            }
            if ((parts[0] == "") && (parts.length > 0)) {
                parts = parts.slice(1);
            }
            name = parts[0].charAt(0).toUpperCase() + parts[0].substring(1);
            if (persistence.isDefined(name)) {
                if ((settings.type == "post") || ((settings.type == "get") && (arr.length > 1))) {
                    // ajax form submission
                    var data = {}, qs = (settings.type == "post") ? settings.data : arr[1] ;
                    qs.replace(/(?:^|&)([^&=]*)=?([^&]*)/g, function ( $0, $1, $2 ) {
                        if ($1) {
                            data[$1] = $2;
                        }
                    });
                    return {
                        isFormSubmission: true,
                        name: name,
                        templateKey: parts.slice(1).join('/'),
                        data: data
                    };
                } else {
                    // ajax page
                    return {
                        name: name,
                        templateKey: parts.slice(1).join('/')
                    };
                }
            } else {
                return null;
            }
        }

        $.ajax = function(settings) {
            var info = anylizeRequest(settings);
            if (info === null) {
                originalAjaxMethod(settings);
            } else {
                var Entity = persistence.define(info.name);
                if (info.isFormSubmission) {
                    var persist = function(data) {
                        var obj = {};
                        for (var i in data) {
                            if (data.hasOwnProperty(i)) {
                                obj[i] = data[i];
                            }
                        }
                        var entity = new Entity(obj);
                        persistence.add(entity);
                        persistence.flush();
                    };

                    if (!navigator.hasOwnProperty("onLine") || navigator.onLine) {
                       originalAjaxMethod({
                           url: settings.url,
                           success: function(data) {
                               settings.success(data);
                               persist(info.data);
                           },
                           error: settings.error
                       });
                    } else {
                       persist(info.data);
                    }
                } else { // ajax html page
                    Entity.findBy(persistence.jqmTemplateKeyField, info.templateKey, function(hit){
                        if (hit) {
                            if (settings.success)
                                settings.success(hit[persistence.jqmDataField]());
                        } else {
                            originalAjaxMethod({
                                url: settings.url,
                                success: function(data) {
                                    settings.success(data);
                                    var obj = {};
                                    obj[persistence.jqmTemplateKeyField] = info.templateKey;
                                    obj[persistence.jqmDataField] = data;
                                    var entity = new Entity(obj);
                                    persistence.add(entity);
                                    persistence.flush();
                                },
                                error: settings.error
                            });
                        }
                    });
                }
            }
        };
    }

    if (persistence.sync) {
        persistence.sync.getJSON = function(url, success) {
            $.getJSON(url, null, success);
        };

        persistence.sync.postJSON = function(url, data, success) {
            $.ajax({
                url: url,
                type: 'POST',
                data: data,
                dataType: 'json',
                success: function(response) {
                    success(JSON.parse(response));
                }
            });
        };
    }
})(jQuery);
