-- Recalculate leaderboard positions function --
CREATE OR REPLACE FUNCTION public.recalc_positions()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO leaderboard_positions (device_id, position)
SELECT
  device_id,
  RANK() OVER (ORDER BY total_dabs DESC)
FROM
  leaderboard ON CONFLICT (device_id)
  DO
  UPDATE
  SET
    position = EXCLUDED.position;
  RETURN NEW;
END
$function$;

-- Call the recalc_position() function when leaderboard UPDATEs --
CREATE TRIGGER leaderboard_recalc_user_positions
	AFTER UPDATE ON leaderboard
	FOR EACH ROW
	EXECUTE PROCEDURE recalc_positions ();