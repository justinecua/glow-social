from django.utils import timezone

from GlowProject.db import fetch_tuples

CHALLENGES = {  # weekday (Monday = 0) -> recurring photo challenge
    0: ("Monday mood: show us how your week is starting 📸", "MondayMood"),
    2: ("View from here: post what's in front of you right now 🌇", "ViewFromHere"),
    4: ("Food Friday! What are you eating today? 🍜", "FoodFriday"),
    5: ("OOTD Saturday: show off today's fit 👟", "OOTD"),
    6: ("Sunday throwback: an old photo and the story behind it 🕰️", "SundayThrowback"),
}

PROMPTS = [  # other days rotate through these
    ("What made you smile today?", "SmileToday"),
    ("What are you listening to right now? 🎧", "NowPlaying"),
    ("One small win you had this week 🏆", "SmallWins"),
    ("Recommend a show, game or book to everyone", "Recommend"),
    ("Describe your day in 3 emojis", "3Emojis"),
    ("What's a skill you want to learn this year?", "LearnThis"),
    ("Show us your pet (or your dream pet) 🐾", "PetPics"),
    ("Your go-to merienda? 🍢", "Merienda"),
    ("Desk or workspace check 💻", "DeskSetup"),
    ("What's on your weekend plans list?", "WeekendPlans"),
    ("Best advice someone ever gave you", "BestAdvice"),
    ("Hometown pride: what's your province known for? 🇵🇭", "HometownPride"),
]


def today_prompt():
    today = timezone.localdate()
    if today.weekday() in CHALLENGES:
        text, tag = CHALLENGES[today.weekday()]
        kind = "challenge"
    else:
        text, tag = PROMPTS[today.toordinal() % len(PROMPTS)]
        kind = "prompt"

    start = timezone.make_aware(timezone.datetime.combine(today, timezone.datetime.min.time()))
    rows = fetch_tuples(  # who answered today: public posts with the tag, newest first
        """
        SELECT p.account_id, u.username, a.profile_photo
        FROM glow.glow.posts_post p
        JOIN glow.glow.posts_tag_post tp ON tp.post_id = p.id
        JOIN glow.glow.posts_tag t ON t.id = tp.tag_id
        JOIN glow.glow.accounts_account a ON a.id = p.account_id
        JOIN glow.glow.auth_user u ON u.id = a.auth_user_id
        LEFT JOIN glow.glow.posts_audience aud ON aud.id = p.audience_id
        WHERE LOWER(t.tag) = LOWER(%s) AND p."dateTime" >= %s
          AND COALESCE(aud.key, 'public') = 'public'
        ORDER BY p."dateTime" DESC
        """,
        (tag, start),
    )

    seen, people = set(), []
    for account_id, username, photo in rows:
        if account_id not in seen:
            seen.add(account_id)
            people.append({"id": account_id, "username": username, "profile_photo": photo or ""})
    return {
        "date": today.isoformat(),
        "kind": kind,
        "text": text,
        "tag": tag,
        "count": len(rows),
        "people": people[:3],
    }
