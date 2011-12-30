function tableExists(name, callback){
  var sql = 'select name from sqlite_master where type = "table" and name == "'+name+'"';
  persistence.transaction(function(tx){
    tx.executeSql(sql, null, function(result){
      ok(result.length == 1, name + ' table exists');
      if (callback) callback();
    });
  });
}

function checkNoTables(callback) {
  var sql = 'select name from sqlite_master where type = "table"';
  persistence.transaction(function(tx){
    tx.executeSql(sql, null, function(results){
        var foundLegitimate = false;
        results.forEach(function(result) {
            if(result.name[0] !== '_') {
              foundLegitimate = true;
            }
          });
      ok(!foundLegitimate, 'all tables are gone');
      if (callback) callback();
    });
  });
}

function tableNotExists(name, callback){
  var sql = 'select name from sqlite_master where type = "table" and name == "'+name+'"';
  persistence.transaction(function(tx){
    tx.executeSql(sql, null, function(result){
      ok(result.length == 0, name + ' table not exists');
      if (callback) callback();
    });
  });
}

function columnExists(table, column, type, callback) {
  var sql = 'select sql from sqlite_master where type = "table" and name == "'+table+'"';
  type = type.replace('(', '\\(').replace(')', '\\)');
  var regex = "CREATE TABLE .+`?" + column + "`?\\s+" + type + ".+";
  persistence.transaction(function(tx){
    tx.executeSql(sql, null, function(result){
        console.log('Table def: ------> ', result[0].sql);
      ok(result[0].sql.match(regex), column + ' colum exists');
      if (callback) callback();
    });
  });
}

function columnNotExists(table, column, type, callback) {
  var sql = 'select sql from sqlite_master where type = "table" and name == "'+table+'"';
  type = type.replace('(', '\\(').replace(')', '\\)');
  var regex = "CREATE TABLE \\w+ \\((\\w|[\\(\\), ])*" + column + " " + type + "(\\w|[\\(\\), ])*\\)";
  persistence.transaction(function(tx){
    tx.executeSql(sql, null, function(result){
      ok(!result[0].sql.match(regex), column + ' colum not exists');
      if (callback) callback();
    });
  });
}

function indexExists(table, column, callback) {
  var sql = 'select sql from sqlite_master where type = "index" and name == "'+table+'_'+column+'"';
  persistence.transaction(function(tx){
    tx.executeSql(sql, null, function(result){
      ok(result.length == 1, 'index ' + table + '_' + column + ' exists');
      if (callback) callback();
    });
  });
}

function indexNotExists(table, column, callback) {
  var sql = 'select sql from sqlite_master where type = "index" and name == "'+table+'_'+column+'"';
  persistence.transaction(function(tx){
    tx.executeSql(sql, null, function(result){
      ok(result.length == 0, 'index ' + table + '_' + column + ' not exists');
      if (callback) callback();
    });
  });
}
