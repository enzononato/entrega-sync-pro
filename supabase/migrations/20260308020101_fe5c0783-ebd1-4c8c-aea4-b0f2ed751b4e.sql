-- Add unique constraints for upsert operations (skip if exists)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_indicator_daily_unique_entry') THEN
    ALTER TABLE user_indicator_daily ADD CONSTRAINT user_indicator_daily_unique_entry UNIQUE (user_id, indicator_id, data_referencia);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_incentives_daily_unique_entry') THEN
    ALTER TABLE user_incentives_daily ADD CONSTRAINT user_incentives_daily_unique_entry UNIQUE (user_id, data_referencia);
  END IF;
END $$;