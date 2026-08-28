"""Offline-first field notes synchronization API."""
import sqlite3
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel, Field

from config import settings


router = APIRouter(prefix="/field-notes", tags=["field-notes"])


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class FieldNote(BaseModel):
    id: str
    title: str
    details: str
    created_at: str
    updated_at: str
    version: int
    deleted_at: str | None = None


class NoteMutation(BaseModel):
    mutation_id: str = Field(min_length=1, max_length=128)
    note_id: str = Field(min_length=1, max_length=128)
    operation: Literal["upsert", "delete"]
    title: str = Field(default="", max_length=120)
    details: str = Field(default="", max_length=4000)
    base_version: int | None = Field(default=None, ge=1)
    client_updated_at: str


class SyncRequest(BaseModel):
    device_id: str = Field(min_length=1, max_length=128)
    cursor: int = Field(default=0, ge=0)
    mutations: list[NoteMutation] = Field(default_factory=list, max_length=50)


class SyncConflict(BaseModel):
    mutation_id: str
    note: FieldNote | None
    message: str


class SyncResponse(BaseModel):
    applied_mutation_ids: list[str]
    duplicate_mutation_ids: list[str]
    conflicts: list[SyncConflict]
    records: list[FieldNote]
    next_cursor: int


SCHEMA = """
CREATE TABLE IF NOT EXISTS field_notes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    details TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL,
    deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS field_note_mutations (
    mutation_id TEXT PRIMARY KEY,
    device_id TEXT NOT NULL,
    note_id TEXT NOT NULL,
    applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS field_note_changes (
    sequence INTEGER PRIMARY KEY AUTOINCREMENT,
    note_id TEXT NOT NULL,
    changed_at TEXT NOT NULL
);
"""


def connect() -> sqlite3.Connection:
    database_path = Path(settings.FIELD_NOTES_DB_PATH)
    database_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(database_path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.executescript(SCHEMA)
    return connection


def row_to_note(row: sqlite3.Row) -> FieldNote:
    return FieldNote(
        id=row["id"],
        title=row["title"],
        details=row["details"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        version=row["version"],
        deleted_at=row["deleted_at"],
    )


def changes_since(connection: sqlite3.Connection, cursor: int) -> tuple[list[FieldNote], int]:
    rows = connection.execute(
        """
        SELECT n.*, MAX(c.sequence) AS change_sequence
        FROM field_note_changes c
        JOIN field_notes n ON n.id = c.note_id
        WHERE c.sequence > ?
        GROUP BY n.id
        ORDER BY change_sequence ASC
        """,
        (cursor,),
    ).fetchall()
    records = [row_to_note(row) for row in rows]
    next_cursor = cursor
    if rows:
        next_cursor = max(row["change_sequence"] for row in rows)
    return records, next_cursor


@router.post("/sync", response_model=SyncResponse)
async def sync_field_notes(payload: SyncRequest) -> SyncResponse:
    """Apply queued device mutations and return changes after the device cursor."""
    applied_mutation_ids: list[str] = []
    duplicate_mutation_ids: list[str] = []
    conflicts: list[SyncConflict] = []

    with closing(connect()) as connection:
        with connection:
            for mutation in payload.mutations:
                existing_mutation = connection.execute(
                    "SELECT 1 FROM field_note_mutations WHERE mutation_id = ?",
                    (mutation.mutation_id,),
                ).fetchone()
                if existing_mutation:
                    duplicate_mutation_ids.append(mutation.mutation_id)
                    continue

                current_row = connection.execute(
                    "SELECT * FROM field_notes WHERE id = ?",
                    (mutation.note_id,),
                ).fetchone()

                if mutation.operation == "upsert" and current_row is None:
                    now = utc_now()
                    connection.execute(
                        """
                        INSERT INTO field_notes
                            (id, title, details, created_at, updated_at, version, deleted_at)
                        VALUES (?, ?, ?, ?, ?, 1, NULL)
                        """,
                        (mutation.note_id, mutation.title.strip(), mutation.details.strip(), now, now),
                    )
                    connection.execute(
                        "INSERT INTO field_note_changes (note_id, changed_at) VALUES (?, ?)",
                        (mutation.note_id, now),
                    )
                    connection.execute(
                        """
                        INSERT INTO field_note_mutations (mutation_id, device_id, note_id, applied_at)
                        VALUES (?, ?, ?, ?)
                        """,
                        (mutation.mutation_id, payload.device_id, mutation.note_id, now),
                    )
                    applied_mutation_ids.append(mutation.mutation_id)
                    continue

                current_note = row_to_note(current_row) if current_row else None
                if current_note is None or mutation.base_version != current_note.version:
                    conflicts.append(
                        SyncConflict(
                            mutation_id=mutation.mutation_id,
                            note=current_note,
                            message="The server has a newer version of this note.",
                        )
                    )
                    continue

                now = utc_now()
                next_version = current_note.version + 1
                if mutation.operation == "upsert":
                    connection.execute(
                        """
                        UPDATE field_notes
                        SET title = ?, details = ?, updated_at = ?, version = ?, deleted_at = NULL
                        WHERE id = ?
                        """,
                        (
                            mutation.title.strip(),
                            mutation.details.strip(),
                            now,
                            next_version,
                            mutation.note_id,
                        ),
                    )
                else:
                    connection.execute(
                        """
                        UPDATE field_notes
                        SET updated_at = ?, version = ?, deleted_at = ?
                        WHERE id = ?
                        """,
                        (now, next_version, now, mutation.note_id),
                    )

                connection.execute(
                    "INSERT INTO field_note_changes (note_id, changed_at) VALUES (?, ?)",
                    (mutation.note_id, now),
                )
                connection.execute(
                    """
                    INSERT INTO field_note_mutations (mutation_id, device_id, note_id, applied_at)
                    VALUES (?, ?, ?, ?)
                    """,
                    (mutation.mutation_id, payload.device_id, mutation.note_id, now),
                )
                applied_mutation_ids.append(mutation.mutation_id)

        records, next_cursor = changes_since(connection, payload.cursor)

    return SyncResponse(
        applied_mutation_ids=applied_mutation_ids,
        duplicate_mutation_ids=duplicate_mutation_ids,
        conflicts=conflicts,
        records=records,
        next_cursor=next_cursor,
    )
