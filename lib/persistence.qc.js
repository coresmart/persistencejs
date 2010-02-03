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
    }

    function AndFilter (left, right) {
        this.sql = function (prefix, values) {
            return "(" + left.sql(prefix, values) + " AND "
                    + right.sql(prefix, values) + ")";
        }

        this.match = function (o) {
            return left.match(o) && right.match(o);
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
    }

    var queryCollection = function (entityName, constructor) {
        var that = {};
        // public
        that._filter = new NullFilter();
        that._orderColumns = []; // tuples of [column, ascending?]
        that._prefetchFields = [];
        that._additionalJoinSqls = [];
        that._additionalWhereSqls = [];

        that.clone = function () {
            var c = constructor(entityName);
            c._filter = that._filter;
            c._prefetchFields = that._prefetchFields.slice(0); // clone
            c._orderColumns = that._orderColumns.slice(0);
            return c;
        };

        that.filter = function (property, operator, value) {
            var c = that.clone();
            c._filter = new AndFilter(that._filter, new PropertyFilter(
                    property, operator, value));
            return c;
        };

        that.order = function (property, ascending) {
            ascending = ascending || true;
            var c = that.clone();
            c._orderColumns.push( [ property, ascending ]);
            return c;
        };

        that.prefetch = function (property) {
            var c = that.clone();
            c._prefetchFields.push(property);
            return c;
        }

        return that;
    };

    dbQueryCollection = function (entityName) {
        var that = queryCollection(entityName, dbQueryCollection);
        var meta = persistence.getMeta(entityName);

        that.list = function (tx, callback) {

            function selectAll (meta, tableAlias, prefix) {
                var selectFields = [ "`" + tableAlias + "`.id AS " + prefix
                        + "id" ];
                for ( var p in meta.fields) {
                    if (meta.fields.hasOwnProperty(p)) {
                        selectFields.push("`" + tableAlias + "`.`" + p
                                + "` AS `" + prefix + p + "`");
                    }
                }
                for ( var p in meta.hasOne) {
                    if (meta.hasOne.hasOwnProperty(p)) {
                        selectFields.push("`" + tableAlias + "`.`" + p
                                + "` AS `" + prefix + p + "`");
                    }
                }
                return selectFields;
            }
            var args = [];
            var mainPrefix = entityName + "_";

            var selectFields = selectAll(meta, meta.name, mainPrefix);

            var joinSql = that._additionalJoinSqls.join(' ');

            for ( var i = 0; i < that._prefetchFields.length; i++) {
                var prefetchField = that._prefetchFields[i];
                var thatMeta = meta.hasOne[prefetchField].meta;
                var tableAlias = thatMeta.name + '_' + prefetchField + "_tbl";
                selectFields = selectFields.concat(selectAll(thatMeta,
                        tableAlias, prefetchField + "_"));
                joinSql += "LEFT JOIN `" + thatMeta.name + "` AS `" + tableAlias + "` ON `"
                        + tableAlias + "`.`id` = `" + mainPrefix
                        + prefetchField + "` ";

            }

            var whereSql = "WHERE "
                    + [ that._filter.sql(mainPrefix, args) ].concat(
                            that._additionalWhereSqls).join(' AND ');

            var sql = "SELECT " + selectFields.join(", ") + " FROM `"
                    + entityName + "` " + joinSql + " " + whereSql;
            if (that._orderColumns.length > 0) {
                sql += " ORDER BY "
                        + that._orderColumns.map(
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
                        var e = persistence.rowToEntity(entityName, r,
                                mainPrefix);
                        for ( var j = 0; j < that._prefetchFields.length; j++) {
                            var prefetchField = that._prefetchFields[j];
                            var thatMeta = meta.hasOne[prefetchField].meta;
                            e[prefetchField] = persistence.rowToEntity(thatMeta.name, r, prefetchField + '_');
                        }
                        results.push(e);
                        persistence.add(e);
                    }
                    callback(results);
                });
            });
        };

        return that;
    };

    persistence.dbQueryCollection = dbQueryCollection;
}());