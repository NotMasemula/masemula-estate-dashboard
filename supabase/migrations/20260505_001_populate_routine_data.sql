-- Populate routine data for Ntobeko Masemula Estate
-- This migration seeds the estate_data table with complete routine information

-- First, ensure the row exists for this user
INSERT INTO estate_data (user_i, data, updated_at)
VALUES (
  'ntobeko-masemula-estate',
  '{
    "routine": {
      "metadata": {
        "version": "1.0",
        "last_updated": "2026-05-05",
        "user": "Ntobeko Masemula Estate",
        "description": "Complete weekly schedule with academic, business, health, and personal development blocks"
      },
      "weekly_schedule": {
        "Monday": [
          {"time": "04:00-05:30", "activity": "Gym", "type": "health", "color": "#3B6D11"},
          {"time": "05:30-07:00", "activity": "Shower, breakfast, briefing review", "type": "health", "color": "#3B6D11"},
          {"time": "07:00-08:00", "activity": "Community Care", "type": "business", "color": "#8B6F47"},
          {"time": "08:00-12:30", "activity": "Deep work — PC/projects (not email)", "type": "business", "color": "#8B6F47"},
          {"time": "12:30-13:30", "activity": "Lunch", "type": "admin", "color": "#9999AA"},
          {"time": "13:30-15:00", "activity": "CleanDesk Co — pre-launch", "type": "business", "color": "#8B6F47"},
          {"time": "15:00-16:30", "activity": "STTN111 — Social Stats", "type": "school", "color": "#C9A84C"},
          {"time": "16:30-18:00", "activity": "Gym/Run — lighter workout", "type": "health", "color": "#3B6D11"},
          {"time": "18:00-19:00", "activity": "Dinner + wind down", "type": "health", "color": "#3B6D11"},
          {"time": "19:00-20:30", "activity": "Evening reading (30min) + light task (30min)", "type": "growth", "color": "#5C3317"},
          {"time": "20:30-22:00", "activity": "Personal project/skill building", "type": "creative", "color": "#E74C3C"},
          {"time": "22:00-23:30", "activity": "Pre-sleep routine — walk/stretch/journal", "type": "health", "color": "#3B6D11"},
          {"time": "23:30-04:00", "activity": "Sleep (4.5h)", "type": "recovery", "color": "#5C3317"}
        ],
        "Tuesday": [
          {"time": "04:00-05:30", "activity": "Gym", "type": "health", "color": "#3B6D11"},
          {"time": "05:30-07:00", "activity": "Shower, breakfast, briefing review", "type": "health", "color": "#3B6D11"},
          {"time": "07:00-08:00", "activity": "Admin / email catch-up", "type": "admin", "color": "#9999AA"},
          {"time": "08:00-12:30", "activity": "Deep work — PC/projects", "type": "business", "color": "#8B6F47"},
          {"time": "12:30-13:30", "activity": "Lunch", "type": "admin", "color": "#9999AA"},
          {"time": "13:30-15:00", "activity": "MTHS114 — Mathematics", "type": "school", "color": "#C9A84C"},
          {"time": "15:00-16:00", "activity": "GEOG111 — Geography", "type": "school", "color": "#C9A84C"},
          {"time": "16:00-17:00", "activity": "STTN111 — Social Stats", "type": "school", "color": "#C9A84C"},
          {"time": "17:00-18:30", "activity": "Library/Study group — MTHS", "type": "school", "color": "#C9A84C"},
          {"time": "18:30-19:30", "activity": "Dinner", "type": "health", "color": "#3B6D11"},
          {"time": "19:30-20:30", "activity": "Evening reading (optional)", "type": "growth", "color": "#5C3317"},
          {"time": "20:30-22:00", "activity": "Wind down + personal time", "type": "health", "color": "#3B6D11"},
          {"time": "22:00-23:30", "activity": "Pre-sleep routine", "type": "health", "color": "#3B6D11"},
          {"time": "23:30-04:00", "activity": "Sleep (4.5h)", "type": "recovery", "color": "#5C3317"}
        ],
        "Wednesday": [
          {"time": "04:00-05:30", "activity": "Gym", "type": "health", "color": "#3B6D11"},
          {"time": "05:30-07:00", "activity": "Shower, breakfast, briefing review", "type": "health", "color": "#3B6D11"},
          {"time": "07:00-08:00", "activity": "Community Care", "type": "business", "color": "#8B6F47"},
          {"time": "08:00-12:30", "activity": "Deep work — PC/projects", "type": "business", "color": "#8B6F47"},
          {"time": "12:30-13:30", "activity": "Lunch", "type": "admin", "color": "#9999AA"},
          {"time": "13:30-15:00", "activity": "ALDE112 — Language Development", "type": "school", "color": "#C9A84C"},
          {"time": "15:00-16:00", "activity": "ECON112 — Economics", "type": "school", "color": "#C9A84C"},
          {"time": "16:00-17:00", "activity": "SBSS111 — Library Study", "type": "school", "color": "#C9A84C"},
          {"time": "17:00-18:00", "activity": "Tutorial — ALDE112", "type": "school", "color": "#C9A84C"},
          {"time": "18:00-19:00", "activity": "Gym/Run", "type": "health", "color": "#3B6D11"},
          {"time": "19:00-20:00", "activity": "Dinner + wind down", "type": "health", "color": "#3B6D11"},
          {"time": "20:00-22:00", "activity": "Evening reading + personal time", "type": "growth", "color": "#5C3317"},
          {"time": "22:00-23:30", "activity": "Pre-sleep routine", "type": "health", "color": "#3B6D11"},
          {"time": "23:30-04:00", "activity": "Sleep (4.5h)", "type": "recovery", "color": "#5C3317"}
        ],
        "Thursday": [
          {"time": "04:00-05:30", "activity": "Gym", "type": "health", "color": "#3B6D11"},
          {"time": "05:30-07:00", "activity": "Shower, breakfast, briefing review", "type": "health", "color": "#3B6D11"},
          {"time": "07:00-08:00", "activity": "Admin", "type": "admin", "color": "#9999AA"},
          {"time": "08:00-12:30", "activity": "Deep work — PC/projects", "type": "business", "color": "#8B6F47"},
          {"time": "12:30-13:30", "activity": "Lunch", "type": "admin", "color": "#9999AA"},
          {"time": "13:30-15:00", "activity": "GEOG111 — Geography", "type": "school", "color": "#C9A84C"},
          {"time": "15:00-16:30", "activity": "SBSS111 — Seminar", "type": "school", "color": "#C9A84C"},
          {"time": "16:30-17:30", "activity": "Gym/Run", "type": "health", "color": "#3B6D11"},
          {"time": "17:30-18:30", "activity": "Dinner", "type": "health", "color": "#3B6D11"},
          {"time": "18:30-20:00", "activity": "Personal project", "type": "creative", "color": "#E74C3C"},
          {"time": "20:00-22:00", "activity": "Evening reading / wind down", "type": "growth", "color": "#5C3317"},
          {"time": "22:00-23:30", "activity": "Pre-sleep routine", "type": "health", "color": "#3B6D11"},
          {"time": "23:30-04:00", "activity": "Sleep (4.5h)", "type": "recovery", "color": "#5C3317"}
        ],
        "Friday": [
          {"time": "04:00-05:30", "activity": "Gym", "type": "health", "color": "#3B6D11"},
          {"time": "05:30-07:00", "activity": "Shower, breakfast, briefing review", "type": "health", "color": "#3B6D11"},
          {"time": "07:00-08:00", "activity": "Community Care + PA", "type": "business", "color": "#8B6F47"},
          {"time": "08:00-12:30", "activity": "DEEP WORK — FOCUS DAY", "type": "business", "color": "#8B6F47"},
          {"time": "12:30-13:30", "activity": "Lunch", "type": "admin", "color": "#9999AA"},
          {"time": "13:30-17:00", "activity": "Venture planning + P&L review", "type": "business", "color": "#8B6F47"},
          {"time": "17:00-18:30", "activity": "Gym/Recreation", "type": "health", "color": "#3B6D11"},
          {"time": "18:30-19:30", "activity": "Dinner", "type": "health", "color": "#3B6D11"},
          {"time": "19:30-21:00", "activity": "Creative project / music", "type": "creative", "color": "#E74C3C"},
          {"time": "21:00-23:00", "activity": "Social / personal time", "type": "growth", "color": "#5C3317"},
          {"time": "23:00-23:30", "activity": "Pre-sleep routine", "type": "health", "color": "#3B6D11"},
          {"time": "23:30-04:00", "activity": "Sleep (4.5h)", "type": "recovery", "color": "#5C3317"}
        ],
        "Saturday": [
          {"time": "06:00-07:30", "activity": "Gym/Morning walk", "type": "health", "color": "#3B6D11"},
          {"time": "07:30-09:00", "activity": "Breakfast + planning", "type": "admin", "color": "#9999AA"},
          {"time": "09:00-13:00", "activity": "Flexible — projects/ventures/learning", "type": "creative", "color": "#E74C3C"},
          {"time": "13:00-14:00", "activity": "Lunch", "type": "health", "color": "#3B6D11"},
          {"time": "14:00-18:00", "activity": "Flexible — social/personal/creative", "type": "growth", "color": "#5C3317"},
          {"time": "18:00-19:00", "activity": "Dinner", "type": "health", "color": "#3B6D11"},
          {"time": "19:00-22:00", "activity": "Social / entertainment", "type": "creative", "color": "#E74C3C"},
          {"time": "22:00-23:30", "activity": "Pre-sleep routine", "type": "health", "color": "#3B6D11"},
          {"time": "23:30-04:00", "activity": "Sleep (4.5h)", "type": "recovery", "color": "#5C3317"}
        ],
        "Sunday": [
          {"time": "06:00-07:30", "activity": "Light workout / stretch", "type": "health", "color": "#3B6D11"},
          {"time": "07:30-09:00", "activity": "Breakfast + journal", "type": "admin", "color": "#9999AA"},
          {"time": "09:00-12:00", "activity": "Spiritual/reflective time + planning", "type": "growth", "color": "#5C3317"},
          {"time": "12:00-13:00", "activity": "Lunch", "type": "health", "color": "#3B6D11"},
          {"time": "13:00-16:00", "activity": "Week planning + review", "type": "business", "color": "#8B6F47"},
          {"time": "16:00-18:00", "activity": "Personal project / learning", "type": "creative", "color": "#E74C3C"},
          {"time": "18:00-19:00", "activity": "Dinner", "type": "health", "color": "#3B6D11"},
          {"time": "19:00-22:00", "activity": "Relaxation / entertainment", "type": "growth", "color": "#5C3317"},
          {"time": "22:00-23:30", "activity": "Pre-sleep routine", "type": "health", "color": "#3B6D11"},
          {"time": "23:30-04:00", "activity": "Sleep (4.5h)", "type": "recovery", "color": "#5C3317"}
        ]
      },
      "weekly_targets": {
        "gym": {"target": 7, "unit": "sessions/week", "description": "Daily gym or exercise"},
        "deep_work": {"target": 20, "unit": "hours/week", "description": "Focused project work"},
        "reading": {"target": 60, "unit": "minutes/day", "description": "Personal development"},
        "classes": {"target": 12, "unit": "sessions/week", "description": "Academic sessions"},
        "ventures": {"target": 15, "unit": "hours/week", "description": "Business/venture time"}
      },
      "non_negotiables": [
        "Gym/exercise 7 days/week",
        "Deep work 20h/week minimum",
        "Reading 60min/day",
        "Sleep 4.5-5h nightly",
        "Friday P&L review (CleanDesk)",
        "Weekly planning (Sunday)",
        "Community care commitment"
      ],
      "academic_modules": {
        "MTHS114": {"name": "Mathematics", "color": "#C9A84C", "credits": 12},
        "GEOG111": {"name": "Geography", "color": "#C9A84C", "credits": 12},
        "STTN111": {"name": "Social Statistics", "color": "#C9A84C", "credits": 12},
        "ALDE112": {"name": "Language Development", "color": "#C9A84C", "credits": 12},
        "ECON112": {"name": "Economics", "color": "#C9A84C", "credits": 12},
        "SBSS111": {"name": "Social Science Seminar", "color": "#C9A84C", "credits": 12}
      },
      "ventures": {
        "cleandesk_co": {
          "name": "CleanDesk Co.",
          "status": "pre-launch",
          "weekly_hours": 15,
          "next_milestone": "Go Live Week 4"
        },
        "community_care": {
          "name": "Community Care",
          "status": "active",
          "weekly_hours": 5
        }
      }
    }
  }'::jsonb,
  now()
)
ON CONFLICT (user_i) DO UPDATE SET
  data = EXCLUDED.data,
  updated_at = now();

-- Log the migration
SELECT 'Routine data populated successfully for ntobeko-masemula-estate' as status;
