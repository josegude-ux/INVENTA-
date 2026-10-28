-- VISURA INVENTA 07 — TEAM-AUTHORIZED PHYSICAL SCAN EVIDENCE.
-- Synthetic server-minted scan rows. NO real camera/device attestation is performed.
DO $guard$
BEGIN
 IF current_database()<>'inventa07_test' THEN
  RAISE EXCEPTION 'INVENTA07 LAB ONLY: wrong database %',current_database();
 END IF;
END $guard$;
BEGIN;
CREATE TABLE inventa07_lab.trusted_scan_events(
 id uuid PRIMARY KEY,
 campaign_id uuid NOT NULL REFERENCES inventa07_lab.campaigns,
 location_code text NOT NULL,
 barcode text NOT NULL,
 actor_id uuid NOT NULL REFERENCES inventa07_lab.actors,
 session_id uuid NOT NULL REFERENCES inventa07_lab.device_sessions,
 device_id uuid NOT NULL,
 source text NOT NULL CHECK(source='camera'),
 captured_at timestamptz NOT NULL DEFAULT now(),
 claimed_by uuid
);
REVOKE ALL ON inventa07_lab.trusted_scan_events FROM PUBLIC;
ALTER TABLE inventa07_lab.trusted_scan_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventa07_lab.trusted_scan_events FORCE ROW LEVEL SECURITY;

ALTER TABLE inventa07_lab.provisionals
 ADD COLUMN team_id uuid REFERENCES inventa07_lab.team_terminals,
 ADD COLUMN original_a uuid,
 ADD COLUMN original_b uuid;
ALTER TABLE inventa07_lab.incidents
 ADD COLUMN team_id uuid REFERENCES inventa07_lab.team_terminals,
 ADD COLUMN original_a uuid,
 ADD COLUMN original_b uuid;

CREATE FUNCTION inventa07_lab.guard_physical_evidence()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $physical$
DECLARE
 actor uuid;sess uuid;device uuid;
 v_team inventa07_lab.team_terminals%ROWTYPE;
 claimed integer;
BEGIN
 actor:=nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
 sess:=nullif(current_setting('request.jwt.claim.session_id',true),'')::uuid;
 IF TG_OP='UPDATE' THEN
  IF actor IS NULL OR sess IS NULL OR NOT EXISTS(
   SELECT 1 FROM inventa07_lab.actors WHERE id=actor AND active AND role='admin')
  THEN RAISE EXCEPTION 'Only Administration can resolve physical evidence'; END IF;
  IF TG_TABLE_NAME='provisionals' THEN
   IF to_jsonb(NEW)-'status' IS DISTINCT FROM to_jsonb(OLD)-'status'
   THEN RAISE EXCEPTION 'Administrative resolution must preserve original physical evidence'; END IF;
  ELSE
   IF to_jsonb(NEW)-'status'-'revision' IS DISTINCT FROM
      to_jsonb(OLD)-'status'-'revision' OR NEW.revision<>OLD.revision+1
   THEN RAISE EXCEPTION 'Incident update must preserve evidence and advance version'; END IF;
  END IF;
  RETURN NEW;
 END IF;
 IF NOT inventa07_lab.team_authorized(NEW.campaign_id,NEW.location_code)
 THEN RAISE EXCEPTION 'Team terminal lease required for physical evidence'; END IF;
 SELECT * INTO STRICT v_team FROM inventa07_lab.team_terminals
  WHERE campaign_id=NEW.campaign_id AND location_code=NEW.location_code;
 NEW.team_id:=v_team.team_id;
 NEW.original_a:=v_team.original_a;
 NEW.original_b:=v_team.original_b;
 IF TG_TABLE_NAME='provisionals' THEN
  -- The client-provided source flag is NOT evidence. Both independent event IDs
  -- must already be registered by a privileged, trusted scan-attestation service.
  IF NEW.scan_a IS NULL OR NEW.scan_b IS NULL OR NEW.scan_a=NEW.scan_b
    THEN RAISE EXCEPTION 'Two distinct trusted physical scan events required'; END IF;
  UPDATE inventa07_lab.trusted_scan_events s SET claimed_by=NEW.id
   WHERE s.id IN(NEW.scan_a,NEW.scan_b)
     AND s.claimed_by IS NULL
     AND s.campaign_id=NEW.campaign_id AND s.location_code=NEW.location_code
     AND s.barcode=NEW.barcode AND s.actor_id=actor AND s.session_id=sess
     AND s.device_id=v_team.device_id AND s.source='camera'
     AND s.captured_at BETWEEN now()-interval '10 minutes' AND now();
  GET DIAGNOSTICS claimed=ROW_COUNT;
  IF claimed<>2 THEN RAISE EXCEPTION 'Missing, expired or reused trusted scanner evidence'; END IF;
 END IF;
 RETURN NEW;
END $physical$;
REVOKE ALL ON FUNCTION inventa07_lab.guard_physical_evidence() FROM PUBLIC;
CREATE TRIGGER protect_provisional_physical_evidence BEFORE INSERT OR UPDATE
 ON inventa07_lab.provisionals FOR EACH ROW
 EXECUTE FUNCTION inventa07_lab.guard_physical_evidence();
CREATE TRIGGER protect_incident_physical_evidence BEFORE INSERT OR UPDATE
 ON inventa07_lab.incidents FOR EACH ROW
 EXECUTE FUNCTION inventa07_lab.guard_physical_evidence();
COMMIT;
