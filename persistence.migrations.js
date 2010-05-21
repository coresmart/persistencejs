/**
 * @license
 * Copyright (c) 2010 Fábio Rehm <fgrehm@gmail.com>
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

var Migrator = {
    migrations: [],

    version: function(callback) {
        persistence.transaction(function(t){
            t.executeSql('SELECT current_version FROM schema_version', null, function(result){
                if (result.length == 0) {
                    t.executeSql('INSERT INTO schema_version VALUES (0)', function(){
                        callback(0);
                    });
                } else {
                    callback(result[0].current_version);
                }
            });
        });
    },

    setVersion: function(v, callback) {
        persistence.transaction(function(t){
            t.executeSql('UPDATE schema_version SET current_version = ?', [v]);
            Migrator._version = v;
            if (callback) callback();
        });
    },
    
    setup: function(callback) {
        persistence.transaction(function(t){
            t.executeSql('CREATE TABLE IF NOT EXISTS schema_version (current_version INTEGER)');
            if (callback) callback();
        });
    },
    
    migration: function(version, actions) {
        this.migrations[version] = new Migration(version, actions);
        return this.migrations[version];
    }
}

var Migration = function(version, actions) {
    this.version = version;
    // TODO check if actions contains up and down methods
    this.actions = actions;
};

Migration.prototype.up = function() {
    this.actions.up.apply(this);
}

Migration.prototype.down = function() {
    this.actions.down.apply(this);
}
