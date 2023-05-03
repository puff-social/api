-- Recalculate leaderboard positions function --
CREATE OR REPLACE FUNCTION public.recalc_leaderboard()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO device_leaderboard (id, position)
SELECT
  id,
  RANK() OVER (ORDER BY dabs DESC)
FROM
  devices ON CONFLICT (id)
  DO
  UPDATE
  SET
    position = EXCLUDED.position;
  RETURN NEW;
END
$function$

-- Call the recalc_position() function when leaderboard UPDATEs --
CREATE TRIGGER device_recalc_on_update
	AFTER UPDATE ON devices
	FOR EACH ROW
	EXECUTE PROCEDURE recalc_leaderboard ();