/**
 * @license
 * Copyright (c) 2010 Zef Hemel <zef@zef.me>
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

try {
  if(!window) {
    window = {};
  }
} catch(e) {
  window = {};
  exports.console = console;
}

var persistence = (window && window.persistence) ? window.persistence : {}; 

persistence.search = {};

persistence.search.config = function(persistence, dialect) {
  var filteredWords = {'and':true, 'the': true, 'are': true};

  var argspec = persistence.argspec;

  function normalizeWord(word, filterShortWords) {
    if(!(word in filteredWords || (filterShortWords && word.length < 3))) {
      word = word.replace(/ies$/, 'y');
      word = word.length > 3 ? word.replace(/s$/, '') : word;
      return word;
    } else {
      return false;
    }
  }

  /**
   * Does extremely basic tokenizing of text. Also includes some basic stemming.
   */
  function searchTokenizer(text) {
    var words = text.toLowerCase().split(/[^\w\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]+/);
    var wordDict = {};
    // Prefixing words with _ to also index Javascript keywords and special fiels like 'constructor'
    for(var i = 0; i < words.length; i++) {
      var normalizedWord = normalizeWord(words[i]);
      if(normalizedWord) {
        var word = '_' + normalizedWord;
        // Some extremely basic stemming
        if(word in wordDict) {
          wordDict[word]++;
        } else {
          wordDict[word] = 1;
        }
      }
    }
    return wordDict;
  }

  /**
   * Parses a search query and returns it as list SQL parts later to be OR'ed or AND'ed.
   */
  function searchPhraseParser(query, indexTbl, prefixByDefault) {
    query = query.toLowerCase().replace(/['"]/, '').replace(/(^\s+|\s+$)/g, '');
    var words = query.split(/\s+/);
    var sqlParts = [];
    var restrictedToColumn = null;
    for(var i = 0; i < words.length; i++) {
      var word = normalizeWord(words[i]);
      if(!word) {
        continue;
      }
      if(word.search(/:$/) !== -1) {
        restrictedToColumn = word.substring(0, word.length-1);
        continue;
      } 
      var sql = '(';
      if(word.search(/\*/) !== -1) {
        sql += "`" + indexTbl + "`.`word` LIKE '" + word.replace(/\*/g, '%') + "'";
      } else if(prefixByDefault) {
        sql += "`" + indexTbl + "`.`word` LIKE '" + word + "%'";
      } else {
        sql += "`" + indexTbl + "`.`word` = '" + word + "'";
      }
      if(restrictedToColumn) {
        sql += ' AND `' + indexTbl + "`.`prop` = '" + restrictedToColumn + "'";
      }
      sql += ')';
      sqlParts.push(sql);
    }
    return sqlParts.length === 0 ? ["1=1"] : sqlParts;
  }

  var queryCollSubscribers = {}; // entityName -> subscription obj
  persistence.searchQueryCollSubscribers = queryCollSubscribers;

  function SearchFilter(query, entityName) {
    this.query = query;
    this.entityName = entityName;
  }

  SearchFilter.prototype.match = function (o) {
    var meta = persistence.getMeta(this.entityName);
    var query = this.query.toLowerCase();
    var text = '';
    for(var p in o) {
      if(meta.textIndex.hasOwnProperty(p)) {
        if(o[p]) {
          text += o[p];
        }
      }
    }
    text = text.toLowerCase();
    return text && text.indexOf(query) !== -1;
  }

  SearchFilter.prototype.sql = function (o) {
    return "1=1";
  }

  SearchFilter.prototype.subscribeGlobally = function(coll, entityName) {
    var meta = persistence.getMeta(entityName);
    for(var p in meta.textIndex) {
      if(meta.textIndex.hasOwnProperty(p)) {
        persistence.subscribeToGlobalPropertyListener(coll, entityName, p);
      }
    }
  };

  SearchFilter.prototype.unsubscribeGlobally = function(coll, entityName) {
    var meta = persistence.getMeta(entityName);
    for(var p in meta.textIndex) {
      if(meta.textIndex.hasOwnProperty(p)) {
        persistence.unsubscribeFromGlobalPropertyListener(coll, entityName, p);
      }
    }
  };

  SearchFilter.prototype.toUniqueString = function() {
    return "SEARCH: " + this.query;
  }

  function SearchQueryCollection(session, entityName, query, prefixByDefault) {
    this.init(session, entityName, SearchQueryCollection);
    this.subscribers = queryCollSubscribers[entityName];
    this._filter = new SearchFilter(query, entityName);


    if(query) {
      this._additionalJoinSqls.push(', `' + entityName + '_Index`');
      this._additionalWhereSqls.push('`root`.id = `' + entityName + '_Index`.`entityId`');
      this._additionalWhereSqls.push('(' + searchPhraseParser(query, entityName + '_Index', prefixByDefault).join(' OR ') + ')');
      this._additionalGroupSqls.push(' GROUP BY (`' + entityName + '_Index`.`entityId`)');
      this._additionalGroupSqls.push(' ORDER BY SUM(`' + entityName + '_Index`.`occurrences`) DESC');
    }
  }

  SearchQueryCollection.prototype = new persistence.DbQueryCollection();

  SearchQueryCollection.prototype.oldClone = SearchQueryCollection.prototype.clone;


  SearchQueryCollection.prototype.clone = function() {
    var clone = this.oldClone(false);
    var entityName = this._entityName;
    clone.subscribers = queryCollSubscribers[entityName];
    return clone;
  };

  SearchQueryCollection.prototype.order = function() {
    throw new Error("Imposing additional orderings is not support for search query collections.");
  };

  /*
  SearchQueryCollection.prototype.filter = function (property, operator, value) {
    var c = this.clone();
    c._filter = new persistence.AndFilter(this._filter, new persistence.PropertyFilter(property, operator, value));
    // Add global listener (TODO: memory leak waiting to happen!)
    //session.subscribeToGlobalPropertyListener(c, this._entityName, property);
    return c;
  };
  */

  persistence.entityDecoratorHooks.push(function(Entity) {
      /**
       * Declares a property to be full-text indexed.
       */
      Entity.textIndex = function(prop) {
        if(!Entity.meta.textIndex) {
          Entity.meta.textIndex = {};
        }
        Entity.meta.textIndex[prop] = true;
        // Subscribe
        var entityName = Entity.meta.name;
        if(!queryCollSubscribers[entityName]) {
          queryCollSubscribers[entityName] = {};
        }
      };

      /**
       * Returns a query collection representing the result of a search
       * @param query an object with the following fields:
       */
      Entity.search = function(session, query, prefixByDefault) {
        var args = argspec.getArgs(arguments, [
            { name: 'session', optional: true, check: function(obj) { return obj.schemaSync; }, defaultValue: persistence },
            { name: 'query', optional: false, check: argspec.hasType('string') },
            { name: 'prefixByDefault', optional: false }
          ]);
        session = args.session;
        query = args.query;
        prefixByDefault = args.prefixByDefault;

        return session.uniqueQueryCollection(new SearchQueryCollection(session, Entity.meta.name, query, prefixByDefault));
      };
    });

  persistence.schemaSyncHooks.push(function(tx) {
      var entityMeta = persistence.getEntityMeta();
      var queries = [];
      for(var entityName in entityMeta) {
        var meta = entityMeta[entityName];
        if(meta.textIndex) {
          queries.push([dialect.createTable(entityName + '_Index', [['entityId', 'VARCHAR(32)'], ['prop', 'VARCHAR(30)'], ['word', 'VARCHAR(100)'], ['occurrences', 'INT']]), null]);
          queries.push([dialect.createIndex(entityName + '_Index', ['prop', 'word']), null]);
          queries.push([dialect.createIndex(entityName + '_Index', ['word']), null]);
          persistence.generatedTables[entityName + '_Index'] = true;
        }
      }
      queries.reverse();
      persistence.executeQueriesSeq(tx, queries);
    });


  persistence.flushHooks.push(function(session, tx, callback) {
      var queries = [];
      for (var id in session.getTrackedObjects()) {
        if (session.getTrackedObjects().hasOwnProperty(id)) {
          var obj = session.getTrackedObjects()[id];
          var meta = session.define(obj._type).meta;
          var indexTbl = obj._type + '_Index';
          if(meta.textIndex) {
            for ( var p in obj._dirtyProperties) {
              if (obj._dirtyProperties.hasOwnProperty(p) && p in meta.textIndex) {
                queries.push(['DELETE FROM `' + indexTbl + '` WHERE `entityId` = ? AND `prop` = ?', [id, p]]);
                var occurrences = searchTokenizer(obj._data[p]);
                for(var word in occurrences) {
                  if(occurrences.hasOwnProperty(word)) {
                    queries.push(['INSERT INTO `' + indexTbl + '` VALUES (?, ?, ?, ?)', [obj.id, p, word.substring(1), occurrences[word]]]);
                  }
                }
              }
            }
          }
        }
      }
      for (var id in persistence.getObjectsToRemove()) {
        if (persistence.getObjectsToRemove().hasOwnProperty(id)) {
          var obj = persistence.getObjectsToRemove()[id];
          var meta = persistence.getEntityMeta()[obj._type];
          if(meta.textIndex) {
            queries.push(['DELETE FROM `' + obj._type + '_Index` WHERE `entityId` = ?', [id]]);
          }
        }
      }
      queries.reverse();
      persistence.executeQueriesSeq(tx, queries, callback);
    });
};

if(typeof exports === 'object') {
  exports.config = persistence.search.config;
}

