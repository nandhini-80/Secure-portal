from sqlalchemy import Column, Integer, String

from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    name = Column(
        String,
        nullable=True
    )

    email = Column(
        String,
        unique=True,
        index=True,
        nullable=False
    )

    picture = Column(
        String,
        nullable=True
    )

    role = Column(
        String,
        nullable=False,
        default="viewer"
    )


class Content(Base):
    __tablename__ = "content"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    title = Column(
        String,
        nullable=False
    )

    description = Column(
        String,
        nullable=False
    )

    type = Column(
        String,
        nullable=False
    )

    category = Column(
        String,
        nullable=False
    )

    filename = Column(
        String,
        nullable=True
    )