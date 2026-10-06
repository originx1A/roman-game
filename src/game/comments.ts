import { browserBagStore, createBagSet } from './lineBag'
import { createHeardLog } from './heardLog'
import { setVoiceHeardListener, setVoiceStartListener, voiceLineText } from './sound'
import { isPlayableVoiceClip, roleForClip } from './voiceLines'
import { NEW_TIP_LINES, OLD_SNARK_TIP_LINES, RECORDED_TIP_LINES, SNARK_TIPS, playableTipLines, type TipId, type TipReason, type TipVoice } from './voiceTips'

export type CommentMood = 'good' | 'bad' | 'hype' | 'neutral'

export type VoiceClipId =
  | 'nice'
  | 'solid'
  | 'that_works'
  | 'good_call'
  | 'clean'
  | 'too_close'
  | 'row_taken'
  | 'region_full'
  | 'nope'
  | 'nudge'
  | 'cleared'
  | 'board_complete'
  | 'out_of_hearts'
  | 'tough_board'
  | 'prize_time'
  | 'new_badge'
  | 'roman_awesome'
  | 'roman_legend'
  | 'roman_highfive'
  | 'roman_win'
  | 'roman_brain'
  | 'roman_boss'
  | 'roman_sparkle'
  | 'roman_proud'
  | 'roman_clutch'
  | 'roman_smooth'
  | 'roman_cheer'
  | 'roman_cook'
  | 'roman_critter'
  | 'roman_stash'
  | 'roman_prize'
  | 'roman_hint'
  | 'roman_nudge'
  | 'roman_close'
  | 'roman_oops'
  | 'roman_bonk'
  | 'roman_nope'
  | 'roman_silly'
  | 'roman_brainfart'
  | 'roman_retry'
  | 'roman_hearts'
  | 'roman_colorblind'
  | 'roman_samecolor'
  | 'roman_rowmate'
  | 'roman_coltaken'
  | 'roman_cuddle'
  | 'roman_highhopes'
  | 'roman_cantwin'
  | 'roman_trying'
  | 'roman_stillbetter'
  | 'roman_skillissue'
  | 'roman_warmup'
  | 'roman_almost'
  | 'roman_sleeping'
  | 'roman_practice'
  | 'roman_myboard'
  | 'roman_sandwich'
  | 'roman_itchy'
  | 'roman_plotwin'
  | 'roman_okayfine'
  | 'roman_cocky'
  | 'roman_sock'
  | 'roman_taco'
  | 'roman_juice'
  | 'roman_dino'
  | 'roman_nugget'
  | 'roman_shoe'
  | 'roman_potato'
  | 'roman_sneeze'
  | 'roman_fridge'
  | 'roman_nap'
  | 'roman_spaghetti'
  | 'roman_raccoon'
  | 'roman_shrug'
  | 'roman_dance'
  | 'roman_forgot'
  | 'roman_toes'
  | 'roman_eyeballs'
  | 'roman_victoryburp'
  | 'roman_highfiveself'
  | 'roman_broccoli'
  | 'roman_pickle'
  | 'roman_banana'
  | 'roman_cheese'
  | 'roman_pants'
  | 'roman_booger'
  | 'roman_lizard'
  | 'roman_ghost'
  | 'roman_unicorn'
  | 'roman_worm'
  | 'roman_trumpet'
  | 'roman_bubblegum'
  | 'roman_helicopter'
  | 'roman_underpants'
  | 'roman_moonwalk'
  | 'roman_idle_hello'
  | 'roman_idle_century'
  | 'roman_idle_sandwich'
  | 'roman_idle_blink'
  | 'roman_idle_loading'
  | 'roman_idle_admire'
  | 'roman_idle_sphinx'
  | 'roman_idle_snore'
  | 'roman_wrong_bold'
  | 'roman_wrong_complaint'
  | 'roman_wrong_oof'
  | 'roman_wrong_politely'
  | 'roman_wrong_grandma'
  | 'roman_wrong_wifi'
  | 'roman_wrong_drama'
  | 'roman_wrong_trophy'
  | 'roman_lose_nap'
  | 'roman_lose_fought'
  | 'roman_lose_snacks'
  | 'roman_lose_round'
  | 'roman_hint_psst'
  | 'roman_hint_secret'
  | 'roman_hint_clue'
  | 'roman_badge_shiny'
  | 'roman_badge_fridge'
  | 'roman_badge_wear'
  | 'roman_badge_impressed'
  | 'roman_spin_spoken'
  | 'roman_spin_ooh'
  | 'roman_spin_lucky'
  | 'roman_stash_party'
  | 'roman_stash_jazz'
  | 'old_wrong_stick'
  | 'old_wrong_pigeon'
  | 'old_wrong_love'
  | 'old_wrong_choice'
  | 'old_wrong_money'
  | 'old_wrong_tea'
  | 'old_wrong_chaos'
  | 'old_wrong_knees'
  | 'old_wrong_personal'
  | 'old_wrong_close'
  | 'old_wrong_again'
  | 'old_wrong_refund'
  | 'old_wrong_nickel'
  | 'old_wrong_teacher'
  | 'old_wrong_loudly'
  | 'old_idle_twenty'
  | 'old_idle_crossword'
  | 'old_idle_kettle'
  | 'old_idle_nap'
  | 'old_idle_glacier'
  | 'old_idle_younger'
  | 'old_idle_gossip'
  | 'old_hint_stare'
  | 'old_hint_tell'
  | 'old_hint_wheels'
  | 'old_hint_push'
  | 'old_hint_smart'
  | 'old_undo_hokey'
  | 'old_undo_dizzy'
  | 'old_undo_rocking'
  | 'old_undo_vacation'
  | 'old_lose_tape'
  | 'old_lose_goldfish'
  | 'old_lose_sideways'
  | 'old_lose_popcorn'
  | 'old_win_eventually'
  | 'old_win_ugly'
  | 'roman_record_best'
  | 'roman_record_faster'
  | 'roman_record_beat'
  | 'roman_nearmiss'
  | 'roman_trial_clear'
  | 'roman_daily_done'
  | 'old_record_head'
  | 'old_record_tea'
  | 'old_nearmiss'
  | 'old_win_paint'
  | 'old_win_yesterday'
  | 'old_win_gaveup'
  | 'old_rescue_modern'
  | 'old_rescue_refund'
  | 'old_rescue_coins'
  | 'old_rescue_cat'
  | 'old_aside_smell'
  | 'old_aside_heat'
  | 'old_aside_glasses'
  | 'old_aside_stove'
  | 'old_aside_tuesday'
  | 'old_aside_tea'
  | 'old_aside_knees'
  | 'old_aside_remote'
  | 'old_aside_cat'
  | 'old_aside_socks'
  | 'old_jab_mitts'
  | 'old_jab_bingo'
  | 'old_jab_phone'
  | 'old_jab_backday'
  | 'old_jab_buddy'
  | 'old_jab_square'
  | 'old_jab_thinking'
  | 'old_jab_patience'
  | 'old_jab_map'
  | 'old_jab_shoes'
  | 'old_good_fine'
  | 'old_good_accident'
  | 'old_good_tea'
  | 'old_good_knees'
  | 'old_good_once'
  | 'old_good_square'
  | 'old_good_grumble'
  | 'old_good_day'
  | 'spark_1'
  | 'spark_2'
  | 'spark_3'
  | 'spark_4'
  | 'spark_unlocked'
  | 'spark_have_1'
  | 'spark_have_2'
  | 'spark_have_3'
  | 'spark_have_4'
  | 'coach_hint_look'
  | 'coach_hint_help'
  | 'coach_hint_glow'
  | 'coach_hint_clue'
  | 'coach_hint_peek'
  | 'coach_hint_step'
  | 'coach_hint_try'
  | 'coach_lose_breathe'
  | 'coach_lose_again'
  | 'coach_lose_next'
  | 'coach_prize_ooh'
  | 'coach_prize_see'
  | 'coach_badge_earned'
  | 'coach_badge_look'
  | 'roman_hint_wink'
  | 'roman_hint_spy'
  | 'roman_hint_treasure'
  | 'roman_lose_cape'
  | 'roman_lose_shake'
  | 'roman_lose_pillow'
  | 'old_wrong_toaster'
  | 'old_wrong_bold'
  | 'old_wrong_hallway'
  | 'old_wrong_history'
  | 'old_wrong_spectacles'
  | 'old_good_clock'
  | 'old_good_surprised'
  | 'old_good_lucky'
  | 'old_good_clap'
  | 'old_hint_flashlight'
  | 'old_hint_grandkid'
  | 'old_hint_cane'
  | 'old_hint_cheating'
  | 'old_undo_face'
  | 'old_undo_yoyo'
  | 'old_undo_regret'
  | 'old_undo_aging'
  | 'old_undo_eraser'
  | 'old_win_squirrel'
  | 'old_win_frame'
  | 'old_win_napped'
  | 'old_win_twothree'
  | 'old_lose_called'
  | 'old_lose_sandwich'
  | 'old_lose_nephew'
  | 'old_lose_deal'
  | 'old_idle_mail'
  | 'old_idle_beard'
  | 'old_idle_birthday'
  | 'old_aside_humming'
  | 'old_aside_pigeons'
  | 'old_rescue_lifeguard'
  | 'old_rescue_parachute'
  | 'tip_stall_roman_clock'
  | 'tip_stall_roman_combo'
  | 'tip_stall_roman_beg'
  | 'tip_stall_coach_combo'
  | 'tip_stall_coach_marks'
  | 'tip_stall_coach_fewest'
  | 'tip_stall_old_combo'
  | 'tip_stall_old_timer'
  | 'tip_stall_old_free'
  | 'tip_undo_roman_count'
  | 'tip_undo_roman_sock'
  | 'tip_undo_roman_rules'
  | 'tip_undo_coach_cost'
  | 'tip_undo_coach_stars'
  | 'tip_undo_coach_marks'
  | 'tip_undo_old_prices'
  | 'tip_undo_old_rent'
  | 'tip_undo_old_crying'
  | 'tip_star_roman_time'
  | 'tip_star_coach_time'
  | 'tip_star_old_time'
  | 'tip_star_roman_recipe'
  | 'tip_star_coach_undo'
  | 'tip_star_old_barber'
  | 'tip_star_roman_combo'
  | 'tip_star_coach_score'
  | 'tip_star_old_coffee'
  | 'tip_star_roman_trial'
  | 'tip_star_coach_card'
  | 'tip_star_old_motel'
  | 'tip_stuck_roman_shiny'
  | 'tip_stuck_roman_1987'
  | 'tip_stuck_roman_row'
  | 'tip_stuck_coach_hint'
  | 'tip_stuck_coach_region'
  | 'tip_stuck_coach_learn'
  | 'tip_stuck_old_complaint'
  | 'tip_stuck_old_knees'
  | 'tip_stuck_old_pride'
  | 'tip_trial_roman_welcome'
  | 'tip_trial_roman_coins'
  | 'tip_trial_coach_rules'
  | 'tip_trial_coach_marks'
  | 'tip_trial_old_life'
  | 'tip_trial_old_doctor'
  | 'tip_trial_old_embarrass'
  | 'tip_trial_old_marriage'
  | 'tip_trial_old_baseball'
  | 'tip_trial_old_gym'
  | 'tip_daily_roman_first'
  | 'tip_daily_roman_streak'
  | 'tip_daily_coach_careful'
  | 'tip_daily_coach_streak'
  | 'tip_daily_old_parking'
  | 'tip_daily_old_glasses'
  | 'tip_daily_old_pills'
  | 'tip_daily_old_diet'
  | 'tip_daily_old_crossword'
  | 'tip_daily_old_nap'
  | 'old_notbest_tsk'
  | 'old_notbest_yesterday'
  | 'old_notbest_rerun'
  | 'old_notbest_ghost'
  | 'old_notbest_calendar'
  | 'old_notbest_knees'
  | 'old_notbest_tea'
  | 'old_notbest_downhill'
  | 'old_notbest_slowpoke'
  | 'roman_notbest_record'
  | 'roman_notbest_again'
  | 'roman_notbest_turtle'
  | 'coach_notbest_clear'
  | 'coach_notbest_close'
  | 'roman_record_fireworks'
  | 'roman_record_clock'
  | 'roman_record_fridge'
  | 'roman_record_zoom'
  | 'roman_record_notes'
  | 'roman_record_socks'
  | 'old_record_nap'
  | 'old_record_teeth'
  | 'old_record_luck'
  | 'old_record_showoff'
  | 'old_record_rocking'
  | 'old_record_pencil'
  | 'coach_record_best'
  | 'coach_record_faster'
  | 'coach_record_proud'
  | 'coach_record_practice'
  // 9.30-o: approved lines (voice-lines-draft-3.md)
  | 'roman_wrong_hiccup'
  | 'roman_wrong_hat'
  | 'roman_wrong_bounce'
  | 'roman_wrong_cousin'
  | 'roman_wrong_marble'
  | 'roman_wrong_toast'
  | 'roman_wrong_sneeze'
  | 'roman_wrong_cape'
  | 'roman_wrong_map'
  | 'roman_wrong_nearly'
  | 'roman_wrong_banana'
  | 'roman_wrong_clown'
  | 'roman_wrong_nap'
  | 'roman_wrong_dance'
  | 'roman_wrong_puddle'
  | 'roman_wrong_hmm'
  | 'roman_wrong_gremlin'
  | 'roman_wrong_shelf'
  | 'roman_wrong_chirp'
  | 'roman_wrong_pancake'
  | 'roman_wrong_noodle'
  | 'roman_wrong_nice_try'
  | 'roman_wrong_plot'
  | 'roman_wrong_mirror'
  | 'roman_wrong_hop'
  | 'roman_wrong_wobble'
  | 'roman_wrong_ticket'
  | 'roman_wrong_gong'
  | 'roman_wrong_sock'
  | 'roman_wrong_detour'
  | 'coach_wrong_touch_gap'
  | 'coach_wrong_touch_corner'
  | 'coach_wrong_row_one'
  | 'coach_wrong_region_own'
  | 'coach_wrong_any_close'
  | 'coach_wrong_any_ok'
  | 'old_good_stopped'
  | 'old_good_carry'
  | 'old_good_twice'
  | 'old_good_mild'
  | 'old_good_bones'
  | 'old_good_newspaper'
  | 'old_good_nod'
  | 'old_good_soup'
  | 'old_good_hat'
  | 'old_good_decent'
  | 'old_good_kid'
  | 'old_good_bench'
  | 'old_good_radio'
  | 'old_good_cardigan'
  | 'old_good_bingo'
  | 'old_good_porch'
  | 'old_good_gravy'
  | 'old_good_whistle'
  | 'old_good_rare'
  | 'old_good_blink'
  | 'old_good_weather'
  | 'old_good_fair'
  | 'old_aside_door'
  | 'old_aside_slippers'
  | 'old_aside_biscuit'
  | 'old_aside_weather'
  | 'old_aside_lawn'
  | 'old_aside_crossword'
  | 'old_aside_clock'
  | 'old_aside_neighbour'
  | 'old_aside_mail'
  | 'old_aside_nap'
  | 'old_aside_stairs'
  | 'old_aside_phone'
  | 'old_aside_lemon'
  | 'old_aside_ache'
  | 'old_aside_whistle'
  | 'roman_prize_drumroll'
  | 'roman_prize_jackpot'
  | 'roman_prize_spin'
  | 'roman_prize_wheel'
  | 'roman_prize_goodies'
  | 'roman_prize_shiny'
  | 'roman_prize_fate'
  | 'coach_prize_spin'
  | 'coach_prize_lucky'
  | 'coach_prize_reward'
  | 'coach_prize_surprise'
  | 'coach_prize_nice'
  | 'coach_badge_nice'
  | 'coach_badge_hard'
  | 'coach_badge_proud'
  | 'coach_badge_collect'
  | 'roman_badge_trophy'
  | 'roman_badge_brag'
  | 'roman_badge_shelf'
  | 'roman_badge_gold'
  | 'coach_hint_light'
  | 'coach_hint_start'
  | 'coach_hint_safe'
  | 'coach_hint_point'
  | 'coach_hint_easy'
  | 'roman_hint_shh'
  | 'roman_hint_magic'
  | 'roman_hint_map'
  | 'roman_hint_owl'
  | 'roman_hint_boop'
  | 'old_hint_mapquest'
  | 'old_hint_crutch'
  | 'old_hint_giveup'
  | 'coach_notbest_again'
  | 'coach_notbest_steady'
  | 'coach_notbest_learning'
  | 'coach_notbest_nice_win'
  | 'coach_notbest_almost'
  | 'coach_notbest_fresh'
  | 'coach_notbest_calm'
  | 'coach_notbest_close2'
  | 'coach_notbest_rhythm'
  | 'coach_notbest_smile'
  | 'coach_notbest_bank'
  | 'roman_notbest_snail'
  | 'roman_notbest_yawn'
  | 'old_notbest_slow'
  | 'old_notbest_sunday'
  | 'old_notbest_snail'
  | 'old_notbest_stroll'
  | 'old_notbest_pension'
  | 'old_notbest_crawl'
  | 'roman_record_rocket'
  | 'coach_record_fast'
  | 'roman_idle_dust'
  | 'roman_idle_tick'
  | 'roman_idle_tea'
  | 'roman_idle_cloud'
  | 'roman_idle_stretch'
  | 'coach_idle_take'
  | 'old_undo_merry'
  | 'old_undo_pendulum'
  | 'old_undo_sweep'
  | 'old_undo_dial'
  | 'roman_undo_boomerang'
  | 'old_wrong_aim'
  | 'old_wrong_bird'
  | 'old_wrong_sideways'
  | 'old_wrong_seat'
  | 'old_wrong_nope'
  | 'old_wrong_cheese'
  | 'old_wrong_map'
  | 'old_wrong_cane'
  | 'old_nearmiss_close'
  | 'roman_trial_shocked'
  | 'roman_trial_coins'
  | 'roman_trial_unfair'
  | 'roman_trial_crown'
  | 'roman_trial_harder'
  | 'coach_trial_clear'
  | 'coach_trial_clock'
  | 'coach_trial_steady'
  | 'old_trial_huh'
  | 'old_trial_candy'
  | 'old_trial_complaint'
  | 'roman_daily_streak'
  | 'roman_daily_cook'
  | 'roman_daily_calendar'
  | 'roman_daily_snack'
  | 'roman_daily_sametime'
  | 'coach_daily_done'
  | 'coach_daily_streak'
  | 'coach_daily_great'
  | 'old_daily_paper'
  | 'old_daily_tomorrow'
  | 'old_daily_everyday'
  | 'coach_notbest_stands'
  | 'coach_notbest_okay'
  | 'coach_notbest_chase'
  | 'coach_notbest_breath'
  | 'coach_notbest_safe'
  | 'coach_notbest_practice'
  | 'coach_stash_five'
  | 'coach_stash_complete'
  | 'coach_stash_bonus'
  | 'coach_stash_sparkle'

