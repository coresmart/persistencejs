<?php

/**
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
 *
 *
 * USAGE:
 * Before this code can be used to persist data in the database the file persistence.sync.server.php.sql must be run
 *
 * This is NOT intended to be used without modification as it implements only the mimimal set of functionality to
 * get persistence working. It does not include any kind of security model for example.
 */

/**
 * Requires that the database schema be setup by running:
 *
 * persistence.sync.server.php.sql
 */
class PersistenceDB {
    private $db;
    private $persistence_table;

    function __construct(PDO $db, $persistence_table) {
        $this->db = $db;
        $this->persistence_table = $persistence_table;
    }

    public function getObjectChanges($bucket, $since) {
        $statement = $this->db->prepare("SELECT content FROM {$this->persistence_table} WHERE bucket=:bucket AND lastUpdated > :since");
        $statement->execute(array(':bucket' => $bucket, ':since' => $since));
        $changes = array();
        foreach ($statement->fetchAll(PDO::FETCH_COLUMN) as $content) {
            $change = json_decode($content);
            // Don't bother sending removed items to fresh clients
            if ($since != 0 || !isset($change->_removed)) {
                $changes[] = $change;
            }
        }

        return $changes;
    }

    public function applyObjectChanges($bucket, $now, array $changes) {
        $statement = $this->db->prepare("
            INSERT INTO {$this->persistence_table} (id, bucket, lastUpdated, content)
            VALUES (:id, :bucket, :lastUpdated, :content)
            ON DUPLICATE KEY UPDATE lastUpdated=:lastUpdated, content=:content");

        foreach ($changes as $change) {
            $change->_lastChanged = $now;
            $statement->execute(array(':id' => $change->id, ':bucket' => $bucket, ':lastUpdated' => $now, ':content' => json_encode($change)));
        }
    }
}

$db = new PersistenceDB(new PDO('mysql:host=localhost;dbname=persistencejs', 'root', ''), 'persistencejs_objects');

function http_400() {
    header($_SERVER['SERVER_PROTOCOL'] . ' 400 Invalid Request');
    exit(0);
}

header('Content-Type: applicatin/json');

switch (strtoupper($_SERVER['REQUEST_METHOD'])) {
    case 'GET':
        if (!isset($_GET['bucket']) || !isset($_GET['since']))
            http_400();

        $bucket = $_GET['bucket'];
        $since = isset($_GET['since']) ? $_GET['since'] : 0;


        $changes = $db->getObjectChanges($bucket, $since);
        echo json_encode(array('now' => round(microtime(true) * 1000), "updates" => $changes));
        break;
    case 'POST':
        $body = file_get_contents('php://input');
        $changes = json_decode($body);
        $now = floor(microtime(true)*1000);
        $db->applyObjectChanges($bucket, $now, $changes);
        echo json_encode(array('now' => $now, "status" => 'ok'));
        break;
    default:
        header($_SERVER['SERVER_PROTOCOL'] . ' 405 Invalid Request');
}
