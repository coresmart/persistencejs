/**
 * Query collections, wrap a (database) collection and add the ability to filter
 * and sort.
 */

(function () {

    /**
     * Filters Filters are composable
     */
    function NullFilter () {
        this.sql = function (prefix, values) {
            return "1=1";
        }

        this.match = function (o) {
            return true;
        }
        
        this.makeFit = function(o) {
        }

        this.makeNotFit = function(o) {
        }
    }

    function AndFilter (left, right) {
        this.sql = function (prefix, values) {
            return "(" + left.sql(prefix, values) + " AND "
                    + right.sql(prefix, values) + ")";
        }

        this.match = function (o) {
            return left.match(o) && right.match(o);
        }

        this.makeFit = function(o) {
            left.makeFit(o);
            right.makeFit(o);
        }
        
        this.makeNotFit = function(o) {
            left.makeNotFit(o);
            right.makeNotFit(o);
        }
    }

    function PropertyFilter (property, operator, value) {
        this.sql = function (prefix, values) {
            if (operator === '=' && value === null) {
                return "`" + prefix + property + "` IS NULL";
            } else if (operator === '!=' && value === null) {
                return "`" + prefix + property + "` IS NOT NULL";
            } else {
                values.push(persistence.entityValToDbVal(value));
                return "`" + prefix + property + "` " + operator + " ?";
            }
        }

        this.match = function (o) {
            switch (operator) {
            case '=':
                return o[property] === value;
                break;
            case '!=':
                return o[property] !== value;
                break;
            case '<':
                return o[property] < value;
                break;
            case '<=':
                return o[property] <= value;
                break;
            case '>':
                return o[property] > value;
                break;
            case '>=':
                return o[property] >= value;
                break;
            }
        }

        this.makeFit = function(o) {
            if(operator === '=') {
                o[property] = value;
            } else {
                throw "Sorry, can't perform makeFit for other filters than =";
            }
        }
        
        this.makeNotFit = function(o) {
            if(operator === '=') {
                o[property] = null;
            } else {
                throw "Sorry, can't perform makeFit for other filters than =";
            }            
        }
    }

    function QueryCollection () {
    }

    QueryCollection.prototype.init = function (entityName, constructor) {
        this._filter = new NullFilter();
        this._orderColumns = []; // tuples of [column, ascending?]
        this._prefetchFields = [];
        this._additionalJoinSqls = [];
        this._additionalWhereSqls = [];
        this._entityName = entityName;
        this._constructor = constructor;
    }

    QueryCollection.prototype.clone = function () {
        var c = new (this._constructor)(this._entityName);
        c._filter = this._filter;
        c._prefetchFields = this._prefetchFields.slice(0); // clone
        c._orderColumns = this._orderColumns.slice(0);
        return c;
    };

    QueryCollection.prototype.filter = function (property, operator, value) {
        var c = this.clone();
        c._filter = new AndFilter(this._filter, new PropertyFilter(property,
                operator, value));
        return c;
    };

    QueryCollection.prototype.order = function (property, ascending) {
        ascending = ascending || true;
        var c = this.clone();
        c._orderColumns.push( [ property, ascending ]);
        return c;
    };

    QueryCollection.prototype.prefetch = function (property) {
        var c = this.clone();
        c._prefetchFields.push(property);
        return c;
    };
    
    // Array-like functions
    
    /**
     * Adds an object to a collection
     * @param obj the object to add
     */
    QueryCollection.prototype.add = function(obj) {
        if(!obj._id || !obj._type) {
            throw "Cannot add object of non-entity type onto collection.";
        }
        persistence.add(obj);
        this._filter.makeFit(obj);
    }
    
    /**
     * Removes an object from a collection
     * @param obj the object to remove from the collection
     */
    QueryCollection.prototype.remove = function(obj) {
        if(!obj._id || !obj._type) {
            throw "Cannot remove object of non-entity type onto collection.";
        }
        persistence.add(obj);
        this._filter.makeNotFit(obj);
    }
    

    function DbQueryCollection (entityName) {
        this.init(entityName, DbQueryCollection);
    }

    DbQueryCollection.prototype = new QueryCollection();

    DbQueryCollection.prototype.list = function (tx, callback) {
        var entityName = this._entityName;
        var meta = persistence.getMeta(entityName);
        var that = this;
        
        function selectAll (meta, tableAlias, prefix) {
            var selectFields = [ "`" + tableAlias + "`.id AS " + prefix + "id" ];
            for ( var p in meta.fields) {
                if (meta.fields.hasOwnProperty(p)) {
                    selectFields.push("`" + tableAlias + "`.`" + p + "` AS `"
                            + prefix + p + "`");
                }
            }
            for ( var p in meta.hasOne) {
                if (meta.hasOne.hasOwnProperty(p)) {
                    selectFields.push("`" + tableAlias + "`.`" + p + "` AS `"
                            + prefix + p + "`");
                }
            }
            return selectFields;
        }
        var args = [];
        var mainPrefix = entityName + "_";

        var selectFields = selectAll(meta, meta.name, mainPrefix);

        var joinSql = this._additionalJoinSqls.join(' ');

        for ( var i = 0; i < this._prefetchFields.length; i++) {
            var prefetchField = this._prefetchFields[i];
            var thisMeta = meta.hasOne[prefetchField].type.meta;
            var tableAlias = thisMeta.name + '_' + prefetchField + "_tbl";
            selectFields = selectFields.concat(selectAll(thisMeta, tableAlias,
                    prefetchField + "_"));
            joinSql += "LEFT JOIN `" + thisMeta.name + "` AS `" + tableAlias
                    + "` ON `" + tableAlias + "`.`id` = `" + mainPrefix
                    + prefetchField + "` ";

        }
        
        var whereSql = "WHERE "
                + [ this._filter.sql(mainPrefix, args) ].concat(
                        this._additionalWhereSqls).join(' AND ');

        var sql = "SELECT " + selectFields.join(", ") + " FROM `" + entityName
                + "` " + joinSql + " " + whereSql;
        if (this._orderColumns.length > 0) {
            sql += " ORDER BY "
                    + this._orderColumns.map(
                            function (c) {
                                return "`" + mainPrefix + c[0] + "` "
                                        + (c[1] ? "ASC" : "DESC");
                            }).join(", ");
        }
        persistence.flush(tx, function () {
            tx.executeSql(sql, args, function (rows) {
                var results = [];
                for ( var i = 0; i < rows.length; i++) {
                    var r = rows[i];
                    var e = persistence.rowToEntity(entityName, r, mainPrefix);
                    for ( var j = 0; j < that._prefetchFields.length; j++) {
                        var prefetchField = that._prefetchFields[j];
                        var thisMeta = meta.hasOne[prefetchField].type.meta;
                        e[prefetchField] = persistence.rowToEntity(
                                thisMeta.name, r, prefetchField + '_');
                    }
                    results.push(e);
                    persistence.add(e);
                }
                callback(results);
            });
        });
    };

    persistence.DbQueryCollection = DbQueryCollection;
}());