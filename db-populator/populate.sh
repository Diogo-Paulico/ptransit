
psql -p 5432 -h $DB_HOST -b -U $DB_USER $DB_NAME << 'EOF'
CREATE EXTENSION pg_trgm;
DROP SCHEMA IF EXISTS carris CASCADE;
DROP SCHEMA IF EXISTS ml CASCADE;
DROP SCHEMA IF EXISTS mts CASCADE;
DROP SCHEMA IF EXISTS cmet CASCADE;
DROP SCHEMA IF EXISTS cp CASCADE;
DROP SCHEMA IF EXISTS fertagus CASCADE;
DROP VIEW IF EXISTS public.all_stops CASCADE;
EOF

psql -p 5432 -h $DB_HOST -b -U $DB_USER $DB_NAME << 'EOF'
CREATE EXTENSION unaccent;
EOF

psql -p 5432 -h $DB_HOST -b -U $DB_USER $DB_NAME << 'EOF'
create function PT_DEABREVIATE(a text) returns text
language plpgsql
immutable
as
$$
declare
word1 text;
BEGIN
select regexp_replace(
regexp_replace(
regexp_replace(
regexp_replace(
regexp_replace(
regexp_replace(
regexp_replace(
regexp_replace(
regexp_replace(
regexp_replace(
regexp_replace(
regexp_replace(
regexp_replace(
regexp_replace(
regexp_replace(
regexp_replace(
regexp_replace(
regexp_replace(
regexp_replace(
regexp_replace(
regexp_replace(
regexp_replace (
regexp_replace(
regexp_replace(
regexp_replace(
regexp_replace(
regexp_replace(
regexp_replace(
lower(unaccent(regexp_replace(a, '-',' ','g'))),
'\mr\.?\M', 'rua', 'gi'),
'[^0-9a-z ]', '', 'g'),'\mlg\.?\M', 'largo', 'gi'),
'\mav\.?\M', 'avenida', 'gi'), 
'\mpc\.?\M', 'praca', 'gi'),
'\mlgo\.?\M', 'largo', 'gi'),
'\msr\.?\M', 'senhor', 'gi'),
'\mdr\.?\M', 'doutor', 'gi'),
'\msto\.?\M', 'santo', 'gi'),
'\mfte\.?\M', 'frente', 'gi'),
'\mal\.?\M', 'alameda', 'gi'), 
'\mestr\.?\M', 'estrada', 'gi'),
'\mb\.?\M', 'bairro','gi'),
'\mesc\.?\M', 'escola','gi'),
'\mhosp\.?\M', 'hospital','gi'),
'\mcc\.?\M', 'calcada','gi'),
'\mc\.?\M', 'centro','gi'),
'\mqta\.?\M', 'quinta','gi'),
'\mmq\.?\M', 'marques','gi'),
'\mrot\.?\M', 'rotunda','gi'),
'\ms\.?\M', 'sao','gi'),
'\mtv\.?\M', 'travessa','gi'),
'\maz\.?\M', 'azinhaga','gi'),
'\mpq\.?\M', 'parque','gi'),
'\mpca\.?\M', 'praca','gi'),
'\malm\.?\M', 'almirante','gi'),
'\malf\.?\M', 'alfredo','gi'),
'\minst\.?\M', 'instituto','gi') 
into word1;
return word1;
END;
$$;
EOF

rm -r operators

mkdir operators
cd operators


mkdir cmet
cd cmet
wget https://api.carrismetropolitana.pt/gtfs -O cmet.zip
unzip cmet.zip
rm plans.txt
npm exec -- gtfs-to-sql --require-dependencies --schema cmet --stops-location-index -- *.txt | sponge | psql -p 5432 -h $DB_HOST -b -U $DB_USER $DB_NAME
psql -p 5432 -h $DB_HOST -b -U $DB_USER $DB_NAME << EOF
ALTER TABLE cmet.stops ADD COLUMN stop_name_clean text;
UPDATE cmet.stops SET stop_name_clean = PT_DEABREVIATE(stop_name);
EOF
cat stops.txt | awk -F, 'BEGIN {OFS=","} {print $7,$19}' > stop_legacy_match.txt
psql -p 5432 -h $DB_HOST -b -U $DB_USER $DB_NAME << EOF
CREATE TABLE cmet.stop_legacy_match (
    stop_id text,
    legacy_ids text
);
\COPY cmet.stop_legacy_match(stop_id, legacy_ids) FROM '/app/operators/cmet/stop_legacy_match.txt' WITH (FORMAT csv);
ALTER TABLE cmet.stops ADD COLUMN legacy_ids text;
UPDATE cmet.stops  a SET legacy_ids = b.legacy_ids FROM cmet.stop_legacy_match b where a.stop_id = b.stop_id;
DROP TABLE cmet.stop_legacy_match;
EOF

rm *.txt
rm cmet.zip
cd ..

mkdir carris
cd carris
wget https://gateway.carris.pt/gateway/gtfs/api/v2.8/GTFS -O carris.zip
unzip carris.zip
npm exec -- gtfs-to-sql --require-dependencies --schema  carris --trips-without-shape-id --stops-location-index -- *.txt | sponge | psql -p 5432 -h $DB_HOST -b -U $DB_USER $DB_NAME
psql -p 5432 -h $DB_HOST -b -U $DB_USER $DB_NAME << EOF
ALTER TABLE carris.stops ADD COLUMN stop_name_clean text;
UPDATE carris.stops SET stop_name_clean = PT_DEABREVIATE(stop_name);
EOF
rm *.txt
rm carris.zip
cd ..