export type ConflictKind = 'touch' | 'row' | 'col' | 'region' | 'generic'

export type VoiceMood = 'excited' | 'happy' | 'neutral' | 'soft' | 'disappointed'

export interface Banter {
  text: string
  mood: CommentMood
  voiceMood: VoiceMood
  speak: boolean
  clip?: VoiceClipId
  /** Other clips in the same pool if the chosen file fails to play. */
  alts?: readonly VoiceClipId[]
  giggle?: boolean
  silent?: boolean
  /** Voice channel priority: a line only interrupts a lower-priority line (see VOICE_PRIORITY). */
  priority?: number
  /** If the channel is busy with an equal/higher line, wait up to this long for it instead of skipping. */
  waitMs?: number
}

/**
 * Voice channel priorities. A new line interrupts only a lower-priority one; equal/lower is skipped
 * (or waits, for lines with waitMs). Win/lose beat everything, then a hint the player asked for.
 */
export const VOICE_PRIORITY = { idle: 1, chatter: 2, wrong: 3, hint: 4, prize: 4, win: 5, lose: 5 } as const

// All roman_* clips are the deeper Roman voice (en-US-BrianNeural, see scripts/voice-manifest.json).
// old_* clips are the old-timer heckler (en-AU-WilliamMultilingualNeural + rasp). Coach clips are en-US-JennyNeural.

