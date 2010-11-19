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
        persistence.jqmPageEntityName = "Page";
        persistence.jqmImageEntityName = "Image";
        persistence.jqmPathField = "path";
        persistence.jqmDataField = "data";

        var originalAjaxMethod = $.ajax;

        function expand(docPath, srcPath) {
            var basePath = (/\/$/.test(location.pathname) || (location.pathname == "")) ?
                location.pathname :
                location.pathname.substring(0, location.pathname.lastIndexOf("/"));
            if (/^\.\.\//.test(srcPath)) {
                // relative path with upward directory traversal
                var count = 1, splits = docPath.split("/");
                while (/^\.\.\//.test(srcPath)) {
                    srcPath = srcPath.substring(3);
                    count++;
                }
                return basePath + ((count >= splits.length) ?
                    srcPath :
                    splits.slice(0, splits.length-count).join("/") + "/" + srcPath);
            } else if (/^\//.test(srcPath)) {
                // absolute path
                return srcPath;
            } else {
                // relative path without directory traversal
                return basePath + docPath + "/" + srcPath;
            }
        }

        function base64Image(img, type) {
            var canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;

            // Copy the image contents to the canvas
            var ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0);

            return canvas.toDataURL("image/" + type);
        }

        // parseUri 1.2.2
        // (c) Steven Levithan <stevenlevithan.com>
        // MIT License

        var parseUriOptions = {
            strictMode: false,
            key: ["source","protocol","authority","userInfo","user","password","host","port","relative","path","directory","file","query","anchor"],
            q:   {
                name:   "queryKey",
                parser: /(?:^|&)([^&=]*)=?([^&]*)/g
            },
            parser: {
                strict: /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/,
                loose:  /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/
            }
        };

        function parseUri (str) {
            var o   = parseUriOptions,
                m   = o.parser[o.strictMode ? "strict" : "loose"].exec(str),
                uri = {},
                i   = 14;

            while (i--) uri[o.key[i]] = m[i] || "";

            uri[o.q.name] = {};
            uri[o.key[12]].replace(o.q.parser, function ($0, $1, $2) {
                if ($1) uri[o.q.name][$1] = $2;
            });

            return uri;
        }

        function getImageType(parsedUri) {
            if (parsedUri.queryKey.type) {
                return parsedUri.queryKey.type;
            }  else {
                return (/\.png$/i.test(parsedUri.path)) ? "png" : "jpeg";
            }
        }

        $.ajax = function(settings) {
            var entities = {}, urlPathSegments = settings.url.split("/");
            if ((settings.type == "post") && (urlPathSegments.length > 1)) {
                var entityName = (urlPathSegments[1].charAt(0).toUpperCase() + urlPathSegments[1].substring(1));
                if (persistence.isDefined(entityName)) {
                    var Form = persistence.define(entityName);

                    var persistFormData = function() {
                        var obj = {};
                        settings.data.replace(/(?:^|&)([^&=]*)=?([^&]*)/g, function ( $0, $1, $2 ) {
                            if ($1) {
                                obj[$1] = $2;
                            }
                        });

                        var entity = new Form(obj);
                        persistence.add(entity);
                        persistence.flush();
                    };

                    if (!navigator.hasOwnProperty("onLine") || navigator.onLine) {
                        originalAjaxMethod({
                            url: settings.url,
                            success: function(data) {
                                settings.success(data);
                                persistFormData();
                            },
                            error: settings.error
                        });
                    } else {
                        persistFormData();
                    }
                } else {
                    originalAjaxMethod(settings);
                }
            } else {
                if (persistence.isDefined(persistence.jqmPageEntityName)) {
                    var Page = persistence.define(persistence.jqmPageEntityName);
                    Page.findBy(persistence.jqmPathField, settings.url, function(page) {
                        if (page) {
                            //
                            // load page and images from persistencejs
                            //
                            if (settings.success) {
                                var pos = 0, countOuter = 0, countInner = 0;
                                var inStr = page[persistence.jqmDataField](), outStr = "";
                                var regExp = /(<img[^>]+src\s*=\s*[\'\"])([^\'\"]+)([\'\"][^>]*>)/ig;
                                var replaced = inStr.replace(regExp, function($0, $1, $2, $3, offset) {
                                    countOuter++;
                                    if (persistence.isDefined(persistence.jqmImageEntityName)) {
                                        var Img = persistence.define(persistence.jqmImageEntityName);
                                        Img.findBy(persistence.jqmPathField, expand(settings.url, $2), function(image){
                                            countInner++;
                                            if (image) {
                                                var imgTagStr = $1 + image[persistence.jqmDataField]() + $3;
                                                outStr += inStr.substring(pos, offset) + imgTagStr;
                                                pos = offset + imgTagStr.length;
                                            } else {
                                                outStr += inStr.substring(pos, offset) + imgTagStr;
                                                pos = offset;
                                            }
                                            if (countInner == countOuter) {
                                                settings.success(outStr);
                                            }
                                            return "";
                                        });
                                    } else {
                                        outStr += inStr.substring(pos, offset) + imgTagStr;
                                        pos = offset;
                                    }
                                });
                                if (replaced == inStr) {
                                    settings.success(inStr);
                                } else if (!persistence.isDefined(persistence.jqmImageEntityName)) {
                                    settings.success(outStr);
                                };
                            }
                        } else {
                            //
                            // ajax-load page and persist page and images
                            //
                            originalAjaxMethod({
                                url: settings.url,
                                success: function(data) {
                                    settings.success(data);
                                    if (persistence.isDefined(persistence.jqmPageEntityName)) {
                                        var entities = [], crawlImages = false;
                                        var Page = persistence.define(persistence.jqmPageEntityName);
                                        if (persistence.isDefined(persistence.jqmImageEntityName)) {
                                            var Img = persistence.define(persistence.jqmImageEntityName), count = 0;
                                            $("#"+settings.url.replace(/\//g,"\\/").replace(/\./g,"\\.")+" img").each(function(i, img){
                                                crawlImages = true;
                                                count++;
                                                $(img).load(function() {
                                                  var obj = {}, parsedImgSrc = parseUri(img.src);
                                                  obj[persistence.jqmPathField] = parsedImgSrc.path;
                                                  obj[persistence.jqmDataField] = base64Image(img, getImageType(parsedImgSrc));
                                                  entities.push(new Img(obj));

                                                  if (crawlImages && (--count == 0)) {
                                                      for (var j=0; j<entities.length; j++) {
                                                          persistence.add(entities[j]);
                                                      }
                                                      persistence.flush();
                                                  }
                                                });
                                                $(img).error(function() {
                                                    crawlImages = false;
                                                });
                                            });
                                        }

                                        var obj = {};
                                        obj[persistence.jqmPathField] = settings.url;
                                        obj[persistence.jqmDataField] = data;

                                        entities.push(new Page(obj));

                                        if (!crawlImages) {
                                            persistence.add(entities[0]);
                                            persistence.flush();
                                        }
                                    }
                                },
                                error: settings.error
                            });
                        }
                    });
                } else {
                    originalAjaxMethod(settings);
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