mkdir mts
cd mts
wget https://files.mobilitydatabase.org/mdb-2408/mdb-2408-202610130122/mdb-2408-202610130122.zip
unzip mdb-2408-202610130122.zip
rm vehicles.txt
rm calendar.txt
echo "service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date
DOM,0,0,0,0,0,0,1,20260101,20261231
DS_inverno,1,1,1,1,1,0,0,20260908,20270714
DS_verao,1,1,1,1,1,0,0,20270715,20270907
SAB,0,0,0,0,0,1,0,20260101,20261231" > calendar.txt
rm -r __MACOSX/
npm exec -- gtfs-to-sql --require-dependencies --schema mts --stops-location-index -- *.txt | sponge | psql -p 5432 -h $DB_HOST -b -U $DB_USER $DB_NAME
psql -p 5432 -h $DB_HOST -b -U $DB_USER $DB_NAME << EOF
ALTER TABLE mts.stops ADD COLUMN stop_name_clean text;
UPDATE mts.stops SET stop_name_clean = PT_DEABREVIATE(stop_name);
EOF
rm *.txt
rm MTS-20240129.zip
cd ..

mkdir ml
cd ml
wget --user-agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 Safari/537.36" "https://httpbin.io/user-agent" https://www.metrolisboa.pt/google_transit/googleTransit.zip -O ml.zip
unzip ml.zip
rm fare_attributes.txt 
rm fare_rules.txt 
rm feed_info.txt
rm areas.txt
rm fare_media.txt
rm fare_transfer_rules.txt
rm fare_products.txt
rm fare_leg_rules.txt
npm exec -- gtfs-to-sql --require-dependencies --schema ml --stops-location-index -- *.txt | sponge | psql -p 5432 -h $DB_HOST -b -U $DB_USER $DB_NAME
psql -p 5432 -h $DB_HOST -b -U $DB_USER $DB_NAME << EOF
ALTER TABLE ml.stops ADD COLUMN stop_name_clean text;
UPDATE ml.stops SET stop_name_clean = PT_DEABREVIATE(stop_name);
EOF
rm *.txt
rm ml.zip
cd ..

mkdir cp
cd cp
wget https://publico.cp.pt/gtfs/gtfs.zip
unzip gtfs.zip
npm exec -- gtfs-to-sql --require-dependencies --trips-without-shape-id  --schema cp --stops-location-index -- *.txt | sponge | psql -p 5432 -h $DB_HOST -b -U $DB_USER $DB_NAME
psql -p 5432 -h $DB_HOST -b -U $DB_USER $DB_NAME << EOF
ALTER TABLE cp.stops ADD COLUMN stop_name_clean text;
UPDATE cp.stops SET stop_name_clean = PT_DEABREVIATE(stop_name);
EOF
rm *.txt
rm gtfs.zip


mkdir fertagus
cd fertagus
wget --no-check-certificate https://www.fertagus.pt/GTFSTMLzip/Fertagus_GTFS.zip
unzip Fertagus_GTFS.zip
rm fare_attributes.txt
rm fare_rules.txt
rm vehicles.txt
rm feed_info.txt
npm exec -- gtfs-to-sql --require-dependencies --schema fertagus --stops-location-index -- *.txt | sponge | psql -p 5432 -h $DB_HOST -b -U $DB_USER $DB_NAME
psql -p 5432 -h $DB_HOST -b -U $DB_USER $DB_NAME << EOF
ALTER TABLE fertagus.stops ADD COLUMN stop_name_clean text;
UPDATE fertagus.stops SET stop_name_clean = PT_DEABREVIATE(stop_name);
EOF
rm *.txt
rm Fertagus_GTFS.zip
cd ..



echo "CREATE OR REPLACE VIEW public.all_stops AS
 SELECT 'carris'::text AS feed_id,
    stops.stop_id,
    stops.stop_name,
    stops.stop_name_clean,
    stops.stop_loc
   FROM carris.stops
UNION ALL
 SELECT 'ml'::text AS feed_id,
    stops.stop_id,
    stops.stop_name,
    stops.stop_name_clean,
    stops.stop_loc
   FROM ml.stops
UNION ALL
 SELECT 'mts'::text AS feed_id,
    stops.stop_id,
    stops.stop_name,
    stops.stop_name_clean,
    stops.stop_loc
   FROM mts.stops
UNION ALL
 SELECT 'cmet'::text AS feed_id,
    stops.stop_id,
    stops.stop_name,
    stops.stop_name_clean,
    stops.stop_loc
   FROM cmet.stops
UNION ALL
 SELECT 'fertagus'::text AS feed_id,
    stops.stop_id,
    stops.stop_name,
    stops.stop_name_clean,
    stops.stop_loc
   FROM fertagus.stops
UNION ALL
 SELECT 'cp'::text AS feed_id,
    stops.stop_id,
    stops.stop_name,
    stops.stop_name_clean,
    stops.stop_loc
   FROM cp.stops;" | psql -p 5432 -h $DB_HOST -b -U $DB_USER $DB_NAME




