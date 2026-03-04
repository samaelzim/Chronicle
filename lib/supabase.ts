import { createClient } from '@supabase/supabase-js';

export interface Player {
    id: string;
    name: string;
    rating: number;
    wins: number;
    losses: number;
}

export interface Match {
    id: string;
    winner_name: string;
    loser_name: string;
    rating_change: number;
    game_name: string; 
    created_at: string;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);