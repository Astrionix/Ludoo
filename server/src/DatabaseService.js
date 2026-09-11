/**
 * DatabaseService.js
 * Integrated Supabase client service for authoritative persistence of player profiles, coins, stats, and match history.
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jyvwfvhhgsjxdcasztir.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5dndmdmhoZ3NqeGRjYXN6dGlyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTA2MjkyOCwiZXhwIjoyMTA0NjM4OTI4fQ.O5Hx_b_kd_0mXpukTc6c6_p-jMxks3pLSkOg4onp-ns';

class DatabaseService {
  constructor() {
    this.supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false }
    });
    console.log(`[Supabase] Initialized database client for ${SUPABASE_URL}`);
  }

  /**
   * Fetches or initializes a player profile in Supabase database.
   */
  async getOrCreateProfile(playerId, playerName) {
    try {
      const { data, error } = await this.supabase
        .from('profiles')
        .select('*')
        .eq('id', playerId)
        .single();

      if (data) return data;

      // Create new profile if not found
      const newProfile = {
        id: playerId,
        username: playerName || `Player_${playerId.substring(0, 4)}`,
        coins: 1000,
        diamonds: 50,
        total_matches: 0,
        wins: 0
      };

      const { data: inserted, error: insertError } = await this.supabase
        .from('profiles')
        .insert([newProfile])
        .select()
        .single();

      if (insertError) {
        console.error('[Supabase Error] Profile creation:', insertError.message);
        return newProfile;
      }

      return inserted;
    } catch (err) {
      console.error('[Supabase Exception] getOrCreateProfile:', err.message);
      return { id: playerId, username: playerName, coins: 1000, diamonds: 50 };
    }
  }

  /**
   * Records match outcome and updates winner's coins and stats.
   */
  async recordMatchFinished(matchId, winnerId, durationSeconds) {
    try {
      // 1. Insert match record
      await this.supabase.from('matches').insert([{
        id: matchId,
        winner_id: winnerId,
        duration_seconds: durationSeconds || 0
      }]);

      // 2. Increment winner coins (+500) and wins (+1)
      const { data: profile } = await this.supabase
        .from('profiles')
        .select('wins, coins, total_matches')
        .eq('id', winnerId)
        .single();

      if (profile) {
        await this.supabase
          .from('profiles')
          .update({
            wins: (profile.wins || 0) + 1,
            coins: (profile.coins || 0) + 500,
            total_matches: (profile.total_matches || 0) + 1
          })
          .eq('id', winnerId);
      }

      console.log(`[Supabase] Recorded match result for ${matchId}, Winner: ${winnerId}`);
    } catch (err) {
      console.error('[Supabase Exception] recordMatchFinished:', err.message);
    }
  }
}

module.exports = new DatabaseService();
