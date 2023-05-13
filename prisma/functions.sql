-- Recalculate leaderboard positions function --
CREATE OR REPLACE FUNCTION public.recalc_leaderboard()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO device_leaderboard (id, position, avg_position)
SELECT
  id,
  RANK() OVER (ORDER BY dabs DESC) as rank,
  RANK() OVER (ORDER BY avg_dabs DESC) as avg_rank
FROM
  devices WHERE user_id IS NOT NULL ON CONFLICT (id)
  DO
  UPDATE
  SET
    position = EXCLUDED.position,
    avg_position = EXCLUDED.avg_position;
  RETURN NEW;
END
$function$;

-- Call the recalc_position() function when leaderboard UPDATEs --
CREATE TRIGGER device_recalc_on_update
	AFTER UPDATE ON devices
	FOR EACH ROW
	EXECUTE PROCEDURE recalc_leaderboard ();