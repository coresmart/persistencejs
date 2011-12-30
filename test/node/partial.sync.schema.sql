--
-- Table structure for table `_syncremovedobject`
--

DROP TABLE IF EXISTS `_syncremovedobject`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `_syncremovedobject` (
  `entity` varchar(255) DEFAULT NULL,
  `objectId` varchar(32) DEFAULT NULL,
  `date` bigint(20) DEFAULT NULL,
  `id` varchar(32) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `_syncremovedobject`
--

LOCK TABLES `_syncremovedobject` WRITE;
/*!40000 ALTER TABLE `_syncremovedobject` DISABLE KEYS */;
/*!40000 ALTER TABLE `_syncremovedobject` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `class`
--

DROP TABLE IF EXISTS `class`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `class` (
  `class_id` int(11) NOT NULL AUTO_INCREMENT,
  `teacher_id` int(11) NOT NULL,
  `class_name` varchar(120) NOT NULL,
  `id` varchar(32) DEFAULT NULL,
  `_lastChange` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`class_id`),
  KEY `fk_teacher_id` (`teacher_id`),
  CONSTRAINT `fk_teacher_id` FOREIGN KEY (`teacher_id`) REFERENCES `teacher` (`teacher_id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `class`
--

LOCK TABLES `class` WRITE;
/*!40000 ALTER TABLE `class` DISABLE KEYS */;
INSERT INTO `class` VALUES (1,1,'Computer Systems','d2ffcf2a33c911e08f5eb58579ce9ead',1297199638),(2,2,'Linux/Dark Arts','d2ffd2e533c911e08f5eb58579ce9ead',1297199638);
/*!40000 ALTER TABLE `class` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `student`
--

DROP TABLE IF EXISTS `student`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `student` (
  `student_id` int(11) NOT NULL AUTO_INCREMENT,
  `first_name` varchar(60) NOT NULL,
  `last_name` varchar(60) NOT NULL,
  `id` varchar(32) DEFAULT NULL,
  `_lastChange` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`student_id`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `student`
--

LOCK TABLES `student` WRITE;
/*!40000 ALTER TABLE `student` DISABLE KEYS */;
INSERT INTO `student` VALUES (1,'John','Doe','cd6068c833c911e08f5eb58579ce9ead',1297199634),(2,'Jane','Doe','cd606df733c911e08f5eb58579ce9ead',1297199634),(3,'Chris','Farmer','cd6070b733c911e08f5eb58579ce9ead',1297199634),(4,'Bob','Jones','cd60738433c911e08f5eb58579ce9ead',1297199634),(5,'Christine','Alexander','cd60761833c911e08f5eb58579ce9ead',1297199634),(6,'Abe','Lincoln','cd60786e33c911e08f5eb58579ce9ead',1297199634),(7,'Adrian','Doty','cd607af033c911e08f5eb58579ce9ead',1297199634),(8,'Eileen','Nyman','cd607dbe33c911e08f5eb58579ce9ead',1297199634),(9,'Amber','Chase','cd60807033c911e08f5eb58579ce9ead',1297199634);
/*!40000 ALTER TABLE `student` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `student_class`
--

DROP TABLE IF EXISTS `student_class`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `student_class` (
  `student_id` int(11) NOT NULL,
  `class_id` int(11) NOT NULL,
  `id` varchar(32) DEFAULT NULL,
  `_lastChange` bigint(20) DEFAULT NULL,
  KEY `fk_student_id` (`student_id`),
  KEY `fk_class_id` (`class_id`),
  CONSTRAINT `fk_class_id` FOREIGN KEY (`class_id`) REFERENCES `class` (`class_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_student_id` FOREIGN KEY (`student_id`) REFERENCES `student` (`student_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `student_class`
--

LOCK TABLES `student_class` WRITE;
/*!40000 ALTER TABLE `student_class` DISABLE KEYS */;
INSERT INTO `student_class` VALUES (1,1,'d61678e133c911e08f5eb58579ce9ead',1297199644),(2,1,'d6167d0c33c911e08f5eb58579ce9ead',1297199644),(3,1,'d6167f2833c911e08f5eb58579ce9ead',1297199644),(4,1,'d616812c33c911e08f5eb58579ce9ead',1297199644),(5,1,'d616833c33c911e08f5eb58579ce9ead',1297199644),(6,2,'d616854733c911e08f5eb58579ce9ead',1297199644),(7,2,'d616874e33c911e08f5eb58579ce9ead',1297199644),(8,2,'d616895933c911e08f5eb58579ce9ead',1297199644),(9,2,'d6168b6c33c911e08f5eb58579ce9ead',1297199644);
/*!40000 ALTER TABLE `student_class` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `teacher`
--

DROP TABLE IF EXISTS `teacher`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `teacher` (
  `teacher_id` int(11) NOT NULL AUTO_INCREMENT,
  `first_name` varchar(60) NOT NULL,
  `last_name` varchar(60) NOT NULL,
  `id` varchar(32) DEFAULT NULL,
  `_lastChange` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`teacher_id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `teacher`
--

LOCK TABLES `teacher` WRITE;
/*!40000 ALTER TABLE `teacher` DISABLE KEYS */;
INSERT INTO `teacher` VALUES (1,'Mark','Price','d1521f2933c911e08f5eb58579ce9ead',1297199641),(2,'Tony','Basil','d152235d33c911e08f5eb58579ce9ead',1297199641);
/*!40000 ALTER TABLE `teacher` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;
