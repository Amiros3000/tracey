"""
routes/goals.py — Savings goals: create, track progress, update, delete.

Endpoints:
  GET    /goals          — list all goals for the user
  POST   /goals          — create a goal
  PATCH  /goals/{id}     — update fields (name, amounts, date, linked account)
  DELETE /goals/{id}     — delete permanently
"""

from fastapi import APIRouter, Depends, HTTPException

from auth import get_current_user
from database import get_db
from models import GoalCreate, GoalUpdate, GoalResponse

router = APIRouter()

_PATCHABLE = {"name", "target_amount", "current_amount", "target_date", "linked_account_id"}


def _get_or_404(db, goal_id: int, user_id: int):
    row = db.execute(
        "SELECT * FROM savings_goals WHERE id = ? AND user_id = ?",
        (goal_id, user_id),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Goal not found")
    return row


@router.get("", response_model=list[GoalResponse])
def list_goals(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Return all savings goals ordered by creation date."""
    rows = db.execute(
        "SELECT * FROM savings_goals WHERE user_id = ? ORDER BY created_at ASC",
        (current_user["id"],),
    ).fetchall()
    return [dict(r) for r in rows]


@router.post("", response_model=GoalResponse, status_code=201)
def create_goal(
    body: GoalCreate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Create a new savings goal."""
    db.execute(
        """INSERT INTO savings_goals
           (user_id, name, target_amount, current_amount, target_date, linked_account_id)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (
            current_user["id"], body.name, body.target_amount,
            body.current_amount, body.target_date, body.linked_account_id,
        ),
    )
    row_id = db.execute("SELECT last_insert_rowid()").fetchone()[0]
    return dict(db.execute("SELECT * FROM savings_goals WHERE id = ?", (row_id,)).fetchone())


@router.patch("/{goal_id}", response_model=GoalResponse)
def update_goal(
    goal_id: int,
    body: GoalUpdate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Update one or more fields of an existing goal."""
    _get_or_404(db, goal_id, current_user["id"])

    fields = {k: v for k, v in body.model_dump(exclude_unset=True).items() if k in _PATCHABLE}
    if not fields:
        raise HTTPException(status_code=400, detail="No valid fields to update")

    sets = ", ".join(f"{k} = ?" for k in fields)
    vals = list(fields.values()) + [goal_id, current_user["id"]]
    db.execute(
        f"UPDATE savings_goals SET {sets} WHERE id = ? AND user_id = ?",
        vals,
    )
    return dict(db.execute("SELECT * FROM savings_goals WHERE id = ?", (goal_id,)).fetchone())


@router.delete("/{goal_id}", status_code=204)
def delete_goal(
    goal_id: int,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Permanently delete a goal."""
    _get_or_404(db, goal_id, current_user["id"])
    db.execute(
        "DELETE FROM savings_goals WHERE id = ? AND user_id = ?",
        (goal_id, current_user["id"]),
    )