/** Win cheers (Roman). Every id has a clip under public/voices. */
export const ROMAN_CHEER_CLIPS = [
  'roman_awesome',
  'roman_legend',
  'roman_highfive',
  'roman_win',
  'roman_brain',
  'roman_boss',
  'roman_sparkle',
  'roman_proud',
  'roman_clutch',
  'roman_smooth',
  'roman_cheer',
  'roman_cook',
  'roman_itchy',
  'roman_plotwin',
  'roman_okayfine',
  'roman_cocky',
  'roman_sandwich',
  'roman_sock',
  'roman_taco',
  'roman_juice',
  'roman_dino',
  'roman_nugget',
  'roman_shoe',
  'roman_potato',
  'roman_sneeze',
  'roman_fridge',
  'roman_nap',
  'roman_spaghetti',
  'roman_raccoon',
  'roman_shrug',
  'roman_dance',
  'roman_forgot',
  'roman_toes',
  'roman_eyeballs',
  'roman_victoryburp',
  'roman_highfiveself',
  'roman_broccoli',
  'roman_pickle',
  'roman_banana',
  'roman_cheese',
  'roman_pants',
  'roman_booger',
  'roman_lizard',
  'roman_ghost',
  'roman_unicorn',
  'roman_worm',
  'roman_trumpet',
  'roman_bubblegum',
  'roman_helicopter',
  'roman_underpants',
  'roman_moonwalk',
] as const satisfies readonly VoiceClipId[]

/** Wrong-move putdowns (Roman). */
export const ROMAN_WRONG_CLIPS = [
  'roman_close',
  'roman_oops',
  'roman_bonk',
  'roman_nope',
  'roman_silly',
  'roman_brainfart',
  'roman_retry',
  'roman_colorblind',
  'roman_samecolor',
  'roman_rowmate',
  'roman_coltaken',
  'roman_cuddle',
  'roman_trying',
  'roman_skillissue',
  'roman_sleeping',
  'roman_wrong_bold',
  'roman_wrong_complaint',
  'roman_wrong_oof',
  'roman_wrong_politely',
  'roman_wrong_grandma',
  'roman_wrong_wifi',
  'roman_wrong_drama',
  'roman_wrong_trophy',
  'roman_wrong_hiccup',
  'roman_wrong_hat',
  'roman_wrong_bounce',
  'roman_wrong_cousin',
  'roman_wrong_marble',
  'roman_wrong_toast',
  'roman_wrong_sneeze',
  'roman_wrong_cape',
  'roman_wrong_map',
  'roman_wrong_nearly',
  'roman_wrong_banana',
  'roman_wrong_clown',
  'roman_wrong_nap',
  'roman_wrong_dance',
  'roman_wrong_puddle',
  'roman_wrong_hmm',
  'roman_wrong_gremlin',
  'roman_wrong_shelf',
  'roman_wrong_chirp',
  'roman_wrong_pancake',
  'roman_wrong_noodle',
  'roman_wrong_nice_try',
  'roman_wrong_plot',
  'roman_wrong_mirror',
  'roman_wrong_hop',
  'roman_wrong_wobble',
  'roman_wrong_ticket',
  'roman_wrong_gong',
  'roman_wrong_sock',
  'roman_wrong_detour',
] as const satisfies readonly VoiceClipId[]

/** Idle pokes while the player waits (Roman). */
export const ROMAN_IDLE_CLIPS = [
  'roman_idle_hello',
  'roman_idle_century',
  'roman_idle_sandwich',
  'roman_idle_blink',
  'roman_idle_loading',
  'roman_idle_admire',
  'roman_idle_sphinx',
  'roman_idle_snore',
  // 9.30-j: the stall-tip lines were written for this same moment (no moves for a while)
  'tip_stall_roman_clock',
  'tip_stall_roman_combo',
  'tip_stall_roman_beg',
  'roman_idle_dust',
  'roman_idle_tick',
  'roman_idle_tea',
  'roman_idle_cloud',
  'roman_idle_stretch',
] as const satisfies readonly VoiceClipId[]
/** 9.30-j: the coach's stall-tip lines (no moves for a while) */
export const COACH_IDLE_CLIPS = ['tip_stall_coach_combo', 'tip_stall_coach_marks', 'tip_stall_coach_fewest', 'coach_idle_take'] as const satisfies readonly VoiceClipId[]

/** Out of hearts (Roman). */
export const ROMAN_LOSE_CLIPS = [
  'roman_hearts',
  'roman_lose_nap',
  'roman_lose_fought',
  'roman_lose_snacks',
  'roman_lose_round',
  'roman_lose_cape',
  'roman_lose_shake',
  'roman_lose_pillow',
  // 9.29-a: these end-of-run lines were in the wrong-move pool (so they could play mid-board)
  'roman_highhopes',
  'roman_warmup',
] as const satisfies readonly VoiceClipId[]

/**
 * 9.29-a: "nice try" lines (Roman) for missing the Buddy Hunt bonus after a WIN. Kept apart from
 * the lose pools: a won board must never hear "out of hearts" (it used the lose pool before).
 * These were in the wrong-move pool before.
 */
export const ROMAN_NICE_TRY_CLIPS = [
  'roman_cantwin',
  'roman_myboard',
  'roman_stillbetter',
  'roman_practice',
] as const satisfies readonly VoiceClipId[]

/** Hint / rescue (Roman). */
export const ROMAN_HINT_CLIPS = [
  'roman_hint',
  'roman_nudge',
  'roman_hint_psst',
  'roman_hint_secret',
  'roman_hint_clue',
  'roman_hint_wink',
  'roman_hint_spy',
  'roman_hint_treasure',
  'roman_hint_shh',
  'roman_hint_magic',
  'roman_hint_map',
  'roman_hint_owl',
  'roman_hint_boop',
] as const satisfies readonly VoiceClipId[]

/** Badge unlocked (Roman). */
export const ROMAN_BADGE_CLIPS = [
  'roman_badge_shiny',
  'roman_badge_fridge',
  'roman_badge_wear',
  'roman_badge_impressed',
  'roman_badge_trophy',
  'roman_badge_brag',
  'roman_badge_shelf',
  'roman_badge_gold',
] as const satisfies readonly VoiceClipId[]

/** Prize wheel result (Roman). */
export const ROMAN_PRIZE_CLIPS = [
  'roman_prize',
  'roman_spin_spoken',
  'roman_spin_ooh',
  'roman_spin_lucky',
  'roman_prize_drumroll',
  'roman_prize_jackpot',
  'roman_prize_spin',
  'roman_prize_wheel',
  'roman_prize_goodies',
  'roman_prize_shiny',
  'roman_prize_fate',
] as const satisfies readonly VoiceClipId[]

/** Fifth spark critter — stash complete (Roman). */
export const ROMAN_STASH_CLIPS = [
  'roman_stash',
  'roman_critter',
  'roman_stash_party',
  'roman_stash_jazz',
] as const satisfies readonly VoiceClipId[]

/** Old-timer heckles for a wrong move. */
export const OLDTIMER_WRONG_CLIPS = [
  'old_wrong_stick',
  'old_wrong_pigeon',
  'old_wrong_love',
  'old_wrong_choice',
  'old_wrong_money',
  'old_wrong_tea',
  'old_wrong_chaos',
  'old_wrong_knees',
  'old_wrong_personal',
  'old_wrong_close',
  'old_wrong_again',
  'old_wrong_refund',
  'old_wrong_nickel',
  'old_wrong_teacher',
  'old_wrong_loudly',
  'old_jab_mitts',
  'old_jab_bingo',
  'old_jab_phone',
  'old_jab_backday',
  'old_jab_buddy',
  'old_jab_square',
  'old_jab_thinking',
  'old_jab_patience',
  'old_jab_map',
  'old_jab_shoes',
  'old_wrong_toaster',
  'old_wrong_bold',
  'old_wrong_hallway',
  'old_wrong_history',
  'old_wrong_spectacles',
  'old_wrong_aim',
  'old_wrong_bird',
  'old_wrong_sideways',
  'old_wrong_seat',
  'old_wrong_nope',
  'old_wrong_cheese',
  'old_wrong_map',
  'old_wrong_cane',
] as const satisfies readonly VoiceClipId[]

/** Old-timer grumbles when the player is slow. */
export const OLDTIMER_IDLE_CLIPS = [
  'old_idle_twenty',
  'old_idle_crossword',
  'old_idle_kettle',
  'old_idle_nap',
  'old_idle_glacier',
  'old_idle_younger',
  'old_idle_gossip',
  'old_idle_mail',
  'old_idle_beard',
  'old_idle_birthday',
  // 9.30-f: two general jabs that fit a long pause widen the idle roasts
  'old_jab_thinking',
  'old_jab_patience',
  // 9.30-j: his stall-tip lines (same moment)
  'tip_stall_old_combo',
  'tip_stall_old_timer',
  'tip_stall_old_free',
] as const satisfies readonly VoiceClipId[]

/** Old-timer on hints. */
export const OLDTIMER_HINT_CLIPS = [
  'old_hint_stare',
  'old_hint_tell',
  'old_hint_wheels',
  'old_hint_push',
  'old_hint_smart',
  'old_hint_flashlight',
  'old_hint_grandkid',
  'old_hint_cane',
  'old_hint_cheating',
  'old_hint_mapquest',
  'old_hint_crutch',
  'old_hint_giveup',
] as const satisfies readonly VoiceClipId[]

