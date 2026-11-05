-- VISURA INVENTA 07 — PROVEN USE OF VERSIONED ALTERNATE CODE, LAB ONLY.
DO $guard$
BEGIN
 IF current_database()<>'inventa07_test' THEN
  RAISE EXCEPTION 'INVENTA07 LAB ONLY: wrong database %',current_database();
 END IF;
END $guard$;
BEGIN;
CREATE TABLE inventa07_lab.verified_alias_use(
 count_event_id bigint PRIMARY KEY REFERENCES inventa07_lab.reference_events(id),
 scan_event_id uuid UNIQUE NOT NULL REFERENCES inventa07_lab.trusted_scan_events(id),
 activation_event_id bigint NOT NULL REFERENCES inventa07_lab.alternate_barcode_events(id),
 recorded_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON inventa07_lab.verified_alias_use FROM PUBLIC;
ALTER TABLE inventa07_lab.verified_alias_use ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventa07_lab.verified_alias_use FORCE ROW LEVEL SECURITY;

CREATE FUNCTION inventa07_lab.require_actual_alias_use()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $alias$
BEGIN
 IF NEW.kind<>'used-alias-misattribution' THEN RETURN NEW; END IF;
 IF NEW.affected_count_event IS NULL OR NOT EXISTS(
  SELECT 1 FROM inventa07_lab.verified_alias_use link
  JOIN inventa07_lab.reference_events counted ON counted.id=link.count_event_id
  JOIN inventa07_lab.trusted_scan_events scan ON scan.id=link.scan_event_id
  JOIN inventa07_lab.alternate_barcode_events activated ON activated.id=link.activation_event_id
  JOIN inventa07_lab.device_sessions historical_session
    ON historical_session.id=scan.session_id
  JOIN inventa07_lab.team_terminals team
    ON team.campaign_id=counted.campaign_id AND team.location_code=counted.location_code
  WHERE link.count_event_id=NEW.affected_count_event
   AND counted.kind='confirmed' AND counted.campaign_id=NEW.campaign_id
   AND counted.location_code=NEW.location_code
   AND scan.campaign_id=counted.campaign_id AND scan.location_code=counted.location_code
   AND scan.actor_id=counted.actor_id AND scan.session_id=counted.authenticated_session_id
   AND scan.source='camera' AND scan.device_id=team.device_id
   AND historical_session.actor_id=scan.actor_id
   AND historical_session.device_id=team.device_id
   AND activated.operation='activated' AND activated.barcode=scan.barcode
   AND activated.new_product_code=counted.product_code
   AND activated.at<=scan.captured_at AND scan.captured_at<=counted.recorded_at
   AND NOT EXISTS (
    SELECT 1 FROM inventa07_lab.alternate_barcode_events later
    WHERE later.barcode=activated.barcode AND later.id<>activated.id
     AND later.at>activated.at AND later.at<=scan.captured_at
   )
 ) THEN RAISE EXCEPTION
  'Actual confirmed count with verified historical alternate scan required';
 END IF;
 RETURN NEW;
END $alias$;
REVOKE ALL ON FUNCTION inventa07_lab.require_actual_alias_use() FROM PUBLIC;
CREATE TRIGGER require_real_alias_use_before_incident BEFORE INSERT
 ON inventa07_lab.incidents FOR EACH ROW
 EXECUTE FUNCTION inventa07_lab.require_actual_alias_use();
COMMIT;
