#!/usr/bin/env bash
cat ./neo4j-init/init.cypher | docker exec -i reclamos_neo4j cypher-shell -u neo4j -p password123