/** Old-timer on undo/redo spam. */
export const OLDTIMER_UNDO_CLIPS = [
  'old_undo_hokey',
  'old_undo_dizzy',
  'old_undo_rocking',
  'old_undo_vacation',
  'old_undo_face',
  'old_undo_yoyo',
  'old_undo_regret',
  'old_undo_aging',
  'old_undo_eraser',
  // 9.30-j: his undo-tip lines (same moment: undo after undo)
  'tip_undo_old_prices',
  'tip_undo_old_rent',
  'tip_undo_old_crying',
  'old_undo_merry',
  'old_undo_pendulum',
  'old_undo_sweep',
  'old_undo_dial',
] as const satisfies readonly VoiceClipId[]
/** 9.30-j: Roman's and the coach's undo-tip lines, for undo after undo */
export const ROMAN_UNDO_CLIPS = ['tip_undo_roman_count', 'tip_undo_roman_sock', 'tip_undo_roman_rules', 'roman_undo_boomerang'] as const satisfies readonly VoiceClipId[]
export const COACH_UNDO_CLIPS = ['tip_undo_coach_cost', 'tip_undo_coach_stars', 'tip_undo_coach_marks'] as const satisfies readonly VoiceClipId[]
/** 9.30-j: starting a Trial / a Daily (the first-time tip lines, heard again after the tip retires) */
export const ROMAN_TRIAL_START_CLIPS = ['tip_trial_roman_welcome', 'tip_trial_roman_coins'] as const satisfies readonly VoiceClipId[]
export const COACH_TRIAL_START_CLIPS = ['tip_trial_coach_rules', 'tip_trial_coach_marks'] as const satisfies readonly VoiceClipId[]
export const OLDTIMER_TRIAL_START_CLIPS = ['tip_trial_old_life', 'tip_trial_old_doctor', 'tip_trial_old_embarrass', 'tip_trial_old_marriage', 'tip_trial_old_baseball', 'tip_trial_old_gym'] as const satisfies readonly VoiceClipId[]
export const ROMAN_DAILY_START_CLIPS = ['tip_daily_roman_first', 'tip_daily_roman_streak'] as const satisfies readonly VoiceClipId[]
export const COACH_DAILY_START_CLIPS = ['tip_daily_coach_careful', 'tip_daily_coach_streak'] as const satisfies readonly VoiceClipId[]
export const OLDTIMER_DAILY_START_CLIPS = ['tip_daily_old_parking', 'tip_daily_old_glasses', 'tip_daily_old_pills', 'tip_daily_old_diet', 'tip_daily_old_crossword', 'tip_daily_old_nap'] as const satisfies readonly VoiceClipId[]
/** 9.30-j: the coach's original wrong-move lines (recorded, never wired): one per kind of mistake + a general one */
export const COACH_WRONG_CLIPS = ['nope', 'too_close', 'row_taken', 'region_full', 'coach_wrong_touch_gap', 'coach_wrong_touch_corner', 'coach_wrong_row_one', 'coach_wrong_region_own', 'coach_wrong_any_close', 'coach_wrong_any_ok'] as const satisfies readonly VoiceClipId[]
let lastCoachWrong: VoiceClipId | null = null
const COACH_WRONG_BY_KIND: Record<'touch' | 'row' | 'region' | 'generic', readonly VoiceClipId[]> = {
  touch: ['too_close', 'coach_wrong_touch_gap', 'coach_wrong_touch_corner'],
  row: ['row_taken', 'coach_wrong_row_one'],
  region: ['region_full', 'coach_wrong_region_own'],
  generic: ['nope', 'coach_wrong_any_close', 'coach_wrong_any_ok'],
}
const coachWrongBags = new Map<string, () => VoiceClipId>()
function coachWrongBag(kind: string, pool: readonly VoiceClipId[]): () => VoiceClipId {
  let b = coachWrongBags.get(kind)
  if (!b) { b = voiceBags.bag(`coach.wrong.${kind}`, pool) as () => VoiceClipId; coachWrongBags.set(kind, b) }
  return b
}
/** 9.30-j: the coach's original board-cleared lines (recorded, never wired) */
export const COACH_WIN_CLIPS = ['board_complete', 'cleared'] as const satisfies readonly VoiceClipId[]
/** 9.30-j: near-miss lines written for that moment (recorded, never wired). roman_nearmiss stays retired (it sounded like a loss). */
export const ROMAN_NEAR_MISS_CLIPS = ['roman_almost'] as const satisfies readonly VoiceClipId[]
export const OLDTIMER_NEAR_MISS_CLIPS = ['old_nearmiss', 'old_nearmiss_close'] as const satisfies readonly VoiceClipId[]

/** Old-timer when the player runs out of hearts. */
export const OLDTIMER_LOSE_CLIPS = [
  'old_lose_tape',
  'old_lose_goldfish',
  'old_lose_sideways',
  'old_lose_popcorn',
  'old_lose_called',
  'old_lose_sandwich',
  'old_lose_nephew',
  'old_lose_deal',
] as const satisfies readonly VoiceClipId[]

/** Old-timer backhanded compliments after a slow or sloppy win. */
export const OLDTIMER_WIN_CLIPS = [
  'old_win_eventually',
  'old_win_ugly',
  'old_win_paint',
  'old_win_yesterday',
  'old_win_gaveup',
  'old_win_squirrel',
  'old_win_frame',
  'old_win_napped',
  'old_win_twothree',
] as const satisfies readonly VoiceClipId[]

/** Old-timer when the player buys a rescue. */
export const OLDTIMER_RESCUE_CLIPS = [
  'old_rescue_modern',
  'old_rescue_refund',
  'old_rescue_coins',
  'old_rescue_cat',
  'old_rescue_lifeguard',
  'old_rescue_parachute',
] as const satisfies readonly VoiceClipId[]

/** Offhand remarks that have nothing to do with the move. */
export const OLDTIMER_ASIDE_CLIPS = [
  'old_aside_smell',
  'old_aside_heat',
  'old_aside_glasses',
  'old_aside_stove',
  'old_aside_tuesday',
  'old_aside_tea',
  'old_aside_knees',
  'old_aside_remote',
  'old_aside_cat',
  'old_aside_socks',
  'old_aside_humming',
  'old_aside_pigeons',
  'old_aside_door',
  'old_aside_slippers',
  'old_aside_biscuit',
  'old_aside_weather',
  'old_aside_lawn',
  'old_aside_crossword',
  'old_aside_clock',
  'old_aside_neighbour',
  'old_aside_mail',
  'old_aside_nap',
  'old_aside_stairs',
  'old_aside_phone',
  'old_aside_lemon',
  'old_aside_ache',
  'old_aside_whistle',
] as const satisfies readonly VoiceClipId[]

/** Grudging praise after a correct buddy. */
export const OLDTIMER_GOOD_CLIPS = [
  'old_good_fine',
  'old_good_accident',
  'old_good_tea',
  'old_good_knees',
  'old_good_once',
  'old_good_square',
  'old_good_grumble',
  'old_good_day',
  'old_good_clock',
  'old_good_surprised',
  'old_good_lucky',
  'old_good_clap',
  'old_good_stopped',
  'old_good_carry',
  'old_good_twice',
  'old_good_mild',
  'old_good_bones',
  'old_good_newspaper',
  'old_good_nod',
  'old_good_soup',
  'old_good_hat',
  'old_good_decent',
  'old_good_kid',
  'old_good_bench',
  'old_good_radio',
  'old_good_cardigan',
  'old_good_bingo',
  'old_good_porch',
  'old_good_gravy',
  'old_good_whistle',
  'old_good_rare',
  'old_good_blink',
  'old_good_weather',
  'old_good_fair',
] as const satisfies readonly VoiceClipId[]

/**
 * The old-timer takes about one in three shared voice moments (wrong move, idle, hint, lose),
 * instead of Roman or the coach, never on top of them. A quiet gap keeps him from stacking
 * heckles. Each pool is its own saved shuffle bag (see voiceBags below).
 */
export const OLDTIMER_SHARE = 0.36
export const OLDTIMER_COOLDOWN_MS = 6500
let oldtimerLastAt = Number.NEGATIVE_INFINITY

function oldtimerTurn(share = OLDTIMER_SHARE, oldPool?: readonly VoiceClipId[], others: readonly (readonly VoiceClipId[])[] = []): boolean {
  const now = Date.now()
  if (now - oldtimerLastAt < OLDTIMER_COOLDOWN_MS) return false
  // 9.30-k: when he still has lines nobody has heard (fewer plays than the others' best), he goes
  // more often; when the others have unheard lines and he doesn't, less often. Level = the usual share.
  let p = share
  if (oldPool && others.length) {
    const minOf = (pool: readonly VoiceClipId[]) => Math.min(...pool.map((x) => heardLog.count(x)))
    const o = minOf(oldPool)
    const r = Math.min(...others.map(minOf))
    if (o < r) p = 0.97
    else if (o > r) p = share * 0.35
  }
  if (Math.random() >= p) return false
  oldtimerLastAt = now
  return true
}

/**
 * Every category, for all three voices, is a shuffle bag: each line plays once in random order
 * before any line repeats, a new shuffle never opens with the line just played, a line shared by
 * two categories never plays twice in a row, and bag positions are saved in localStorage so a
 * reload doesn't bring the same lines back first.
 */
// 9.30-f: a line only counts as played once it is actually heard (skipped / stale lines stay next)
// 9.30-k: a saved heard count per clip (roman.heard.v1, not tied to the build). Each moment offers its
// LEAST-heard lines first (random among ties), so an unheard line always comes before a repeat.
export const heardLog = createHeardLog({ store: browserBagStore() })
const voiceBags = createBagSet({ store: browserBagStore(), commitOnPlay: true, heard: heardLog })
/** The voice channel started this clip: its bag moves on (and it counts for no-back-to-back) */
export function noteVoicePlayed(clip: string) {
  voiceBags.markPlayed(clip)
  pendingTurns.get(clip)?.()
  pendingTurns.delete(clip)
}
setVoiceStartListener(noteVoicePlayed)
/** 9.30-k: only a clip that finished (or played 70%) adds to the heard count */
export function noteVoiceHeard(clip: string) {
  heardLog.record(clip)
}
setVoiceHeardListener(noteVoiceHeard)
/** Speaker / turn bags (not lines): they move on when drawn, and never count as a spoken line */
const turnBags = createBagSet({ store: browserBagStore(), key: 'roman.voiceturns.v1' })

function bag(name: string, pool: readonly VoiceClipId[]) {
  const next = voiceBags.bag(name, pool)
  return () => ({ clip: next(), pool })
}

