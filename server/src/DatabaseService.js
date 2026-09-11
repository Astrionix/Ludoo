/**
 * DatabaseService.js
 * Integrated Supabase client service for authoritative persistence of player profiles, coins, stats, and match history.
 * Environment variables SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are loaded from .env
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

class DatabaseService {
  constructor() {
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      this.supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false }
      });
      console.log(`[Supabase] Initialized database client for ${SUPABASE_URL}`);
    } else {
      console.warn('[Supabase Warning] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing. Database persistence disabled.');
      this.supabase = null;
    }
  }

  /**
   * Fetches or initializes a player profile in Supabase database.
   */
  async getOrCreateProfile(playerId, playerName) {
    if (!this.supabase) {
      return { id: playerId, username: playerName, coins: 1000, diamonds: 50 };
    }

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
    if (!this.supabase) return;

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
