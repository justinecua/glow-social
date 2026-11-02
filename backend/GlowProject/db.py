"""Tiny helpers for raw SQL.

Each one opens a cursor, runs the query and closes the cursor for you.
Errors are not caught: they raise, Django logs the traceback and the
request returns a 500. Wrap several writes in `transaction.atomic()` when
they must succeed or fail together.

    from GlowProject.db import fetch_all, fetch_one, fetch_value, execute

    rows  = fetch_all("SELECT id, caption FROM posts_post WHERE account_id = %s", [me])
    row   = fetch_one("SELECT * FROM posts_post WHERE id = %s", [post_id])   # dict or None
    total = fetch_value("SELECT COUNT(*) FROM posts_post")                    # one value
    new_id = fetch_value("INSERT INTO ... RETURNING id", [...])
    changed = execute("UPDATE ... WHERE id = %s", [post_id])                  # rows affected

Always pass values as %s params, never format them into the SQL string.
"""

from django.db import connection


def _blank(value):
    return "" if value is None else value


def fetch_all(sql, params=None, blank_nulls=False):
    """All rows as a list of dicts. `blank_nulls=True` turns NULL into ""."""
    with connection.cursor() as cursor:
        cursor.execute(sql, params)
        columns = [c[0] for c in cursor.description]
        rows = cursor.fetchall()
    if blank_nulls:
        return [{c: _blank(v) for c, v in zip(columns, row)} for row in rows]
    return [dict(zip(columns, row)) for row in rows]


def fetch_one(sql, params=None, blank_nulls=False):
    """The first row as a dict, or None."""
    rows = fetch_all(sql, params, blank_nulls)
    return rows[0] if rows else None


def fetch_value(sql, params=None, default=None):
    """The first column of the first row (COUNT(*), RETURNING id, ...)."""
    with connection.cursor() as cursor:
        cursor.execute(sql, params)
        row = cursor.fetchone()
    return row[0] if row else default


def fetch_column(sql, params=None):
    """The first column of every row, as a list."""
    with connection.cursor() as cursor:
        cursor.execute(sql, params)
        return [row[0] for row in cursor.fetchall()]


def fetch_tuples(sql, params=None):
    """All rows as plain tuples (for unpacking: `for a, b in fetch_tuples(...)`)."""
    with connection.cursor() as cursor:
        cursor.execute(sql, params)
        return cursor.fetchall()


def execute(sql, params=None):
    """Run INSERT/UPDATE/DELETE. Returns the number of rows affected."""
    with connection.cursor() as cursor:
        cursor.execute(sql, params)
        return cursor.rowcount


def execute_many(sql, param_list):
    """Run the same statement once per params tuple."""
    with connection.cursor() as cursor:
        cursor.executemany(sql, param_list)