const oldWrong = bag('old.wrong', OLDTIMER_WRONG_CLIPS)
const oldIdle = bag('old.idle', OLDTIMER_IDLE_CLIPS)
const oldHint = bag('old.hint', OLDTIMER_HINT_CLIPS)
const oldUndo = bag('old.undo', OLDTIMER_UNDO_CLIPS)
const oldLose = bag('old.lose', OLDTIMER_LOSE_CLIPS)
const oldWin = bag('old.win', OLDTIMER_WIN_CLIPS)
const oldRescue = bag('old.rescue', OLDTIMER_RESCUE_CLIPS)
const oldAside = bag('old.aside', OLDTIMER_ASIDE_CLIPS)
const oldGood = bag('old.good', OLDTIMER_GOOD_CLIPS)
/** Buddy Hunt misses: the general jabs (not the wrong-buddy lines, which talk about squares/rules) */
const OLDTIMER_HUNT_MISS_CLIPS = [
  'old_jab_mitts',
  'old_jab_bingo',
  'old_jab_backday',
  'old_jab_thinking',
  'old_jab_patience',
  'old_jab_shoes',
  'old_jab_phone',
] as const satisfies readonly VoiceClipId[]
const oldHuntMiss = bag('old.huntMiss', OLDTIMER_HUNT_MISS_CLIPS)
/** New personal best / near miss (replay challenge) */
export const ROMAN_RECORD_CLIPS = ['roman_record_best', 'roman_record_faster', 'roman_record_beat', 'roman_record_fireworks', 'roman_record_clock', 'roman_record_fridge', 'roman_record_zoom', 'roman_record_notes', 'roman_record_socks', 'roman_record_rocket'] as const satisfies readonly VoiceClipId[]
export const COACH_RECORD_CLIPS = ['coach_record_best', 'coach_record_faster', 'coach_record_proud', 'coach_record_practice', 'coach_record_fast'] as const satisfies readonly VoiceClipId[]
// 9.30-f: 'Frame it. It might not happen again.' fits a new best too (the pool had only two lines)
export const OLDTIMER_RECORD_CLIPS = ['old_record_head', 'old_record_tea', 'old_win_frame', 'old_record_nap', 'old_record_teeth', 'old_record_luck', 'old_record_showoff', 'old_record_rocking', 'old_record_pencil'] as const satisfies readonly VoiceClipId[]
/** 9.30-i: Trial clear and Daily done get lines in all three voices (were one Roman line each) */
export const ROMAN_TRIAL_CLEAR_CLIPS = ['roman_trial_clear', 'roman_trial_shocked', 'roman_trial_coins', 'roman_trial_unfair', 'roman_trial_crown', 'roman_trial_harder'] as const satisfies readonly VoiceClipId[]
export const COACH_TRIAL_CLEAR_CLIPS = ['coach_trial_clear', 'coach_trial_clock', 'coach_trial_steady'] as const satisfies readonly VoiceClipId[]
export const OLDTIMER_TRIAL_CLEAR_CLIPS = ['old_trial_huh', 'old_trial_candy', 'old_trial_complaint'] as const satisfies readonly VoiceClipId[]
export const ROMAN_DAILY_DONE_CLIPS = ['roman_daily_done', 'roman_daily_streak', 'roman_daily_cook', 'roman_daily_calendar', 'roman_daily_snack', 'roman_daily_sametime'] as const satisfies readonly VoiceClipId[]
export const COACH_DAILY_DONE_CLIPS = ['coach_daily_done', 'coach_daily_streak', 'coach_daily_great'] as const satisfies readonly VoiceClipId[]
export const OLDTIMER_DAILY_DONE_CLIPS = ['old_daily_paper', 'old_daily_tomorrow', 'old_daily_everyday'] as const satisfies readonly VoiceClipId[]
const oldTrialClear = bag('old.trialClear', OLDTIMER_TRIAL_CLEAR_CLIPS)
const oldDailyDone = bag('old.dailyDone', OLDTIMER_DAILY_DONE_CLIPS)
const oldRecord = bag('old.record', OLDTIMER_RECORD_CLIPS)
/**
 * "Finished, but not your best": a replayed board won without beating the old best.
 * 9.30-a (Tony): ONE line for the whole moment, board cleared + slower than your best, instead of
 * the win cheer followed by a tease. Teasing, never a loss line.
 * 9.30-g: Tony approved the 14 combined lines and they are recorded; they replace the stand-in
 * teasers (those stay in their own win/record/nice-try pools). Old-timer about 60%, Roman and the
 * coach take weighted turns for the rest.
 */
export const ROMAN_NOT_BEST_CLIPS = ['roman_notbest_record', 'roman_notbest_again', 'roman_notbest_turtle', 'roman_notbest_snail', 'roman_notbest_yawn'] as const satisfies readonly VoiceClipId[]
export const OLDTIMER_NOT_BEST_CLIPS = [
  'old_notbest_tsk',
  'old_notbest_yesterday',
  'old_notbest_rerun',
  'old_notbest_ghost',
  'old_notbest_calendar',
  'old_notbest_knees',
  'old_notbest_tea',
  'old_notbest_downhill',
  'old_notbest_slowpoke',
  'old_notbest_slow',
  'old_notbest_sunday',
  'old_notbest_snail',
  'old_notbest_stroll',
  'old_notbest_pension',
  'old_notbest_crawl',
] as const satisfies readonly VoiceClipId[]
export const COACH_NOT_BEST_CLIPS = ['coach_notbest_clear', 'coach_notbest_close', 'coach_notbest_stands', 'coach_notbest_okay', 'coach_notbest_chase', 'coach_notbest_breath', 'coach_notbest_safe', 'coach_notbest_practice', 'coach_notbest_again', 'coach_notbest_steady', 'coach_notbest_learning', 'coach_notbest_nice_win', 'coach_notbest_almost', 'coach_notbest_fresh', 'coach_notbest_calm', 'coach_notbest_close2', 'coach_notbest_rhythm', 'coach_notbest_smile', 'coach_notbest_bank'] as const satisfies readonly VoiceClipId[]
const oldNotBest = bag('old.notBest', OLDTIMER_NOT_BEST_CLIPS)

/** Old-timer draw. The bag set already keeps a line from playing twice in a row across bags. */
function pickOld(draw: () => { clip: VoiceClipId; pool: readonly VoiceClipId[] }) {
  return draw()
}

/** Coach (female) lines for the moments she has always voiced */
const COACH_LOSE_CLIPS = ['out_of_hearts', 'tough_board', 'coach_lose_breathe', 'coach_lose_again', 'coach_lose_next'] as const satisfies readonly VoiceClipId[]
const COACH_HINT_CLIPS = ['nudge', 'coach_hint_look', 'coach_hint_help', 'coach_hint_glow', 'coach_hint_clue', 'coach_hint_peek', 'coach_hint_step', 'coach_hint_try', 'coach_hint_light', 'coach_hint_start', 'coach_hint_safe', 'coach_hint_point', 'coach_hint_easy'] as const satisfies readonly VoiceClipId[]
const COACH_BADGE_CLIPS = ['new_badge', 'coach_badge_earned', 'coach_badge_look', 'coach_badge_nice', 'coach_badge_hard', 'coach_badge_proud', 'coach_badge_collect'] as const satisfies readonly VoiceClipId[]
const COACH_PRIZE_CLIPS = ['prize_time', 'coach_prize_ooh', 'coach_prize_see', 'coach_prize_spin', 'coach_prize_lucky', 'coach_prize_reward', 'coach_prize_surprise', 'coach_prize_nice'] as const satisfies readonly VoiceClipId[]
const COACH_STASH_CLIPS = ['spark_unlocked', 'coach_stash_five', 'coach_stash_complete', 'coach_stash_bonus', 'coach_stash_sparkle'] as const satisfies readonly VoiceClipId[]

/** Quick coach praise (critter catch, Buddy Hunt finds) */
const COACH_CHEER_CLIPS = ['nice', 'solid', 'good_call', 'that_works', 'clean'] as const satisfies readonly VoiceClipId[]

const nextCheer = voiceBags.bag('roman.cheer', ROMAN_CHEER_CLIPS)
const nextWrong = voiceBags.bag('roman.wrong', ROMAN_WRONG_CLIPS)
const nextCoachCheer = bag('coach.cheer', COACH_CHEER_CLIPS)

/**
 * Shared moments (lose, hint, badge, prize, stash): Roman and the coach take turns, one line per
 * event. Each speaker keeps its own saved shuffle bag for the moment.
 */
function takeTurns(name: string, roman: readonly VoiceClipId[], coach: readonly VoiceClipId[]) {
  const nextRoman = voiceBags.bag(`roman.${name}`, roman)
  const nextCoach = voiceBags.bag(`coach.${name}`, coach)
  // 9.30-k: within this moment, the voice that holds the least-heard lines goes next. When both
  // are level, the turn is weighted by how many lines each has. Skipped or stale lines change nothing
  // (only a line heard to 70% adds to its count), so the same turn comes round again.
  return (): { clip: VoiceClipId; pool: readonly VoiceClipId[] } => {
    const low = (pool: readonly VoiceClipId[]) => {
      const min = Math.min(...pool.map((x) => heardLog.count(x)))
      return { min, n: pool.filter((x) => heardLog.count(x) === min).length }
    }
    const r = low(roman)
    const c = low(coach)
    const coachTurn = c.min !== r.min ? c.min < r.min : Math.random() * (r.n + c.n) < c.n
    return coachTurn ? { clip: nextCoach(), pool: coach } : { clip: nextRoman(), pool: roman }
  }
}
/** clip → "this speaker turn is used up" (runs when that clip is heard) */
const pendingTurns = new Map<string, () => void>()


