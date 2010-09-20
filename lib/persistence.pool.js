var sys = require('sys');
var mysql = require('mysql');

function log(o) {
  sys.print(sys.inspect(o) + "\n");
}

function ConnectionPool(getSession, initialPoolSize) {
  this.newConnection = getSession;
  this.pool = [];
  for(var i = 0; i < initialPoolSize; i++) {
    this.pool.push({available: true, session: getSession()});
  }
}

ConnectionPool.prototype.obtain = function() {
  var session = null;
  for(var i = 0; i < this.pool.length; i++) {
    if(this.pool[i].available) {
      var pool = this.pool[i];
      session = pool.session;
      pool.available = false;
      pool.claimed = new Date();
      break;
    }
  }
  if(!session) {
    session = getSession();
    this.pool.push({available: false, session: session, claimed: new Date() });
  }
};

ConnectionPool.prototype.release = function(session) {
  for(var i = 0; i < this.pool.length; i++) {
    if(this.pool[i].session === session) {
      var pool = this.pool[i];
      pool.available = true;
      pool.claimed = null;
      return;
    }
  }
  return false;
};

exports.ConnectionPool = ConnectionPool;
