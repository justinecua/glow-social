# Glow — guide for working in this codebase

Glow is a social app: Django REST backend (`backend/`) + React frontend (`frontend/`).
The owner is a learning developer. **Readable beats clever.** Boring, obvious, consistent
code is the goal: they should understand every line after one read.

## ⚠️ The database is LIVE

`backend/.env` points at `127.0.0.1:5433`, an SSH tunnel to the **production** Postgres.
There is no separate dev database.

- Never run anything that writes without asking first: inserts, updates, deletes,
  `migrate`, data scripts, or "test" sign-ups — not even inside a rolled-back transaction.
- Verify with read-only queries, `pyflakes`, `python manage.py check`,
  `python manage.py makemigrations --check --dry-run`, and ESLint.
- Management commands that post or send things have `--dry-run`. Use it.

## Backend layers (one job per file)

```
urls.py      which URL goes to which view
views.py     HTTP only: read the request, call ONE function, return a Response
queries.py   the work: raw SQL and validation (some apps name it services.py)
models.py    schema only, used for migrations — never for queries
```

- A view never contains SQL. A query function never builds a `Response`.
- Bigger features get their own module (e.g. `posts/posting.py`, `posts/bots/`).
- Errors the user should see: raise a small exception (`PostError`, `ChatError`,
  `CommentError`...) in the work module; the view turns it into a 400/403/404.

## Rules

1. **Raw SQL only. No Django ORM** (`Model.objects`, `.save()`, `.delete()`,
   `select_related`, `get_or_create`...). Use the helpers in `GlowProject/db.py`:
   `fetch_all`, `fetch_one`, `fetch_value`, `fetch_column`, `fetch_tuples`,
   `execute`, `execute_many`.
2. **Values always go in `%s` / `%(name)s` params**, never f-strings. f-strings are only
   for fixed SQL pieces defined in code (column lists, shared fragments).
3. **Table names are always `glow.glow.<app>_<model>`** (e.g. `glow.glow.posts_post`).
4. **Foreign keys are `NO ACTION` in the database.** Django used to cascade in Python;
   raw SQL doesn't. When deleting, remove child rows first, in one `transaction.atomic()`.
   Copy the pattern in `posts/queries.py` (`DELETE_POST`) and `accounts/account_data.py`.
   If you add a table that points at accounts or posts, add it to those delete lists.
5. **New `NOT NULL` columns need a value in every raw `INSERT`.** Django's `default=`
   only applies to ORM inserts. (Sign-up once broke because of this.) Check required
   columns with `information_schema.columns` before writing an insert.
6. **Multi-step writes go in `transaction.atomic()`.**
7. **Don't catch broad exceptions.** Let errors raise (Django logs them, returns 500).
   Only exception: Redis/channel-layer calls may catch `Exception` and must
   `log.warning(...)`, never silently pass. Catch the specific error you expect otherwise.
8. **Never trust ids from the client** for "who is acting". Use
   `current_account_id(request)` (from `accounts.auth_utils`). For public pages use
   `viewer_account_id(request)`; `require_self(request, id)` when the URL holds your id.
9. **Post visibility:** any query that returns posts must use `visible_sql(viewer_id)`
   or `can_view_post(post_id, viewer_id)` from `posts/visibility.py`.
10. **Validate input** (length, ints via `str(x).isdigit()`, allowed values) before SQL,
    so bad input returns 400 instead of a database error.

## Style

- All imports at the top of the file. No imports inside functions.
- **No docstrings and no comment blocks.** Only short comments at the END of a line,
  only to explain *why*. SQL may use `-- comments` at line ends.
- `snake_case` function names that say what they do (`find_own_post`, `count_unread`).
- Say it once: before writing a helper, search for an existing one.

## Shared helpers — reuse these, don't copy them

| Need | Use |
|---|---|
| Friends of an account | `friends.queries.friend_ids`, `are_friends` |
| Create a notification | `notifications.queries.create_notification` |
| Live-update someone's notification badge | `notifications.queries.push_notifications` |
| Push any realtime event | `async_to_sync(get_channel_layer().group_send)(f"user_{id}", {...})` + a handler in `realtime/consumers.py` |
| "5 mins ago" text | `posts.queries.time_ago` |
| Save / delete an uploaded image | `GlowProject.media.read_image`, `save_image`, `delete_media` |
| Create a post, tags, photos | `posts.queries.insert_post`, `add_tags`, `add_photo` |
| Bot accounts | `posts.queries.bot_account_id` |
| Clear Explore cache after post changes | `posts.discover.bump_explore` |

## Media

- Uploads are stored on our own server (`MEDIA_ROOT`, served at `/media/` by nginx).
  **No third-party image hosts** (ImageKit was removed).
- Store links **relative** (`/media/...`), never with a host. Vite proxies `/media` in dev.

## Frontend

- React 18 + Vite, JavaScript (no TypeScript), Tailwind v4, shadcn-style components in
  `src/components/ui/`, icons from `lucide-react`, toasts from `sonner`.
- Feature code lives in `src/features/<feature>/`.
- API calls use RTK Query: `api.injectEndpoints(...)` in `src/redux/services/`
  (base query in `redux/services/auth/token.js` handles cookies and token refresh).
- **Never use AI-style icons** (Sparkles, wand, bot, ✨) anywhere in the UI.
- Search the frontend before changing any API URL or response shape.

## Adding a feature — checklist

1. Read the closest existing feature first and copy its shape.
2. Model in `models.py` → `makemigrations` (don't run `migrate`; ask, it hits the live DB).
3. SQL in `queries.py` using the db helpers; validation in the same module.
4. Thin views; URLs in the app's `urls.py`; include it in `GlowProject/urls.py`.
5. Permissions: `IsAuthenticated` unless the page is public; actor from
   `current_account_id`; posts filtered with `visible_sql`.
6. If the feature deletes things or adds a table linked to accounts/posts, update the
   delete lists (rule 4) and the data export in `accounts/account_data.py`.
7. Frontend: RTK Query endpoint in `redux/services/`, UI in `features/<feature>/`.
8. Verify: `pyflakes`, `manage.py check`, `makemigrations --check`, ESLint,
   read-only requests. List anything you couldn't test because it would write.

## Git

- The owner handles git. Suggest branch names and commit messages; only run git
  commands when explicitly asked.
- Branches are named `dev-<short-description>` and merged into `staging` via pull requests.
- Never add `Co-Authored-By` or any AI attribution to commits or PRs.