const nextLose = takeTurns('lose', ROMAN_LOSE_CLIPS, COACH_LOSE_CLIPS)
const nextHint = takeTurns('hint', ROMAN_HINT_CLIPS, COACH_HINT_CLIPS)
const nextBadge = takeTurns('badge', ROMAN_BADGE_CLIPS, COACH_BADGE_CLIPS)
const nextPrize = takeTurns('prize', ROMAN_PRIZE_CLIPS, COACH_PRIZE_CLIPS)
const nextStash = takeTurns('stash', ROMAN_STASH_CLIPS, COACH_STASH_CLIPS)
// 9.30-g: Roman and the coach share the non-old-timer not-best turns (bags roman.notBest / coach.notBest)
const nextNotBest = takeTurns('notBest', ROMAN_NOT_BEST_CLIPS, COACH_NOT_BEST_CLIPS)
// 9.30-i: record / Trial clear / Daily done: Roman and the coach take weighted turns (the old-timer has his share)
const nextRecord = takeTurns('record', ROMAN_RECORD_CLIPS, COACH_RECORD_CLIPS)
const nextTrialClear = takeTurns('trialClear', ROMAN_TRIAL_CLEAR_CLIPS, COACH_TRIAL_CLEAR_CLIPS)
const nextDailyDone = takeTurns('dailyDone', ROMAN_DAILY_DONE_CLIPS, COACH_DAILY_DONE_CLIPS)

/**
 * 9.29-a: Roman's Trial ran out of time. The hearts are still there, so no "out of hearts" /
 * "hearts gone" lines here (they used to come from the lose pool).
 */
export const ROMAN_TIMEUP_CLIPS = [
  'roman_lose_fought',
  'roman_lose_round',
  'roman_lose_cape',
  'roman_lose_shake',
  'roman_lose_pillow',
  'roman_highhopes',
  'roman_warmup',
] as const satisfies readonly VoiceClipId[]
export const COACH_TIMEUP_CLIPS = ['tough_board', 'coach_lose_breathe', 'coach_lose_again', 'coach_lose_next'] as const satisfies readonly VoiceClipId[]
export const OLDTIMER_TIMEUP_CLIPS = [
  'old_lose_goldfish',
  'old_lose_sideways',
  'old_lose_popcorn',
  'old_lose_called',
  'old_lose_nephew',
  'old_lose_deal',
] as const satisfies readonly VoiceClipId[]
const nextTimeUp = takeTurns('timeup', ROMAN_TIMEUP_CLIPS, COACH_TIMEUP_CLIPS)
// 9.30-j
const nextIdle = takeTurns('idle', ROMAN_IDLE_CLIPS, COACH_IDLE_CLIPS)
const nextUndo = takeTurns('undo', ROMAN_UNDO_CLIPS, COACH_UNDO_CLIPS)
const nextTrialStart = takeTurns('trialStart', ROMAN_TRIAL_START_CLIPS, COACH_TRIAL_START_CLIPS)
const nextDailyStart = takeTurns('dailyStart', ROMAN_DAILY_START_CLIPS, COACH_DAILY_START_CLIPS)
const oldTrialStart = bag('old.trialStart', OLDTIMER_TRIAL_START_CLIPS)
const oldDailyStart = bag('old.dailyStart', OLDTIMER_DAILY_START_CLIPS)
const nextCoachWin = bag('coach.win', COACH_WIN_CLIPS)
const nextRomanNearMiss = bag('roman.nearMiss', ROMAN_NEAR_MISS_CLIPS)
const oldNearMiss = bag('old.nearMiss', OLDTIMER_NEAR_MISS_CLIPS)
/** Win: Roman's cheers and the coach's two board-cleared lines, turns weighted by line count */
const winSpeaker = () => turnBags.bag('speaker.win', [...ROMAN_CHEER_CLIPS.map((_, i) => `roman#${i}`), ...COACH_WIN_CLIPS.map((_, i) => `coach#${i}`)])()
/** Wrong move: the coach speaks one in six of Roman's turns, with the line for that kind of mistake (or her general one) */
const coachWrongTurn = () => turnBags.bag('speaker.wrong', ['coach#0', 'roman#0', 'roman#1', 'roman#2', 'roman#3', 'roman#4'])().startsWith('coach')
const oldTimeUp = bag('old.timeup', OLDTIMER_TIMEUP_CLIPS)
const nextNiceTry = bag('roman.niceTry', ROMAN_NICE_TRY_CLIPS)

/** A near miss keeps the plain win cheer. (9.30-i: record / Trial clear / Daily done have their own lines now.) */
const cheer = () => roman(nextCheer(), ROMAN_CHEER_CLIPS)

/** Fallback clips (only used if the chosen file is missing), shuffled so no line is the usual stand-in */
function shuffledAlts(pool: readonly VoiceClipId[], clip: VoiceClipId): VoiceClipId[] {
  const out = pool.filter((id) => id !== clip)
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out.slice(0, 4)
}

function voiced(
  pick: { clip: VoiceClipId; pool: readonly VoiceClipId[] },
  mood: CommentMood,
  voiceMood: VoiceMood,
  priority: number,
  extra: Partial<Banter> = {},
): Banter {
  return {
    text: voiceLineText(pick.clip) ?? 'Roman says: okay, next!',
    mood,
    voiceMood,
    speak: true,
    clip: pick.clip,
    alts: shuffledAlts(pick.pool, pick.clip),
    priority,
    ...extra,
  }
}

const roman = (clip: VoiceClipId, pool: readonly VoiceClipId[]) => ({ clip, pool })

