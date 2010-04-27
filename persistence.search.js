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

if(!window.persistence) { // persistence.js not loaded!
  throw "persistence.js should be loaded before persistence.search.js"
}

(function() {
    var filteredWords = {'and':true, 'a':true, 'or':true, 'an':true, 'the': true, 'is': true, 'are': true};

    /**
     * Does extremely basic tokenizing of text. Also includes some basic stemming.
     */
    function searchTokenizer(text) {
      var words = text.toLowerCase().split(/\W+/);
      var wordDict = {};
      // Prefixing words with _ to also index Javascript keywords and special fiels like 'constructor'
      for(var i = 0; i < words.length; i++) {
        if(!(words[i] in filteredWords || words[i].length < 3)) {
          var word = '_' + words[i];
          // Some extremely basic stemming
          word = word.replace(/ies$/, 'y');
          word = word.replace(/s$/, '');
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
    function searchPhraseParser(query, indexTbl) {
      query = query.replace(/['"]/, '').replace(/(^\s+|\s+$)/g, '');
      var words = query.split(/\s+/);
      var sqlParts = [];
      var restrictedToColumn = null;
      for(var i = 0; i < words.length; i++) {
        var word = words[i];
        if(word in filteredWords) {
          continue;
        }
        if(word.search(/:$/) !== -1) {
          restrictedToColumn = word.substring(0, word.length-1);
          continue;
        } 
        var sql = '(';
        if(word.search(/\*/) !== -1) {
          sql += "`" + indexTbl + "`.`word` LIKE '" + word.replace(/\*/g, '%') + "%'";
        } else {
          sql += "`" + indexTbl + "`.`word` = '" + word + "'";
        }
        if(restrictedToColumn) {
          sql += ' AND `' + indexTbl + "`.`prop` = '" + restrictedToColumn + "'";
        }
        sql += ')';
        sqlParts.push(sql);
      }
      return sqlParts;
    }

    persistence.entityDecoratorHooks.push(function(Entity) {
        /**
         * Declares a property to be full-text indexed.
         */
        Entity.textIndex = function(prop) {
          if(!Entity.meta.textIndex) {
            Entity.meta.textIndex = {};
          }
          Entity.meta.textIndex[prop] = true;
        };

        /**
         * Searches using the full-text search engine
         * @param props an object with the following fields:
         *   - tx (optional): the transaction to use
         *   - query: search query
         *   - limit (optional): maximum number results to return (for pagination)
         *   - skip (optional): number of initial results to skip (for pagination)
         *   - success: callback(results) function called with the found results
         */
        Entity.search = function(props) {
          var tx = props.tx || null;
          var query = props.query;
          var success = props.success;
          var limit = props.limit;
          var skip = props.skip;
          if(!tx) {
            persistence.transaction(function(tx) { 
                props.tx = tx;
                Entity.search(props);
              });
            return;
          }
          var tblName = Entity.meta.name;
          var sql = 'SELECT `' + tblName + '`.*, SUM(`' + tblName + '_Index`.`occurences`) AS _occ FROM `' + tblName + '_Index`';
          sql += ' LEFT JOIN `' + tblName + '` ON `' + tblName + '`.id = `' + tblName + '_Index`.`entityId` WHERE ';

          var sqlParts = searchPhraseParser(query, tblName + '_Index');
          sql += sqlParts.join(' OR ');
          sql += ' GROUP BY (`' + tblName + '_Index`.`entityId`) ORDER BY _occ DESC';
          if(limit) {
            sql += ' LIMIT ' + limit;
          }
          if(skip) {
            sql += ' OFFSET ' + skip;
          }
          tx.executeSql(sql, [], function(results) {
              var entityResults = [];
              for(var i = 0;  i < results.length; i++) {
                var obj = persistence.rowToEntity(tblName, results[i]);
                //obj._occurences = results[i]._occ;
                entityResults.push(obj);
              }
              success(entityResults);
            });
        };
      });

    persistence.schemaSyncHooks.push(function(tx) {
        var entityMeta = persistence.getEntityMeta();
        var queries = [];
        for(var entityName in entityMeta) {
          var meta = entityMeta[entityName];
          if(meta.textIndex) {
            queries.push(['CREATE TABLE IF NOT EXISTS `' + entityName + '_Index` (`entityId`, `prop`, `word`, `occurences`)']);
            persistence.generatedTables[entityName + '_Index'] = true;
          }
        }
        persistence.executeQueriesSeq(tx, queries);
      });


    persistence.flushHooks.push(function(tx) {
        var queries = [];
        for (var id in persistence.getTrackedObjects()) {
          if (persistence.getTrackedObjects().hasOwnProperty(id)) {
            var obj = persistence.getTrackedObjects()[id];
            var meta = persistence.define(obj._type).meta;
            var indexTbl = obj._type + '_Index';
            if(meta.textIndex) {
              for ( var p in obj._dirtyProperties) {
                if (obj._dirtyProperties.hasOwnProperty(p) && p in meta.textIndex) {
                  queries.push(['DELETE FROM `' + indexTbl + '` WHERE `entityId` = ? AND `prop` = ?', [id, p]]);
                  var occurences = searchTokenizer(obj._data[p]);
                  for(var word in occurences) {
                    if(occurences.hasOwnProperty(word)) {
                      queries.push(['INSERT INTO `' + indexTbl + '` VALUES (?, ?, ?, ?)', [obj.id, p, word.substring(1), occurences[word]]]);
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
            var meta = persistence.define(obj._type);
            if(meta.textIndex) {
              queries.push(['DELETE FROM `' + obj._type + '_Index` WHERE `entityId` = ?', [id]]);
            }
          }
        }
        queries.reverse();
        persistence.executeQueriesSeq(tx, queries);
      });

  }());

