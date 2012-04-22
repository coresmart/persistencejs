-- This table must exist in the database for synchronization with the php version of the server to run.
-- This is definitely not an efficient, but it's about as simple as it gets

CREATE TABLE `persistencejs_objects` (
  `id` char(32) NOT NULL,
  `bucket` varchar(50) NOT NULL,
  `lastUpdated` bigint(20) NOT NULL,
  `content` text NOT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_objects_lastUpdated` (`lastUpdated`),
  KEY `ix_bucket` (`bucket`)
)  DEFAULT CHARSET=utf8