export function banterFor(
  event:
    | 'place-good'
    | 'place-bad'
    | 'mark'
    | 'hint'
    | 'win'
    | 'lose'
    | 'prize'
    | 'achievement'
    | 'critter'
    | 'critter-stash'
    | 'idle'
    | 'rescue'
    | 'undo-spam'
    | 'win-heckle'
    | 'aside'
    | 'hunt-miss'
    | 'hunt-some'
    | 'hunt-all'
    | 'hunt-none'
    | 'record'
    | 'near-miss'
    | 'trial-clear'
    | 'daily-done'
    | 'not-best'
    | 'time-up'
    | 'trial-start'
    | 'daily-start',
  _conflict?: ConflictKind,
): Banter {
  const silent: Banter = { text: '', mood: 'neutral', voiceMood: 'neutral', speak: false, silent: true }
  if (event === 'idle') {
    if (oldtimerTurn(OLDTIMER_SHARE, OLDTIMER_IDLE_CLIPS, [ROMAN_IDLE_CLIPS, COACH_IDLE_CLIPS])) return voiced(pickOld(oldIdle), 'bad', 'neutral', VOICE_PRIORITY.idle)
    return voiced(nextIdle(), 'bad', 'disappointed', VOICE_PRIORITY.idle)
  }
  if (event === 'mark') return { text: '', mood: 'neutral', voiceMood: 'neutral', speak: false, silent: true }
  if (event === 'place-good') {
    // Buddy giggle still plays from the board. Praise is a voice line, so leave giggle unset.
    if (oldtimerTurn()) return voiced(pickOld(oldGood), 'good', 'neutral', VOICE_PRIORITY.chatter)
    return { text: '', mood: 'good', voiceMood: 'happy', speak: false, giggle: true, silent: true }
  }
  if (event === 'place-bad') {
    if (oldtimerTurn(OLDTIMER_SHARE, OLDTIMER_WRONG_CLIPS, [ROMAN_WRONG_CLIPS, COACH_WRONG_CLIPS])) return voiced(pickOld(oldWrong), 'bad', 'neutral', VOICE_PRIORITY.wrong)
    if (coachWrongTurn()) {
      // the line names the kind of mistake (or is her general one); never the same clip twice running
      // 9.30-o: each kind of mistake has its own lines (plus the original one); the least-heard line goes first
      const kindKey = _conflict === 'col' ? 'row' : (_conflict ?? 'generic')
      const own = COACH_WRONG_BY_KIND[kindKey === 'generic' ? 'generic' : kindKey]
      const clip = coachWrongBag(kindKey, own)()
      if (clip !== lastCoachWrong) {
        lastCoachWrong = clip
        return voiced({ clip, pool: COACH_WRONG_CLIPS }, 'bad', 'soft', VOICE_PRIORITY.wrong)
      }
    }
    return voiced(roman(nextWrong(), ROMAN_WRONG_CLIPS), 'bad', 'disappointed', VOICE_PRIORITY.wrong)
  }
  if (event === 'win') {
    if (winSpeaker().startsWith('coach')) return voiced(nextCoachWin(), 'hype', 'happy', VOICE_PRIORITY.win)
    return voiced(roman(nextCheer(), ROMAN_CHEER_CLIPS), 'hype', 'excited', VOICE_PRIORITY.win)
  }
  if (event === 'hint') {
    if (oldtimerTurn(OLDTIMER_SHARE, OLDTIMER_HINT_CLIPS, [ROMAN_HINT_CLIPS, COACH_HINT_CLIPS])) return voiced(pickOld(oldHint), 'neutral', 'neutral', VOICE_PRIORITY.hint)
    return voiced(nextHint(), 'neutral', 'happy', VOICE_PRIORITY.hint)
  }
  if (event === 'rescue') {
    if (oldtimerTurn(0.5, OLDTIMER_RESCUE_CLIPS, [ROMAN_HINT_CLIPS, COACH_HINT_CLIPS])) return voiced(pickOld(oldRescue), 'neutral', 'neutral', VOICE_PRIORITY.hint)
    return voiced(nextHint(), 'neutral', 'happy', VOICE_PRIORITY.hint)
  }
  // Undo/redo spam: only the old-timer comments, and only now and then
  if (event === 'undo-spam') {
    if (oldtimerTurn(0.6, OLDTIMER_UNDO_CLIPS, [ROMAN_UNDO_CLIPS, COACH_UNDO_CLIPS])) return voiced(pickOld(oldUndo), 'bad', 'neutral', VOICE_PRIORITY.chatter)
    // 9.30-j: Roman / the coach sometimes take it (their undo-tip lines); otherwise stay quiet
    return Math.random() < 0.4 ? voiced(nextUndo(), 'bad', 'soft', VOICE_PRIORITY.chatter) : silent
  }
  if (event === 'trial-start') {
    if (oldtimerTurn(0.34, OLDTIMER_TRIAL_START_CLIPS, [ROMAN_TRIAL_START_CLIPS, COACH_TRIAL_START_CLIPS])) return voiced(pickOld(oldTrialStart), 'neutral', 'neutral', VOICE_PRIORITY.chatter)
    return voiced(nextTrialStart(), 'neutral', 'happy', VOICE_PRIORITY.chatter)
  }
  if (event === 'daily-start') {
    if (oldtimerTurn(0.34, OLDTIMER_DAILY_START_CLIPS, [ROMAN_DAILY_START_CLIPS, COACH_DAILY_START_CLIPS])) return voiced(pickOld(oldDailyStart), 'neutral', 'neutral', VOICE_PRIORITY.chatter)
    return voiced(nextDailyStart(), 'neutral', 'happy', VOICE_PRIORITY.chatter)
  }
  // After a slow/sloppy win: sometimes a backhanded compliment, once Roman's cheer has finished
  if (event === 'win-heckle') {
    return oldtimerTurn(0.45) ? voiced(pickOld(oldWin), 'bad', 'neutral', VOICE_PRIORITY.chatter, { waitMs: 7000 }) : silent
  }
  // Free-channel remark. The caller already waited; share is 1 so only the cooldown applies.
  if (event === 'aside') {
    return oldtimerTurn(1) ? voiced(pickOld(oldAside), 'neutral', 'neutral', VOICE_PRIORITY.idle) : silent
  }
  if (event === 'lose') {
    if (oldtimerTurn(OLDTIMER_SHARE, OLDTIMER_LOSE_CLIPS, [ROMAN_LOSE_CLIPS, COACH_LOSE_CLIPS])) return voiced(pickOld(oldLose), 'bad', 'neutral', VOICE_PRIORITY.lose)
    return voiced(nextLose(), 'bad', 'disappointed', VOICE_PRIORITY.lose)
  }
  // Buddy Hunt bonus round: existing clips only, same one-voice-at-a-time channel
  if (event === 'hunt-miss') return oldtimerTurn(0.5) ? voiced(pickOld(oldHuntMiss), 'bad', 'neutral', VOICE_PRIORITY.chatter) : silent
  if (event === 'hunt-some') {
    if (oldtimerTurn(0.5)) return voiced(pickOld(oldGood), 'good', 'neutral', VOICE_PRIORITY.prize)
    return voiced(nextCoachCheer(), 'hype', 'happy', VOICE_PRIORITY.prize)
  }
  if (event === 'hunt-all') return voiced(roman(nextCheer(), ROMAN_CHEER_CLIPS), 'hype', 'excited', VOICE_PRIORITY.win)
  // Missed the bonus round, but the board was WON: a "nice try", never an "out of hearts" line
  if (event === 'hunt-none') {
    if (oldtimerTurn(0.5)) return voiced(pickOld(oldHuntMiss), 'bad', 'neutral', VOICE_PRIORITY.prize)
    return voiced(nextNiceTry(), 'neutral', 'happy', VOICE_PRIORITY.prize)
  }
  // Roman's Trial clock ran out (hearts left): lose lines that don't talk about hearts
  if (event === 'time-up') {
    if (oldtimerTurn(OLDTIMER_SHARE, OLDTIMER_TIMEUP_CLIPS, [ROMAN_TIMEUP_CLIPS, COACH_TIMEUP_CLIPS])) return voiced(pickOld(oldTimeUp), 'bad', 'neutral', VOICE_PRIORITY.lose)
    return voiced(nextTimeUp(), 'bad', 'disappointed', VOICE_PRIORITY.lose)
  }
  if (event === 'prize') return voiced(nextPrize(), 'hype', 'excited', VOICE_PRIORITY.prize)
  // Replay challenge: these replace the win cheer (never on top of it)
  if (event === 'record') {
    // 9.30-i: 22 lines of its own now, so no more turns with the plain win cheer
    if (oldtimerTurn(0.35, OLDTIMER_RECORD_CLIPS, [ROMAN_RECORD_CLIPS, COACH_RECORD_CLIPS])) return voiced(pickOld(oldRecord), 'hype', 'neutral', VOICE_PRIORITY.win)
    return voiced(nextRecord(), 'hype', 'excited', VOICE_PRIORITY.win)
  }
  // A near miss on a first/untimed win keeps the cheer; a replayed board that misses the best uses
  // the single 'not-best' line instead (App picks the event).
  if (event === 'near-miss') {
    // 9.30-j: the two near-miss lines take turns with the cheer
    const turn = turnBags.bag('turn.nearMiss', ['old#0', 'roman#0', 'cheer#0', 'cheer#1'])()
    if (turn.startsWith('old')) return voiced(pickOld(oldNearMiss), 'hype', 'neutral', VOICE_PRIORITY.win)
    if (turn.startsWith('roman')) return voiced(nextRomanNearMiss(), 'hype', 'happy', VOICE_PRIORITY.win)
    return voiced(cheer(), 'hype', 'excited', VOICE_PRIORITY.win)
  }
  // 9.30-a: the ONLY line for a win that doesn't beat your best (no cheer before it): it's the win line
  if (event === 'not-best') {
    if (oldtimerTurn(0.6, OLDTIMER_NOT_BEST_CLIPS, [ROMAN_NOT_BEST_CLIPS, COACH_NOT_BEST_CLIPS])) return voiced(pickOld(oldNotBest), 'hype', 'neutral', VOICE_PRIORITY.win)
    return voiced(nextNotBest(), 'hype', 'happy', VOICE_PRIORITY.win)
  }
  if (event === 'trial-clear') {
    if (oldtimerTurn(0.25, OLDTIMER_TRIAL_CLEAR_CLIPS, [ROMAN_TRIAL_CLEAR_CLIPS, COACH_TRIAL_CLEAR_CLIPS])) return voiced(pickOld(oldTrialClear), 'hype', 'neutral', VOICE_PRIORITY.win)
    return voiced(nextTrialClear(), 'hype', 'excited', VOICE_PRIORITY.win)
  }
  if (event === 'daily-done') {
    if (oldtimerTurn(0.25, OLDTIMER_DAILY_DONE_CLIPS, [ROMAN_DAILY_DONE_CLIPS, COACH_DAILY_DONE_CLIPS])) return voiced(pickOld(oldDailyDone), 'hype', 'neutral', VOICE_PRIORITY.win)
    return voiced(nextDailyDone(), 'hype', 'excited', VOICE_PRIORITY.win)
  }
  // Badges pop a few seconds after a win: wait for Roman's win line to finish instead of cutting it
  if (event === 'achievement') return voiced(nextBadge(), 'hype', 'excited', VOICE_PRIORITY.chatter, { waitMs: 6000 })
  if (event === 'critter-stash') return voiced(nextStash(), 'hype', 'excited', VOICE_PRIORITY.wrong)
  if (event === 'critter') return voiced(nextCoachCheer(), 'hype', 'happy', VOICE_PRIORITY.chatter)
  return { text: '', mood: 'neutral', voiceMood: 'neutral', speak: false, silent: true }
}

/** Spark progress after a critter catch — coach counts them (one line per catch) */
const SPARK_CLIPS = {
  1: ['spark_1', 'spark_have_1'],
  2: ['spark_2', 'spark_have_2'],
  3: ['spark_3', 'spark_have_3'],
  4: ['spark_4', 'spark_have_4'],
} as const satisfies Record<number, readonly VoiceClipId[]>
const sparkBags = { 1: bag('coach.spark1', SPARK_CLIPS[1]), 2: bag('coach.spark2', SPARK_CLIPS[2]), 3: bag('coach.spark3', SPARK_CLIPS[3]), 4: bag('coach.spark4', SPARK_CLIPS[4]) }
const sparkClip = (n: 1 | 2 | 3 | 4): VoiceClipId => sparkBags[n]().clip

export function sparkProgressBanter(have: number, goal = 5): Banter {
  const left = Math.max(0, goal - have)
  return {
    text: have === 1 ? 'One sparkle so far. Four more for the bonus!' : `${have} sparkles. ${left} more for the bonus!`,
    mood: 'hype',
    voiceMood: 'happy',
    speak: true,
    // 9.30-j: each count has two recorded takes (spark_N / spark_have_N): a small bag alternates them
    clip: sparkClip(Math.min(4, Math.max(1, have)) as 1 | 2 | 3 | 4),
    priority: VOICE_PRIORITY.chatter,
    waitMs: 2500,
  }
}

/**
 * Voice tip line (9.28-b). Voices take turns (a saved shuffle bag of the voices that have a
 * recorded line for this tip), then each voice draws from its own saved shuffle bag, so no line
 * repeats until the rest of its category has played. Returns a silent banter when nothing
 * recorded fits yet (new lines stay silent until they are approved and recorded).
 */
export function tipBanter(tip: TipId, reason?: TipReason): Banter {
  const silent: Banter = { text: '', mood: 'neutral', voiceMood: 'neutral', speak: false, silent: true }
  const lines = playableTipLines(tip, reason, isPlayableVoiceClip, voiceLineText)
  if (lines.length === 0) return silent
  const voices = [...new Set(lines.map((l) => l.voice))] as TipVoice[]
  // 9.29-a: the old-timer takes two turns in every voice cycle (Tony wants more of him heard).
  // Still a shuffle bag, so the voices keep rotating and no voice runs away with it.
  const turns = voices.includes('old') && voices.length > 1 ? [...voices, 'old2'] : voices
  const turn = turns.length === 1 ? turns[0] : turnBags.bag(`tipvoice.${tip}`, turns)()
  const voice = (turn === 'old2' ? 'old' : turn) as TipVoice
  const pool = lines.filter((l) => l.voice === voice).map((l) => l.id) as VoiceClipId[]
  const clip = voiceBags.bag(`tip.${tip}.${reason ?? 'any'}.${voice}`, pool)()
  const alts = shuffledAlts(pool, clip)
  const text = lines.find((l) => l.id === clip)?.text || voiceLineText(clip) || ''
  return {
    text,
    mood: 'neutral',
    voiceMood: voice === 'old' ? 'neutral' : 'happy',
    speak: true,
    clip,
    alts,
    priority: tip === 'three-star' ? VOICE_PRIORITY.chatter : VOICE_PRIORITY.idle,
    waitMs: tip === 'three-star' ? 7000 : tip === 'first-trial' || tip === 'first-daily' ? 3000 : undefined,
  }
}

/* ------------------------------------------------------------------------------------------ *
 * 9.29-a voice audit: which pools each event may draw from, and when each event may speak.
 * Tests (scripts/voice-pools.test.ts) play banterFor() and check every line against this map.
 * ------------------------------------------------------------------------------------------ */

export type BanterEvent = Parameters<typeof banterFor>[0]

/** Every saved shuffle bag (name → lines). */
export const VOICE_POOLS: Record<string, readonly VoiceClipId[]> = {
  'roman.cheer': ROMAN_CHEER_CLIPS,
  'roman.record': ROMAN_RECORD_CLIPS,
  'roman.notBest': ROMAN_NOT_BEST_CLIPS,
  'coach.notBest': COACH_NOT_BEST_CLIPS,
  'roman.trialClear': ROMAN_TRIAL_CLEAR_CLIPS,
  'coach.trialClear': COACH_TRIAL_CLEAR_CLIPS,
  'old.trialClear': OLDTIMER_TRIAL_CLEAR_CLIPS,
  'roman.dailyDone': ROMAN_DAILY_DONE_CLIPS,
  'coach.dailyDone': COACH_DAILY_DONE_CLIPS,
  'old.dailyDone': OLDTIMER_DAILY_DONE_CLIPS,
  'coach.record': COACH_RECORD_CLIPS,
  'roman.wrong': ROMAN_WRONG_CLIPS,
  'roman.idle': ROMAN_IDLE_CLIPS,
  'coach.idle': COACH_IDLE_CLIPS,
  'roman.undo': ROMAN_UNDO_CLIPS,
  'coach.undo': COACH_UNDO_CLIPS,
  'roman.trialStart': ROMAN_TRIAL_START_CLIPS,
  'coach.trialStart': COACH_TRIAL_START_CLIPS,
  'old.trialStart': OLDTIMER_TRIAL_START_CLIPS,
  'roman.dailyStart': ROMAN_DAILY_START_CLIPS,
  'coach.dailyStart': COACH_DAILY_START_CLIPS,
  'old.dailyStart': OLDTIMER_DAILY_START_CLIPS,
  'coach.wrong': COACH_WRONG_CLIPS,
  'coach.win': COACH_WIN_CLIPS,
  'roman.nearMiss': ROMAN_NEAR_MISS_CLIPS,
  'old.nearMiss': OLDTIMER_NEAR_MISS_CLIPS,
  'roman.lose': ROMAN_LOSE_CLIPS,
  'roman.timeup': ROMAN_TIMEUP_CLIPS,
  'roman.niceTry': ROMAN_NICE_TRY_CLIPS,
  'roman.hint': ROMAN_HINT_CLIPS,
  'roman.badge': ROMAN_BADGE_CLIPS,
  'roman.prize': ROMAN_PRIZE_CLIPS,
  'roman.stash': ROMAN_STASH_CLIPS,
  'coach.cheer': COACH_CHEER_CLIPS,
  'coach.lose': COACH_LOSE_CLIPS,
  'coach.timeup': COACH_TIMEUP_CLIPS,
  'coach.hint': COACH_HINT_CLIPS,
  'coach.badge': COACH_BADGE_CLIPS,
  'coach.prize': COACH_PRIZE_CLIPS,
  'coach.stash': COACH_STASH_CLIPS,
  'old.wrong': OLDTIMER_WRONG_CLIPS,
  'old.idle': OLDTIMER_IDLE_CLIPS,
  'old.hint': OLDTIMER_HINT_CLIPS,
  'old.undo': OLDTIMER_UNDO_CLIPS,
  'old.lose': OLDTIMER_LOSE_CLIPS,
  'old.timeup': OLDTIMER_TIMEUP_CLIPS,
  'old.win': OLDTIMER_WIN_CLIPS,
  'old.rescue': OLDTIMER_RESCUE_CLIPS,
  'old.aside': OLDTIMER_ASIDE_CLIPS,
  'old.good': OLDTIMER_GOOD_CLIPS,
  'old.huntMiss': OLDTIMER_HUNT_MISS_CLIPS,
  'old.record': OLDTIMER_RECORD_CLIPS,
  'old.notBest': OLDTIMER_NOT_BEST_CLIPS,
}

/** The pools each event is allowed to draw from. */
export const EVENT_POOLS: Record<BanterEvent, readonly string[]> = {
  'place-good': ['old.good'],
  'place-bad': ['old.wrong', 'roman.wrong', 'coach.wrong'],
  mark: [],
  hint: ['old.hint', 'roman.hint', 'coach.hint'],
  rescue: ['old.rescue', 'roman.hint', 'coach.hint'],
  idle: ['old.idle', 'roman.idle', 'coach.idle'],
  'undo-spam': ['old.undo', 'roman.undo', 'coach.undo'],
  'trial-start': ['roman.trialStart', 'coach.trialStart', 'old.trialStart'],
  'daily-start': ['roman.dailyStart', 'coach.dailyStart', 'old.dailyStart'],
  aside: ['old.aside'],
  win: ['roman.cheer', 'coach.win'],
  record: ['roman.record', 'coach.record', 'old.record'],
  'near-miss': ['roman.cheer', 'roman.nearMiss', 'old.nearMiss'],
  'not-best': ['roman.notBest', 'coach.notBest', 'old.notBest'],
  'trial-clear': ['roman.trialClear', 'coach.trialClear', 'old.trialClear'],
  'daily-done': ['roman.dailyDone', 'coach.dailyDone', 'old.dailyDone'],
  'win-heckle': ['old.win'],
  'hunt-miss': ['old.huntMiss'],
  'hunt-some': ['old.good', 'coach.cheer'],
  'hunt-all': ['roman.cheer'],
  'hunt-none': ['old.huntMiss', 'roman.niceTry'],
  lose: ['old.lose', 'roman.lose', 'coach.lose'],
  'time-up': ['old.timeup', 'roman.timeup', 'coach.timeup'],
  prize: ['roman.prize', 'coach.prize'],
  achievement: ['roman.badge', 'coach.badge'],
  'critter-stash': ['roman.stash', 'coach.stash'],
  critter: ['coach.cheer'],
}

/** Lines only for a lost board (hearts gone / Trial clock out). */
export const LOSE_POOLS = ['old.lose', 'roman.lose', 'coach.lose', 'old.timeup', 'roman.timeup', 'coach.timeup'] as const
/** Mid-board put-downs for a wrong move, idling or undo spam. */
export const PLAY_PUTDOWN_POOLS = ['old.wrong', 'roman.wrong', 'coach.wrong', 'old.idle', 'roman.idle', 'coach.idle', 'old.undo', 'roman.undo', 'coach.undo'] as const
/** Lines that celebrate a finished board. */
export const WIN_POOLS = ['roman.cheer', 'coach.win', 'roman.nearMiss', 'old.nearMiss', 'roman.record', 'coach.record', 'old.record', 'roman.notBest', 'coach.notBest', 'old.notBest', 'roman.trialClear', 'coach.trialClear', 'old.trialClear', 'roman.dailyDone', 'coach.dailyDone', 'old.dailyDone', 'old.win'] as const

/** Events that belong to a live board / a won board / a lost board; the rest can play anywhere. */
export const PLAY_EVENTS: readonly BanterEvent[] = ['place-good', 'place-bad', 'mark', 'hint', 'rescue', 'idle', 'undo-spam', 'aside']
/** 9.30-k: every clip a player can actually hear (a fired moment's pool, a tip line, a spark count) */
export function reachableClips(): string[] {
  const ids = new Set<string>()
  for (const p of new Set(Object.values(EVENT_POOLS).flat())) for (const id of VOICE_POOLS[p] ?? []) ids.add(id)
  for (const lines of Object.values(RECORDED_TIP_LINES)) for (const l of lines) ids.add(l.id)
  for (const lines of Object.values(NEW_TIP_LINES)) for (const l of lines) ids.add(l.id)
  if (SNARK_TIPS.length) for (const id of OLD_SNARK_TIP_LINES) ids.add(id)
  for (let n = 1; n <= 4; n++) (ids.add(`spark_${n}`), ids.add(`spark_have_${n}`))
  return [...ids].filter(isPlayableVoiceClip)
}

/** 9.30-k: "Voice lines heard: X of Y", with a per-voice breakdown for Settings */
export function heardSummary(): { heard: number; total: number; plays: number; voices: { name: string; heard: number; total: number }[] } {
  const all = reachableClips()
  const groups: Record<string, string[]> = { Roman: [], 'Old-timer': [], Coach: [] }
  for (const id of all) {
    const r = roleForClip(id)
    groups[r === 'roman' ? 'Roman' : r === 'oldtimer' ? 'Old-timer' : 'Coach'].push(id)
  }
  return {
    heard: heardLog.heardOf(all),
    total: all.length,
    plays: heardLog.totalPlays(),
    voices: Object.entries(groups).map(([name, ids]) => ({ name, heard: heardLog.heardOf(ids), total: ids.length })),
  }
}

/** 9.30-k: share (0..1) of a moment's lines that have never been heard (drives how easily a busy moment speaks) */
export function unheardShare(event: BanterEvent): number {
  const pools = EVENT_POOLS[event]
  if (!pools) return 0
  const ids = [...new Set(pools.flatMap((p) => [...(VOICE_POOLS[p] ?? [])]))]
  if (!ids.length) return 0
  return ids.filter((id) => heardLog.count(id) === 0).length / ids.length
}

export const WIN_EVENTS: readonly BanterEvent[] = ['win', 'record', 'near-miss', 'not-best', 'trial-clear', 'daily-done', 'win-heckle', 'hunt-miss', 'hunt-some', 'hunt-all', 'hunt-none']
export const LOSE_EVENTS: readonly BanterEvent[] = ['lose', 'time-up']

export type BoardOutcome = 'won' | 'lost' | null

/**
 * May this event speak now? Once a board is won, only win lines (and badge / prize / spark lines)
 * play: a wrong-move, idle, undo or old-timer put-down queued just before the win is dropped, and
 * a lose line can never follow a win (and the other way round).
 */
export function eventAllowed(event: BanterEvent, outcome: BoardOutcome): boolean {
  if (PLAY_EVENTS.includes(event)) return outcome === null
  if (WIN_EVENTS.includes(event)) return outcome === 'won'
  if (LOSE_EVENTS.includes(event)) return outcome === 'lost'
  return true
}
